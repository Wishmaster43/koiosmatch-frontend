/**
 * useOutreachCampaigns — loads the campaign list and exposes optimistic list
 * mutations, so the container can switch between list/create/detail without
 * refetching while create/update/delete keep the table in sync.
 */
import { useState, useEffect, useCallback } from 'react'
import { listCampaigns } from '../data/outreachApi'

export interface Campaign {
  id: string
  // NUMMER-3: immutable human-readable display number (B-4), shown as a copy chip
  // next to the title (OutreachCampaignResource::reference_number).
  reference_number?: string
  name?: string
  channel?: 'call' | 'email' | 'whatsapp' | string
  status?: 'draft' | 'active' | 'done' | string
  owner?: { id: string; name: string } | null
  targets_count?: number
  target_count?: number
  created_at?: string
  // Archive state for banners/toggles (W2 delivered, measured: OutreachCampaignResource
  // carries both fields on the list row and the detail).
  archived?: boolean
  deleted_at?: string | null
  // Tenant custom-field values (§3B "Eigen velden").
  custom_fields?: Record<string, unknown>
  [key: string]: unknown
}

// OutreachCampaignController's filterRules() caps per_page at `between:1,200`. Fixed
// 2026-08-05 (audit: "Bellijsten heeft niet eens een footer?? ... rows per page niet
// overal toegepast"): this hook used to call GET /outreach-campaigns with NO per_page/
// page at all, so the controller's own default (25) silently capped the whole list —
// and OutreachPage had no PaginationBar at all to reveal the truncation (mirrors the
// "84 vs 25" bug useMatches.ts already fixed for matches). Now fetches the FULL set
// via a page loop, safety-capped at 5 pages (1000 rows), same scale as useMatches.
export const OUTREACH_MAX_PER_PAGE = 500
const OUTREACH_MAX_PAGES = 5

export function useOutreachCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)

  // Fetch (or refetch) the list, resetting the error/loading flags.
  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    const loadAll = async () => {
      const all: Campaign[] = []
      for (let pageNo = 1; pageNo <= OUTREACH_MAX_PAGES; pageNo++) {
        const res = await listCampaigns({ per_page: OUTREACH_MAX_PER_PAGE, page: pageNo })
        all.push(...((res.rows as Campaign[]) ?? []))
        if (pageNo >= (res.lastPage ?? 1)) break
      }
      return all
    }
    loadAll()
      .then(setCampaigns)
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
