/**
 * useVacancyCustomFields — tenant-defined vacancy field definitions from the unified
 * custom-fields surface (G-13 / AP-CO10): GET /custom-fields?entity_type=vacancy.
 * The generic def ({ label_i18n, in_use, … }) is normalised to VacancyFieldDef in the
 * active language, so a locale switch re-labels without a refetch. Cached for the session.
 */
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'

export interface VacancyFieldDef {
  id?: string
  key: string
  label: string
  label_i18n?: Record<string, string>
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'textarea'
  options?: string[]
  active: boolean
  has_data?: boolean
}

// The generic /custom-fields definition shape (identical for every entity).
interface RawDef {
  id?: string; key?: string; label_i18n?: Record<string, string>
  type?: VacancyFieldDef['type']; options?: unknown; active?: boolean; in_use?: boolean
}

let cache: RawDef[] | null = null

// Pick a label for the active language, falling back lang-base → en → nl → any → key.
function pickLabel(l: Record<string, string> | undefined, lang: string, key: string): string {
  if (!l) return key
  return l[lang] ?? l[lang.split('-')[0]] ?? l.en ?? l.nl ?? Object.values(l)[0] ?? key
}

export function useVacancyCustomFields() {
  const { i18n } = useTranslation()
  const [raw,     setRaw]     = useState<RawDef[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) { setRaw(cache); setLoading(false); return }
    api.get('/custom-fields', { params: { entity_type: 'vacancy' } })
      .then(r => { const list = (r.data?.data ?? r.data ?? []) as RawDef[]; cache = list; setRaw(list) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Map the generic defs to VacancyFieldDef in the active language.
  const allFields = useMemo<VacancyFieldDef[]>(() => raw
    .map(d => ({
      id: d.id, key: String(d.key ?? d.id ?? ''),
      label: pickLabel(d.label_i18n, i18n.language, String(d.key ?? '')),
      label_i18n: d.label_i18n, type: d.type ?? 'text',
      options: Array.isArray(d.options) ? (d.options as string[]) : undefined,
      active: d.active !== false, has_data: !!d.in_use,
    }))
    .filter(f => f.key), [raw, i18n.language])

  const invalidate = () => { cache = null }
  return { fields: allFields.filter(f => f.active), allFields, loading, invalidate }
}
