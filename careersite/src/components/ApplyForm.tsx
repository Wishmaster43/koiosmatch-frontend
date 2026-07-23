import { useState, type FormEvent } from 'react'
import { strings } from '../strings'
import { validateCvFile } from '../lib/validateFile'
import { validatePhotoFile } from '../lib/validatePhotoFile'
import { validateMotivationLength, getPlainTextLength } from '../lib/richText'
import { validateRemarksLength } from '../lib/remarks'
import { useApplySubmit } from '../hooks/useApplySubmit'
import { RichTextArea } from './RichTextArea'
import { PersonalFields, type PersonalFieldsValues } from './apply/PersonalFields'
import { AddressFields, type AddressFieldsValues } from './apply/AddressFields'
import { PhotoField } from './apply/PhotoField'
import { ExperienceList } from './apply/ExperienceList'
import { EducationList } from './apply/EducationList'
import { RemarksField } from './apply/RemarksField'
import { DEFAULT_COUNTRY_CODE, dialCodeFor } from './apply/countryCodes'
import type { ApplicationSettings, EducationEntry, ExperienceEntry } from '../types'

interface ApplyFormProps {
  tenant: string
  reference: string
  // Per-vacancy field visibility (CAREERSITE-APPLY-2) — the parent resolves this
  // through lib/applySettings.ts, so this component never has to guess defaults.
  applicationSettings: ApplicationSettings
}

interface FieldErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  motivation?: string
  cv?: string
  photo?: string
  remarks?: string
  consent?: string
  interviewConsent?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The public application form (formulier-v2): required contact fields, an
