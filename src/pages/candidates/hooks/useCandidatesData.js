/**
 * useCandidatesData — data layer for CandidatesPage: loads the paginated +
 * server-filtered candidate list, the server-wide stats (totals across the whole
 * filtered set), and the location filter options. Returns the setters so the
 * optimistic bulk/drawer updates in the container can mutate the list directly.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { mapCandidate } from '../data/mapCandidate'

export function useCandidatesData({ filterParams, page, pageSize, t, setActionMsg }) {
  const [candidates, setCandidates] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [total,      setTotal]      = useState(0)
  const [lastPage,   setLastPage]   = useState(1)
  const [stats,      setStats]      = useState(null)
  const [locations,  setLocations]  = useState([])

  // ── List (paginated, server-filtered) ──
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api.get('/candidates', { params: { ...filterParams, page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total, lastPage } = unwrapList(res)
        setCandidates(rows.map(mapCandidate)); setTotal(total); setLastPage(lastPage)
      })
      .catch(err => {
        if (isAbortError(err)) return
        // 422 = the backend rejected a filter value (e.g. a status the API doesn't
        // accept yet). Keep the page usable: empty result + a soft notice, so the
        // filters stay visible and the user can clear the offending one — instead
        // of a hard "loading failed" that blocks the whole page.
        if (err?.response?.status === 422) {
          setCandidates([]); setTotal(0); setLastPage(1); setError(null)
          setActionMsg({ type: 'error', text: t('page.filterUnsupported', { defaultValue: 'Dit filter wordt (nog) niet door de server ondersteund.' }) })
          return
        }
        // Any other failure: empty list + a soft error notice, never fabricated rows.
        setError(t('page.loadError', { defaultValue: 'Kandidaten laden is mislukt.' }))
        setCandidates([]); setTotal(0); setLastPage(1)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [filterParams, page, pageSize, t, setActionMsg])

  // ── Stats (real totals across the whole filtered set, not just the page) ──
  // Depends only on the filters, not on pagination.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/candidates/stats', { params: filterParams, signal: ctrl.signal })
      .then(res => setStats(res.data?.data ?? res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [filterParams])

  // ── Vestiging (location) filter options ── from /locations; best-effort.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/locations', { signal: ctrl.signal })
      .then(res => setLocations(res.data?.data ?? res.data ?? []))
      .catch(err => { if (!isAbortError(err)) setLocations([]) })
    return () => ctrl.abort()
  }, [])

  return { candidates, setCandidates, loading, error, total, setTotal, lastPage, stats, locations }
}
