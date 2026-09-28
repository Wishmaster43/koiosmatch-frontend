// english-code-ignore: LEGACY_FIELD_KEYS is the Dutch → English alias map for the KOIOS-EN-1
// transition (BE phase B renames the tool input keys); delete the map and this marker after ONIX.
/**
 * pendingPreview — pure row-shaping for KoiosPendingActionCard's preview list
 * (KOIOS-PENDING-CARD-FACE-1, Danny 28-09: raw tool parameter keys, an ISO date
 * and a UUID leaked onto the card). Hides id/UUID rows, extracts the model's
 * confidence value out of the row list, humanises ISO dates and translates the
 * row label — through a legacy Dutch-key alias map until KOIOS-EN-1 lands on
 * the backend and every tool starts sending English parameter keys. No React,
 * no i18n import: the caller passes its own `t`.
 */
import { humanizeIsoDates } from '@/lib/localDate'
import type { KoiosPreviewRow } from './koiosTypes'

// FILES-EN-1 legacy alias: the server still sends these Dutch parameter keys
// today. Remove this map once KOIOS-EN-1 (BE) renames every tool's input keys
// to English — the fallback below already handles any key it does not cover.
export const LEGACY_FIELD_KEYS: Record<string, string> = {
  titel: 'title',
  deadline: 'due_date',
  vervaldatum: 'due_date',
  omschrijving: 'description',
  kandidaat: 'candidate',
  kandidaat_id: 'candidate_id',
  klant: 'customer',
  vacature: 'vacancy',
  contactpersoon: 'contact',
  locatie: 'location',
  afdeling: 'department',
  eigenaar: 'owner',
  datum: 'date',
  tijd: 'time',
  prioriteit: 'priority',
  bericht: 'message',
  telefoon: 'phone',
  onderwerp: 'subject',
  notitie: 'note',
  fase: 'phase',
  reden: 'reason',
  zekerheid: 'confidence',
}

// A raw label into the normalised (English) field key.
function normaliseKey(label: string): string {
  const key = label.trim().toLowerCase()
  return LEGACY_FIELD_KEYS[key] ?? key
}

// Fallback label when there is no `fields.*` translation for a key: "due_date" → "Due date".
function humanise(key: string): string {
  const spaced = key.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A row never shown to a user: any `_id`/`id` field, or a value that IS a UUID
// (a1: candidate_id was rendering as a raw parameter row + label).
function isHiddenRow(key: string, row: KoiosPreviewRow): boolean {
  if (key === 'id' || key.endsWith('_id')) return true
  const values = [row.text, row.before, row.after]
  return values.some((v) => v != null && UUID_RE.test(v))
}

// The model's confidence value, translated (hoog/high → high, …); an unknown
// value renders as-is rather than being silently dropped.
function translateConfidence(value: string, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  const normalised = value.trim().toLowerCase()
  const bucket = normalised === 'hoog' || normalised === 'high' ? 'high'
    : normalised === 'middel' || normalised === 'medium' ? 'medium'
    : normalised === 'laag' || normalised === 'low' ? 'low'
    : null
  return bucket ? t(`koios.pendingAction.confidence.${bucket}`, { defaultValue: value }) : value
}

export interface ShapedPreviewRow {
  label: string
  before?: string | null
  after?: string | null
  text?: string | null
}

export interface ShapedPreview {
  rows: ShapedPreviewRow[]
  confidence: string | null
}

// Shapes the raw preview rows for display: translated labels, humanised ISO
// dates, id/UUID rows hidden, and the confidence value pulled out of the list.
export function shapePreviewRows(
  rows: KoiosPreviewRow[],
  t: (key: string, opts?: { defaultValue?: string }) => string,
): ShapedPreview {
  const shaped: ShapedPreviewRow[] = []
  let confidence: string | null = null

  for (const row of rows) {
    const key = normaliseKey(row.label)
    const rawValue = row.text ?? row.after ?? row.before
    if (key === 'confidence') {
      confidence = rawValue != null ? translateConfidence(rawValue, t) : null
      continue
    }
    if (isHiddenRow(key, row)) continue
    shaped.push({
      label: t(`koios.pendingAction.fields.${key}`, { defaultValue: humanise(key) }),
      before: row.before != null ? humanizeIsoDates(row.before) : row.before,
      after: row.after != null ? humanizeIsoDates(row.after) : row.after,
      text: row.text != null ? humanizeIsoDates(row.text) : row.text,
    })
  }

  return { rows: shaped, confidence }
}
