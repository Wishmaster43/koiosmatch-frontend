/**
 * CandidatesDetailPage — paginated detail list of all candidates.
 * Fetches candidates from the API and renders them in CandidatesTable with a
 * PaginationBar; page size comes from the user's saved preference.
 */
import { useState, useEffect } from 'react'
import api                    from '../../lib/api'
import { useDefaultPageSize } from '../../lib/usePageSize'
import { useAuth }            from '../../context/AuthContext'
import CandidatesTable        from '../../components/reports/CandidatesTable'
import PaginationBar          from '../../components/ui/PaginationBar'
import type { ReportCandidate } from '../../types/reports'

export default function CandidatesDetailPage() {
  const defaultPageSize        = useDefaultPageSize()
  const { refreshUser }        = useAuth() ?? {}
  const [candidates, setCandidates] = useState<ReportCandidate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [pageSize,   setPageSize]   = useState(defaultPageSize)
  const [total,      setTotal]      = useState(0)
  const [lastPage,   setLastPage]   = useState(1)

  useEffect(() => { setPage(1) }, [pageSize])

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

  const handlePageSizeChange = async (newSize: number) => {
    setPageSize(newSize)
    // Sla op als nieuwe standaard voor de gebruiker
    try {
      await api.put('/auth/me', { default_per_page: newSize })
      await refreshUser?.()
    } catch {}
  }

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <CandidatesTable candidates={candidates} loading={loading} />
      </div>
      <PaginationBar
        page={page}
        totalPages={lastPage}
        totalRows={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
