/**
 * useApplicationFilters — all list-filter state for the applications page
 * (§0.3 size split, mirrors useCandidateFilters). Owns the bucket tab, the
 * panel dimensions (phase/owner/source/vacancy), the attention KPI filter, the
 * search text and the archived toggle — plus the row predicate, clear-all and
 * the SERVER-side filterParams (F-6: /applications now supports pagination +
 * a subset of filters — bucket/phase_key/vacancy_id/search/include_archived,
 * all single-value; see ApplicationQuery.php, measured 2026-07-15). owner/source
 * and the attention KPIs have NO server equivalent (BE gap — ApplicationQuery
 * lacks the array-filter + by_owner/sources/attention support CandidateQuery has),
 * so they — and any MULTI-select on phase/vacancy — stay a client-side refine
 * over the fetched page via matchesFilters, exactly as before pagination.
 */
import { useState, useCallback, useMemo } from 'react'
import { usePageMemory } from '@/lib/usePageMemory'

// The owner facet key for unowned rows (kept identical to the donut slice key).
export const OWNER_NONE = '__none'

// The row fields the predicate reads — structurally typed so the page's
// Application model satisfies it without an import cycle.
interface FilterableApplication {
  archived?: boolean
  bucket?: string
  phaseKey?: string
  owner?: { name?: string } | null
  source?: string
  vacancyId?: string | number | null
  isNew?: boolean
  score?: number | null
  task?: unknown
  candidateName?: string
  vacancyTitle?: string
}

export function useApplicationFilters() {
  const [bucket,         setBucket]         = usePageMemory('apps.bucket', 'active')
  const [selectedPhase,  setSelectedPhase]  = usePageMemory<string[]>('apps.phase', [])
  const [attention,      setAttention]      = usePageMemory<string | null>('apps.attention', null)
  const [selectedOwner,  setSelectedOwner]  = usePageMemory<string[]>('apps.owner', [])
  const [selectedSource, setSelectedSource] = usePageMemory<string[]>('apps.source', [])
  const [selectedVac,    setSelectedVac]    = usePageMemory<string[]>('apps.vac', [])
  const [showArchived,   setShowArchived]   = usePageMemory('apps.archived', false)
  const [query,          setQuery]          = usePageMemory('apps.search', '')

  // Anything narrowing the default view → the shared clear-button shows.
  const anyFilterActive = Boolean(query.trim() || attention || showArchived || (bucket !== 'active' && bucket !== 'allActive')
    || selectedPhase.length || selectedOwner.length || selectedSource.length || selectedVac.length)
  // Remount the (self-stateful) search input on clear so the visible text resets too.
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setAttention(null); setShowArchived(false); setBucket('active')
    setSelectedPhase([]); setSelectedOwner([]); setSelectedSource([]); setSelectedVac([])
  }

  // One row predicate for table + board (the page maps decorate over the result).
  // `ignoreQuery`: the server already ran `search` (a richer match — candidate email/
  // phone/city/function + vacancy code + remarks, not just name/title/source), so a
  // second client-side substring check on the narrower field set would wrongly HIDE a
  // legitimate server hit (e.g. found via email) — skip it once the server was asked.
  const matchesFilters = useCallback((a: FilterableApplication, opts?: { ignoreBucket?: boolean; ignoreQuery?: boolean }): boolean => {
    // Detached rows only surface in the dedicated archived view (any bucket).
    if (showArchived) return Boolean(a.archived)
    if (a.archived) return false
    // 'allActive' (TOTAAL ACTIEF-kaart) spans the active + matched buckets together.
    // opts.ignoreBucket: the board view shows the whole funnel (all buckets).
    if (!opts?.ignoreBucket && (bucket === 'allActive' ? !['active', 'matched'].includes(a.bucket ?? '') : a.bucket !== bucket)) return false
    if (selectedPhase.length  && !selectedPhase.includes(a.phaseKey ?? ''))              return false
    if (selectedOwner.length  && !selectedOwner.includes(a.owner?.name || OWNER_NONE))   return false
    if (selectedSource.length && !selectedSource.includes(a.source ?? ''))               return false
    if (selectedVac.length    && !selectedVac.includes(String(a.vacancyId)))             return false
    // KPI attention filters (mirror the card definitions on the page).
    if (attention === 'new'     && !(a.isNew && a.bucket === 'active'))                          return false
    if (attention === 'scored'  && !(typeof a.score === 'number' && a.bucket !== 'rejected'))    return false
    if (attention === 'aiTasks' && !(a.task && a.bucket === 'active'))                           return false
    // Free-text search across candidate · vacancy · source (client-side; mirrors candidates).
    if (!opts?.ignoreQuery && query.trim()) {
      const q = query.trim().toLowerCase()
      if (!`${a.candidateName ?? ''} ${a.vacancyTitle ?? ''} ${a.source ?? ''}`.toLowerCase().includes(q)) return false
    }
    return true
  }, [bucket, showArchived, attention, selectedPhase, selectedOwner, selectedSource, selectedVac, query])

  // ── Server-side filter params (F-6) ──────────────────────────────────────
  // Shared base sent to BOTH the list and the stats endpoints (ApplicationQuery
  // honours phase_key/vacancy_id/search/include_archived on the list; stats only
  // honours vacancy_id/owner_id/search — bucket/phase_key are deliberately
  // ignored there so the KPI strip keeps showing the full distribution to pick
  // between). Single-value only: phase_key/vacancy_id 422 on an array (the
  // backend, unlike CandidateQuery, has no ARRAY_FILTERS normalisation yet — BE
  // gap) — so a multi-select on those dimensions is sent as NO server filter and
  // finishes narrowing client-side via matchesFilters, exactly as pre-pagination.
  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (selectedPhase.length === 1) p.phase_key   = selectedPhase[0]
    if (selectedVac.length === 1)   p.vacancy_id  = selectedVac[0]
    if (query.trim())               p.search      = query.trim()
    // include_archived REVEALS trashed rows alongside the active set (it does not
    // isolate them) — matchesFilters' `showArchived` branch still isolates client-side.
    if (showArchived)               p.include_archived = 1
    return p
  }, [selectedPhase, selectedVac, query, showArchived])

  // Bucket param — TABLE query only (never board/stats): 'allActive' has no server
  // equivalent (spans two buckets) and showArchived's reveal must not be narrowed by
  // it (matchesFilters ignores bucket entirely once showArchived is true).
  const bucketParam = (!showArchived && (bucket === 'active' || bucket === 'matched' || bucket === 'rejected'))
    ? bucket : undefined
  const filterKey = JSON.stringify({ ...filterParams, bucket: bucketParam })

  return {
    bucket, setBucket, selectedPhase, setSelectedPhase, attention, setAttention,
    selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    selectedVac, setSelectedVac, showArchived, setShowArchived, query, setQuery,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
    filterParams, bucketParam, filterKey,
  }
}