// address block, settings-aware CV/motivation/photo/remarks fields, repeatable
// work-experience and education entries, a hidden honeypot, and two consent
// gates (interview + AVG) that block the actual network call — checking either
// box alone never "unlocks" anything; submitting without a required one blocks
// before any request is sent (CLAUDE.md §8).
export function ApplyForm({ tenant, reference, applicationSettings }: ApplyFormProps) {
  const { status, errorMessage, reference: appliedReference, submit } = useApplySubmit(tenant, reference)
  const [personal, setPersonal] = useState<PersonalFieldsValues>({
    firstName: '',
    lastName: '',
    email: '',
    countryCode: DEFAULT_COUNTRY_CODE,
    phone: '',
  })
  const [address, setAddress] = useState<AddressFieldsValues>({
    street: '',
    houseNumber: '',
    postcode: '',
    city: '',
  })
  const [motivation, setMotivation] = useState('')
  const [cv, setCv] = useState<File | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [remarks, setRemarks] = useState('')
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([])
  const [educations, setEducations] = useState<EducationEntry[]>([])
  const [interviewConsent, setInterviewConsent] = useState(false)
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
  const handleCvFile = (file: File | null) => {
    if (!file) {
      setCv(null)
      setErrors((prev) => ({ ...prev, cv: undefined }))
      return
    }
    const message = validateCvFile(file)
    setErrors((prev) => ({ ...prev, cv: message ?? undefined }))
    setCv(message ? null : file)
  }

  // Client-side photo check (UX only) — same pattern as the CV field above.
  const handlePhotoFile = (file: File | null) => {
    if (!file) {
      setPhoto(null)
      setErrors((prev) => ({ ...prev, photo: undefined }))
      return
    }
    const message = validatePhotoFile(file)
    setErrors((prev) => ({ ...prev, photo: message ?? undefined }))
    setPhoto(message ? null : file)
  }

  // Required-field + settings-driven required + consent validation, run on submit.
  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!personal.firstName.trim()) next.firstName = strings.apply.validation.required
    if (!personal.lastName.trim()) next.lastName = strings.apply.validation.required
    if (!personal.email.trim()) next.email = strings.apply.validation.required
    else if (!EMAIL_PATTERN.test(personal.email)) next.email = strings.apply.validation.email
    if (!personal.phone.trim()) next.phone = strings.apply.validation.required

    if (applicationSettings.cover_letter === 'required' && getPlainTextLength(motivation) === 0) {
      next.motivation = strings.apply.validation.required
    } else {
      const motivationError = validateMotivationLength(motivation)
      if (motivationError) next.motivation = motivationError
    }

    if (applicationSettings.cv === 'required' && !cv) next.cv = strings.apply.validation.required
    if (applicationSettings.photo === 'required' && !photo) next.photo = strings.apply.validation.required

    const remarksError = validateRemarksLength(remarks)
    if (remarksError) next.remarks = remarksError
    else if (applicationSettings.remarks === 'required' && !remarks.trim()) next.remarks = strings.apply.validation.required

    if (!consent) next.consent = strings.apply.validation.consent
    if (applicationSettings.interview_consent === 'required' && !interviewConsent) {
      next.interviewConsent = strings.apply.validation.interviewConsentRequired
    }

    return next
  }

  // Blocks the actual apply() call — and therefore the network request — until
  // every required field is filled and both applicable consents are given.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    void submit({
      firstName: personal.firstName,
      lastName: personal.lastName,
      email: personal.email,
      // Joins the selected country's dial code with the typed local number
      // verbatim (no leading-zero stripping) into the single `phone` field.
      phone: `+${dialCodeFor(personal.countryCode)}${personal.phone.trim()}`,
      motivation,
      cv,
      street: address.street,
      houseNumber: address.houseNumber,
      postcode: address.postcode,
      city: address.city,
      photo,
      remarks,
      experiences,
      educations,
      website,
    })
  }

  return (
    <form className="apply-form" onSubmit={handleSubmit} noValidate>
      <h2>{strings.apply.heading}</h2>

      <PersonalFields
        values={personal}
        errors={errors}
        onChange={(patch) => setPersonal((prev) => ({ ...prev, ...patch }))}
      />

      <AddressFields values={address} onChange={(patch) => setAddress((prev) => ({ ...prev, ...patch }))} />

      {applicationSettings.cover_letter !== 'hidden' ? (
        <>
          <RichTextArea
            id="apply-motivation"
            label={strings.apply.motivation}
            value={motivation}
            onChange={setMotivation}
            required={applicationSettings.cover_letter === 'required'}
          />
          {errors.motivation ? <span className="field-error">{errors.motivation}</span> : null}
        </>
      ) : null}

      {applicationSettings.cv !== 'hidden' ? (
        <label className="apply-form__field">
          <span className={applicationSettings.cv === 'required' ? 'required-marker' : undefined}>
            {strings.apply.cv}
          </span>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-required={applicationSettings.cv === 'required' || undefined}
            onChange={(event) => handleCvFile(event.target.files?.[0] ?? null)}
          />
          {errors.cv ? <span className="field-error">{errors.cv}</span> : null}
        </label>
      ) : null}

      {applicationSettings.photo !== 'hidden' ? (
        <PhotoField
          photo={photo}
          onFileChange={handlePhotoFile}
          error={errors.photo}
          required={applicationSettings.photo === 'required'}
        />
      ) : null}

      <ExperienceList entries={experiences} onChange={setExperiences} />
      <EducationList entries={educations} onChange={setEducations} />

      {applicationSettings.remarks !== 'hidden' ? (
        <RemarksField
          value={remarks}
          onChange={setRemarks}
          error={errors.remarks}
          required={applicationSettings.remarks === 'required'}
        />
      ) : null}

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

      {applicationSettings.interview_consent !== 'hidden' ? (
        <>
          <label className="apply-form__consent">
            <input
              type="checkbox"
              checked={interviewConsent}
              onChange={(event) => setInterviewConsent(event.target.checked)}
            />
            <span>{strings.apply.interviewConsent.label}</span>
          </label>
          {errors.interviewConsent ? (
            <span className="field-error" role="alert">{errors.interviewConsent}</span>
          ) : null}
        </>
      ) : null}

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
