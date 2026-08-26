/**
 * useLiveFieldValidation — generic live, on-blur/typing field FORMAT check +
 * touched/message state (VALIDATIE-LIVE-1-rest, 2026-08-08), generalised from
 * the candidate create form's own copy (pages/candidates/addmodal/
 * useLiveFieldValidation.ts) so the non-candidate create/edit modals can adopt
 * the same on-blur pattern without duplicating the state machine per file.
 * Generic over the caller's form shape — the caller supplies which keys have
 * a format check (`validators`) and which i18n key explains a failure
 * (`errorKeys`); this hook only owns touched/fieldMessages and the message
 * resolution (a server 422 message always wins over a live check — it is the
 * authoritative source and must match the value still on screen, never
 * wiped). The caller still owns required-field flags and the submit body —
 * this hook only answers "is this field's CURRENT value malformed, and what
 * do I show for it".
 */
import { useState } from 'react'
import type { TFunction } from 'i18next'

type FieldChecks<T> = Partial<Record<keyof T, (v: string) => boolean>>
type FieldErrorKeys<T> = Partial<Record<keyof T, string>>

// Generic touched/message state for on-blur field format checks, shared across
// non-candidate create/edit modals; a server 422 message always wins over a live check.
export function useLiveFieldValidation<T extends object>(
  form: T,
  t: TFunction,
  validators: FieldChecks<T>,
  errorKeys: FieldErrorKeys<T>,
) {
  // The server's own per-field message (422), and which fields the user has
  // already left (blurred) — a live format error only renders once the field
  // is touched, never on the very first keystroke.
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const markTouched = (k: keyof T) => setTouched(prevT => ({ ...prevT, [String(k)]: true }))
  const liveInvalid = (k: keyof T): boolean => {
    const check = validators[k]
    return !!check && !check(String(form[k] ?? ''))
  }
  // The message to show under a field: the server's own 422 text wins (it is
  // the authoritative source and the value the user still sees must match
  // it — never wiped); otherwise a live format problem, only once touched.
  const fieldMessage = (k: keyof T): string | undefined => {
    const key = String(k)
    if (fieldMessages[key]) return fieldMessages[key]
    if (touched[key] && liveInvalid(k)) return t(errorKeys[k] as string)
    return undefined
  }
  // A fresh edit invalidates any server 422 message shown for this field.
  const clearFieldMessage = (k: keyof T) => {
    const key = String(k)
    if (fieldMessages[key]) setFieldMessages(m => ({ ...m, [key]: '' }))
  }
  // Blocks submit on a live format failure: marks every currently-invalid field
  // touched (so its message renders) and hands back the list for the caller's
  // own "anything invalid?" gate.
  const touchInvalidFields = (): Array<keyof T> => {
    const invalidKeys = (Object.keys(validators) as Array<keyof T>).filter(liveInvalid)
    if (invalidKeys.length) setTouched(prevT => { const next = { ...prevT }; invalidKeys.forEach(k => { next[String(k)] = true }); return next })
    return invalidKeys
  }
  // Gates the submit button — any field currently malformed, touched or not.
  const hasFormatError = (Object.keys(validators) as Array<keyof T>).some(liveInvalid)

  return { fieldMessages, setFieldMessages, markTouched, fieldMessage, clearFieldMessage, touchInvalidFields, hasFormatError }
}
