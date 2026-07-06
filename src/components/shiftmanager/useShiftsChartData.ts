/**
 * useShiftsChartData — owns the data layer for ShiftsChartsBlock: loads the
 * filter options and the per-month rows from /sm_reports, indexes them, and
 * derives the chart data + bar descriptors (per selected year × series).
 * UI filter state lives in the component and is passed in as arguments.
 *
 * Both fetches run through React Query: responses are cached per query, and the
 * per-month query keeps the previous rows visible while a new one loads
 * (keepPreviousData) — so toggling a filter no longer blanks the chart or
 * refetches a combo we already have (was: a raw useEffect that cleared rows to
 * [] and re-hit the aggregation on every change → felt like a full reload).
 */
import { useMemo } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import api from "@/lib/api"
import { SERIES, monthAbbr, YEAR_OPACITY, QUARTERS } from "./shiftsChartsConfig"
import type { ShiftFilterOptions, ShiftMonthRow, ShiftsChartDatum, ShiftBar } from '@/types/shiftmanager'

// Stable empty fallback so `rows` keeps a constant reference while there is no
// data (avoids re-running the downstream useMemo on every render).
const EMPTY_ROWS: ShiftMonthRow[] = []

// Stable empty filter-options fallback. Critical: without a constant reference,
// `?? { … }` yields a fresh object every render while the query is pending/errored,
// so the filterGroups memo recomputes each render and the RightPanel register/
// unregister effect loops forever ("Maximum update depth exceeded").
const EMPTY_FILTER_OPTIONS: ShiftFilterOptions = { job_types: [], locations: [] }

