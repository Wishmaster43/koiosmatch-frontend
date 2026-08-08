/**
 * useCustomFields — tenant-defined field definitions for ANY entity, from the
 * unified custom-fields surface (G-13 / AP-CO10): GET /custom-fields?entity_type=X.
 * One session cache PER TENANT+entity type (a Map, not a single module-level list) —
 * a page that opens several drawers (e.g. a task AND a customer) fetches each
 * entity's defs once, never refetching one entity because another was cached.
 * Every entity-specific wrapper (useCandidateCustomFields, useVacancyCustomFields)
 * is a thin re-export of this one fetch+normalise path (§0.4 — one implementation,
 * zero duplicated fetch logic) — see those files' docblocks.
 *
 * TENANT SCOPING: cache keys are `${tenantId}:${entityType}`, not the bare entity
 * type (mirrors useCachedLookup's tenantCacheKey) — a super-admin switching bureaus
 * mid-session must never be served the PREVIOUS tenant's custom-field defs from this
 * module-scope cache.
 */
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList, getActiveTenantId } from '@/lib/api'

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'textarea'

// Every entity_type the unified /custom-fields endpoint whitelists
// (CustomFieldDefinition::TABLE_FOR, koiosmatch-api routes/api/tenant/core-lookups.php).
// planning_* entries are skipped — the planning module isn't live yet.
export type CustomFieldEntityType =
  | 'candidate' | 'application' | 'match' | 'vacancy' | 'task' | 'opportunity'
  | 'outreach_campaign' | 'customer' | 'customer_location' | 'customer_department' | 'customer_contact'

// Normalised field definition — the one shape every settings editor / drawer tab renders.
export interface CustomFieldDef {
  id?: string | number
  key: string
  label: string
  label_i18n?: Record<string, string>
  type: CustomFieldType
  options?: string[]
  required_for?: string[]
  /** Globally required, in EVERY phase — the second half of the backend's requirement
   *  test (`$field->required || in_array($phase, $field->required_phases)`). Exposed so
   *  a required-fields editor can show the phase toggles honestly instead of rendering
   *  them all off while the field is in fact always required. Optional on the type
   *  (the hook always sets it) so callers building a fixture stay valid without it. */
  required_always?: boolean
  sort_order: number
  active: boolean
  has_data: boolean
  // Worklist #44: field stays writable via the API/imports either way — this only
  // gates whether it renders on the entity's Extra tab (settings keeps it editable).
  visible_in_ui: boolean
}

// The generic /custom-fields definition shape as the API sends it (identical for every entity).
interface RawDef {
  id?: string | number; key?: string; label_i18n?: Record<string, string>
  type?: CustomFieldType; options?: unknown
  required?: boolean; required_phases?: string[]; sort_order?: number; active?: boolean; in_use?: boolean
  visible_in_ui?: boolean
}

// One session cache per tenant+entity type — keys are `${tenantId}:${entityType}`.
const cacheByEntity = new Map<string, RawDef[]>()

// Reads localStorage fresh on every call (never memoized) so it always reflects
// the CURRENT tenant, mirroring useCachedLookup's tenantCacheKey.
const tenantEntityKey = (entityType: CustomFieldEntityType): string =>
  `${getActiveTenantId() ?? 'none'}:${entityType}`

// Pick a label for the active language, falling back lang-base → en → nl → any → key.
function pickLabel(l: Record<string, string> | undefined, lang: string, key: string): string {
  if (!l) return key
  return l[lang] ?? l[lang.split('-')[0]] ?? l.en ?? l.nl ?? Object.values(l)[0] ?? key
}

export function useCustomFields(entityType: CustomFieldEntityType) {
  const { i18n } = useTranslation()
  const cached = cacheByEntity.get(tenantEntityKey(entityType))
  const [raw,     setRaw]     = useState<RawDef[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)

  // Fetch once per tenant+entity type; a cache hit (from an earlier hook instance —
  // settings editor + drawer both mount this) skips the request entirely. The key
  // is recomputed from the CURRENT tenant on every run (a tenant switch reloads the
  // app per AuthContext, so a fresh mount always resolves the right slot).
  useEffect(() => {
    const key = tenantEntityKey(entityType)
    const hit = cacheByEntity.get(key)
    if (hit) { setRaw(hit); setLoading(false); return }
    setLoading(true)
    api.get('/custom-fields', { params: { entity_type: entityType } })
      .then(r => { const list = (unwrapList(r).rows) as RawDef[]; cacheByEntity.set(key, list); setRaw(list) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [entityType])

  // Map the generic defs to CustomFieldDef in the active language.
  const allFields = useMemo<CustomFieldDef[]>(() => raw
    .map(d => ({
      id: d.id, key: String(d.key ?? d.id ?? ''),
      label: pickLabel(d.label_i18n, i18n.language, String(d.key ?? '')),
      label_i18n: d.label_i18n, type: d.type ?? 'text',
      options: Array.isArray(d.options) ? (d.options as string[]) : undefined,
      required_for: d.required_phases ?? [],
      required_always: d.required === true,
      sort_order: d.sort_order ?? 0,
      active: d.active !== false, has_data: !!d.in_use,
      visible_in_ui: d.visible_in_ui !== false,
    }))
    .filter(f => f.key), [raw, i18n.language])

  // Invalidate the cache for THIS tenant+entity type only — a settings-editor
  // mutation (create/update/delete/reorder) refetches on the next mount, other
  // entities/tenants untouched.
  const invalidate = () => { cacheByEntity.delete(tenantEntityKey(entityType)) }

  // fields = what the entity's Extra tab renders and gates on: active AND
  // visible_in_ui. A field kept active-but-API-only stays reachable via the API/
  // imports (settings still lists it in allFields) while disappearing from the UI.
  return { fields: allFields.filter(f => f.active && f.visible_in_ui), allFields, loading, invalidate }
}
