/**
 * useShiftAnalysis — data layer for the Kandidaten Shift-analyse page (plan Fase A1).
 * Fetches the per-candidate month series (prognose + werkelijk hours) and derives an
 * average, upcoming hours and an attention alarm per candidate. The backend feed
 * (GET /sm_reports/shifts-per-candidate) is not delivered yet, so a 503/"not
 * configured" degrades to `unavailable` (empty-state) rather than an error.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { isServiceUnavailable } from '@/lib/api'

// Default alarm thresholds — Settings-tunable later (plan: avg_window/dropoff/…). Hours-based.
const AVG_WINDOW_MONTHS   = 3
const DROPOFF_PCT         = 0.5
const WEGVALLEND_MIN_HRS  = 8
const OPKOMEND_MIN_HRS    = 8
const NIEUW_INACTIEF_DAYS = 30

export type ShiftAlarm = 'wegvallend' | 'daling' | 'opkomend' | 'nieuw_inactief' | null

export interface ShiftAnalysisRow {
  id: string
  name: string
  position?: string
  city?: string
  avgHours: number
  upcomingHours: number
  alarm: ShiftAlarm
}

// The four values a candidate has per month (prognose + werkelijk × uren + diensten).
export interface MatrixCell {
  prognose_hours?: number; prognose_shifts?: number
  werkelijk_hours?: number; werkelijk_shifts?: number
}
export type MetricKey = keyof MatrixCell
export const METRIC_KEYS: MetricKey[] = ['prognose_hours', 'prognose_shifts', 'werkelijk_hours', 'werkelijk_shifts']

// One candidate row for the per-month matrix.
export interface MatrixRow { id: string; name: string; position?: string; contract_form?: string; months: Record<string, MatrixCell> }

// One raw candidate month series from the backend feed.
interface RawRow {
  candidate_id?: string | number
  name?: string
  position?: string
  city?: string
  contract_form?: string
  registration_date?: string | null
  number_of_times_worked?: number | null
  months?: Record<string, MatrixCell>
}

// Current month key 'YYYY-MM' (string compare orders month keys correctly).
function currentMonthKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Derive avg (recent worked), upcoming (future prognose) and the alarm for one candidate.
function toRow(r: RawRow, nowKey: string, nowMs: number): ShiftAnalysisRow {
  const months = r.months ?? {}
  const keys = Object.keys(months).sort()
  const pastHrs   = keys.filter(k => k < nowKey).slice(-AVG_WINDOW_MONTHS)
    .map(k => Number(months[k]?.werkelijk_hours) || 0)
  const upcoming  = keys.filter(k => k >= nowKey)
    .reduce((s, k) => s + (Number(months[k]?.prognose_hours) || 0), 0)
  const avgHours  = pastHrs.length ? pastHrs.reduce((s, v) => s + v, 0) / pastHrs.length : 0

  const worked = Number(r.number_of_times_worked) || 0
  const regDays = r.registration_date ? (nowMs - new Date(r.registration_date).getTime()) / 86400000 : Infinity

  // First matching rule wins (attention → drop-off → strong drop → rising).
  let alarm: ShiftAlarm = null
  if (regDays > NIEUW_INACTIEF_DAYS && worked === 0)                     alarm = 'nieuw_inactief'
  else if (avgHours >= WEGVALLEND_MIN_HRS && upcoming === 0)             alarm = 'wegvallend'
  else if (avgHours > 0 && upcoming < avgHours * (1 - DROPOFF_PCT))      alarm = 'daling'
  else if (avgHours < 1 && upcoming >= OPKOMEND_MIN_HRS)                 alarm = 'opkomend'

  return {
    id: String(r.candidate_id ?? ''),
    name: r.name ?? '',
    position: r.position,
    city: r.city,
    avgHours: Math.round(avgHours),
    upcomingHours: Math.round(upcoming),
    alarm,
  }
}

export function useShiftAnalysis(contractForm?: string | null) {
  // retry:false so an unavailable feed resolves fast to the empty-state.
  const { data, isLoading, error } = useQuery({
    queryKey: ['sm_shift_analysis'],
    queryFn: async ({ signal }) => (await api.get('/sm_reports/shifts-per-candidate', { signal })).data,
    retry: false,
  })
  const unavailable = error ? isServiceUnavailable(error) : false

  const derived = useMemo(() => {
    const rawAll = (Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []) as RawRow[]
    const now = new Date()
    const nowKey = currentMonthKey(now)
    const nowMs = now.getTime()

    // Distinct contract forms (from the full set) for the filter chips.
    const contractForms = [...new Set(rawAll.map(r => r.contract_form).filter((x): x is string => Boolean(x)))].sort()
    // Apply the contract-form filter (default UZK on the page) before deriving anything.
    const raw = contractForm ? rawAll.filter(r => r.contract_form === contractForm) : rawAll

    // Alarm rows (KPI + attention) — one per candidate.
    const rows = raw.map(r => toRow(r, nowKey, nowMs))

    // Month columns = the sorted union of month keys across all (filtered) candidates.
    const monthSet = new Set<string>()
    raw.forEach(r => Object.keys(r.months ?? {}).forEach(k => monthSet.add(k)))
    const monthColumns = [...monthSet].sort()

    // Matrix rows keep the raw per-month cells so the table can pick any metric.
    const matrixRows: MatrixRow[] = raw.map(r => ({
      id: String(r.candidate_id ?? ''), name: r.name ?? '', position: r.position, contract_form: r.contract_form, months: r.months ?? {},
    }))

    // Geplande UZK per maand = # candidates with a planned shift that month.
    const plannedPerMonth = monthColumns.map(m => ({
      month: m,
      count: raw.filter(r => (Number(r.months?.[m]?.prognose_shifts) || 0) > 0).length,
    }))

    return { rows, monthColumns, matrixRows, plannedPerMonth, contractForms }
  }, [data, contractForm])

  return { ...derived, loading: isLoading, error: !!error && !unavailable, unavailable }
}
