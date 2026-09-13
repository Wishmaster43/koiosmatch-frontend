/**
 * useMatchTextPopout — DRILLDOWN-VOLGORDE-CANON (Danny 21-08): the match text
 * gets the profile-text recipe too, so it also gets the second-screen popout.
 * Mirrors useVacancyTextPopout 1:1 via the shared useLiteTextPopout plumbing — a
 * light identity fetch for the popped-out window plus a standalone PATCH
 * /matches/{id} on the SAME `match_text` field the drawer's own MatchTextBlock
 * writes through useMatchContract.save.
 */
import { initialsOf } from '@/lib/initials'
import { useLiteTextRecord, patchLiteText } from '@/hooks/useLiteTextPopout'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

export interface MatchTextLite { id: string; title: string; initials: string; matchText: string }

// The subset of the raw match resource this popout actually reads.
interface RawMatchLite {
  id?: Id
  candidate?: { name?: string } | null
  vacancy?: { title?: string } | null
  match_text?: string | null
  description?: string | null
}

// Mapper: fetch and build the MatchTextLite from the raw response.
function mapMatchTextLite(raw: RawMatchLite, id: string): MatchTextLite {
  // Candidate — vacancy as the window title; the em-dash here is a
  // separator between two data values, not sentence punctuation (§5 exception).
  const title = [raw.candidate?.name, raw.vacancy?.title].filter(Boolean).join(' — ') || '?'
  return {
    id: String(raw.id ?? id),
    title,
    initials: initialsOf(raw.candidate?.name ?? title),
    matchText: raw.description ?? raw.match_text ?? ''
  }
}

// Light identity fetch for the popped-out match-text window.
export function useMatchTextLite(id: string | undefined) {
  const { record: match, loading, error, reload } = useLiteTextRecord(id, '/matches', mapMatchTextLite)
  return { match, loading, error, reload }
}

// Standalone PATCH /matches/{id} — same field MatchTextBlock writes.
export function patchMatchText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return patchLiteText('/matches', id, 'description', html, t, revert, true)
}
