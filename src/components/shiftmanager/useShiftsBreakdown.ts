/**
 * useShiftsBreakdown — the SM-CHARTS2 shift aggregation: open diensten
 * (geen_kandidaat) grouped per klant (customer→name, with a month series) and per
 * functie (job_type), driven by the SAME applied filter as the charts (queryString).
 * Feeds both the dashboard donuts (valued on hours) and the two breakdown charts
 * under the tables. React Query keeps the previous data while a new filter loads; a
 * 404/503 (endpoint not configured) degrades to empty.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import api from '@/lib/api'

export interface BreakdownRow {
  key: string; label: string; count: number; hours: number
  months?: Array<{ month: string; count: number; hours: number }>
}
export interface DonutDatum { name: string; value: number; key: string; color: string }

// eslint-disable-next-line no-restricted-syntax -- fixed chart colour series (DATA), not UI styling: needs more distinct hues than the semantic token set provides
export const BREAKDOWN_PALETTE = ['#1B60A9', '#19A5CA', '#F0AB00', '#16A34A', '#EF4444', '#6366F1', '#94A3B8']

// Rows → donut data, valued on HOURS (Danny: alles op uren), top 7 by hours.
const toDonut = (rows: BreakdownRow[]): DonutDatum[] =>
  rows.slice(0, 7).map((r, i) => ({ name: r.label || '—', value: Number(r.hours) || 0, key: String(r.key), color: BREAKDOWN_PALETTE[i % BREAKDOWN_PALETTE.length] }))

// Fetch one group_by breakdown (metric + optional month-split).
const fetchBreakdown = (queryString: string, groupBy: 'customer' | 'job_type', metric: string, split?: boolean) =>
  async ({ signal }: { signal?: AbortSignal }) => {
    const url = `/sm_reports/shifts-breakdown?${queryString}&metric=${metric}&group_by=${groupBy}${split ? '&split=month' : ''}`
    const data = (await api.get(url, { signal })).data?.data ?? []
    return (Array.isArray(data) ? data : []) as BreakdownRow[]
  }

export function useShiftsBreakdown(queryString: string) {
  // Open diensten (geen_kandidaat) per klant (month-split) + per functie.
  const customerQ = useQuery({
    queryKey: ['sm_reports', 'shifts-breakdown', 'customer', 'geen_kandidaat', queryString],
    queryFn: fetchBreakdown(queryString, 'customer', 'geen_kandidaat', true),
    placeholderData: keepPreviousData, staleTime: 60_000,
  })
  const functionQ = useQuery({
    queryKey: ['sm_reports', 'shifts-breakdown', 'job_type', 'geen_kandidaat', queryString],
    queryFn: fetchBreakdown(queryString, 'job_type', 'geen_kandidaat'),
    placeholderData: keepPreviousData, staleTime: 60_000,
  })
  // All customers with any shift in the period → "active customers" count KPI.
  const activeCustomersQ = useQuery({
    queryKey: ['sm_reports', 'shifts-breakdown', 'customer', 'totaal', queryString],
    queryFn: fetchBreakdown(queryString, 'customer', 'totaal'),
    placeholderData: keepPreviousData, staleTime: 60_000,
  })
  // Customers that have PLANNED shifts (prognose) → the "5" in "5 / 7 actieve klanten".
  const plannedCustomersQ = useQuery({
    queryKey: ['sm_reports', 'shifts-breakdown', 'customer', 'prognose', queryString],
    queryFn: fetchBreakdown(queryString, 'customer', 'prognose'),
    placeholderData: keepPreviousData, staleTime: 60_000,
  })

  // Drop the ShiftManager test/self client (external_id '1') — shifts-breakdown
  // doesn't exclude it yet (BE fix pending); until then filter it FE-side.
  const noTest = (rows: BreakdownRow[]) => rows.filter(r => String(r.key) !== '1')
  const customerRows = noTest((customerQ.data ?? []) as BreakdownRow[])
  const functionRows = (functionQ.data ?? []) as BreakdownRow[]
  return {
    customerRows, functionRows,
    customerDonut: toDonut(customerRows),
    functionDonut: toDonut(functionRows),
    activeCustomers:    noTest((activeCustomersQ.data ?? []) as BreakdownRow[]).length,
    plannedCustomers:   noTest((plannedCustomersQ.data ?? []) as BreakdownRow[]).length,
    customersWithOpen:  customerRows.length,
  }
}
