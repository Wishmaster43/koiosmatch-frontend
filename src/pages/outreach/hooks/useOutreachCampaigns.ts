/**
 * useOutreachCampaigns — loads the campaign list and exposes optimistic list
 * mutations, so the container can switch between list/create/detail without
 * refetching while create/update/delete keep the table in sync.
 */
import { useState, useEffect, useCallback } from 'react'
import { listCampaigns } from '../data/outreachApi'

export interface Campaign {
  id: string
  name?: string
  channel?: 'call' | 'email' | 'whatsapp' | string
  status?: 'draft' | 'active' | 'done' | string
  owner?: { id: string; name: string } | null
  targets_count?: number
  target_count?: number
  created_at?: string
  // Tenant custom-field values (§3B "Eigen velden").
  custom_fields?: Record<string, unknown>
  [key: string]: unknown
}

export function useOutreachCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)

  // Fetch (or refetch) the list, resetting the error/loading flags.
  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    listCampaigns()
      .then((res) => setCampaigns((res.rows as Campaign[]) ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Optimistic list helpers used by the views after a mutation.
  const add   = (c: Campaign)                       => setCampaigns((p) => [c, ...p])
  const patch = (id: string, data: Partial<Campaign>) => setCampaigns((p) => p.map((c) => (c.id === id ? { ...c, ...data } : c)))
  const drop  = (id: string)                        => setCampaigns((p) => p.filter((c) => c.id !== id))

  return { campaigns, loading, error, reload: load, add, patch, drop }
}
