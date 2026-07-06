/**
 * ShiftsChartsBlock — two side-by-side charts: total hours (left) and number of
 * shifts (right). Reads its filters from RightPanelContext (no own filter button).
 * Thin container: owns the UI filter state, delegates data to useShiftsChartData
 * and the filter tree to buildShiftsFilterGroups, and renders the two cards.
 *
 * Props (the "fixed*" ones are always sent and not shown as toggleable filters):
 *   filterKey         — unique key for RightPanelContext (default 'shifts-charts')
 *   fixedCustomers    — customer names always included in the query
 *   fixedLocationIds  — location id strings always included
 *   fixedDepartmentId — department id string always included
 *   fixedCandidateId  — candidate id string always included
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation }     from "react-i18next"
import ShiftsDrillDownDrawer  from "./ShiftsDrillDownDrawer"
import { useRightPanel }      from "@/context/RightPanelContext"
import { SERIES, CURRENT_YEAR } from "./shiftsChartsConfig"
import { BarChartWidget, YearIndicator, ChartCard, ShiftsDataTable } from "./shiftsChartsWidgets"
import { useShiftsChartData } from "./useShiftsChartData"
import { buildShiftsFilterGroups } from "./buildShiftsFilterGroups"
import { useSavedShiftFilters } from "./useSavedShiftFilters"
import type { ShiftFilterState } from "./useSavedShiftFilters"
import { useShiftsBreakdown } from "./useShiftsBreakdown"
import InsightsRow from "@/components/insights/InsightsRow"
import type { KpiSpec, DonutSpec } from "@/components/insights/InsightsRow"
import type { ShiftsChartDatum, ShiftBar } from '@/types/shiftmanager'

export default function ShiftsChartsBlock({
  filterKey         = 'shifts-charts',
  fixedCustomers:    fixedCustomersProp   = [],
  fixedLocationIds:  fixedLocationIdsProp = [],
  fixedDepartmentId = null,
  fixedCandidateId  = null,
  leadingKpis,
  leadingDonuts,
}: {
  filterKey?: string
  fixedCustomers?: string[]
  fixedLocationIds?: string[]
  fixedDepartmentId?: string | null
  fixedCandidateId?: string | null
  // When present (dashboard), a combined InsightsRow is rendered on top with these
  // candidate cards + the filter-driven shift cards (hour tiles + klant/functie donuts).
  leadingKpis?: KpiSpec[]
  leadingDonuts?: DonutSpec[]
}) {
  const { t } = useTranslation('shiftmanager')
  // Stable series-label resolver (memoised so derived bars don't recompute each render).
  const seriesLabel = useCallback((key: string) => t(`charts.series.${key}`, { defaultValue: key }), [t])

  // Stabilise array props so they keep the same reference across renders
  // (a default [] in props would otherwise cause an infinite re-render loop).
  const fixedCustomers   = useMemo(() => fixedCustomersProp,
    [fixedCustomersProp.join(',')])   // eslint-disable-line
  const fixedLocationIds = useMemo(() => fixedLocationIdsProp,
    [fixedLocationIdsProp.join(',')]) // eslint-disable-line

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedYears,      setSelectedYears]      = useState<number[]>([CURRENT_YEAR])
  // All 12 months selected by default (explicit set, never "empty means all"): the toggle
  // then removes/adds one at a time and the chart always follows this set, chronologically.
  const [selectedMonths,     setSelectedMonths]     = useState<string[]>(() => Array.from({ length: 12 }, (_, i) => String(i + 1)))
  const [period,             setPeriod]             = useState("month")
  const [visible,            setVisible]            = useState<string[]>(SERIES.map((s) => s.key))
  const [selectedJobTypes,   setSelectedJobTypes]   = useState<string[]>([])
  const [selectedCustomers,  setSelectedCustomers]  = useState<string[]>([])
  const [selectedLocations,  setSelectedLocations]  = useState<string[]>([])
  const [drill,              setDrill]              = useState<{ baseQuery: string; metric: string; label: string; yearSuffix: string } | null>(null)

  // ── Data layer ──────────────────────────────────────────────────────────────
  const { loading, error, filterOptions, chartData, shiftBars, hoursBars, multiYear, queryString, hourStats } =
    useShiftsChartData({
      selectedYears, selectedMonths, period, visible,
      selectedJobTypes, selectedCustomers, selectedLocations,
      fixedCustomers, fixedLocationIds, fixedDepartmentId, fixedCandidateId,
      seriesLabel,
    })

  // Shift-based dashboard cards (only when this block drives the KPI row). Donuts
  // (klant/functie) come from the filtered shifts-breakdown; hour tiles from the
  // filtered chartData. Both follow the applied filter (Danny).
  const showKpiRow = !!leadingKpis
  const { customerDonut, functionDonut } = useShiftsBreakdown(queryString)
  const fmtH = (n: number) => Math.round(n).toLocaleString('nl-NL')
  const kpiRow: KpiSpec[] = [
    ...(leadingKpis ?? []),
    { key: 'open_hours',       label: t('dashboard.stats.openHours'),      value: fmtH(hourStats.openHours),           color: 'var(--color-warning)' },
    { key: 'hours_this_month', label: t('dashboard.stats.hoursThisMonth'), value: fmtH(hourStats.currentMonthForecast), color: 'var(--color-warning)' },
    { key: 'occupancy_pct',    label: t('dashboard.stats.occupancy'),      value: hourStats.occupancy != null ? `${hourStats.occupancy}%` : '—', color: 'var(--color-success)' },
  ]
  const donutRow: DonutSpec[] = [
    ...(leadingDonuts ?? []),
    { key: 'function', title: t('dashboard.charts.byFunction'), data: functionDonut, colors: functionDonut.map(d => d.color) },
    { key: 'customer', title: t('dashboard.charts.byCustomer'), data: customerDonut, colors: customerDonut.map(d => d.color) },
  ]

  // Location id → { name, customer } so the drill-down totals can show real customer
  // names (the detail rows only carry a customer_external_id).
  const locationMeta = useMemo(() => {
    const m = new Map<string, { name?: string; customer?: string }>()
    for (const l of filterOptions.locations) m.set(String(l.id), { name: l.name, customer: l.customer as string | undefined })
    return m
  }, [filterOptions.locations])

  // ── Drill-down ────────────────────────────────────────────────────────────
  const handleBarClick = (datum: ShiftsChartDatum, barMeta: ShiftBar) => {
    const { year, seriesKey } = barMeta
    const baseMetric = seriesKey.replace("_uren", "")
    const params     = new URLSearchParams()

    if (period === "quarter") {
      params.set("quarter", String(datum._quarter ?? datum.label))
      params.set("year", String(year))
    } else {
      const mm = String(datum._monthIndex ?? 1).padStart(2, "0")
      params.set("month", `${year}-${mm}`)
    }

    // NB: metric is NOT baked in — the drawer appends the chosen series, so you can
    // switch Totaal / Niet ingevuld / … in the drawer without reopening (Danny).
    selectedJobTypes.forEach((j) => params.append("job_type[]", j))
    selectedLocations.forEach((l) => params.append("location_id[]", l))
    fixedLocationIds.forEach((l)  => params.append("location_id[]", l))
    if (fixedDepartmentId) params.append("department_id[]", fixedDepartmentId)
    if (fixedCandidateId)  params.append("candidate_id[]",  fixedCandidateId)

    const yearSuffix = multiYear ? ` '${String(year).slice(2)}` : ""
    setDrill({ baseQuery: params.toString(), metric: baseMetric, label: datum.label, yearSuffix })
  }

  // Add/remove a year, keeping at least one selected.
  const toggleYear = (v: string) =>
    setSelectedYears((prev) => {
      const n = Number(v)
      if (prev.includes(n)) return prev.length > 1 ? prev.filter((y) => y !== n) : prev
      return [...prev, n].sort()
    })

  // Add/remove a month — keep ≥1 selected and always numerically sorted, so the
  // chart never collapses to one month and shows Mei·Juni·Juli regardless of click order.
  const toggleMonth = (v: string) =>
    setSelectedMonths((prev) =>
      prev.includes(v)
        ? (prev.length > 1 ? prev.filter((m) => m !== v) : prev)
        : [...prev, v].sort((a, b) => Number(a) - Number(b))
    )

  const periodLabel = t('charts.periodLabel', {
    years: selectedYears.join(", "),
    unit:  period === "quarter" ? t('charts.perQuarterUnit') : t('charts.perMonthUnit'),
  })

  // Save/load named filter sets — lives IN the right filter panel (localStorage
  // interim; swaps to /sm_reports/saved-filters when SM-FILT-SAVE lands). Scoped
  // per page via filterKey, so it only appears where it's registered.
  const { saved, save, remove, setDefault, defaultState } = useSavedShiftFilters(`sm-saved-filters:${filterKey}`)
  const applyFilterState = useCallback((s: ShiftFilterState) => {
    setSelectedYears(s.selectedYears); setSelectedMonths(s.selectedMonths); setPeriod(s.period)
    setVisible(s.visible); setSelectedJobTypes(s.selectedJobTypes)
    setSelectedCustomers(s.selectedCustomers); setSelectedLocations(s.selectedLocations)
  }, [])

  // Apply the default saved filter once on mount (Danny: "wordt niet default geladen?").
  const appliedDefaultRef = useRef(false)
  useEffect(() => {
    if (appliedDefaultRef.current || !defaultState) return
    applyFilterState(defaultState)
    appliedDefaultRef.current = true
  }, [defaultState, applyFilterState])

  // ── Filter groups for the right sidebar ───────────────────────────────────
  // A saved-filters group is pinned on top; the SM groups opt out of the chip
  // summary (noChip) — with every month/series selected by default it was noise.
  const filterGroups = useMemo(() => {
    const filterState: ShiftFilterState = { selectedYears, selectedMonths, period, visible, selectedJobTypes, selectedCustomers, selectedLocations }
    return [
      { key: `${filterKey}-saved`, type: 'saved-filters', label: t('savedFilters.title'),
        value: JSON.stringify(filterState), selected: saved.map(s => s.id),
        saved, onSave: (name: string) => save(name, filterState), onLoad: applyFilterState, onDelete: remove, onSetDefault: setDefault },
      ...buildShiftsFilterGroups({
        t, seriesLabel, period, selectedYears, selectedMonths, visible,
        selectedJobTypes, selectedCustomers, selectedLocations, filterOptions,
        fixedCustomers, fixedLocationIds,
        setPeriod, toggleYear, toggleMonth, setVisible,
        setSelectedJobTypes, setSelectedCustomers, setSelectedLocations,
      }).map(g => ({ ...g, noChip: true })),
    ]
  }, [t, seriesLabel, period, selectedYears, selectedMonths, visible, selectedJobTypes,
      selectedCustomers, selectedLocations, filterOptions, fixedCustomers, fixedLocationIds,
      filterKey, saved, save, remove, setDefault, applyFilterState])

  // Sync the groups into the right panel.
  const { registerFilters, unregisterFilters } = useRightPanel()
  useEffect(() => {
    registerFilters(filterKey, filterGroups)
    return () => unregisterFilters(filterKey)
  }, [filterKey, filterGroups, registerFilters, unregisterFilters])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Combined, filter-driven KPI row (dashboard only): candidate cards + shift cards */}
      {showKpiRow && <InsightsRow donuts={donutRow} kpis={kpiRow} padding="0 0 16px" />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t('charts.hours')} subtitle={periodLabel} loading={loading} error={error}>
          <YearIndicator years={selectedYears} />
          <BarChartWidget data={chartData} bars={hoursBars} onBarClick={handleBarClick} />
        </ChartCard>

        <ChartCard title={t('charts.shifts')} subtitle={periodLabel} loading={loading} error={error}>
          <YearIndicator years={selectedYears} />
          <BarChartWidget data={chartData} bars={shiftBars} onBarClick={handleBarClick} />
        </ChartCard>
      </div>

      {/* Same data as a table under each chart (hours + shifts per month, with totals). */}
      <div className="grid grid-cols-1 gap-4 mt-4 lg:grid-cols-2">
        <ChartCard title={t('charts.hoursTable')} subtitle={periodLabel} loading={loading} error={error}>
          <ShiftsDataTable data={chartData} bars={hoursBars} monthLabel={t('charts.periodCol')} totalLabel={t('charts.totalRow')} multiYear={multiYear} onCellClick={handleBarClick} />
        </ChartCard>
        <ChartCard title={t('charts.shiftsTable')} subtitle={periodLabel} loading={loading} error={error}>
          <ShiftsDataTable data={chartData} bars={shiftBars} monthLabel={t('charts.periodCol')} totalLabel={t('charts.totalRow')} multiYear={multiYear} onCellClick={handleBarClick} />
        </ChartCard>
      </div>

      {drill && (
        <ShiftsDrillDownDrawer
          metric={drill.metric}
          metricOptions={SERIES.map(s => ({ value: s.key, label: seriesLabel(s.key) }))}
          buildUrl={(m) => `/sm_reports/shifts-per-month/detail?${drill.baseQuery}&metric=${m}`}
          titleFor={(m) => `${seriesLabel(m)}${drill.yearSuffix} — ${drill.label}`}
          onClose={() => setDrill(null)}
          locationMeta={locationMeta}
        />
      )}
    </>
  )
}
