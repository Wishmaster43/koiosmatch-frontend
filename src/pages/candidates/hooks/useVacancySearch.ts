/**
 * useVacancySearch — Match-zoeker fase 1b (candidate side): the MIRROR of
 * useCandidateSearch (vacancy side) — search the EXISTING open vacancy pool
 * around a candidate's geocoded home location, using the EXISTING /vacancies
 * list endpoint's server-side filters (lat/lng/radius/status[]/function_title[])
 * — no new backend. Mirrors the abort/alive idiom (AbortController per fetch,
 * ignore a superseded response, adjust-during-render reset on an entity switch).
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { toCoord } from '@/lib/coords'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export interface VacancySearchRow {
  id: Id
  title: string
  customer: string
  city: string
  status: string
  lat: number | null
  lng: number | null
  distanceKm: number | null
}

// Raw /vacancies list row — read defensively (snake_case, tolerant of gaps).
// Kept LOCAL on purpose: importing the vacancy feature's own types/mapper would
// be a cross-entity import (§2 — entity pages never reach into another entity's
// internals), so this is a minimal, independent read of the same wire shape.
interface RawVacancyRow {
  id?: Id
  title?: string; name?: string
  customer_name?: string; customer?: { name?: string }
  city?: string
  status?: string
  lat?: unknown; lng?: unknown; distance_km?: unknown
}

export function useVacancySearch(candidate: Candidate) {
  const { statuses } = useVacancyLookups()

  // Soft DEFAULT against the tenant's seed — never a hardcoded vocabulary: preselect
  // whichever status option reads as "open" by value or label, if the tenant has
  // one; otherwise no default (empty selection = all statuses).
  const defaultStatus = statuses.find(s => /open/i.test(`${s.value} ${s.label}`))

  const [radiusKm, setRadiusKm]   = useState(30)
  const [functions, setFunctions] = useState<string[]>(candidate.title ? [candidate.title] : [])
  const [statusSel, setStatusSel] = useState<string[]>(defaultStatus ? [defaultStatus.value] : [])

  // The tab is NOT remounted when a different candidate is opened (EntityDrawer only
  // keys its tab body by the active TAB id, not the entity) — re-derive the filter
  // defaults on a candidate switch the same way the vacancy side does: compare
  // against the previous id during render (React's documented "adjust state
  // during render" pattern), no extra effect needed.
  const [prevId, setPrevId] = useState<Id | undefined>(candidate.id)
  if (candidate.id !== prevId) {
    setPrevId(candidate.id)
    setRadiusKm(30)
    setFunctions(candidate.title ? [candidate.title] : [])
    setStatusSel(defaultStatus ? [defaultStatus.value] : [])
  }

  const [rows, setRows]           = useState<VacancySearchRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const lat = toCoord(candidate.lat)
  const lng = toCoord(candidate.lng)
  const noLocation = lat == null || lng == null

  // Fetch on any param change; abortable so a fast filter edit never lets a
  // superseded response overwrite the latest one (§9 alive-guard).
  useEffect(() => {
    if (noLocation) { setRows([]); setLoading(false); setError(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get('/vacancies', {
      params: {
        lat, lng, radius: radiusKm,
        ...(statusSel.length && { status: statusSel }),
        ...(functions.length && { function_title: functions }),
        per_page: 200,
      },
      signal: ctrl.signal,
    })
      .then(res => {
        // Tolerant envelope unwrap (array | {data} | {data:{data}}).
        const list = unwrapList<RawVacancyRow>(res).rows
        const mapped: VacancySearchRow[] = list.map(r => ({
          id: r.id ?? '',
          title: r.title ?? r.name ?? '',
          customer: r.customer_name ?? r.customer?.name ?? '',
          city: r.city ?? '',
          status: r.status ?? '',
          lat: toCoord(r.lat), lng: toCoord(r.lng), distanceKm: toCoord(r.distance_km),
        }))
        // Closest first; rows without a resolved distance sort to the end.
        mapped.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
        setRows(mapped)
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [noLocation, lat, lng, radiusKm, statusSel, functions, reloadKey])

  return {
    rows, loading, error, retry: () => setReloadKey(k => k + 1),
    radiusKm, setRadiusKm,
    functions, setFunctions,
    statuses: statusSel, setStatuses: setStatusSel,
    noLocation,
  }
}
