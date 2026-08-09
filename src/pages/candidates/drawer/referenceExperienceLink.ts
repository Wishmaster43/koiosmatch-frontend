/**
 * referenceExperienceLink — the reference ↔ work-experience link (REF-ERVARING-1,
 * Danny 08-08 punt 4: the referee was the manager AT that employer).
 *
 * MEASURED live 09-08 against koiosmatch-api.test (X-Tenant: yesway) on the
 * delivered backend, BEFORE building — the earlier "not possible yet" gate is
 * therefore gone (its notice had become untrue):
 *  - `POST /candidates/{c}/references` already answers with `work_experience_id`
 *    + a nested `work_experience`, and accepts the id on create too.
 *  - `PATCH /candidates/{c}/references/{r}` with `work_experience_id` = a uuid of
 *    THIS candidate's own experience → 200; a fresh `GET /candidates/{c}` shows the
 *    id PLUS the nested object { id, function_title, employer, location,
 *    start_date, end_date, current, description }.
 *  - The same PATCH with ANOTHER candidate's experience uuid → 422 "The selected
 *    work experience id is invalid." and the stored link stays untouched
 *    (IDOR-safe, scoped to the candidate).
 *  - Unlink is that same PATCH with `null` → 200, fresh GET shows null/null.
 *  - Every probe row was DELETEd afterwards: the candidate is back at 0
 *    references, its experiences were never modified.
 *
 * The one measured detail this module exists for: the POST/PATCH RESPONSE echoes
 * the new `work_experience_id` but leaves `work_experience: null` (the relation is
 * not reloaded), while BackgroundTab's optimistic edit keeps the row's PREVIOUS
 * nested object. So the read line resolves the ID against the candidate's own
 * experience list and never trusts a stale nested object — see
 * resolveLinkedExperience.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

/** A candidate work experience as this link reads it — mapCandidate keeps BOTH the
 *  UI camelCase shape (title/company/start/end) and the raw API snake_case one.
 *  Dates are nullable: the measured resource really sends `end_date: null` for a
 *  running job (never an absent key). */
export interface LinkableExperience {
  id?: Id
  title?: string | null
  function_title?: string | null
  company?: string | null
  employer?: string | null
  start?: string | null
  start_date?: string | null
  end?: string | null
  end_date?: string | null
  current?: boolean
  [k: string]: unknown
}

/** The reference row's side of the link (ReferenceResource: id + nested object). */
export interface ExperienceLinkingEntry {
  work_experience_id?: Id | null
  work_experience?: unknown
  [k: string]: unknown
}

// Ids arrive as UUID strings but are numbers on optimistic temp rows — compare as
// strings, mirroring documentLinkRules' own sameId (§11: one comparison rule).
const sameId = (a?: Id | null, b?: Id | null): boolean =>
  a != null && a !== '' && b != null && b !== '' && String(a) === String(b)

// Only a row the server actually knows is a valid FK: a just-added experience
// carries a NEGATIVE temp id until its POST resolves (BackgroundTab), and sending
// that would 422 — so it is never offered as a link target.
const isPersistedId = (id?: Id | null): boolean =>
  (typeof id === 'string' && id.length > 0) || (typeof id === 'number' && id > 0)

/** The experiences a reference may be linked to — persisted rows only. */
export const linkableExperiences = (experiences: LinkableExperience[]): LinkableExperience[] =>
  experiences.filter(e => isPersistedId(e.id))

/**
 * The experience a reference points at. The ID decides: a cleared link must read
 * as "none" even while the row still carries the nested object of its previous
 * pick (the PATCH response never refreshes it — see the file header), and a
 * switched link resolves against the candidate's own list.
 */
export function resolveLinkedExperience(
  entry: ExperienceLinkingEntry,
  experiences: LinkableExperience[],
): LinkableExperience | undefined {
  const id = entry?.work_experience_id
  if (id == null || id === '') return undefined
  const nested = entry.work_experience
  if (nested && typeof nested === 'object' && sameId((nested as LinkableExperience).id, id)) {
    return nested as LinkableExperience
  }
  return experiences.find(e => sameId(e.id, id))
}

/**
 * One label per experience — "werkgever · functie · periode". The picker and the
 * read line share it, so what a recruiter picks is literally what they read back.
 */
export function useExperienceLabel() {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  return useCallback((e: LinkableExperience): string => {
    // Empty dates render as '' (never formatDate's '—' placeholder), so a range
    // never shows a dangling separator.
    const fmt = (d?: string | null) => (d ? formatDate(d) : '')
    const start = e.start ?? e.start_date
    const end = e.end ?? e.end_date
    const present = t('addFields.present')
    // A running experience — flagged `current`, or simply without an end date —
    // closes with "heden" instead of an empty side (Danny 08-08 punt 4).
    const endLabel = (e.current || !end) ? present : fmt(end)
    const period = start ? `${fmt(start)} – ${endLabel}` : (end ? fmt(end) : (e.current ? present : ''))
    return [e.company ?? e.employer, e.title ?? e.function_title, period].filter(Boolean).join(' · ')
  }, [formatDate, t])
}

/** The picker's option list — same label as the read line, value = the real FK. */
export function useExperienceOptions(experiences: LinkableExperience[]) {
  const label = useExperienceLabel()
  return linkableExperiences(experiences).map(e => ({ value: String(e.id), label: label(e) }))
}
