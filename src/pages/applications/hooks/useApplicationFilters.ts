/**
 * useApplicationFilters — all list-filter state for the applications page
 * (§0.3 size split, mirrors useCandidateFilters). Owns the bucket tab, the
 * panel dimensions (phase/owner/source/vacancy/client), the attention KPI
 * filter, the search text and the archived toggle — plus the row predicate,
 * clear-all and the SERVER-side filterParams.
 *
 * W27 (verified 2026-08-07 against ApplicationQuery.php): `phase_key`,
 * `vacancy_id`, `owner_id`, `source`, `customer_id` and `candidate_ids` are ALL
 * real backend ARRAY_FILTERS now (ApplicationQuery.php:34) — every multi-select
 * here goes server-side, none of it is a client-only refine anymore.
 * OWNER-NONE-SENTINEL-1 (verified live 2026-08-07, CMBE 5961c673): `owner_id[]`
 * now carries a REAL IS-NULL sentinel too (`owner_id.*` accepts `none` or a
 * uuid; `ApplicationQuery::filtered` widens the set with owner-less rows via an
 * `orWhereNull`) — the OWNER_NONE pick sends the wire value `'none'` and narrows
 * server-side exactly like a real id, combinable in the same array. matchesFilters
 * still re-applies the owner check client-side, same as every other dimension
 * here (the board view re-filters the wide, bucket-less fetch), not because of
 * any remaining BE gap.
 * NUMMER-1 (mirrors useCandidateFilters): a well-formed reference number
 * ("S-00123") sends an exact `?ref=` lookup instead of the fuzzy `?search=` —
 * `ref` takes precedence over EVERY other filter server-side (bucket, phase,
 * owner, …), so `refMode` lets the row predicate skip those dimensions too
 * (ApplicationsPage passes it through on both the table and board refine).
 * INTERVIEW-PHASE-1: two mutually-exclusive quick-views (busy/paused) send the
 * server's own universal category filter directly — exclusivity is enforced by
 * the page's click handlers (each toggle clears its sibling), not here.
 * 11.1: `selectedCandidateIds` is the deep-link scope from the candidates bulk
 * "manage per application" action (NavigationContext intent, plain useState —
 * NOT persisted like the other filters, a deep-link seed shouldn't linger across
 * sessions). Sent to the server as `candidate_ids` — a real, working filter.
 */
import { useState, useCallback, useMemo } from 'react'
import { usePageMemory } from '@/lib/usePageMemory'
import { isReferenceQuery } from '@/lib/referenceNumber'
import type { Id } from '@/types/common'

// The owner facet key for unowned rows (kept identical to the donut slice key).
export const OWNER_NONE = '__none'

// FILTER-PARITY-1: created-date range from a dashboard bar click (mirrors the
// candidate page's DateRangeFilter) — a single removable panel value.
export interface AppDateRangeFilter { param: 'created_between'; from: string; to: string }

// The row fields the predicate reads — structurally typed so the page's
// Application model satisfies it without an import cycle.
interface FilterableApplication {
  archived?: boolean
  bucket?: string
  phaseKey?: string
  owner?: { id?: string | number | null; name?: string } | null
  source?: string
  vacancyId?: string | number | null
  customerId?: string | number | null
  isNew?: boolean
  score?: number | null
  task?: unknown
  candidateName?: string
  vacancyTitle?: string
  // PLACED-1: batched EXISTS on `matches` — drives the 'placed' bucket pseudo-value.
  hasMatch?: boolean
}

