/**
 * useProfileEditState — the pencil/draft/error state shared by the three
 * Profile sub-tabs (Personal / Address / Contact, Danny 28-07 split). Each
 * sub-tab owns its OWN field set, but the editing/form/errors machinery and
 * the auto-edit-signal ratchet (opens edit mode right after e.g. Lead→
 * Kandidaat convert) were three near-identical copies — kept here once
 * instead (DRY round 11, CANDTABS).
 */
import { useState } from 'react'

// F = the sub-tab's own form shape (all string fields); K = its field keys.
export function useProfileEditState<F extends Record<string, string>, K extends keyof F & string>(
  emptyForm: () => F,
  autoEditSignal?: number,
) {
  const [editing, setEditing] = useState(false)
  // Open edit mode when the parent bumps the signal (e.g. right after Lead→Kandidaat
  // convert) — a render-phase ratchet (React's derive-from-props idiom), never an
  // effect: an effect would open edit mode one render later than the signal change.
  const [prevAutoEdit, setPrevAutoEdit] = useState(autoEditSignal ?? 0)
  if ((autoEditSignal ?? 0) !== prevAutoEdit) { setPrevAutoEdit(autoEditSignal ?? 0); setEditing(true) }
  const [form, setForm] = useState<F>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<K, boolean>>>({})
  const setF = (k: K, v: string) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }
  return { editing, setEditing, form, setForm, errors, setErrors, setF }
}
