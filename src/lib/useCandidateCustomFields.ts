/**
 * useCandidateCustomFields — fetches tenant-defined candidate field definitions
 * from /candidate-custom-fields and caches them for the session.
 * Shared by the drawer (rendering values) and settings (CRUD).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { CandidateCustomFieldDef } from '@/types/candidate'

let cache: CandidateCustomFieldDef[] | null = null

export function useCandidateCustomFields() {
  const [fields,  setFields]  = useState<CandidateCustomFieldDef[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) { setFields(cache); setLoading(false); return }
    api.get('/candidate-custom-fields')
      .then(r => {
        const list: CandidateCustomFieldDef[] = r.data?.data ?? r.data ?? []
        cache = list
        setFields(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Invalidate cache so the settings editor and drawer stay in sync after a mutation.
  const invalidate = () => { cache = null }

  return { fields: fields.filter(f => f.active), allFields: fields, loading, invalidate }
}
