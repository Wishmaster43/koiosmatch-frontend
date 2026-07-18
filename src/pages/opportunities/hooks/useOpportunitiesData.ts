/**
 * useOpportunitiesData — the data layer for OpportunitiesPage (§3): loads the
 * opportunities list + the customer picker list, owns the selected/drawer state,
 * and holds the optimistic mutations (create, board move, header/picker edits).
 * Lookups (users, stages) are pulled in here too so the page stays presentational.
 * A missing endpoint (404) is an empty list, not an error.
 *
 * ARCHIVE-1 (2026-07-18): this used to also fetch `?include_archived=1` and expose
 * a `showArchived` toggle. Measured: OpportunityController::index DOES honour that
 * param (`$request->boolean('include_archived')` → `withTrashed()`, grepped
 * app/Http/Controllers/OpportunityController.php) — but OpportunityResource never
 * serializes `archived`/`deleted_at` on either the list or the detail row (same
 * resource class serves both). So a fetch with the flag on silently returns active
 * + archived rows MIXED, indistinguishable — the former client-side filter
 * (`r.archived`) was always false, meaning the "Archived" view always rendered
 * ZERO rows. Dropped rather than shipped as a fake toggle (§0/§4); the single-
 * record archive/restore (useOpportunityArchive) is unaffected — see its own
 * comment for the exact BE routes. Recommend backend add the two fields
 * (mirror VacancyListResource/ApplicationListResource/CandidateListResource)
 * to re-enable list-level archived visibility.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
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

  // Opportunities list via React Query (A-3). A missing endpoint (404) is an
  // empty list, not an error. `refetch` doubles as the post-archive/restore
  // reload (useOpportunityArchive) so a just-archived row drops out of view and
  // a just-restored one comes back — the default query already excludes
  // soft-deleted rows, so no `include_archived` fetch is needed here (see the
  // file comment on why the archived-only view was removed).
  const { data, isLoading: loading, isError: error, refetch } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async ({ signal }) => {
      try {
        const r = await api.get('/opportunities', { signal })
        return ((unwrapList(r).rows) as ApiOpportunity[]).map(mapOpportunity)
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return [] as Opportunity[]
        throw e
      }
    },
  })
  const rows = data ?? EMPTY_OPPORTUNITIES
  // Keep the setRows(prev => …) API the optimistic mutations use, backed by the query cache.
  const setRows = useCallback((updater: Opportunity[] | ((prev: Opportunity[]) => Opportunity[])) => {
    queryClient.setQueryData<Opportunity[]>(['opportunities'], prev =>
      typeof updater === 'function' ? (updater as (p: Opportunity[]) => Opportunity[])(prev ?? []) : updater)
  }, [queryClient])
  const [selected,       setSelected]       = useState<Opportunity | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())

  // Row selection for the checkbox column (drives the future bulk bar, worklist C-41).
  const toggleRow = (id: Id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next })
  const clearSelection = () => setSelectedIds(new Set())

  // Load customers once for the drawer/modal pickers. per_page:100 so the
  // searchable client picker (AddOpportunityModal, KlantTab) has the full set to
  // type-filter over, not just the backend's small default page.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { params: { per_page: 100 }, signal: ctrl.signal })
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
      .then(r => { if (selectedIdRef.current === o.id) setSelected(mapOpportunity(unwrap(r))) })
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
  // On failure the local state reverts to its pre-edit snapshot AND shows the error —
  // an optimistic edit that silently sticks around after a failed save is worse than none.
  const updateOpportunity = (id: Id | undefined, patch: Record<string, unknown>) => {
    const previous = rows.find(x => x.id === id)
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
    // Org hierarchy (klant tab, C-42/OPP-LOC-1): department/contact/customer_location_id
    // all map to real, validated columns (customer_departments/customer_locations/
    // customer_contacts — see OpportunityRequest). The API's `location_id` (unrelated
    // to `locationId` here) is a DIFFERENT concept — the TENANT's own branch (mirrors
    // Match.branch_id), validated against `locations`, not the customer's location —
    // sending our pick there would 422. Ours goes out under its own key.
    if ('locationId'   in patch) body.customer_location_id = patch.locationId || null
    if ('departmentId' in patch) body.department_id = patch.departmentId || null
    if ('contactId'    in patch) body.contact_id    = patch.contactId || null
    // §3B "Eigen velden" — the Extra tab patches the full merged map at once.
    if ('customFieldValues' in patch) body.custom_fields = patch.customFieldValues
    if (Object.keys(body).length) {
      api.patch(`/opportunities/${id}`, body).catch(() => {
        notifyError(t('common:actionFailed'))
        if (previous) {
          setRows(prev => prev.map(x => x.id === id ? previous : x))
          setSelected(prev => (prev && prev.id === id ? previous : prev))
        }
      })
    }
  }

  // Post-mutation reload (archive/restore) — a plain wrapper so callers don't
  // need to know this is React Query's refetch under the hood.
  const reload = () => { void refetch() }

  return {
    rows, loading, error, customers, users, stages, stageMeta,
    selected, drawerExpanded, setDrawerExpanded,
    selectedIds, toggleRow, toggleAll, clearSelection,
    selectOpportunity, closeDrawer, handleCreated, handleMove, updateOpportunity, reload,
  }
}
