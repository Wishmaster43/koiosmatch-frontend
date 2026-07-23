/**
 * useCandidateSearch — Match-zoeker fase 1 (vacancy side): search the EXISTING
 * candidate pool around a vacancy's geocoded location, using the EXISTING
 * /candidates list endpoint's server-side filters (lat/lng/radius/function_title[]/
 * status[]) — no new backend. Mirrors the abort/alive idiom of
 * useVacancyActivity (AbortController per fetch, ignore a superseded response).
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { toCoord } from '@/lib/coords'
import { canonicalizeToOptions, lookupValue } from '@/lib/lookupUtils'
import { useLookups } from '@/context/LookupsContext'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

export interface CandidateSearchRow {
  id: Id
  name: string
  city: string
  functionTitle: string
  status: string
  lat: number | null
  lng: number | null
  distanceKm: number | null
}

// Raw /candidates list row — read defensively (snake_case, tolerant of gaps).
// Kept LOCAL on purpose: importing the candidate feature's own types/mapper would
// be a cross-entity import (§2 — entity pages never reach into another entity's
// internals), so this is a minimal, independent read of the same wire shape.
interface RawCandidateRow {
  id?: Id
  name?: string; full_name?: string; first_name?: string; last_name?: string
  city?: string; woonplaats?: string
  function_title?: string
  status?: unknown
  lat?: unknown; lng?: unknown; distance_km?: unknown
}

// Local, minimal name fallback chain (mirrors mapCandidate's without importing it).
const nameOf = (r: RawCandidateRow): string =>
  r.name || r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '?'

export function useCandidateSearch(vacancy: VacancyDetail) {
  const { statuses } = useLookups()

  // Soft DEFAULT against the tenant's seed — never a hardcoded vocabulary: preselect
  // whichever status option reads as "available" by value or label, if the tenant
  // has one; otherwise no default (empty selection = all statuses).
  const defaultStatus = statuses.find(s => /beschikbaar|available/i.test(`${s.value} ${s.label}`))

  const [radiusKm, setRadiusKm]     = useState(30)
  const [functions, setFunctions]   = useState<string[]>(vacancy.category ? [vacancy.category] : [])
  const [statusSel, setStatusSel]   = useState<string[]>(defaultStatus ? [defaultStatus.value] : [])

  // The tab is NOT remounted when a different vacancy is opened (EntityDrawer only
  // keys its tab body by the active TAB id, not the entity) — re-derive the filter
  // defaults on a vacancy switch the same way VacancyDrawer resets its own local
  // state: compare against the previous id during render (React's documented
  // "adjust state during render" pattern), no extra effect needed.
  const [prevId, setPrevId] = useState<Id | undefined>(vacancy.id)
  if (vacancy.id !== prevId) {
    setPrevId(vacancy.id)
    setRadiusKm(30)
    setFunctions(vacancy.category ? [vacancy.category] : [])
    setStatusSel(defaultStatus ? [defaultStatus.value] : [])
  }

  // Converge the selection onto the lookup's canonical values once the API rows
  // replace the seed (mirror of the candidate-side fix): the trigger counted the
  // seed value while the checklist compared the API value, so no ✓ showed.
  const canonicalStatuses = canonicalizeToOptions(statusSel, statuses)
  if (canonicalStatuses.join(' ') !== statusSel.join(' ')) setStatusSel(canonicalStatuses)

  const [rows, setRows]       = useState<CandidateSearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const lat = toCoord(vacancy.lat)
  const lng = toCoord(vacancy.lng)
  const noLocation = lat == null || lng == null

  // Fetch on any param change; abortable so a fast filter edit never lets a
  // superseded response overwrite the latest one (§9 alive-guard).
  useEffect(() => {
    if (noLocation) { setRows([]); setLoading(false); setError(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get('/candidates', {
      params: {
        lat, lng, radius: radiusKm,
        ...(functions.length && { function_title: functions }),
        ...(statusSel.length && { status: statusSel }),
        per_page: 200,
      },
      signal: ctrl.signal,
    })
      .then(res => {
        // Tolerant envelope unwrap (array | {data} | {data:{data}}).
        const list = unwrapList<RawCandidateRow>(res).rows
        const mapped: CandidateSearchRow[] = list.map(r => ({
          id: r.id ?? '',
          name: nameOf(r),
          city: r.city ?? r.woonplaats ?? '',
          functionTitle: r.function_title ?? '',
          status: lookupValue(r.status),
          lat: toCoord(r.lat), lng: toCoord(r.lng), distanceKm: toCoord(r.distance_km),
        }))
        // Closest first; rows without a resolved distance sort to the end.
        mapped.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
        setRows(mapped)
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [noLocation, lat, lng, radiusKm, functions, statusSel, reloadKey])

  return {
    rows, loading, error, retry: () => setReloadKey(k => k + 1),
    radiusKm, setRadiusKm,
    functions, setFunctions,
    statuses: statusSel, setStatuses: setStatusSel,
    noLocation,
  }
}
