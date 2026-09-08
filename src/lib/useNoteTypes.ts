/**
 * useNoteTypes — tenant-configurable note-category lookup, scoped per owning entity
 * (NOTE-TYPES-2/3 wave 2, Danny 2026-07-20). A note type created for "Candidate" no
 * longer leaks into "Customer" — mirrors the Settings-side split (registry.jsx's
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
 *
 * `useNoteTypesFor([...entities])` (NOTE-TYPE-WIDEN-1) is the WIDENING sibling for a
 * note composed on a deeper entity that must also accept its shallower entities' types
 * — see that function's own docblock for the backend rule it mirrors.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueries } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { buildLookupHelpers } from './buildLookupHelpers'
import type { LookupOption } from '@/types/common'
import api, { getActiveTenantId, unwrapList } from '@/lib/api'
import { translateSeedList } from './lookupSeedI18n'
import { toLookupOption } from './lookupOption'

// Mirrors the backend NoteType::ENTITIES whitelist (koiosmatch-api NoteType.php) —
// the only entities a note type can be scoped to. 'vacancy' added 2026-08-02
// (VACANCY-NOTE-TYPE-1) once vacancy_notes gained its own `type` column.
export type NoteTypeEntity = 'candidate' | 'application' | 'match' | 'task' | 'customer' | 'contact' | 'opportunity' | 'vacancy' | 'location' | 'department'

// Seed defaults. VALUES are the API slugs (mirror the backend note_types seed) — the old
// Dutch-label-as-value fallback made a note 422 ("type invalid") whenever the lookup hadn't
// loaded yet (smoke-suite catch, 2026-07-03). Labels stay NL for display.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
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
/* eslint-enable no-restricted-syntax */

// Note types the backend writes automatically (not hand-authored) — rendered as a
// calm system-event row in the thread, never with an edit pencil (N-1-FE).
export const SYSTEM_NOTE_TYPES = new Set(['status_change', 'lifecycle'])

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapNoteTypes = (res: AxiosResponse): LookupOption[] | null => {
  const raw = (unwrapList(res).rows) as Record<string, unknown>[]
  const d = raw.filter(Boolean).map(r => toLookupOption(r))
  // Dedupe by value: a defensive backstop against duplicate slugs in one response
  // (was load-bearing pre-wave-2 when every entity's types arrived unscoped in one
  // list; now that the request itself is entity-scoped this should never trigger,
  // but a stray duplicate would otherwise still crash on a repeated React key).
  const seen = new Set<string>()
  const unique = d.filter(x => (seen.has(x.value) ? false : (seen.add(x.value), true)))
  return unique.length ? unique : null
}

// Shared label/colour resolver + writable-types filter, built once so useNoteTypes
// and useNoteTypesFor (the widened union below) derive identical behaviour instead
// of two hand-copied resolvers drifting apart.
function buildNoteTypeHelpers(types: LookupOption[]) {
  // Build base resolvers from the lookup list.
  const { labelOf, colorOf } = buildLookupHelpers(types, norm)
  // Composer options: system-written categories (Statuswissel) are never offered
  // as a writable type — the seeded lookup DOES contain them for display resolution.
  const writableTypes = types.filter(nt => !SYSTEM_NOTE_TYPES.has(nt.value))
  return { labelOf, colorOf, writableTypes }
}

// entity is required — every caller scopes to its own owning entity (candidate/
// application/customer/opportunity/…), never the old flat cross-entity fetch.
export function useNoteTypes(entity: NoteTypeEntity) {
  // Cross-entity lookup (candidates/customers/matches/applications/tasks/…) — the
  // 'common' namespace is its shared home, mirroring common.json's own 'notes' keys.
  const { t } = useTranslation('common')
  const { data: rawTypes } = useCachedLookup(`/note-types?entity=${entity}`, mapNoteTypes, DEFAULT_NOTE_TYPES)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const types = useMemo(() => translateSeedList(t, 'noteTypes', rawTypes), [rawTypes, t])
  const { labelOf, colorOf, writableTypes } = useMemo(() => buildNoteTypeHelpers(types), [types])

  return { types, writableTypes, labelOf, colorOf }
}

/**
 * useNoteTypesFor — the WIDENING union across several owning entities
 * (BUG-NOTE-SCOPE-1: backend CustomerController::addNote/updateNote,
 * koiosmatch-api/app/Http/Controllers/CustomerController.php:459-473). A location
 * note accepts note types scoped to entity in ['customer','location']; a department
 * note accepts ['customer','location','department'] — a deeper link WIDENS the
 * accepted set, it never narrows it. Plain `useNoteTypes(entity)` only ever fetches
 * ONE entity's list, which silently drops the shallower entities' types out of both
 * the composer's option list and the label/colour resolver (a historical note typed
 * on the shallower entity then renders as a raw, uncoloured slug).
 *
 * Fetches every requested entity in parallel via React Query's `useQueries` — plain
 * `useCachedLookup` is a hook and cannot be called a variable number of times per
 * render without breaking Rules of Hooks, which a caller-supplied `entities` array
 * would require. The result is merged in call order (customer → location →
 * department, matching the widening rule), de-duplicated by value (first entity
 * wins a clash). This hook's cache is React Query's own — separate from
 * useCachedLookup's module-scope Map — but the query key still carries the tenant
 * id, mirroring useCachedLookup's own `${tenantId}:${url}` scoping, so a bureau
 * switch never leaks another tenant's rows.
 */
export function useNoteTypesFor(entities: NoteTypeEntity[]) {
  const { t } = useTranslation('common')
  const tenantId = getActiveTenantId() ?? 'none'
  const results = useQueries({
    queries: entities.map(entity => ({
      queryKey: ['note-types', tenantId, entity],
      queryFn: async ({ signal }: { signal?: AbortSignal }) => {
        const res = await api.get(`/note-types?entity=${entity}`, { signal })
        return mapNoteTypes(res) ?? DEFAULT_NOTE_TYPES
      },
      placeholderData: DEFAULT_NOTE_TYPES,
    })),
  })
  // `isLoading` (isPending && isFetching) goes false as soon as `placeholderData`
  // supplies non-undefined data — before the REAL fetch has actually settled.
  // `isFetching` stays accurate through the seed-vs-real-data transition.
  const loading = results.some(r => r.isFetching)

  // Union in entity order, de-duped by value — a type seeded on more than one
  // entity (e.g. 'general') appears once, from the first (shallowest) entity.
  const rawTypes = useMemo(() => {
    const seen = new Set<string>()
    const out: LookupOption[] = []
    for (const r of results) {
      for (const item of (r.data ?? DEFAULT_NOTE_TYPES)) {
        if (!seen.has(item.value)) { seen.add(item.value); out.push(item) }
      }
    }
    return out
  }, [results])

  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const types = useMemo(() => translateSeedList(t, 'noteTypes', rawTypes), [rawTypes, t])
  const { labelOf, colorOf, writableTypes } = useMemo(() => buildNoteTypeHelpers(types), [types])

  return { types, writableTypes, labelOf, colorOf, loading }
}
