/**
 * useLiveFieldValidation — VALIDATIE-LIVE-1's live, on-blur/typing format checks
 * (email/phone/mobile/linkedin) for the create form, split out of
 * AddCandidateModal.tsx (§3 size discipline: the container had grown past the
 * 400-line split trigger). Owns the touched/fieldMessages state and the message
 * resolution (a server 422 message always wins over a live check — it is the
 * authoritative source and must match the value still on screen, never wiped).
 * The container still owns `errors` (required-field flags) and the submit body —
 * this hook only answers "is this field's CURRENT value malformed, and what do I
 * show for it".
 */
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { isValidEmailFormat, isValidPhoneFormat, isValidLinkedinFormat } from '../lib/contactFieldValidation'
import type { FormState } from '../AddCandidateModal'

// VALIDATIE-LIVE-1 (Danny 06-08): the ZZP-tab pattern becomes the standard — live,
// on-blur/typing format checks (mirroring the backend rules 1:1, see
// contactFieldValidation.ts) for the same fields ProfileContactTab validates.
const FORMAT_VALIDATORS: Partial<Record<keyof FormState, (v: string) => boolean>> = {
  email: isValidEmailFormat, phone: isValidPhoneFormat, mobile: isValidPhoneFormat, linkedin: isValidLinkedinFormat,
}
const FORMAT_ERROR_KEY: Partial<Record<keyof FormState, string>> = {
  email: 'validation.emailFormat', phone: 'validation.phoneFormat', mobile: 'validation.phoneFormat', linkedin: 'validation.linkedinFormat',
}

export function useLiveFieldValidation(form: FormState, t: TFunction) {
  // VALIDATIE-LIVE-1: the server's own per-field message (422), and which fields
  // the user has already left (blurred) — a live format error only renders once
  // the field is touched, never on the very first keystroke.
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const markTouched = (k: keyof FormState) => setTouched(prevT => ({ ...prevT, [k]: true }))
  const liveInvalid = (k: keyof FormState): boolean => {
    const check = FORMAT_VALIDATORS[k]
    return !!check && !check(String(form[k] ?? ''))
  }
  // The message to show under a field: the server's own 422 text wins (it is the
  // authoritative source and the value the user still sees must match it — never
  // wiped, §house rule); otherwise a live format problem, only once touched.
  const fieldMessage = (k: keyof FormState): string | undefined => {
    if (fieldMessages[k]) return fieldMessages[k]
    if (touched[k] && liveInvalid(k)) return t(FORMAT_ERROR_KEY[k] as string)
    return undefined
  }
  // A fresh edit invalidates any server 422 message shown for this field.
  const clearFieldMessage = (k: keyof FormState) => {
    if (fieldMessages[k]) setFieldMessages(m => ({ ...m, [k]: '' }))
  }
  // Blocks submit on a live format failure: marks every currently-invalid field
  // touched (so its message renders) and hands back the list for the caller's
  // own "anything invalid?" gate.
  const touchInvalidFields = (): Array<keyof FormState> => {
    const invalidKeys = (Object.keys(FORMAT_VALIDATORS) as Array<keyof FormState>).filter(liveInvalid)
    if (invalidKeys.length) setTouched(prevT => { const next = { ...prevT }; invalidKeys.forEach(k => { next[k] = true }); return next })
    return invalidKeys
  }
  // Gates the Create button — any field currently malformed, touched or not.
  const hasFormatError = (Object.keys(FORMAT_VALIDATORS) as Array<keyof FormState>).some(liveInvalid)

  return { fieldMessages, setFieldMessages, markTouched, fieldMessage, clearFieldMessage, touchInvalidFields, hasFormatError }
}
