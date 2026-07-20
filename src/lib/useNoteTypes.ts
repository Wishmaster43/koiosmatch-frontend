/**
 * useNoteTypes — tenant-configurable note-category lookup, scoped per owning entity
 * (NOTE-TYPES-2/3 wave 2, Danny 2026-07-20). A note type created for "Kandidaat" no
 * longer leaks into "Klant" — mirrors the Settings-side split (registry.jsx's
 * `note_types` group / NoteTypesSettings.jsx).
 *
 * Fed by the API (GET /note-types?entity=X → {value/name,label,color,...}) with a
 * seed default as fallback while the endpoint is empty/unavailable. Managed in
 * Settings → Notitietypes (C-21 backend, mirrors last-contact-types/rejection-reasons).
 *
 * `labelOf` / `colorOf` resolve a stored value/slug to its label/colour, matching
 * on value OR label so it works whichever the note stores.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per entity
 * per session, shared across every mounted consumer of that entity (the `?entity=`
 * query string is part of the cache key, so entities never share a cache slot).
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// Mirrors the backend NoteType::ENTITIES whitelist (koiosmatch-api NoteType.php) —
// the only entities a note type can be scoped to.
export type NoteTypeEntity = 'candidate' | 'application' | 'match' | 'task' | 'customer' | 'contact' | 'opportunity'

// Seed defaults. VALUES are the API slugs (mirror the backend note_types seed) — the old
// Dutch-label-as-value fallback made a note 422 ("type invalid") whenever the lookup hadn't
// loaded yet (smoke-suite catch, 2026-07-03). Labels stay NL for display.
export const DEFAULT_NOTE_TYPES: LookupOption[] = [
  { value: 'general',     label: 'Algemeen' },
  { value: 'intake',      label: 'Intake' },
  { value: 'feedback',    label: 'Feedback' },
  { value: 'appointment', label: 'Afspraak' },
  { value: 'followup',    label: 'Follow-up' },
  { value: 'warning',     label: 'Waarschuwing' },
  // System note the backend writes on every status/phase change (N-1) — seeded here
  // with a neutral slate so the "Statuswissel" chip resolves even before /note-types loads.
  { value: 'status_change', label: 'Statuswissel', color: '#64748B' },
  // Lifecycle events (archived/restored/trashed) the BE writes centrally (TIJDLIJN-LC-1).
  { value: 'lifecycle', label: 'Dossier', color: '#64748B' },
]

// Note types the backend writes automatically (not hand-authored) — rendered as a
// calm system-event row in the thread, never with an edit pencil (N-1-FE).
export const SYSTEM_NOTE_TYPES = new Set(['status_change', 'lifecycle'])

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// Normalise an API row (id/name/label/value/color) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapNoteTypes = (res: AxiosResponse): LookupOption[] | null => {
  const raw = (unwrapList(res).rows) as Record<string, unknown>[]
  const d = raw.filter(Boolean).map(toOption)
  // Dedupe by value: a defensive backstop against duplicate slugs in one response
  // (was load-bearing pre-wave-2 when every entity's types arrived unscoped in one
  // list; now that the request itself is entity-scoped this should never trigger,
  // but a stray duplicate would otherwise still crash on a repeated React key).
  const seen = new Set<string>()
  const unique = d.filter(x => (seen.has(x.value) ? false : (seen.add(x.value), true)))
  return unique.length ? unique : null
}

// entity is required — every caller scopes to its own owning entity (candidate/
// application/customer/opportunity/…), never the old flat cross-entity fetch.
export function useNoteTypes(entity: NoteTypeEntity) {
  const { data: types } = useCachedLookup(`/note-types?entity=${entity}`, mapNoteTypes, DEFAULT_NOTE_TYPES)

  // Resolve a stored value/slug to its label/colour; fall back to the raw value.
  const find = (value?: string | null) => {
    const v = norm(value)
    return v ? types.find(x => norm(x.value) === v || norm(x.label) === v) : undefined
  }
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''
  const colorOf = (value?: string | null): string | undefined => find(value)?.color

  // Composer options: system-written categories (Statuswissel) are never offered
  // as a writable type — the seeded lookup DOES contain them for display resolution.
  const writableTypes = types.filter(nt => !SYSTEM_NOTE_TYPES.has(nt.value))

  return { types, writableTypes, labelOf, colorOf }
}
