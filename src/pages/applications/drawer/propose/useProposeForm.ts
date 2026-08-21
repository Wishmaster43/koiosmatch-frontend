/**
 * useProposeForm — all state + side effects behind ProposeCandidateModal (§3A:
 * logic in hooks, no JSX here). Loads the customer's contacts and the FULL
 * candidate record (the CV needs it), holds the form fields, prefills subject/
 * body from the tenant's proposal templates (token interpolation), and drives
 * submit(): CV download + POST /applications/{id}/propose (the real recording
 * endpoint) + an optional funnel-phase move.
 *
 * Koios still never SENDS anything itself — the propose endpoint only records
 * the proposal (recipient, cv variant, drafted subject/body), so submit()
 * downloads a PDF client-side and records what happened; it never claims a
 * message went out. That is a MAIL-PROVIDER gap, not a link gap: the share link
 * itself shipped, and ProposalsBlock hands it to the recruiter to send.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useLookups } from '@/context/LookupsContext'
import { useCvSettings } from '@/lib/useCvSettings'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { useLocale } from '@/lib/datetime'
import { mapCandidate } from '@/pages/candidates/shared'
import { buildProposalCvBlob } from '@/lib/proposalCv'
import type { CvCandidate } from '@/pages/candidates/shared'
import type { ApplicationDetail } from '@/types/application'
import type { Candidate } from '@/types/candidate'

// `function` is optional — the fallback recipient built from `application.contact`
// (ApplicationDetailResource::contact() only sends id/name/email/phone) never
// carries one; contactOptionLabel degrades to the bare name with no dangling
// separator when it's absent.
export interface ProposeContact { id: string; name: string; email: string; phone?: string; function?: string }
export type CvVariant = 'proposal' | 'full'
export type ProposeDisabledReason = 'loading' | 'noCandidate' | 'noContact' | 'noConsent' | null

// Tenant settings for the propose flow — JSON group 'application_proposal',
// shared contract with the sibling CV+SETTINGS agent (Settings screen owns writes).
interface ApplicationProposalSettings {
  subject_template?: string
  body_template?: string
  sets_phase?: boolean
  default_cv_variant?: CvVariant
}

// Fixed token names ({kandidaat} {vacature} {klant} {contact} {recruiter}) per
// the shared contract — literal, never translated, so a tenant's own template
// text works the same regardless of the recruiter's UI language.
function fillTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{(kandidaat|vacature|klant|contact|recruiter)\}/g, (_m, key: string) => tokens[key] ?? '')
}

export function useProposeForm(application: ApplicationDetail) {
  const { t } = useTranslation(['applications', 'common'])
  const locale = useLocale()
  // To invalidate the proposals-history query (ProposalsBlock) after a
  // successful record, so the new entry shows up without a manual reload.
  const queryClient = useQueryClient()
  // Funnel stages, resolved BY FLAG (never a bare literal) — is_proposal is now
  // emitted by the API (PROPOSE-FLAG-EXPOSE-1 shipped); the 'proposal' value
  // fallback stays only for tenants whose lookup data predates the flag.
  const { funnelTypes } = useLookups() as unknown as { funnelTypes: Array<{ value: string; label: string; is_proposal?: boolean }> }
  const { settings: cvSettings } = useCvSettings() as { settings?: unknown }
  const settingsValues = useAllSettings()
  const proposalSettings = getJsonSetting<ApplicationProposalSettings>(settingsValues, 'application_proposal', {})

  // Contacts — a direct fetch rather than useCustomerCascade: that shared hook
  // exposes no loading flag, and this form must show an honest loading/error/
  // empty state (§3) for the recipient picker.
  const [contacts, setContacts] = useState<ProposeContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactsError, setContactsError] = useState(false)

  useEffect(() => {
    const customerId = application.customerId
    if (!customerId) { setContactsLoading(false); return }
    let alive = true
    setContactsLoading(true); setContactsError(false)
    api.get(`/customers/${customerId}`)
      .then(r => {
        if (!alive) return
        const raw = ((unwrap(r) as { contacts?: Array<{ id?: string; name?: string; email?: string; phone?: string; function?: string }> })?.contacts) ?? []
        // CustomerContactResource sends `function` (CustomerContactResource.php:43) —
        // carried through so the recipient picker can distinguish same-named contacts.
        setContacts(raw.map(c => ({ id: String(c.id ?? ''), name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '', function: c.function ?? '' })))
      })
      .catch(() => { if (alive) setContactsError(true) })
      .finally(() => { if (alive) setContactsLoading(false) })
    return () => { alive = false }
  }, [application.customerId])

  // The FULL candidate record — the application only carries a trimmed summary,
  // but the CV template needs the real record. Alive-guarded (mirrors CandidateTab).
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [candidateLoading, setCandidateLoading] = useState(true)
  const [candidateError, setCandidateError] = useState(false)

  useEffect(() => {
    const candidateId = application.candidateId
    if (!candidateId) { setCandidateLoading(false); return }
    let alive = true
    setCandidateLoading(true); setCandidateError(false)
    api.get(`/candidates/${candidateId}`)
      .then(r => { if (alive) setCandidate(mapCandidate(unwrap(r))) })
      .catch(() => { if (alive) setCandidateError(true) })
      .finally(() => { if (alive) setCandidateLoading(false) })
    return () => { alive = false }
  }, [application.candidateId])

  // Form fields. Recipient defaults to the application's own contact when present.
  const [recipientContactId, setRecipientContactId] = useState<string>(application.contact?.id != null ? String(application.contact.id) : '')
  const [cvVariant, setCvVariant] = useState<CvVariant>(proposalSettings.default_cv_variant === 'full' ? 'full' : 'proposal')
  const [includeMotivation, setIncludeMotivation] = useState(false)
  const [subject, setSubjectState] = useState('')
  const [body, setBodyState] = useState('')
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  // V-appdetail-5: the freshly recorded proposal's own recipient-facing link —
  // handed straight to the recruiter after submit() succeeds, so they never have
  // to go hunting for it in the ProposalsBlock history below.
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current) }, [])

  // DEFECT 2 (2026-07): track whether the recruiter has manually touched subject/
  // body. Wrapping the setters (rather than the raw useState ones) means every
  // caller outside this hook is a manual edit; the auto-fill effect below reads
  // this ref and, once true, never overwrites their words again.
  const dirtyRef = useRef(false)
  const setSubject = (value: string) => { dirtyRef.current = true; setSubjectState(value) }
  const setBody = (value: string) => { dirtyRef.current = true; setBodyState(value) }

  // The picked contact, falling back to the application's carried contact when
  // the fresh customer fetch hasn't resolved (or failed) yet.
  const recipient: ProposeContact | null = contacts.find(c => c.id === recipientContactId)
    ?? (application.contact?.id != null && String(application.contact.id) === recipientContactId
      ? { id: String(application.contact.id), name: application.contact.name, email: application.contact.email, phone: application.contact.phone }
      : null)

  // DEFECT 2 fix: re-run the template fill whenever the RESOLVED RECIPIENT
  // changes — picking or switching the contact must update the greeting, so the
  // recorded/copied message never addresses the previous contact while submit()
  // registers the new one. Guarded by dirtyRef: once the recruiter has edited
  // subject/body themselves, their words are never overwritten again. With no
  // recipient yet, the fill is skipped entirely rather than resolving {contact}
  // to an empty string — a bare "Beste ," reads worse than a still-empty field,
  // and submit() is disabled without a recipient anyway (see disabledReason).
  useEffect(() => {
    if (dirtyRef.current || !recipient) return
    const tokens = {
      kandidaat: application.candidateName ?? '',
      vacature: application.vacancyTitle ?? '',
      klant: application.client ?? '',
      contact: recipient.name,
      recruiter: application.owner?.name ?? '',
    }
    const subjectTpl = proposalSettings.subject_template || t('propose.defaultSubject')
    const bodyTpl = proposalSettings.body_template || t('propose.defaultBody')
    setSubjectState(fillTemplate(subjectTpl, tokens))
    setBodyState(fillTemplate(bodyTpl, tokens))
    // Deliberately keyed on the recipient's own identity, not the whole
    // `application`/`proposalSettings` objects (a new identity every render
    // would re-fire this on every keystroke elsewhere) or `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient?.id, recipient?.name])

  const hasMotivation = Boolean(application.coverLetter)

  // Why the primary action is disabled — the modal renders this, never a bare
  // greyed-out button with no explanation (§3 no fake affordances).
  const disabledReason: ProposeDisabledReason =
    (candidateLoading || contactsLoading) ? 'loading'
    : !candidate ? 'noCandidate'
    : !recipient ? 'noContact'
    : !consentConfirmed ? 'noConsent'
    : null

  // Copy the drafted subject + a plain-text version of the (rich-text) body.
  // The message as it is actually shared: the drafted body, plus the candidate's
  // own motivation letter appended when the recruiter ticked it. Without this the
  // "motivatiebrief meesturen" checkbox changed nothing at all — the /propose
  // contract has no field for it, so the letter travels inside the message body
  // (§3: a control must have a real effect, or not exist).
  const composedBody = () => (includeMotivation && application.coverLetter
    ? `${body}<hr />${application.coverLetter}`
    : body)

  const copyMessage = async () => {
    const plainBody = composedBody().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${plainBody}`)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      notifyError(t('common:actionFailed'))
    }
  }

  // submit(): RECORD the proposal via the real backend endpoint FIRST, only
  // then download the CV, and (only when the tenant setting is on) move the
  // funnel phase. Any failing step surfaces the server message and returns
  // false — never a false "sent"/"recorded" claim.
  const submit = async (): Promise<boolean> => {
    if (disabledReason || !candidate || submitting) return false
    setSubmitting(true)
    try {
      // 1. Record the proposal via the real endpoint (gate applications.update)
      // BEFORE anything leaves the app (DEFECT 3, §8): recipient, cv variant and
      // the drafted subject/body. This only RECORDS the proposal; the backend
      // does not send an e-mail itself. If this fails (403/422), no CV full of
      // special-category data has left the recruiter's browser — the AVG trail
      // never has a gap.
      const res = await api.post(`/applications/${application.id}/propose`, {
        contact_id: recipientContactId,
        cv_variant: cvVariant,
        subject,
        // The recorded body is what was actually shared, motivation letter included
        // when ticked — so the proposal history matches what the customer received.
        body: composedBody(),
      })
      // V-appdetail-5: PROPOSE-SHARE-LINK-1 shipped — the response's own record
      // carries the same recipient-facing share_url ProposalsBlock renders (never
      // logged, §8 — only handed into component state for the copy affordance).
      const created = unwrap<{ share_url?: string | null }>(res)
      setShareUrl(created?.share_url ?? null)
      // Refresh the proposals-history block (ProposalsBlock shares this query
      // key) so the freshly recorded proposal appears without a manual reload.
      queryClient.invalidateQueries({ queryKey: ['applications', application.id, 'proposals'] })

      // 2. Only once the record succeeded, generate + download the CV PDF
      // client-side — same blob → object-URL → <a download> pattern as
      // CandidateHeaderBits' downloadCv, no server round-trip.
      const blob = await buildProposalCvBlob({ candidate: candidate as unknown as CvCandidate, settings: cvSettings as never, locale, t, variant: cvVariant })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `CV - ${candidate.name ?? 'candidate'}.pdf`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      // Defer the revoke — revoking the object URL synchronously right after
      // click() can cancel the download in some browsers (DEFECT 3).
      setTimeout(() => URL.revokeObjectURL(url), 0)

      // 3. Move the funnel phase to the is_proposal stage — only when the tenant
      // opted in via Settings (application_proposal.sets_phase).
      if (proposalSettings.sets_phase) {
        const proposalStage = funnelTypes.find(f => f.is_proposal) ?? funnelTypes.find(f => f.value === 'proposal')
        if (proposalStage) await api.patch(`/applications/${application.id}`, { phase_key: proposalStage.value })
      }

      notifySuccess(t('propose.recorded'))
      return true
    } catch (err) {
      notifyError(extractApiError(err, t('common:actionFailed')))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // V-appdetail-5: copy the recorded share link only — never the message body/
  // subject, and the URL itself never reaches a log or toast (§8).
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const shareLinkCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (shareLinkCopyTimerRef.current) clearTimeout(shareLinkCopyTimerRef.current) }, [])
  const copyShareLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareLinkCopied(true)
      if (shareLinkCopyTimerRef.current) clearTimeout(shareLinkCopyTimerRef.current)
      shareLinkCopyTimerRef.current = setTimeout(() => setShareLinkCopied(false), 2000)
    } catch {
      notifyError(t('common:actionFailed'))
    }
  }

  return {
    contacts, contactsLoading, contactsError,
    candidateLoading, candidateError,
    recipientContactId, setRecipientContactId, recipient,
    cvVariant, setCvVariant,
    includeMotivation, setIncludeMotivation, hasMotivation,
    subject, setSubject, body, setBody,
    consentConfirmed, setConsentConfirmed,
    disabledReason, submitting, submit,
    copyMessage, copied,
    shareUrl, copyShareLink, shareLinkCopied,
  }
}
