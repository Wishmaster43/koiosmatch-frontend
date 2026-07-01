/**
 * useOrdersTable — data layer for OrdersTable: loads the shift/order rows from
 * /sm_reports, owns paging (with persisted page size), and derives the enriched
 * + filtered + sorted rows and the status options. The UI filter state (month,
 * search, statuses, sort) is owned by the component and passed in.
 */
import { useState, useEffect, useMemo, useReducer } from 'react'
import { useAuth }            from '@/context/AuthContext'
import api                    from '@/lib/api'
import { useDefaultPageSize } from '@/lib/usePageSize'
import type { OrderRow, EnrichedOrderRow } from '@/types/shiftmanager'

// The request lifecycle held by the reducer (replaced wholesale per dispatch).
interface OrdersState { rows: OrderRow[]; loading: boolean; total: number; lastPage: number }

export function useOrdersTable({ selectedMonth, search, selectedStatuses, sort }: {
  selectedMonth: string
  search: string
  selectedStatuses: string[]
  sort: { key: string; dir: 'asc' | 'desc' }
}) {
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth() ?? {}

  const [{ rows, loading, total, lastPage }, dispatch] = useReducer(
    (_: OrdersState, a: OrdersState) => a,
    { rows: [], loading: true, total: 0, lastPage: 1 } as OrdersState
  )
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  // Reset to the first page when the month or page size changes.
  useEffect(() => { setPage(1) }, [selectedMonth, pageSize])

  // Load the rows for the current month/page/size.
  useEffect(() => {
    dispatch({ rows: [], loading: true, total: 0, lastPage: 1 })
    api.get('/sm_reports/shifts-per-month/detail', {
      params: {
        ...(selectedMonth ? { month: selectedMonth } : {}),
        metric: 'totaal', per_page: pageSize, page,
      },
    })
      .then(res => {
        const body = res.data
        dispatch({
          rows:     body?.data ?? (Array.isArray(body) ? body : []),
          loading:  false,
          total:    body?.meta?.total ?? body?.total ?? 0,
          lastPage: body?.meta?.last_page ?? body?.last_page ?? 1,
        })
      })
      .catch(() => dispatch({ rows: [], loading: false, total: 0, lastPage: 1 }))
  }, [selectedMonth, page, pageSize])

  // Persist the chosen page size on the user profile.
  const handlePageSizeChange = async (newSize: number) => {
    setPageSize(newSize)
    try {
      await api.put('/auth/me', { default_per_page: newSize })
      await refreshUser?.()
    } catch { /* noop */ }
  }

  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.own_status).filter((s): s is string => Boolean(s)))].sort(), [rows])

  // Enrich rows with derived display/sort keys.
  const enriched = useMemo<EnrichedOrderRow[]>(() => rows.map((r): EnrichedOrderRow => ({
    ...r,
    customer_name:          r.order?.customerLocation?.customer?.name ?? r.order?.customer?.name ?? '',
    location_name:          r.order?.customerLocation?.name ?? '',
    start_date:             r.start_time ? r.start_time.slice(0, 10) : '',
    cost_center_candidate:  r.cost_center_candidate ?? r.cost_center ?? '',
    cost_center_customer:   r.cost_center_customer ?? r.order?.cost_center ?? '',
    worked_hours_candidate: r.worked_hours_candidate ?? r.hours_worked ?? null,
    worked_hours_customer:  r.worked_hours_customer ?? r.billed_hours ?? null,
    order_ref:              r.order?.order_ref ?? '',
  })), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter(r => {
      if (selectedStatuses.length && !selectedStatuses.includes(r.own_status ?? '')) return false
      if (!q) return true
      return (
        (r.external_id    ?? '').toString().toLowerCase().includes(q) ||
        (r.order_ref      ?? '').toLowerCase().includes(q) ||
        (r.customer_name  ?? '').toLowerCase().includes(q) ||
        (r.location_name  ?? '').toLowerCase().includes(q) ||
        (r.job_type       ?? '').toLowerCase().includes(q)
      )
    })
  }, [enriched, search, selectedStatuses])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = String(a[key] ?? '').toLowerCase()
      const bv = String(b[key] ?? '').toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  return { rows, loading, total, lastPage, page, setPage, pageSize, handlePageSizeChange, statusOptions, sorted }
}
