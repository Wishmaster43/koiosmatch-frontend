/**
 * useOpportunitiesData — the data layer for OpportunitiesPage (§3): loads the
 * opportunities list + the customer picker list, owns the selected/drawer state,
 * and holds the optimistic mutations (create, board move, header/picker edits).
 * Lookups (users, stages) are pulled in here too so the page stays presentational.
 * A missing endpoint (404) is an empty list, not an error.
 *
 * ARCHIVE-1 (2026-07-18): re-added `includeArchived` + `?include_archived=1` now
 * that the backend serializes what the toggle needs — measured against the
 * delivered code: OpportunityController::index still honours the param
 * (`withTrashed()`), and OpportunityResource NOW carries `archived` (bool) +
 * `deleted_at` (ISO8601) on every row (previously the resource silently dropped
 * both fields, so a mixed active+archived response was indistinguishable — the
 * former client-side `r.archived` filter was always false). Archived rows ride
 * ALONGSIDE the active set (mirrors vacancies), not an isolated view — the table
 * chip (OpportunitiesTable) is what tells them apart. The single-record archive/
 * restore (useOpportunityArchive) is unaffected — see its own comment for routes.
 *
 * VESTIGING-2: `branchIds` sends the page's explicit branch filter as server-side
 * `?branch_id[]=` — a narrowing only (opportunities inherit their branch from the
 * customer), gated behind the tenant's own `branch_authz_enabled` axis on the
 * backend (off = no effect either way).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
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

// OpportunityQuery::rules() caps per_page at `between:1,200`. Fixed 2026-08-05 (audit:
// "rows per page niet overal toegepast"): this hook used to call GET /opportunities
// with NO per_page/page at all, so the controller's own default (25) silently capped
// EVERY consumer of `rows` — the table, the board, the donuts and the KPI cards —
// to at most 25 opportunities total, regardless of the page's own pageSize picker
// (mirrors the "84 vs 25" bug useMatches.ts already fixed for matches). Now fetches
// the FULL set via a page loop, safety-capped at 5 pages (1000 rows), same scale as
// useMatches.ts's fetch-all.
export const OPPORTUNITIES_MAX_PER_PAGE = 500
const OPPORTUNITIES_MAX_PAGES = 5

// includeArchived (ARCHIVE-1): reveal soft-deleted opportunities alongside the
// active set (?include_archived=1) — off by default; the page owns the toggle state.
// branchIds (VESTIGING-2): explicit branch filter, off (empty) by default.
// ref (NUMMER-1): an exact reference-number lookup (KA-00042) — OpportunityQuery
// returns early on `ref`, so pasting a number always finds that one deal. Null =
// the normal list; the page's free-text search stays client-side.
export function useOpportunitiesData(includeArchived: boolean = false, branchIds: string[] = [], ref: string | null = null) {
  const { t } = useTranslation()
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { stages, stageMeta } = useOpportunityStages()

  const queryClient = useQueryClient()
  const [customers, setCustomers] = useState<PageCustomer[]>([])

  // Opportunities list via React Query (A-3). A missing endpoint (404) is an
  // empty list, not an error. `refetch` doubles as the post-archive/restore
  // reload (useOpportunityArchive) so a just-archived row drops out of view and
  // a just-restored one comes back. The toggle rides in the query key so
  // flipping it triggers a real refetch instead of silently reusing the cache.
  const queryKey = ['opportunities', includeArchived, branchIds, ref] as const
  const { data, isLoading: loading, isError: error, refetch } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      try {
        // Build params conditionally so a default call (no archive/branch filter)
        // still sends `undefined` — mirrors the pre-VESTIGING-2 include_archived-only shape.
        const params: Record<string, unknown> = {}
        if (includeArchived)  params.include_archived = 1
        if (branchIds.length) params.branch_id = branchIds
        // NUMMER-1: exact reference-number lookup — takes precedence server-side, an
        // exact match returned in one request; no pagination loop needed (mirrors
        // useMatches.ts's identical `ref` shortcut).
        if (ref) {
          const r = await api.get('/opportunities', { signal, params: { ...params, ref } })
          return ((unwrapList(r).rows) as ApiOpportunity[]).map(mapOpportunity)
        }
        // Fetch the FULL set (OPPORTUNITIES_MAX_PER_PAGE per request, looped) — see
        // the constant's comment above for why a single unpaginated call used to
        // silently truncate every consumer of `rows` to 25.
        const all: ApiOpportunity[] = []
        for (let pageNo = 1; pageNo <= OPPORTUNITIES_MAX_PAGES; pageNo++) {
          const r = await api.get('/opportunities', {
            signal, params: { ...params, per_page: OPPORTUNITIES_MAX_PER_PAGE, page: pageNo },
          })
          const { rows, lastPage } = unwrapList<ApiOpportunity>(r)
          all.push(...rows)
          if (pageNo >= lastPage) break
        }
        return all.map(mapOpportunity)
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return [] as Opportunity[]
        throw e
      }
    },
  })
  const rows = data ?? EMPTY_OPPORTUNITIES
  // Keep the setRows(prev => …) API the optimistic mutations use, backed by the query cache.
  const setRows = useCallback((updater: Opportunity[] | ((prev: Opportunity[]) => Opportunity[])) => {
    queryClient.setQueryData<Opportunity[]>(queryKey, prev =>
      typeof updater === 'function' ? (updater as (p: Opportunity[]) => Opportunity[])(prev ?? []) : updater)
  }, [queryClient, queryKey])
  const [selected,       setSelected]       = useState<Opportunity | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())

  // Row selection for the checkbox column (drives the future bulk bar, worklist C-41).
  const toggleRow = (id: Id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next })
  const clearSelection = () => setSelectedIds(new Set())

  // Load customers once for the drawer/modal pickers. per_page:100 so the
  // searchable client picker (AddOpportunityModal, CustomerTab) has the full set to
  // type-filter over, not just the backend's small default page.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { params: { per_page: 100 }, signal: ctrl.signal })
      .then(res => setCustomers(unwrapList<{ id?: Id; name?: string; company_name?: string }>(res).rows.map(c => ({ id: c.id ?? '', name: c.name ?? c.company_name ?? '—' }))))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // Drawer: select an opportunity, then refresh from the detail endpoint (ref-guarded).
  // ARCHIVE-1 measured: OpportunityController::show does NOT withTrashed() (unlike
  // MatchController::show), so this refresh 404s for an archived row — the catch
  // below is silent because `o` (the list row) already has the SAME shape as the
  // detail (one OpportunityResource serves both), so the drawer still renders full
  // data from the list-row fallback. Not blocking, but the field never re-syncs
  // past this session for an archived row — recommend BE add withTrashed() to show().
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

  // Board drag-and-drop: move to a new stage optimistically, then PATCH. Bug class
  // fix: this used to `.catch(() => notifyError(...))` with no revert, so a rejected
  // move (e.g. a backend stage-transition guard) left the card sitting in the new
  // column as if the server had accepted it. Snapshot ONLY the stage fields the
  // optimistic write is about to overwrite and put them back on failure, mirroring
  // useApplicationDrawerActions.handleMove.
  const handleMove = (id: Id, stageValue: string | number) => {
    const m = stageMeta(String(stageValue))
    const before = rows.find(r => r.id === id)
    const beforeStage = before ? { stage: before.stage, stageValue: before.stageValue, stageColor: before.stageColor } : undefined
    setRows(prev => prev.map(r => r.id === id ? ({ ...r, stage: m.label, stageValue, stageColor: m.color } as Opportunity) : r))
    const s = stages.find(x => x.value === stageValue)
    if (s?.id) {
      api.patch(`/opportunities/${id}`, { opportunity_stage_id: s.id }).catch(err => {
        if (beforeStage) setRows(prev => prev.map(r => r.id === id ? ({ ...r, ...beforeStage } as Opportunity) : r))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
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
    // Org hierarchy (customer tab, C-42/OPP-LOC-1): department/contact/customer_location_id
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
    // C-41 free-form tags — UpdateOpportunityRequest validates `tags` as a nullable
    // array of strings and Opportunity::update() mass-assigns it straight through
    // (measured: app/Http/Requests/Opportunity/OpportunityRequest.php + OpportunityController::update).
    if ('tags' in patch) body.tags = patch.tags
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
