/**
 * useSmCandidatesList — data layer for the ShiftManager candidates detail list (§3):
 * the paginated /sm_candidates fetch + page/size state, and persisting the chosen page
 * size as the user's default. Keeps CandidatesDetailPage presentational.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { useDefaultPageSize } from '@/lib/usePageSize'
import { useAuth } from '@/context/AuthContext'
import type { ReportCandidate } from '@/types/reports'

export function useSmCandidatesList() {
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth() ?? {}
  const [candidates, setCandidates] = useState<ReportCandidate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [pageSize,   setPageSize]   = useState(defaultPageSize)
  const [total,      setTotal]      = useState(0)
  const [lastPage,   setLastPage]   = useState(1)

  // Reset to the first page whenever the page size changes.
  useEffect(() => { setPage(1) }, [pageSize])

  // Load one page of candidates.
  useEffect(() => {
    setLoading(true)
    api.get('/sm_candidates', { params: { page, per_page: pageSize } })
      .then(res => {
        const body = res.data
        setCandidates(Array.isArray(body) ? body : (body?.data ?? []))
        setTotal(body?.meta?.total ?? body?.total ?? (Array.isArray(body) ? body.length : 0))
        setLastPage(body?.meta?.last_page ?? body?.last_page ?? 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, pageSize])

  // Persist the chosen page size as the user's new default (non-blocking).
  const handlePageSizeChange = async (newSize: number) => {
    setPageSize(newSize)
    try {
      await api.put('/auth/me', { default_per_page: newSize })
      await refreshUser?.()
    } catch { /* the size still applies locally if the save fails */ }
  }

  return { candidates, loading, page, pageSize, total, lastPage, setPage, handlePageSizeChange }
}
