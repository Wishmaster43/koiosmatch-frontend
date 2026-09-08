/**
 * jsonFormat — PURE draft ⇄ stored-value helpers for catalogue `json` rows.
 * The settings bag stores every value as a string, so a json row lives in the form as
 * a JSON string; the editor shows it per `format` (one item or key=value per line) and
 * parses the draft back. Unknown formats round-trip raw JSON text.
 */
import type { CatalogRow } from './catalogTypes'

export type JsonFormat = CatalogRow['format']

// Parses the stored JSON string; a blank or malformed value yields null.
function parseStored(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null
  if (value.trim() === '') return null
  try { return JSON.parse(value) } catch { return null }
}

// Renders the stored value as editor text for the given format.
export function toDraft(value: unknown, format: JsonFormat): string {
  const parsed = parseStored(value)
  if (format === 'string_list' || format === 'kpi_order') {
    return Array.isArray(parsed) ? parsed.map(String).join('\n') : ''
  }
  if (format === 'key_value') {
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.entries(parsed as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join('\n')
      : ''
  }
  if (parsed == null) return typeof value === 'string' ? value : ''
  return JSON.stringify(parsed, null, 2)
}

// Parses editor text back into the JSON string the settings bag stores; throws on invalid JSON.
export function fromDraft(draft: string, format: JsonFormat): string {
  const lines = draft.split('\n').map(line => line.trim()).filter(Boolean)
  if (format === 'string_list' || format === 'kpi_order') return JSON.stringify(lines)
  if (format === 'key_value') {
    const out: Record<string, string> = {}
    lines.forEach(line => {
      const idx = line.indexOf('=')
      const key = (idx === -1 ? line : line.slice(0, idx)).trim()
      if (key) out[key] = idx === -1 ? '' : line.slice(idx + 1).trim()
    })
    return JSON.stringify(out)
  }
  if (draft.trim() === '') return ''
  return JSON.stringify(JSON.parse(draft))
}
