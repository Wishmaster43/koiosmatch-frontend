/**
 * useVacancyDescription — the vacancy description block's own edit/save/cancel
 * state, split out of useVacancyDetailsForm (Danny 21-07: Beschrijving becomes
 * its own drawer main-tab instead of a Profiel sub-tab, so the state needs a
 * home outside the field-grid hook). Owns: the rich-text draft, its independent
 * edit toggle, and the Koios-generated-concept apply path — mirrors the
 * candidate profile text's own pencil/save/cancel, unchanged behaviour.
 */
import { useState } from 'react'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

export function useVacancyDescription(v: VacancyDetail, onUpdate?: UpdateFn) {
  // Description edits in its own block (rich text), like the candidate profile text.
  const [descEditing, setDescEditing] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [description, setDescription] = useState(v.description ?? '')
  // VACGEN-1 fase 1b: bumped whenever a generated concept is applied, forcing
  // RichTextEditor to remount with the new draft — Tiptap's useEditor only reads
  // `content` at mount time, so a plain setDescription() while already editing
  // would not otherwise reach the visible editor.
  const [descKey, setDescKey] = useState(0)

  const saveDesc = () => { onUpdate?.(v.id, { description }); setDescEditing(false) }
  const cancelDesc = () => { setDescription(v.description ?? ''); setDescEditing(false) }
  // Seed a Koios-generated concept into the draft (opens edit mode if needed) —
  // never writes through onUpdate directly, so the existing Save button stays
  // the ONLY path that persists it (no silent overwrite of the saved text).
  const applyGeneratedConcept = (concept: string) => { setDescription(concept); setDescEditing(true); setDescKey(k => k + 1) }

  return {
    descEditing, setDescEditing, descExpanded, setDescExpanded, description, setDescription, saveDesc, cancelDesc,
    descKey, applyGeneratedConcept,
  }
}
