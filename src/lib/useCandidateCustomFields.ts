/**
 * useCandidateCustomFields — tenant-defined candidate field definitions from the
 * unified custom-fields surface (G-13 / AP-CO10): GET /custom-fields?entity_type=candidate.
 * The generic def ({ label_i18n, required_phases, in_use, … }) is normalised to the
 * drawer/settings shape (CandidateCustomFieldDef) in the active language, so a locale
 * switch re-labels without a refetch. Cached for the session; shared by drawer + settings.
 */
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import type { CandidateCustomFieldDef } from '@/types/candidate'

// The generic /custom-fields definition shape (identical for every entity).
interface RawDef {
  id: string; key: string; label_i18n?: Record<string, string>
  type: CandidateCustomFieldDef['type']; options?: string[]
  required?: boolean; required_phases?: string[]; show_in_table?: boolean
  sort_order?: number; active?: boolean; in_use?: boolean
}

let cache: RawDef[] | null = null

// Pick a label for the active language, falling back lang-base → en → nl → any → key.
function pickLabel(l: Record<string, string> | undefined, lang: string, key: string): string {
  if (!l) return key
  return l[lang] ?? l[lang.split('-')[0]] ?? l.en ?? l.nl ?? Object.values(l)[0] ?? key
}

export function useCandidateCustomFields() {
  const { i18n } = useTranslation()
  const [raw,     setRaw]     = useState<RawDef[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) { setRaw(cache); setLoading(false); return }
    api.get('/custom-fields', { params: { entity_type: 'candidate' } })
      .then(r => { const list = (r.data?.data ?? r.data ?? []) as RawDef[]; cache = list; setRaw(list) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Map the generic defs to the drawer/settings shape in the active language.
  const allFields = useMemo<CandidateCustomFieldDef[]>(() => raw.map(d => ({
    id: d.id, key: d.key, label: pickLabel(d.label_i18n, i18n.language, d.key),
    label_i18n: d.label_i18n, type: d.type, options: d.options,
    required_for: d.required_phases ?? [], sort_order: d.sort_order ?? 0,
    active: d.active !== false, has_data: !!d.in_use,
  })), [raw, i18n.language])

  // Invalidate cache so the settings editor and drawer stay in sync after a mutation.
  const invalidate = () => { cache = null }

  return { fields: allFields.filter(f => f.active), allFields, loading, invalidate }
}
