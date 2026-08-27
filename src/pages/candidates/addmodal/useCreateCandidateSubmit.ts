/**
 * useCreateCandidateSubmit — the "+ Kandidaat" create form's submit/payload
 * builder: required + live-format validation, the create POST body, the
 * create call, and 409/422 error mapping. Extracted verbatim (§3 size split,
 * > ~400-line trigger on AddCandidateModal.tsx) — behaviour unchanged, only
 * wired through explicit params/returns instead of closure. Mirrors
 * useAddVacancySubmit's error-state-ownership lesson: error state stays in
 * the modal, only the setters are injected here.
 */
import type { TFunction } from 'i18next'
import { toLinkedinSlug } from '@/components/drawer/contactLinks'
import { canonicalPhone } from '@/lib/phoneNumber'
import type { Candidate } from '@/types/candidate'
import type { FormState } from '../AddCandidateModal'
import type { DuplicateMatch } from './useDuplicateProbe'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  first_name: 'firstName', last_name: 'lastName', middle_name: 'middleName',
  email: 'email', phone: 'phone', mobile: 'mobile', function_title: 'functionTitle',
  date_of_birth: 'dateOfBirth', gender: 'gender',
  street: 'street', house_number: 'houseNumber',
  house_number_suffix: 'houseNumberSuffix', postal_code: 'postalCode',
  city: 'city', province: 'province', country: 'country', owner_id: 'ownerId',
  // CONTACT-LINKEDIN-1: the backend validation rule/column is `linkedin_slug`.
  linkedin_slug: 'linkedin',
}

interface Args {
  // Error state is owned by the modal (it must exist before its `set()`
  // closure); only the SETTERS are injected — the 422 mapping lands there.
  setErrors: (v: Record<string, boolean> | ((e: Record<string, boolean>) => Record<string, boolean>)) => void
  setSubmitErr: (v: string | null) => void
  setFieldMessages: (v: Record<string, string>) => void
  setDupBlock: (v: DuplicateMatch | null) => void
  form: FormState
  status: string
  branchIds: string[]
  requiredForm: (keyof FormState)[]
  touchInvalidFields: () => string[]
  createCandidate: (body: Record<string, unknown>) => Promise<Candidate>
  onCreated?: (candidate: Candidate) => void
  onClose: () => void
  t: TFunction
}

