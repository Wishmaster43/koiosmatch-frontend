/**
 * useSmCandidatesList — data layer for the ShiftManager candidates detail list (§3):
 * the paginated /sm_candidates fetch + page/size state, and persisting the chosen page
 * size as the user's default. Via React Query: each page is cached + a superseded fetch
 * cancels, and the previous page stays visible while the next loads (A-3, no flash).
 */
import { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import api from '@/lib/api'
import { useDefaultPageSize } from '@/lib/usePageSize'
import { useAuth } from '@/context/AuthContext'
import { normalizeSmCandidate } from '@/components/reports/useReportCandidates'

export function useSmCandidatesList() {
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth() ?? {}
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  // Reset to the first page whenever the page size changes.
  useEffect(() => { setPage(1) }, [pageSize])

  // Load one page of candidates; cached per page/size, keeps the previous page on change.
  const { data, isLoading } = useQuery({
    queryKey: ['sm_candidates', page, pageSize],
    queryFn: async ({ signal }) => {
      const body = (await api.get('/sm_candidates', { params: { page, per_page: pageSize }, signal })).data
      // Normalise first_name/last_name → firstname/lastname (same fix as the report hook).
      const raw = (Array.isArray(body) ? body : (body?.data ?? [])) as Array<Record<string, unknown>>
      return {
        candidates: raw.map(normalizeSmCandidate),
        total:    body?.meta?.total     ?? body?.total     ?? (Array.isArray(body) ? body.length : 0),
        lastPage: body?.meta?.last_page ?? body?.last_page ?? 1,
      }
    },
    placeholderData: keepPreviousData,
  })

  // Persist the chosen page size as the user's new default (non-blocking).
  const handlePageSizeChange = async (newSize: number) => {
    setPageSize(newSize)
    try {
      await api.put('/auth/me', { default_per_page: newSize })
      await refreshUser?.()
    } catch { /* the size still applies locally if the save fails */ }
  }

  return {
    candidates: data?.candidates ?? [],
    loading:    isLoading,
    page, pageSize,
    total:      data?.total ?? 0,
    lastPage:   data?.lastPage ?? 1,
    setPage, handlePageSizeChange,
  }
}
