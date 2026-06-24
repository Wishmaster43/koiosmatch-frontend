/**
 * useShiftsChartData — owns the data layer for ShiftsChartsBlock: loads the
 * filter options and the per-month rows from /sm_reports, indexes them, and
 * derives the chart data + bar descriptors (per selected year × series).
 * UI filter state lives in the component and is passed in as arguments.
 */
import { useEffect, useMemo, useReducer, useState } from "react"
import api from "../../lib/api"
import { SERIES, monthAbbr, YEAR_OPACITY, QUARTERS } from "./shiftsChartsConfig"

export function useShiftsChartData({
  selectedYears, selectedMonths, period, visible,
  selectedJobTypes, selectedCustomers, selectedLocations,
  fixedCustomers, fixedLocationIds, fixedDepartmentId, fixedCandidateId,
  seriesLabel,
}) {
  // Single reducer holds the request lifecycle (rows + loading + error).
  const [{ rows, loading, error }, dispatch] = useReducer(
    (_, action) => action,
    { rows: [], loading: true, error: null }
  )
  const [filterOptions, setFilterOptions] = useState({ job_types: [], locations: [] })

  // Load the available filter options once.
  useEffect(() => {
    api.get("/sm_reports/shifts-filter-options")
      .then((res) => setFilterOptions(res.data ?? { job_types: [], locations: [] }))
      .catch(() => {})
  }, [])

  // Load the chart rows whenever the effective query changes.
  useEffect(() => {
    let active = true
    dispatch({ rows: [], loading: true, error: null })

    const params = new URLSearchParams()
    selectedYears.forEach((y) => params.append("years[]", y))
    selectedMonths.forEach((m) => params.append("months[]", m))
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
      const effectiveLocations = selectedLocations.length > 0
        ? selectedLocations
        : [...selectedCustomers, ...fixedCustomers].length > 0
          ? filterOptions.locations
              .filter(l => [...selectedCustomers, ...fixedCustomers].includes(l.customer ?? l.name))
              .map(l => String(l.id))
          : []
      effectiveLocations.forEach((l) => params.append("location_id[]", l))
    }

    api.get(`/sm_reports/shifts-per-month?${params}`)
      .then((res) => {
        if (!active) return
        const data = res.data?.data ?? res.data ?? []
        dispatch({ rows: Array.isArray(data) ? data : [], loading: false, error: null })
      })
      .catch((err) => active && dispatch({ rows: [], loading: false, error: err.message ?? "Laden mislukt" }))

    return () => { active = false }
  }, [selectedYears, selectedMonths, selectedJobTypes, selectedLocations, selectedCustomers,
      filterOptions.locations, fixedLocationIds, fixedCustomers, fixedDepartmentId, fixedCandidateId])

  // Index rows by "YYYY-MM" for fast lookup.
  const byYearMonth = useMemo(
    () => new Map(rows.map((r) => [r.maand, r])),
    [rows]
  )

  // Transform rows into chart data, per month or per quarter.
  const chartData = useMemo(() => {
    const monthIndices =
      selectedMonths.length > 0
        ? selectedMonths.map((m) => parseInt(m, 10) - 1).filter((i) => i >= 0 && i < 12)
        : Array.from({ length: 12 }, (_, i) => i)

    if (period === "quarter") {
      return QUARTERS.map((q) => {
        const entry = { label: q.label, _quarter: q.key }
        selectedYears.forEach((year) => {
          const qRows = q.months.map((m) => byYearMonth.get(`${year}-${m}`) ?? {})
          const sum   = (key) => qRows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0)
          SERIES.forEach((s) => {
            entry[`${year}_${s.key}`]      = sum(s.key)
            entry[`${year}_${s.key}_uren`] = sum(`${s.key}_uren`)
          })
        })
        return entry
      })
    }

    return monthIndices.map((i) => {
      const entry = { label: monthAbbr(i), _monthIndex: i + 1 }
      selectedYears.forEach((year) => {
        const key = `${year}-${String(i + 1).padStart(2, "0")}`
        const row = byYearMonth.get(key) ?? {}
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
  const shiftBars = useMemo(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s) => ({
        dataKey:    `${year}_${s.key}`,
        name:       seriesLabel(s.key),
        color:      s.color,
        opacity:    YEAR_OPACITY[yi] ?? 0.25,
        legendType: yi === 0 ? "square" : "none",
        year,
        seriesKey:  s.key,
      }))
    ), [selectedYears, activeSeries, seriesLabel])

  const hoursBars = useMemo(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s) => ({
        dataKey:    `${year}_${s.key}_uren`,
        name:       seriesLabel(s.key),
        color:      s.color,
        opacity:    YEAR_OPACITY[yi] ?? 0.25,
        legendType: yi === 0 ? "square" : "none",
        year,
        seriesKey:  `${s.key}_uren`,
      }))
    ), [selectedYears, activeSeries, seriesLabel])

  return { loading, error, filterOptions, chartData, shiftBars, hoursBars, multiYear }
}
