/**
 * applicationRow — the shapes + pure readers behind the candidate drawer's
 * Sollicitaties list. Split out of the row COMPONENT so both it and WorkTab (which
 * needs the same label for its search filter) read one source, and so the row file
 * exports nothing but its component.
 */
import { isSafeUrl } from '@/lib/safeUrl'
import type { Id } from '@/types/common'

// One application row as nested under the candidate (read defensively). The
// funnel stage (label + colour) used to live in the header chips — shown in the
// row now. APP-EMBED-1: vacancy.id + created_at (applied-on date).
// CMBE wave 1 (batch 14): the embedded application row now carries client_name
// directly (the vacancy's own customer) so the Klant column never has to load
// the full application detail just to show who the vacancy is for.
// S-cand-1: `stageKey` (the funnel lookup's own `value`, ApplicationResource's
// camelCase field) filters by the STABLE key rather than the translated label —
// optional while the backend embed rolls out, so WorkTab falls back to
// stageLabel until every tenant's rows carry it.
export interface AppRow { id?: Id; logo_url?: string; vacancy?: { logo_url?: string; title?: string; url?: string; id?: Id }; vacature?: string; title?: string; url?: string; stageLabel?: string; stageKey?: string; stageColor?: string; created_at?: string; client_name?: string | null }

// A linked appointment as returned by /candidates/{id}/appointments.
export interface Appt { id: Id; application_id?: Id | null; type?: string; scheduled_at?: string; duration_min?: number | null; modality?: string; owner?: { id?: Id; name?: string }; location_name?: string; status?: string }

// The vacancy link, when the API exposes a URL; otherwise null (plain text).
// AUDIT-2: URLs are tenant-entered data — only http(s) may render as a link.
export const vacancyUrlOf = (s: AppRow): string | null => {
  const url = s.vacancy?.url ?? s.url ?? null
  return isSafeUrl(url) ? url : null
}

// The row's own vacancy label, null for a genuinely vacancy-less (intake) row —
// shared by the row render (dash fallback) and WorkTab's search filter, so the two
// never drift into two different ideas of "the label".
export const vacancyLabelOf = (s: AppRow): string | null => s.vacature ?? s.vacancy?.title ?? s.title ?? null

// The row's client (customer) name — tolerant read, null when the row genuinely
// carries none (e.g. a seed row predating CMBE wave 1). Shared by the row's own
// Klant column and its "Intake — <klant>" label so both read one source.
export const clientNameOf = (s: AppRow): string | null => s.client_name ?? null
