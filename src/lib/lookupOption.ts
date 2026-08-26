/**
 * toLookupOption — the shared API-row→LookupOption normaliser, copied by hand
 * across useMatchStopReasons/useNoteTypes/useOutreachOutcomes/useCao/
 * useDocumentTypes before this consolidation. Value falls back through
 * value→slug→name→label→id; label falls back through name→label→value.
 *
 * RECONCILED DIVERGENCE (lane D audit item 5): useCao's copy checked
 * `label ?? name` — the reverse order of the other four, which all check
 * `name ?? label`. This canonicalises on name-first, matching four of the five
 * hooks (and useDocumentTypes/useMatchStopReasons's own convention). This is a
 * genuine behaviour change for useCao ONLY, and only on a row that carries both
 * a `name` and a different `label` — kept deliberately rather than preserved,
 * since a silent 4-vs-1 split is itself the bug the lane was asked to close.
 */
import type { LookupOption } from '@/types/common'

// Normalise one API row (value/slug/name/label/id + color) to the UI LookupOption shape.
export function toLookupOption(r: Record<string, unknown>, fallbackColor?: string): LookupOption {
  return {
    value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
    label: String(r.name ?? r.label ?? r.value ?? ''),
    color: (r.color as string) ?? fallbackColor,
  }
}
