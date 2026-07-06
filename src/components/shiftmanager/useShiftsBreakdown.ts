/**
 * useShiftsBreakdown — the SM-CHARTS2 shift aggregation for the dashboard donuts:
 * open diensten (geen_kandidaat) grouped per klant (customer→name) and per functie
 * (job_type), driven by the SAME applied filter as the charts (queryString). React
 * Query keeps the previous donut while a new filter loads; a 404/503 (endpoint not
 * configured) degrades to an empty donut ('—').
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import api from '@/lib/api'

interface BreakdownRow { key: string; label: string; count: number; hours: number }
export interface DonutDatum { name: string; value: number; key: string; color: string }

const PALETTE = ['#1B60A9', '#19A5CA', '#F0AB00', '#16A34A', '#EF4444', '#6366F1', '#94A3B8']

// Rows → donut data, valued on HOURS (Danny: alles op uren), top 7 by hours.
const toDonut = (rows: BreakdownRow[]): DonutDatum[] =>
  rows.slice(0, 7).map((r, i) => ({ name: r.label || '—', value: Number(r.hours) || 0, key: String(r.key), color: PALETTE[i % PALETTE.length] }))

// Fetch one group_by breakdown for the geen_kandidaat metric.
const fetchBreakdown = (queryString: string, groupBy: 'customer' | 'job_type') =>
  async ({ signal }: { signal?: AbortSignal }) => {
    const res = await api.get(`/sm_reports/shifts-breakdown?${queryString}&metric=geen_kandidaat&group_by=${groupBy}`, { signal })
    const data = res.data?.data ?? res.data ?? []
    return (Array.isArray(data) ? data : []) as BreakdownRow[]
  }

export function useShiftsBreakdown(queryString: string) {
  const customerQ = useQuery({
    queryKey: ['sm_reports', 'shifts-breakdown', 'customer', queryString],
    queryFn: fetchBreakdown(queryString, 'customer'),
    placeholderData: keepPreviousData, staleTime: 60_000,
  })
  const functionQ = useQuery({
    queryKey: ['sm_reports', 'shifts-breakdown', 'job_type', queryString],
    queryFn: fetchBreakdown(queryString, 'job_type'),
    placeholderData: keepPreviousData, staleTime: 60_000,
  })

  return {
    customerDonut: toDonut(customerQ.data ?? []),
    functionDonut: toDonut(functionQ.data ?? []),
  }
}
