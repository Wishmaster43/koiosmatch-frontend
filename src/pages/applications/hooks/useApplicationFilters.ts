/**
 * useApplicationFilters — all list-filter state for the applications page
 * (§0.3 size split, mirrors useCandidateFilters). Owns the bucket tab, the
 * panel dimensions (phase/owner/source/vacancy), the attention KPI filter, the
 * search text and the archived toggle — plus the row predicate and clear-all.
 * Filtering is CLIENT-side here (the endpoint returns all rows at once).
 */
import { useState, useCallback } from 'react'
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
  const matchesFilters = useCallback((a: FilterableApplication): boolean => {
    // Detached rows only surface in the dedicated archived view (any bucket).
    if (showArchived) return Boolean(a.archived)
    if (a.archived) return false
    // 'allActive' (TOTAAL ACTIEF-kaart) spans the active + matched buckets together.
    if (bucket === 'allActive' ? !['active', 'matched'].includes(a.bucket ?? '') : a.bucket !== bucket) return false
    if (selectedPhase.length  && !selectedPhase.includes(a.phaseKey ?? ''))              return false
    if (selectedOwner.length  && !selectedOwner.includes(a.owner?.name || OWNER_NONE))   return false
    if (selectedSource.length && !selectedSource.includes(a.source ?? ''))               return false
    if (selectedVac.length    && !selectedVac.includes(String(a.vacancyId)))             return false
    // KPI attention filters (mirror the card definitions on the page).
    if (attention === 'new'     && !(a.isNew && a.bucket === 'active'))                          return false
    if (attention === 'scored'  && !(typeof a.score === 'number' && a.bucket !== 'rejected'))    return false
    if (attention === 'aiTasks' && !(a.task && a.bucket === 'active'))                           return false
    // Free-text search across candidate · vacancy · source (client-side; mirrors candidates).
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      if (!`${a.candidateName ?? ''} ${a.vacancyTitle ?? ''} ${a.source ?? ''}`.toLowerCase().includes(q)) return false
    }
    return true
  }, [bucket, showArchived, attention, selectedPhase, selectedOwner, selectedSource, selectedVac, query])

  return {
    bucket, setBucket, selectedPhase, setSelectedPhase, attention, setAttention,
    selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    selectedVac, setSelectedVac, showArchived, setShowArchived, query, setQuery,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
  }
}
