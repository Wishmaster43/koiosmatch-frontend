/**
 * useCustomFields — tenant-defined field definitions for ANY entity, from the
 * unified custom-fields surface (G-13 / AP-CO10): GET /custom-fields?entity_type=X.
 * One session cache PER entity type (a Map, not a single module-level list) — a
 * page that opens several drawers (e.g. a task AND a customer) fetches each
 * entity's defs once, never refetching one entity because another was cached.
 * Every entity-specific wrapper (useCandidateCustomFields, useVacancyCustomFields)
 * is a thin re-export of this one fetch+normalise path (§0.4 — one implementation,
 * zero duplicated fetch logic) — see those files' docblocks.
 */
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'

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
  sort_order: number
  active: boolean
  has_data: boolean
}

// The generic /custom-fields definition shape as the API sends it (identical for every entity).
interface RawDef {
  id?: string | number; key?: string; label_i18n?: Record<string, string>
  type?: CustomFieldType; options?: unknown
  required_phases?: string[]; sort_order?: number; active?: boolean; in_use?: boolean
}

// One session cache per entity type.
const cacheByEntity = new Map<CustomFieldEntityType, RawDef[]>()

// Pick a label for the active language, falling back lang-base → en → nl → any → key.
function pickLabel(l: Record<string, string> | undefined, lang: string, key: string): string {
  if (!l) return key
  return l[lang] ?? l[lang.split('-')[0]] ?? l.en ?? l.nl ?? Object.values(l)[0] ?? key
}

export function useCustomFields(entityType: CustomFieldEntityType) {
  const { i18n } = useTranslation()
  const cached = cacheByEntity.get(entityType)
  const [raw,     setRaw]     = useState<RawDef[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)

  // Fetch once per entity type; a cache hit (from an earlier hook instance —
  // settings editor + drawer both mount this) skips the request entirely.
  useEffect(() => {
    const hit = cacheByEntity.get(entityType)
    if (hit) { setRaw(hit); setLoading(false); return }
    setLoading(true)
    api.get('/custom-fields', { params: { entity_type: entityType } })
      .then(r => { const list = (unwrapList(r).rows) as RawDef[]; cacheByEntity.set(entityType, list); setRaw(list) })
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
      sort_order: d.sort_order ?? 0,
      active: d.active !== false, has_data: !!d.in_use,
    }))
    .filter(f => f.key), [raw, i18n.language])

  // Invalidate the cache for THIS entity type only — a settings-editor mutation
  // (create/update/delete/reorder) refetches on the next mount, other entities untouched.
  const invalidate = () => { cacheByEntity.delete(entityType) }

  return { fields: allFields.filter(f => f.active), allFields, loading, invalidate }
}
