/**
 * useOpportunitiesData — the data layer for OpportunitiesPage (§3): loads the
 * opportunities list + the customer picker list, owns the selected/drawer state,
 * and holds the optimistic mutations (create, board move, header/picker edits).
 * Lookups (users, stages) are pulled in here too so the page stays presentational.
 * A missing endpoint (404) is an empty list, not an error.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useUsers } from '@/lib/queries'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { mapOpportunity } from '../data/mapOpportunity'
import type { Opportunity, ApiOpportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

interface AppUser { id: Id; name: string }
interface PageCustomer { id: Id; name: string }

// Stable empty default — a fresh `?? []` each render loops the registerFilters effect
// (see useCandidatesData for the full note).
const EMPTY_OPPORTUNITIES: Opportunity[] = []

export function useOpportunitiesData() {
  const { t } = useTranslation()
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { stages, stageMeta } = useOpportunityStages()

  const queryClient = useQueryClient()
  const [customers, setCustomers] = useState<PageCustomer[]>([])
  const [showArchived, setShowArchived] = useState(false)

  // Opportunities list via React Query (A-3); the archived view opts into ?include_archived=1.
  // A missing endpoint (404) is an empty list, not an error.
  const { data, isLoading: loading, isError: error } = useQuery({
    queryKey: ['opportunities', showArchived],
    queryFn: async ({ signal }) => {
      try {
        const r = await api.get('/opportunities', { params: showArchived ? { include_archived: 1 } : undefined, signal })
        return ((r.data?.data ?? r.data ?? []) as ApiOpportunity[]).map(mapOpportunity)
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return [] as Opportunity[]
        throw e
      }
    },
  })
  const rows = data ?? EMPTY_OPPORTUNITIES
  // Keep the setRows(prev => …) API the optimistic mutations use, backed by the query cache.
  const setRows = useCallback((updater: Opportunity[] | ((prev: Opportunity[]) => Opportunity[])) => {
    queryClient.setQueryData<Opportunity[]>(['opportunities', showArchived], prev =>
      typeof updater === 'function' ? (updater as (p: Opportunity[]) => Opportunity[])(prev ?? []) : updater)
  }, [queryClient, showArchived])
  const [selected,       setSelected]       = useState<Opportunity | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())

  // Row selection for the checkbox column (drives the future bulk bar, worklist C-41).
  const toggleRow = (id: Id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next })
  const clearSelection = () => setSelectedIds(new Set())

  // Load customers once for the drawer/modal pickers.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(res => setCustomers(unwrapList<{ id?: Id; name?: string; company_name?: string }>(res).rows.map(c => ({ id: c.id ?? '', name: c.name ?? c.company_name ?? '—' }))))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // Drawer: select an opportunity, then refresh from the detail endpoint (ref-guarded).
  const selectedIdRef = useRef<Id | null>(null)
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDrawerExpanded(false) }
  const selectOpportunity = (o: Opportunity) => {
    if (selected?.id === o.id) { closeDrawer(); return }
    selectedIdRef.current = o.id ?? null
    setSelected(o); setDrawerExpanded(false)
    api.get(`/opportunities/${o.id}`)
      .then(r => { if (selectedIdRef.current === o.id) setSelected(mapOpportunity(r.data?.data ?? r.data)) })
      .catch(() => {})
  }

  // A freshly created opportunity: prepend + open its drawer (modal close is the page's).
  const handleCreated = (o: Opportunity) => { setRows(prev => [o, ...prev]); selectOpportunity(o) }

  // Board drag-and-drop: move to a new stage optimistically, then PATCH.
  const handleMove = (id: Id, stageValue: string | number) => {
    const m = stageMeta(String(stageValue))
    setRows(prev => prev.map(r => r.id === id ? ({ ...r, stage: m.label, stageValue, stageColor: m.color } as Opportunity) : r))
    const s = stages.find(x => x.value === stageValue)
    if (s?.id) api.patch(`/opportunities/${id}`, { opportunity_stage_id: s.id }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Header/picker edits: optimistic locally, then PATCH (UI keys → API keys).
  const updateOpportunity = (id: Id | undefined, patch: Record<string, unknown>) => {
    const local: Record<string, unknown> = { ...patch }
    if ('stageValue' in patch) { const m = stageMeta(patch.stageValue as string); local.stage = m.label; local.stageColor = m.color }
    if ('ownerId'    in patch) { const u = users.find(x => x.id === patch.ownerId);     local.owner = u?.name ?? '' }
    if ('clientId'   in patch) { const c = customers.find(x => x.id === patch.clientId); local.client = c?.name ?? '' }

    setRows(prev => prev.map(x => x.id === id ? ({ ...x, ...local } as Opportunity) : x))
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...local } as Opportunity) : prev))

    const body: Record<string, unknown> = {}
    if ('stageValue' in patch) { const s = stages.find(x => x.value === patch.stageValue); body.opportunity_stage_id = s?.id ?? null }
    if ('ownerId'    in patch) body.owner_id    = patch.ownerId || null
    if ('clientId'   in patch) body.customer_id = patch.clientId || null
    if ('title'      in patch) body.title       = patch.title
    if ('value'      in patch) body.value       = patch.value
    if ('currency'   in patch) body.currency    = patch.currency
    if ('expectedCloseAt' in patch) body.expected_close_at = patch.expectedCloseAt || null
    // Zorg-detachering fields (C-42) — sent through; the backend ignores unknown keys
    // (validated()) until the columns land, so this is safe FE-first.
    if ('hours'          in patch) body.hours             = patch.hours
    if ('hoursPeriod'    in patch) body.hours_period      = patch.hoursPeriod
    if ('startDate'      in patch) body.start_date        = patch.startDate || null
    if ('endDate'        in patch) body.end_date          = patch.endDate || null
    if ('serviceTypeId'   in patch) body.service_type_id   = patch.serviceTypeId ?? null
    if ('agreementTypeId' in patch) body.agreement_type_id = patch.agreementTypeId ?? null
    if (Object.keys(body).length) api.patch(`/opportunities/${id}`, body).catch(() => notifyError(t('common:actionFailed')))
  }

  return {
    rows, loading, error, customers, users, stages, stageMeta,
    showArchived, setShowArchived,
    selected, drawerExpanded, setDrawerExpanded,
    selectedIds, toggleRow, toggleAll, clearSelection,
    selectOpportunity, closeDrawer, handleCreated, handleMove, updateOpportunity,
  }
}