export function useShiftsChartData({
  selectedYears, selectedMonths, period, visible,
  selectedJobTypes, selectedCustomers, selectedLocations,
  fixedCustomers, fixedLocationIds, fixedDepartmentId, fixedCandidateId,
  seriesLabel,
}: {
  selectedYears: number[]
  selectedMonths: string[]
  period: string
  visible: string[]
  selectedJobTypes: string[]
  selectedCustomers: string[]
  selectedLocations: string[]
  fixedCustomers: string[]
  fixedLocationIds: string[]
  fixedDepartmentId: string | null
  fixedCandidateId: string | null
  seriesLabel: (key: string) => string
}) {
  // Available filter options — cached ~5 min (rarely changes).
  const filterOptionsQ = useQuery({
    queryKey: ['sm_reports', 'shifts-filter-options'],
    queryFn: async ({ signal }) =>
      ((await api.get('/sm_reports/shifts-filter-options', { signal })).data ?? { job_types: [], locations: [] }) as ShiftFilterOptions,
    staleTime: 5 * 60_000,
  })
  const filterOptions: ShiftFilterOptions = filterOptionsQ.data ?? EMPTY_FILTER_OPTIONS

  // Build the effective query string once per input change (also the cache key).
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    selectedYears.forEach((y) => params.append("years[]", String(y)))
    // Only send months[] for a real subset — all 12 selected == unfiltered (avoids a 12-param query).
    if (selectedMonths.length < 12) selectedMonths.forEach((m) => params.append("months[]", m))
    selectedJobTypes.forEach((j) => params.append("job_type[]", j))

    // Fixed department / candidate (pre-scoped context).
    if (fixedDepartmentId) params.append("department_id[]", fixedDepartmentId)
    if (fixedCandidateId)  params.append("candidate_id[]",  fixedCandidateId)

    // Effective locations: fixed locations win, then user-selected locations,
    // then customer-based filtering.
    const allFixed = [...fixedLocationIds]
    if (allFixed.length > 0) {
      allFixed.forEach((l) => params.append("location_id[]", l))
    } else {
      const wantedCustomers = [...selectedCustomers, ...fixedCustomers]
      const effectiveLocations = selectedLocations.length > 0
        ? selectedLocations
        : wantedCustomers.length > 0
          ? filterOptions.locations
              .filter(l => wantedCustomers.includes((l.customer ?? l.name) as string))
              .map(l => String(l.id))
          : []
      effectiveLocations.forEach((l) => params.append("location_id[]", l))
    }
    return params.toString()
  }, [selectedYears, selectedMonths, selectedJobTypes, selectedLocations, selectedCustomers,
      filterOptions.locations, fixedLocationIds, fixedCustomers, fixedDepartmentId, fixedCandidateId])

  // Per-month aggregation. keepPreviousData keeps the old bars on screen while a
  // new query loads and re-shows a previously-seen combo from cache instantly.
  const rowsQ = useQuery({
    queryKey: ['sm_reports', 'shifts-per-month', queryString],
    queryFn: async ({ signal }) => {
      const res  = await api.get(`/sm_reports/shifts-per-month?${queryString}`, { signal })
      const data = res.data?.data ?? res.data ?? []
      return (Array.isArray(data) ? data : []) as ShiftMonthRow[]
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const rows    = rowsQ.data ?? EMPTY_ROWS
  const loading = rowsQ.isLoading
  const error   = rowsQ.isError ? ((rowsQ.error as Error)?.message ?? "Laden mislukt") : null

  // Index rows by "YYYY-MM" for fast lookup.
  const byYearMonth = useMemo(
    () => new Map(rows.map((r) => [r.maand, r])),
    [rows]
  )

  // Transform rows into chart data, per month or per quarter.
  const chartData = useMemo<ShiftsChartDatum[]>(() => {
    // selectedMonths is the real set (default = all 12); always render chronologically.
    const monthIndices = selectedMonths
      .map((m) => parseInt(m, 10) - 1)
      .filter((i) => i >= 0 && i < 12)
      .sort((a, b) => a - b)

    if (period === "quarter") {
      return QUARTERS.map((q) => {
        const entry: ShiftsChartDatum = { label: q.label, _quarter: q.key }
        selectedYears.forEach((year) => {
          const qRows = q.months.map((m) => byYearMonth.get(`${year}-${m}`) ?? ({} as ShiftMonthRow))
          const sum   = (key: string) => qRows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0)
          SERIES.forEach((s) => {
            entry[`${year}_${s.key}`]      = sum(s.key)
            entry[`${year}_${s.key}_uren`] = sum(`${s.key}_uren`)
          })
        })
        return entry
      })
    }

    return monthIndices.map((i) => {
      const entry: ShiftsChartDatum = { label: monthAbbr(i), _monthIndex: i + 1 }
      selectedYears.forEach((year) => {
        const key = `${year}-${String(i + 1).padStart(2, "0")}`
        const row = byYearMonth.get(key) ?? ({} as ShiftMonthRow)
        SERIES.forEach((s) => {
          entry[`${year}_${s.key}`]      = Number(row[s.key]            ?? 0)
          entry[`${year}_${s.key}_uren`] = Number(row[`${s.key}_uren`] ?? 0)
        })
      })
      return entry
    })
  }, [byYearMonth, selectedYears, selectedMonths, period])

  const activeSeries = useMemo(() => SERIES.filter((s) => visible.includes(s.key)), [visible])
  const multiYear    = selectedYears.length > 1

  // Bar descriptors for the shifts chart (count) and the hours chart.
  const shiftBars = useMemo<ShiftBar[]>(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s): ShiftBar => ({
        dataKey:    `${year}_${s.key}`,
        name:       seriesLabel(s.key),
        color:      s.color,
        opacity:    YEAR_OPACITY[yi] ?? 0.25,
        legendType: yi === 0 ? "square" : "none",
        year,
        seriesKey:  s.key,
      }))
    ), [selectedYears, activeSeries, seriesLabel])

  const hoursBars = useMemo<ShiftBar[]>(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s): ShiftBar => ({
        dataKey:    `${year}_${s.key}_uren`,
        name:       seriesLabel(s.key),
        color:      s.color,
        opacity:    YEAR_OPACITY[yi] ?? 0.25,
        legendType: yi === 0 ? "square" : "none",
        year,
        seriesKey:  `${s.key}_uren`,
      }))
    ), [selectedYears, activeSeries, seriesLabel])

  // Filter-driven hour KPIs for the dashboard tiles (derived from the same filtered
  // chartData): open hours = geen-kandidaat uren · this-month = prognose of the current
  // month · occupancy = werkelijk ÷ prognose. All over the selected years/months.
  const hourStats = useMemo(() => {
    const cm = new Date().getMonth() + 1
    let open = 0, actual = 0, forecast = 0, curMonthForecast = 0, curMonthForecastShifts = 0, openShifts = 0
    for (const row of chartData) {
      for (const y of selectedYears) {
        open       += Number(row[`${y}_geen_kandidaat_uren`] || 0)
        actual     += Number(row[`${y}_werkelijk_uren`]     || 0)
        forecast   += Number(row[`${y}_prognose_uren`]      || 0)
        openShifts += Number(row[`${y}_geen_kandidaat`]     || 0)
        if (row._monthIndex === cm) {
          curMonthForecast       += Number(row[`${y}_prognose_uren`] || 0)
          curMonthForecastShifts += Number(row[`${y}_prognose`]      || 0)
        }
      }
    }
    return {
      openHours: open, actualHours: actual, openShifts,
      currentMonthForecast: curMonthForecast, currentMonthForecastShifts: curMonthForecastShifts,
      occupancy: forecast ? Math.round((actual / forecast) * 100) : null,
    }
  }, [chartData, selectedYears])

  return { loading, error, filterOptions, chartData, shiftBars, hoursBars, multiYear, queryString, hourStats }
}
