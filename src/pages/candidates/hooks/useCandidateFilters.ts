/**
 * useCandidateFilters — ALL filter state for the candidates page in one hook
 * (§0.3 split: the page grew past 400 lines). Owns the server-side filter
 * dimensions (page-memory backed), the geo/straal filter (PDOK geocode), the
 * derived filterParams/filterKey, and the shared clear-all. The page passes the
 * map state in so the straal-blok and the map share one circle.
 */
import { useState, useMemo } from 'react'
import { usePageMemory } from '@/lib/usePageMemory'
import { geocodeNL } from '@/lib/geocode'

export interface GeoFilter { q: string; km: number; lat: number; lng: number; label: string }
export interface DateRangeFilter { param: 'created_between' | 'last_contact_between'; from: string; to: string }

interface UseCandidateFiltersArgs {
  t: (k: string) => string
  // "Not contacted > N months" threshold (tenant setting) — drives the stale param.
  staleMonths: number
  // Map view state (owned by the page): the active view + its circle.
  view: 'table' | 'map'
  mapCenter: { lat: number; lng: number }
  mapRadius: number
  setMapCenter: (c: { lat: number; lng: number }) => void
  setMapRadius: (km: number) => void
}

export function useCandidateFilters({ t, staleMonths, view, mapCenter, mapRadius, setMapCenter, setMapRadius }: UseCandidateFiltersArgs) {
  // Archived (soft-deleted) view toggle — opts the list into ?include_archived=1.
  const [showArchived, setShowArchived] = usePageMemory('cand.archived', false)
  // Prullenbak (ERASE-1 pending_erase) view — same server include, filtered by lifecycle.
  const [showTrash, setShowTrash] = usePageMemory('cand.trash', false)
  // Server-side filter dimensions (the API supports these). Owner holds owner_ids.
  const [selectedStatus,   setSelectedStatus]   = usePageMemory<string[]>('cand.status', [])
  const [selectedFunnel,   setSelectedFunnel]   = usePageMemory<string[]>('cand.funnel', [])
  const [selectedType,     setSelectedType]     = usePageMemory<string[]>('cand.type', [])
  const [selectedOwner,    setSelectedOwner]    = usePageMemory<Array<string | number>>('cand.owner', [])
  const [selectedGeslacht, setSelectedGeslacht] = usePageMemory<string[]>('cand.gender', [])
  const [selectedProvince, setSelectedProvince] = usePageMemory<string[]>('cand.province', [])
  const [selectedTitle,    setSelectedTitle]    = usePageMemory<string[]>('cand.title', [])
  const [selectedLocation, setSelectedLocation] = usePageMemory<Array<string | number>>('cand.location', [])
  const [selectedPool,     setSelectedPool]     = usePageMemory<string[]>('cand.pool', [])
  const [selectedCity,     setSelectedCity]     = usePageMemory<string[]>('cand.city', [])
  const [selectedSource,   setSelectedSource]   = usePageMemory<string[]>('cand.source', [])
  const [globalSearch,     setGlobalSearch]     = usePageMemory('cand.search', '')
  // Aandacht-tile filter: null | 'stale6m' | 'neverContacted' | … (klik = aan/uit).
  const [attentionFilter,  setAttentionFilter]  = usePageMemory<string | null>('cand.attention', null)
  // Date-range filter from a dashboard period click (created / last-contact between).
  const [dateRange, setDateRange] = useState<DateRangeFilter | null>(null)
  // Straal-filter (sidebar): place/postcode geocoded via PDOK → server-side lat/lng/radius.
  const [geoFilter, setGeoFilter] = usePageMemory<GeoFilter | null>('cand.geo', null)
  const [geoHint, setGeoHint] = useState<string | null>(null)

  // Straal-blok apply: geocode the input; not found → hint, found → filter + map sync.
  const applyGeo = async (q: string, km: number) => {
    setGeoHint(null)
    const hit = await geocodeNL(q)
    if (!hit) { setGeoHint(t('common:filters.notFound')); return }
    setGeoFilter({ q, km, lat: hit.lat, lng: hit.lng, label: `${hit.label} · ${km} km` })
    setMapCenter({ lat: hit.lat, lng: hit.lng }); setMapRadius(km)
  }
  const clearGeo = () => { setGeoFilter(null); setGeoHint(null) }

  // Anything narrowing the default view → the shared clear-button shows; one click resets.
  const anyFilterActive = Boolean(globalSearch.trim() || attentionFilter || dateRange || showArchived || showTrash || geoFilter
    || selectedStatus.length || selectedFunnel.length || selectedType.length || selectedOwner.length
    || selectedGeslacht.length || selectedProvince.length || selectedTitle.length || selectedLocation.length
    || selectedPool.length || selectedCity.length || selectedSource.length)
  // Remount the (self-stateful) search input on clear so the visible text resets too.
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1)
    setGlobalSearch(''); setAttentionFilter(null); setDateRange(null); setShowArchived(false); setShowTrash(false)
    setSelectedStatus([]); setSelectedFunnel([]); setSelectedType([]); setSelectedOwner([])
    setSelectedGeslacht([]); setSelectedProvince([]); setSelectedTitle([]); setSelectedLocation([])
    setSelectedPool([]); setSelectedCity([]); setSelectedSource([]); clearGeo()
  }

  // Server-side filter params (axios serialises arrays as `key[]`). Only the
  // dimensions the API supports; the attention tile keeps a client refine.
  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    // Map view searches server-side within the chosen centre + radius (STRAAL-1);
    // in table view the sidebar's straal-blok drives the same params.
    if (view === 'map') { p.lat = mapCenter.lat; p.lng = mapCenter.lng; p.radius = mapRadius }
    else if (geoFilter) { p.lat = geoFilter.lat; p.lng = geoFilter.lng; p.radius = geoFilter.km }
    if (globalSearch.trim())     p.search         = globalSearch.trim()
    if (selectedStatus.length)   p.status         = selectedStatus
    if (selectedFunnel.length)   p.funnel_type    = selectedFunnel
    if (selectedType.length)     p.candidate_type = selectedType
    if (selectedOwner.length)    p.owner_id       = selectedOwner
    if (selectedGeslacht.length) p.gender         = selectedGeslacht
    if (selectedProvince.length) p.province       = selectedProvince
    if (selectedTitle.length)    p.function_title = selectedTitle
    if (selectedLocation.length) p.location_id    = selectedLocation
    if (selectedPool.length)     p.pool           = selectedPool
    if (selectedCity.length)     p.city           = selectedCity
    if (selectedSource.length)   p.source         = selectedSource
    if (showArchived || showTrash) p.include_archived = 1
    // "> N months no contact" filters server-wide via last_contact_between at the configured
    // threshold; never-contacted + no-follow-up send server params too (BE KPI-2a).
    if (attentionFilter === 'stale6m') {
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - staleMonths)
      p.last_contact_between = ['1900-01-01', cutoff.toISOString().slice(0, 10)]
    }
    if (attentionFilter === 'neverContacted') p.never_contacted = 1
    if (attentionFilter === 'noFollowup')     p.no_followup = 1
    if (attentionFilter === 'hasTasks')       p.has_open_tasks = 1
    if (attentionFilter === 'intakePlanned')  p.intake_planned = 1
    // Period-click date range; set last so it wins over stale6m if both target last_contact.
    if (dateRange) p[dateRange.param] = [dateRange.from, dateRange.to]
    return p
  }, [globalSearch, selectedStatus, selectedFunnel, selectedType, selectedOwner, selectedGeslacht, selectedProvince, selectedTitle, selectedLocation, selectedPool, selectedCity, selectedSource, showArchived, showTrash, attentionFilter, dateRange, staleMonths, view, mapCenter, mapRadius, geoFilter])
  const filterKey = JSON.stringify(filterParams)

  return {
    showArchived, setShowArchived, showTrash, setShowTrash,
    selectedStatus, setSelectedStatus, selectedFunnel, setSelectedFunnel,
    selectedType, setSelectedType, selectedOwner, setSelectedOwner,
    selectedGeslacht, setSelectedGeslacht, selectedProvince, setSelectedProvince,
    selectedTitle, setSelectedTitle, selectedLocation, setSelectedLocation,
    selectedPool, setSelectedPool, selectedCity, setSelectedCity,
    selectedSource, setSelectedSource,
    globalSearch, setGlobalSearch,
    attentionFilter, setAttentionFilter,
    dateRange, setDateRange,
    geoFilter, geoHint, applyGeo, clearGeo,
    anyFilterActive, clearAllFilters, searchEpoch,
    filterParams, filterKey,
  }
}