// Owns validation and the create submit handler for the "+ Kandidaat" form.
export function useCreateCandidateSubmit({
  setErrors, setSubmitErr, setFieldMessages, setDupBlock,
  form, status, branchIds, requiredForm, touchInvalidFields, createCandidate, onCreated, onClose, t,
}: Args) {
  // Validates required + live-format fields, then submits the create; a 409 renders
  // the duplicate panel, a 422 maps field errors, anything else shows a generic message.
  const handleSubmit = async () => {
    const e: Record<string, boolean> = {}
    requiredForm.forEach(k => { if (!String(form[k] ?? '').trim()) e[k] = true })
    // VALIDATIE-LIVE-1: block on a live format failure too — mirrors the required
    // check above, keeps every typed value in place and never fires the request.
    const invalidKeys = touchInvalidFields()
    if (Object.keys(e).length || invalidKeys.length) {
      setErrors(e)
      return
    }

    setSubmitErr(null)
    // CONTACT-LINKEDIN-1: strip a pasted full URL down to the bare slug the
    // backend column expects — applied ONCE here at the save boundary, so the
    // field itself stays a plain, unopinionated text input.
    const linkedinSlug = toLinkedinSlug(form.linkedin)
    // DUP-PHONE-1: canonicalise both numbers ONCE here, same save-boundary idiom as
    // toLinkedinSlug above. The server's duplicate guard compares the RAW column
    // value (DuplicateFinder: `where('mobile', $value)`), measured 2026-08-08 —
    // '0665277265' answers exists:false for a candidate stored as '+31665277265'.
    // Sending the canonical form is what makes "the same number, other notation"
    // actually collide with the existing dossier instead of creating a second one.
    const canonicalLandline = canonicalPhone(form.phone)
    const canonicalMobile   = canonicalPhone(form.mobile)
    try {
      const body = {
        first_name:          form.firstName.trim(),
        middle_name:         form.middleName.trim() || null,
        last_name:           form.lastName.trim(),
        function_title:      form.functionTitle.trim() || null,
        email:               form.email || null,
        phone:               canonicalLandline || null,
        // Split field (BE 2026-07-20): mobile is validated separately from the
        // landline `phone` on CandidateProfileRequest — same body key the drawer's
        // buildCandidatePatch already maps (candidatesShared.ts). Canonical form
        // (DUP-PHONE-1) so the dedupe key is notation-independent.
        mobile:              canonicalMobile || null,
        date_of_birth:       form.dateOfBirth || null,
        gender:              form.gender || null,
        street:              form.street || null,
        house_number:        form.houseNumber || null,
        house_number_suffix: form.houseNumberSuffix || null,
        postal_code:         form.postalCode || null,
        city:                form.city || null,
        province:            form.province || null,
        // COUNTRY-1: only rides along when actually picked (mirrors every other optional field).
        country:             form.country || null,
        owner_id:            form.ownerId || null,
        // PROFILE-TEXT-1: CandidateProfileRequest accepts `summary` (sometimes|nullable|
        // string) on create — verified against the backend request class.
        summary:             form.summary || null,
        // CONTACT-LINKEDIN-1: the normalised slug, never the raw typed value.
        linkedin_slug:       linkedinSlug || null,
        phase:               status || 'lead',
        status:              'available',
        candidate_types:     [],
        // Punt 10: only an explicit, non-empty choice rides along (explicit wins
        // server-side); empty = omit → auto-assign of the maker's branches.
        ...(branchIds.length ? { location_ids: branchIds } : {}),
      }
      // Create via the hook; it rethrows so the 422 handling below still runs.
      // Create FIRST, then notify: `onCreated?.(await …)` short-circuits the whole
      // call — argument included — when the optional prop is absent, silently
      // skipping the create itself (audit R2-M finding).
      const created = await createCandidate(body)
      onCreated?.(created)
      onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses.
      const ex = err as { response?: { status?: number; data?: { errors?: Record<string, unknown>; message?: string; existing?: DuplicateMatch } }; message?: string }
      const apiErrors = ex?.response?.data?.errors
      // C-29 duplicate (409): render the `existing` payload as a real panel. Without
      // it we fell through to the raw Dutch server sentence — untranslated for every
      // tenant — and threw the one thing that could help the user away.
      if (ex?.response?.status === 409) {
        const existing = ex.response.data?.existing
        setDupBlock(existing ?? null)
        // No payload (older API build): still our own translated line, never the server's.
        setSubmitErr(existing ? null : t('duplicate.blockedTitle'))
      } else if (apiErrors) {
        // VALIDATIE-LIVE-1: keep the server's own per-field message (never wiped,
        // never silently discarded) alongside the red-border boolean flag — the
        // typed value stays exactly as-is, nothing here clears the form.
        const e2: Record<string, boolean> = {}
        const m2: Record<string, string> = {}
        Object.entries(apiErrors).forEach(([k, v]) => {
          const field = API_TO_FORM[k] ?? k
          e2[field] = true
          // Laravel 422 payloads carry an array of messages per field — keep the first.
          const msg = Array.isArray(v) ? v[0] : v
          if (typeof msg === 'string') m2[field] = msg
        })
        setErrors(e2)
        setFieldMessages(m2)
      } else {
        // Fallback: show the server message or a generic error so the user isn't left guessing.
        const msg = ex?.response?.data?.message ?? ex?.message ?? t('common:errorGeneric', 'Er is iets misgegaan')
        setSubmitErr(msg)
      }
    }
  }

  return { handleSubmit }
}
