/**
 * useVacancyDescription — the vacancy description block's own edit/save/cancel
 * state, split out of useVacancyDetailsForm (Danny 21-07: Beschrijving becomes
 * its own drawer main-tab instead of a Profiel sub-tab, so the state needs a
 * home outside the field-grid hook). Owns: the rich-text draft, its independent
 * edit toggle, the Koios-generated-concept apply path, and (V-desc-1) the
 * second-screen pop-out — mirrors the candidate profile text's own
 * pencil/save/cancel + pop-out, unchanged behaviour.
 */
import { useEffect, useRef, useState } from 'react'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

export function useVacancyDescription(v: VacancyDetail, onUpdate?: UpdateFn) {
  // Description edits in its own block (rich text), like the candidate profile text.
  const [descEditing, setDescEditing] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [description, setDescription] = useState(v.description ?? '')
  // Last PERSISTED description — what the popped-out window's `saved` reply and
  // the drawer's own ✕ restore to. Tracked separately from the record prop
  // because the popped-out window can save this field while the drawer's own
  // copy of the vacancy is still the pre-save one.
  const [savedDescription, setSavedDescription] = useState(v.description ?? '')

  const saveDesc = () => { onUpdate?.(v.id, { description }); setSavedDescription(description); setDescEditing(false) }
  const cancelDesc = () => { setDescription(savedDescription); setDescEditing(false) }

  // V-desc-1 (TEKST-POPOUT-1): the description gets the profile text's own
  // second-screen affordance — one icon in the block's title row, the SAME
  // window.open mechanism. Both windows edit one draft: local edits are
  // published, the other window's edits are adopted, and a save on either side
  // ends the edit here.
  const popout = useTextPopoutHost({
    entity: 'vacancy', id: v.id ?? '', field: 'description', value: description, dirty: description !== savedDescription,
    onDraft: html => { setDescription(html); setDescEditing(true) },
    onSaved: html => { setDescription(html); setSavedDescription(html); setDescEditing(false) },
  })
  // Publish every local edit (typing, dictation, applied Koios suggestion).
  const changeDescription = (html: string) => { setDescription(html); popout.publishDraft(html) }
  // Open the second screen; editing starts here too, so the two windows show one
  // and the same draft and closing the popout can never strand unsaved text.
  const openDescriptionPopout = () => {
    if (!v.id) return
    setDescEditing(true)
    popout.open()
  }

  // Adopt the record's value only when the RECORD ITSELF changes (a reload, a
  // save elsewhere) and no edit is in progress — comparing against the last seen
  // record value, so text saved from the popped-out window is not overwritten by
  // this drawer's now-stale copy.
  const lastRecordDescription = useRef(v.description ?? '')
  // Adopt the record's value only on an actual record change, and only when no
  // edit is in progress — see the block comment above for why the popout's own draft must win otherwise.
  useEffect(() => {
    const next = v.description ?? ''
    if (next === lastRecordDescription.current) return
    lastRecordDescription.current = next
    setSavedDescription(next)
    if (!descEditing) setDescription(next)
  }, [v.description, descEditing])

  return {
    descEditing, setDescEditing, descExpanded, setDescExpanded, description, setDescription: changeDescription, saveDesc, cancelDesc,
    openDescriptionPopout,
  }
}