// Owns every applications-page filter dimension (each sticky via usePageMemory,
// two deep-link scopes deliberately transient) plus the derived row predicate and server filterParams.
export function useApplicationFilters() {
  const [bucket,         setBucket]         = usePageMemory('apps.bucket', 'active')
  const [selectedPhase,  setSelectedPhase]  = usePageMemory<string[]>('apps.phase', [])
  const [attention,      setAttention]      = usePageMemory<string | null>('apps.attention', null)
  // W27: holds owner IDs (or the OWNER_NONE sentinel) — was owner NAMES before,
  // switched so the real ids can drive the server's owner_id[] filter directly.
  const [selectedOwner,  setSelectedOwner]  = usePageMemory<string[]>('apps.owner', [])
  const [selectedSource, setSelectedSource] = usePageMemory<string[]>('apps.source', [])
  const [selectedVac,    setSelectedVac]    = usePageMemory<string[]>('apps.vac', [])
  // W27: customer/client filter — new dimension, enabled by the now-verified
  // customer_id[] array filter (ApplicationQuery.php:88-89).
  const [selectedClient, setSelectedClient] = usePageMemory<string[]>('apps.client', [])
  // VESTIGING-2: explicit branch filter (inherited from the candidate) — a
  // narrowing only; the server excludes applications with no branch, see the
  // ApplicationsPage empty-state notice.
  const [selectedBranch, setSelectedBranch] = usePageMemory<string[]>('apps.branch', [])
  const [showArchived,   setShowArchived]   = usePageMemory('apps.archived', false)
  // FILTER-PARITY-1: a separate "trash" quick view (mirrors useCandidateFilters'
  // showTrash) — a distinct UI toggle, same underlying include_archived=1 reveal
  // as showArchived (the server has one soft-delete reveal flag, not two).
  const [showTrash,      setShowTrash]      = usePageMemory('apps.trash', false)
  const [query,          setQuery]          = usePageMemory('apps.search', '')
  // FILTER-PARITY-1: created-date range picked from a dashboard bar click.
  const [dateRange, setDateRange] = usePageMemory<AppDateRangeFilter | null>('apps.dateRange', null)
  // INTERVIEW-PHASE-1: two independent quick-views — the page's click handlers
  // keep them mutually exclusive (each clears its sibling before toggling on).
  const [interviewBusy,   setInterviewBusy]   = usePageMemory('apps.interviewBusy', false)
  const [interviewPaused, setInterviewPaused] = usePageMemory('apps.interviewPaused', false)
  // 11.1: deep-link scope from the candidates bulk "manage per application"
  // action — transient (not usePageMemory), cleared via clearAllFilters or its
  // own dedicated chip (see ApplicationsPage).
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Id[]>([])
  // RAPPORT-APPS-VERDIEPING-1: candidate-owner deep-link scope from a dashboard
  // drill (`candidate_owner_id`, drillTranslate.ts) — the candidate's OWN
  // owner, distinct from `selectedOwner` (the application's owner_id filter).
  // Transient like selectedCandidateIds above, same reasoning.
  const [selectedCandidateOwnerId, setSelectedCandidateOwnerId] = useState<Id | null>(null)

  // Anything narrowing the default view → the shared clear-button shows.
  const anyFilterActive = Boolean(query.trim() || attention || showArchived || showTrash || dateRange || interviewBusy || interviewPaused
    || (bucket !== 'active' && bucket !== 'allActive')
    || selectedPhase.length || selectedOwner.length || selectedSource.length || selectedVac.length
    || selectedClient.length || selectedBranch.length || selectedCandidateIds.length || selectedCandidateOwnerId)
  // Remount the (self-stateful) search input on clear so the visible text resets too.
  const [searchEpoch, setSearchEpoch] = useState(0)
  // Resets every filter to its default and bumps searchEpoch so the self-stateful search input clears its own visible text too.
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setAttention(null); setShowArchived(false); setShowTrash(false); setBucket('active')
    setSelectedPhase([]); setSelectedOwner([]); setSelectedSource([]); setSelectedVac([]); setInterviewBusy(false)
    setInterviewPaused(false); setSelectedClient([]); setSelectedBranch([]); setSelectedCandidateIds([]); setDateRange(null)
    setSelectedCandidateOwnerId(null)
  }

  // NUMMER-1: is the CURRENT search text a well-formed reference number? Drives
  // both filterParams (ref vs search below) and the row predicate's refMode.
  const refMode = useMemo(() => isReferenceQuery(query.trim()), [query])

  // One row predicate for table + board (the page maps decorate over the result).
  // `ignoreQuery`: the server already ran `search` (a richer match — candidate email/
  // phone/city/function + vacancy code + remarks, not just name/title/source), so a
  // second client-side substring check on the narrower field set would wrongly HIDE a
  // legitimate server hit (e.g. found via email) — skip it once the server was asked.
  // `refMode`: an exact ?ref= lookup bypasses every other filter dimension SERVER-side
  // (ApplicationQuery::filtered — `ref` returns immediately, before bucket/phase/owner/
  // source/vacancy are even applied) — mirror that here too, or a pasted reference
  // number would surface from the server then get dropped again by the client's own
  // bucket/phase/owner/… check. Only archived-visibility still applies (matches the
  // backend: include_archived is resolved before the ref shortcut).
  const matchesFilters = useCallback((a: FilterableApplication, opts?: { ignoreBucket?: boolean; ignoreQuery?: boolean; refMode?: boolean }): boolean => {
    // Detached rows only surface in the dedicated archived/trash view (any bucket).
    if (showArchived || showTrash) return Boolean(a.archived)
    if (a.archived) return false
    if (opts?.refMode) return true
    // 'allActive' (TOTAAL ACTIEF-kaart) spans the active + matched buckets together.
    // 'placed' (PLACED-1) is a subset of 'matched' — a real Match must exist too,
    // never a real server bucket value of its own (ApplicationQuery's enum stays
    // active|matched|rejected — see filterParams' bucket translation below)
    // opts.ignoreBucket: the board view shows the whole funnel (all buckets).
    if (!opts?.ignoreBucket) {
      if (bucket === 'allActive') { if (!['active', 'matched'].includes(a.bucket ?? '')) return false }
      else if (bucket === 'placed') { if (a.bucket !== 'matched' || !a.hasMatch) return false }
      else if (a.bucket !== bucket) return false
    }
    if (selectedPhase.length  && !selectedPhase.includes(a.phaseKey ?? ''))              return false
    // Owner compares by ID now (W27) — falls back to OWNER_NONE for an unowned row,
    // same sentinel the donut/filter options use (see buildOwnerData/buildOwnerDataFromStats).
    if (selectedOwner.length) {
      const ownerKey = a.owner?.id != null ? String(a.owner.id) : OWNER_NONE
      if (!selectedOwner.includes(ownerKey)) return false
    }
    if (selectedSource.length && !selectedSource.includes(a.source ?? ''))               return false
    if (selectedVac.length    && !selectedVac.includes(String(a.vacancyId)))             return false
    if (selectedClient.length && !selectedClient.includes(String(a.customerId)))         return false
    // KPI attention filters (mirror the card definitions on the page).
    if (attention === 'new'     && !(a.isNew && a.bucket === 'active'))                          return false
    if (attention === 'scored'  && !(typeof a.score === 'number' && a.bucket !== 'rejected'))    return false
    if (attention === 'aiTasks' && !(a.task && a.bucket === 'active'))                           return false
    // D6 dashboard-intent attention values ('tooLongInStage' / 'missingAppointment') are
    // real server-wide filters (see filterParams below) — no client-side row shape to
    // check them against here, so they fall through and rely on the server's narrowing.
    // Free-text search across candidate · vacancy · source (client-side; mirrors candidates).
    if (!opts?.ignoreQuery && query.trim()) {
      const q = query.trim().toLowerCase()
      if (!`${a.candidateName ?? ''} ${a.vacancyTitle ?? ''} ${a.source ?? ''}`.toLowerCase().includes(q)) return false
    }
    return true
  }, [bucket, showArchived, showTrash, attention, selectedPhase, selectedOwner, selectedSource, selectedVac, selectedClient, query])

  // ── Server-side filter params (W27: every filter the backend supports goes
  // here now — see ApplicationQuery.php's rules()/ARRAY_FILTERS, measured 2026-08-07). ──
  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (selectedPhase.length)  p.phase_key   = selectedPhase
    if (selectedVac.length)    p.vacancy_id  = selectedVac
    if (selectedClient.length) p.customer_id = selectedClient
    if (selectedSource.length) p.source      = selectedSource
    // OWNER-NONE-SENTINEL-1: owner_id[] now has a real IS-NULL sentinel server-side —
    // translate the client-only OWNER_NONE constant to the wire value 'none' so a
    // "No owner" pick (alone or mixed with real ids) narrows server-side too.
    if (selectedOwner.length) p.owner_id = selectedOwner.map(o => (o === OWNER_NONE ? 'none' : o))
    // D6 (dashboard tile → intent seam): the two attention values dashboardKpis emits
    // for applications carry real server-wide filters (ApplicationQuery attention.*).
    if (attention === 'tooLongInStage')    p.too_long_in_stage  = 1
    else if (attention === 'missingAppointment') p.missing_appointment = 1
    // NUMMER-1: a well-formed reference number does an exact server-side `?ref=`
    // lookup instead of the normal free-text search; the server ignores every other
    // filter for it (see the header comment / matchesFilters' refMode).
    if (query.trim()) {
      const q = query.trim()
      if (isReferenceQuery(q)) p.ref = q
      else p.search = q
    }
    // include_archived REVEALS trashed rows alongside the active set (it does not
    // isolate them) — matchesFilters' `showArchived`/`showTrash` branch still
    // isolates client-side. One server flag, two UI quick views (mirrors candidates).
    if (showArchived || showTrash) p.include_archived = 1
    // FILTER-PARITY-1: created-date range (dashboard bar click / panel chip).
    if (dateRange) p[dateRange.param] = [dateRange.from, dateRange.to]
    // INTERVIEW-PHASE-1: the universal category filter — busy wins if somehow both
    // are true (the page's click handlers keep them mutually exclusive already).
    if (interviewBusy) p.interview_status = 'busy'
    else if (interviewPaused) p.interview_status = 'paused'
    // 11.1: the candidates-bulk deep-link scope — a real, working server filter.
    if (selectedCandidateIds.length) p.candidate_ids = selectedCandidateIds
    // RAPPORT-APPS-VERDIEPING-1: dashboard candidate-owner drill — the
    // CANDIDATE's owner, sent as its own server filter (never merged into
    // owner_id, which narrows on the application's owner).
    if (selectedCandidateOwnerId) p.candidate_owner_id = selectedCandidateOwnerId
    // VESTIGING-2: server-side ?branch_id[]= — a narrowing only, gated behind the
    // tenant's own branch_authz_enabled axis on the backend (off = no effect).
    if (selectedBranch.length) p.branch_id = selectedBranch
    // PLACED-1: 'placed' has no server bucket value of its own — send the real
    // 'matched' bucket (bucketParam below) plus `has_match=1` to narrow to the
    // linked-Match subset (server-side EXISTS on `matches`, mirrors the row field).
    if (!showArchived && !showTrash && bucket === 'placed') p.has_match = 1
    return p
  }, [selectedPhase, selectedVac, selectedClient, selectedSource, selectedOwner, query, showArchived, showTrash,
    interviewBusy, interviewPaused, selectedCandidateIds, selectedCandidateOwnerId, selectedBranch, attention, dateRange, bucket])

  // Bucket param — TABLE query only (never board/stats): 'allActive' has no server
  // equivalent (spans two buckets) and showArchived's/showTrash's reveal must not be
  // narrowed by it (matchesFilters ignores bucket entirely once either is true).
  // PLACED-1: 'placed' rides the real 'matched' bucket server-side, narrowed further
  // by `has_match=1` above — no `bucket=placed` value exists on ApplicationQuery.
  const bucketParam = (!showArchived && !showTrash && (bucket === 'active' || bucket === 'matched' || bucket === 'rejected'))
    ? bucket : (!showArchived && !showTrash && bucket === 'placed') ? 'matched' : undefined
  const filterKey = JSON.stringify({ ...filterParams, bucket: bucketParam })

  return {
    bucket, setBucket, selectedPhase, setSelectedPhase, attention, setAttention,
    selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    selectedVac, setSelectedVac, selectedClient, setSelectedClient,
    showArchived, setShowArchived, showTrash, setShowTrash, query, setQuery,
    interviewBusy, setInterviewBusy, interviewPaused, setInterviewPaused, refMode,
    selectedBranch, setSelectedBranch,
    selectedCandidateIds, setSelectedCandidateIds,
    selectedCandidateOwnerId, setSelectedCandidateOwnerId,
    dateRange, setDateRange,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
    filterParams, bucketParam, filterKey,
  }
}
