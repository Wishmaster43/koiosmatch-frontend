import { useState, type FormEvent } from 'react'
import { strings } from '../strings'
import { validateCvFile } from '../lib/validateFile'
import { useApplySubmit } from '../hooks/useApplySubmit'

interface ApplyFormProps {
  tenant: string
  reference: string
}

interface FieldErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  cv?: string
  consent?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The public application form: required contact fields, an optional CV upload
// (client-validated, backend re-checks), a hidden honeypot, and a mandatory
// AVG consent checkbox that gates the actual network call — checking the box
// alone does not "unlock" anything; submitting without it blocks before any
// request is sent (CLAUDE.md §8: public PII collection needs an explicit consent gate).
export function ApplyForm({ tenant, reference }: ApplyFormProps) {
  const { status, errorMessage, reference: appliedReference, submit } = useApplySubmit(tenant, reference)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [motivation, setMotivation] = useState('')
  const [cv, setCv] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  // Honeypot — invisible to real visitors; a bot filling this in tells the backend to reject.
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  if (status === 'success') {
    return (
      <p className="state-notice state-notice--success" role="status">
        {strings.apply.success(appliedReference ?? '')}
      </p>
    )
  }

  // Client-side CV check (UX only) — accepts or clears the file and stores the reason.
  const handleFile = (file: File | null) => {
    if (!file) {
      setCv(null)
      setErrors((prev) => ({ ...prev, cv: undefined }))
      return
    }
    const message = validateCvFile(file)
    setErrors((prev) => ({ ...prev, cv: message ?? undefined }))
    setCv(message ? null : file)
  }

  // Required-field + consent validation, run on submit (never blocks typing).
  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!firstName.trim()) next.firstName = strings.apply.validation.required
    if (!lastName.trim()) next.lastName = strings.apply.validation.required
    if (!email.trim()) next.email = strings.apply.validation.required
    else if (!EMAIL_PATTERN.test(email)) next.email = strings.apply.validation.email
    if (!phone.trim()) next.phone = strings.apply.validation.required
    if (!consent) next.consent = strings.apply.validation.consent
    return next
  }

  // Blocks the actual apply() call — and therefore the network request — until
  // every required field is filled and consent is given.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    void submit({ firstName, lastName, email, phone, motivation, cv, website })
  }

  return (
    <form className="apply-form" onSubmit={handleSubmit} noValidate>
      <h2>{strings.apply.heading}</h2>

      <label className="apply-form__field">
        <span>{strings.apply.firstName}</span>
        <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        {errors.firstName ? <span className="field-error">{errors.firstName}</span> : null}
      </label>

      <label className="apply-form__field">
        <span>{strings.apply.lastName}</span>
        <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
        {errors.lastName ? <span className="field-error">{errors.lastName}</span> : null}
      </label>

      <label className="apply-form__field">
        <span>{strings.apply.email}</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        {errors.email ? <span className="field-error">{errors.email}</span> : null}
      </label>

      <label className="apply-form__field">
        <span>{strings.apply.phone}</span>
        <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
      </label>

      <label className="apply-form__field">
        <span>{strings.apply.motivation}</span>
        <textarea value={motivation} onChange={(event) => setMotivation(event.target.value)} rows={4} />
      </label>

      <label className="apply-form__field">
        <span>{strings.apply.cv}</span>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />
        {errors.cv ? <span className="field-error">{errors.cv}</span> : null}
      </label>

      {/* Honeypot: visually + semantically hidden. Real visitors never see or fill it. */}
      <div className="hp-field" aria-hidden="true">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <label className="apply-form__consent">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>{strings.apply.consentLabel}</span>
      </label>
      {errors.consent ? <span className="field-error" role="alert">{errors.consent}</span> : null}

      {status === 'error' && errorMessage ? (
        <p className="field-error" role="alert">{errorMessage}</p>
      ) : null}

      <button type="submit" className="btn btn--primary" disabled={status === 'submitting'}>
        {status === 'submitting' ? strings.apply.submitting : strings.apply.submit}
      </button>
    </form>
  )
}
