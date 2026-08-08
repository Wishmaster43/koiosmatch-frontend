import { useId } from 'react'
import { useTranslation } from 'react-i18next'
// G34: the house searchable dropdown replaces the native grouped <select>.
import SelectMenu from '@/components/ui/SelectMenu'
// DOC-1-EIGENAAR-1: the one shared "which slot is still free" rule (measured 08-08).
import { selectableEntries } from './documentLinkRules'
import type { Id } from '@/types/common'

interface DocumentLinkPickerProps {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  // DOC-1-EIGENAAR-1: every list item may carry its own `document_id` — an entry that
  // already holds a document is filtered out below (see the doc block on the component).
  educations: Array<{ id?: Id; title?: string; document_id?: Id | null }>
  certifications: Array<{ id?: Id; name?: string; document_id?: Id | null }>
  // DOC-LANG-SKILL-LINK-1: the same OPTIONAL link, extended to languages/skills
  // (BE landed document_id on candidate_languages + candidate_skills). Optional
  // with an empty-array default so a caller that hasn't threaded these through
  // yet keeps rendering exactly as before (backward compatible prop addition).
  languages?: Array<{ id?: Id; language?: string; name?: string; document_id?: Id | null }>
  skills?: Array<{ id?: Id; name?: string; document_id?: Id | null }>
  // REFERENTIE-VELDEN-1: same OPTIONAL link, extended to references (CMBE shipped
  // candidate_references.document_id + the reverse reference_id on DocumentResource,
  // commit 9a9bd8c9). Optional with an empty-array default, same backward-compatible
  // pattern as languages/skills above.
  references?: Array<{ id?: Id; first_name?: string; middle_name?: string; last_name?: string; document_id?: Id | null }>
}

// REFERENTIE-VELDEN-1: composes a reference row's referent name — mirrors
// ReferencesTab's own first+middle+last display order, so the picker option
// reads identically to how the Referenties tab shows the same person.
const referenceName = (ref: { first_name?: string; middle_name?: string; last_name?: string }): string =>
  [ref.first_name, ref.middle_name, ref.last_name].filter(Boolean).join(' ')

/**
 * DocumentLinkPicker — the OPTIONAL "Koppelen aan" grouped picker used by the
 * document upload queue (DOC-ENTRY-LINK-1): lets a recruiter link a freshly
 * uploaded proof document straight to one of the candidate's educations,
 * certifications, languages, skills (DOC-LANG-SKILL-LINK-1) or references
 * (REFERENTIE-VELDEN-1), without leaving the Documenten tab. `value` is a
 * "kind:id" composite string ("education:<id>" / "certification:<id>" /
 * "language:<id>" / "skill:<id>" / "reference:<id>"); '' = no link. Renders
 * nothing when the candidate has none of the five (no fake affordance offering
 * a choice that resolves to nothing).
 *
 * G34: the house SelectMenu replaces the native grouped <select>. SelectMenu has
 * no <optgroup> equivalent, so the five groups are flattened into one list with
 * each option's label prefixed by its group name ("Talen · Engels") instead of a
 * real group header — the "kind:id" value contract (and every caller) is unchanged.
 *
 * DOC-1-EIGENAAR-1 (Danny 08-08 punt 6): an entry that ALREADY carries a document is
 * left out — measured live, PATCHing a second document onto it answers 200 and
 * silently releases the first one, so offering it is a data-loss trap. The entry this
 * document currently hangs on (derived from `value`) stays offered, otherwise the
 * current pick could no longer be seen, switched or cleared. Filtering happens HERE
 * so every caller (upload queue + list row) inherits one rule (§11).
 */
export default function DocumentLinkPicker({ ariaLabel, value, onChange, educations, certifications, languages = [], skills = [], references = [] }: DocumentLinkPickerProps) {
  const { t } = useTranslation('candidates')
  // SelectMenu's trigger is a <button>, which ignores an associated <label for>
  // (see CreatableSelect's own doc comment) — a sr-only span + aria-labelledby
  // names it instead, keeping the same `ariaLabel` prop contract for callers.
  const labelId = useId()
  // The entry this document is linked to right now, split out of the "kind:id" value —
  // only the matching group may keep its occupied entry (an education id never
  // un-hides an occupied certification).
  const [currentKind, currentEntryId] = value ? value.split(':') : []
  const freeOf = <T extends { id?: Id; document_id?: Id | null }>(kind: string, list: T[]): T[] =>
    selectableEntries(list, currentKind === kind ? currentEntryId : undefined)
  const freeEducations = freeOf('education', educations)
  const freeCertifications = freeOf('certification', certifications)
  const freeLanguages = freeOf('language', languages)
  const freeSkills = freeOf('skill', skills)
  const freeReferences = freeOf('reference', references)
  if (freeEducations.length === 0 && freeCertifications.length === 0 && freeLanguages.length === 0 && freeSkills.length === 0 && freeReferences.length === 0) return null
  const options = [
    { value: '', label: t('documents.linkTo') },
    ...freeEducations.map(edu => ({ value: `education:${edu.id}`, label: `${t('sections.education')} · ${edu.title}` })),
    ...freeCertifications.map(cert => ({ value: `certification:${cert.id}`, label: `${t('sections.certifications')} · ${cert.name}` })),
    // DOC-LANG-SKILL-LINK-1: Talen/Vaardigheden — same "kind:id" composite.
    ...freeLanguages.map(lang => ({ value: `language:${lang.id}`, label: `${t('sections.languages')} · ${lang.language ?? lang.name}` })),
    ...freeSkills.map(skill => ({ value: `skill:${skill.id}`, label: `${t('sections.skills')} · ${skill.name}` })),
    // REFERENTIE-VELDEN-1: Referenties — same "kind:id" composite, labelled by
    // the referent's own name (never their internal id).
    ...freeReferences.map(ref => ({ value: `reference:${ref.id}`, label: `${t('sections.references')} · ${referenceName(ref)}` })),
  ]
  return (
    <div style={{ width: 170, flexShrink: 0 }}>
      <span id={labelId} className="sr-only">{ariaLabel}</span>
      <SelectMenu aria-labelledby={labelId} value={value} onChange={onChange} options={options} menuWidth={220}
        style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
    </div>
  )
}
