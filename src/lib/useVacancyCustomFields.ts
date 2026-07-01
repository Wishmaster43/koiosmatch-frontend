/**
 * useVacancyCustomFields — fetches tenant-defined vacancy custom-field definitions
 * from /vacancy-custom-fields and caches them for the session. Tolerant of both the
 * current name-only shape and a future typed shape (key/label/type/options), so the
 * Extra tab works today and gets richer once the backend enriches the defs (C-26.2).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export interface VacancyFieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'textarea'
  options?: string[]
  active: boolean
}

let cache: VacancyFieldDef[] | null = null

// Normalise a raw def (name-only today, typed later) to a stable VacancyFieldDef.
function normalize(raw: unknown): VacancyFieldDef {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    key: String(o.key ?? o.id ?? o.name ?? ''),
    label: String(o.label ?? o.name ?? o.key ?? ''),
    type: (o.type as VacancyFieldDef['type']) ?? 'text',
    options: Array.isArray(o.options) ? (o.options as string[]) : undefined,
    active: o.active !== false,
  }
}

export function useVacancyCustomFields() {
  const [fields,  setFields]  = useState<VacancyFieldDef[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) { setFields(cache); setLoading(false); return }
    api.get('/vacancy-custom-fields')
      .then(r => { const list = ((r.data?.data ?? r.data ?? []) as unknown[]).map(normalize).filter(f => f.key); cache = list; setFields(list) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const invalidate = () => { cache = null }
  return { fields: fields.filter(f => f.active), loading, invalidate }
}
