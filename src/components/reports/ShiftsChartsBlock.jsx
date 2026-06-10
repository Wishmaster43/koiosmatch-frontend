/**
 * ShiftsChartsBlock.jsx
 * Toont twee staafgrafieken naast elkaar: uren (links) en diensten (rechts).
 * Filters worden via RightPanelContext naar de layout gestuurd — geen eigen
 * filter-knop of inline sidebar. De layout-topbar beheert het openen/sluiten.
 *
 * Ondersteunt:
 * - Multi-jaar vergelijking (bars worden transparanter per ouder jaar)
 * - Maand- en kwartaalweergave
 * - Individuele maanden aan/uitzetten
 * - Filter op functie, klant en locatie (geladen uit /reports/shifts-filter-options)
 * - Drill-down drawer bij klik op een bar
 */
import { useEffect, useMemo, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
import api               from "../../lib/api"
import DrillDownDrawer   from "./DrillDownDrawer"
import { useRightPanel } from "../../context/RightPanelContext"

// ── Constanten ────────────────────────────────────────────────────────────────

// Alle mogelijke reeksen met hun label en kleur
const SERIES = [
  { key: "totaal",         label: "Totaal",         color: "#1e293b" },
  { key: "niet_ingevuld",  label: "Niet ingevuld",  color: "#f59e0b" },
  { key: "geen_kandidaat", label: "Geen kandidaat", color: "#ef4444" },
  { key: "prognose",       label: "Prognose",       color: "#6366f1" },
  { key: "werkelijk",      label: "Werkelijk",      color: "#10b981" },
]

const MONTH_LABELS = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"]
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR]

// Oudere jaren krijgen lagere opacity zodat vergelijking visueel duidelijk is
const YEAR_OPACITY = [1, 0.55, 0.3]

const QUARTERS = [
  { label: "Q1", key: "Q1", months: ["01","02","03"] },
  { label: "Q2", key: "Q2", months: ["04","05","06"] },
  { label: "Q3", key: "Q3", months: ["07","08","09"] },
  { label: "Q4", key: "Q4", months: ["10","11","12"] },
]

// ── Herbruikbaar chart-component ──────────────────────────────────────────────
/**
 * BarChartWidget
 * Generieke recharts staafgrafiek. Ontvangt data-array en bar-descriptors.
 * Bar-descriptors bevatten: { dataKey, name, color, opacity }
 * onBarClick(datum, barMeta) wordt aangeroepen bij klik op een bar.
 */
function BarChartWidget({ data, bars, onBarClick }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        {bars.map((b) => (
          <Bar
            key={b.dataKey}
            dataKey={b.dataKey}
            name={b.name}
            fill={b.color}
            fillOpacity={b.opacity}
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(datum) => onBarClick(datum, b)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function ShiftsChartsBlock() {

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedYears,     setSelectedYears]     = useState([CURRENT_YEAR])
  const [selectedMonths,    setSelectedMonths]     = useState([])   // leeg = alle maanden
  const [period,            setPeriod]            = useState("month")
  const [visible,           setVisible]           = useState(SERIES.map((s) => s.key))
  const [selectedJobTypes,  setSelectedJobTypes]  = useState([])
  const [selectedLocations, setSelectedLocations] = useState([])

  // ── Data state ────────────────────────────────────────────────────────────
  const [rows,          setRows]          = useState([])
  const [filterOptions, setFilterOptions] = useState({ job_types: [], locations: [] })
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [drill,         setDrill]         = useState(null) // drill-down drawer state

  // Nieuwe context API: registerFilters/unregisterFilters ipv setFilterGroups
  const { registerFilters, unregisterFilters } = useRightPanel()

  // ── Eenmalig filter-opties laden (functies, klanten, locaties) ────────────
  useEffect(() => {
    api.get("reports/shifts-filter-options")
      .then((res) => setFilterOptions(res.data ?? { job_types: [], locations: [] }))
      .catch(() => {}) // stil falen — filters zijn optioneel
  }, [])

  // ── Chart data laden wanneer filters wijzigen ─────────────────────────────
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    // URLSearchParams ondersteunt arrays via herhaald append
    const params = new URLSearchParams()
    selectedYears.forEach((y) => params.append("years[]", y))
    selectedMonths.forEach((m) => params.append("months[]", m))
    selectedJobTypes.forEach((j) => params.append("job_type[]", j))
    selectedLocations.forEach((l) => params.append("location_id[]", l))

    api.get(`reports/shifts-per-month?${params}`)
      .then((res) => {
        if (!active) return
        const data = res.data?.data ?? res.data ?? []
        setRows(Array.isArray(data) ? data : [])
      })
      .catch((err) => active && setError(err.message ?? "Laden mislukt"))
      .finally(() => active && setLoading(false))

    return () => { active = false } // cleanup: voorkomt state-updates na unmount
  }, [selectedYears, selectedMonths, selectedJobTypes, selectedLocations])

  // ── Rows indexeren op YYYY-MM voor snelle lookup ──────────────────────────
  const byYearMonth = useMemo(
    () => new Map(rows.map((r) => [r.maand, r])),
    [rows]
  )

  // ── Chart data transformeren naar recharts-formaat ────────────────────────
  // Sleutels zijn "{jaar}_{reeks}" zodat meerdere jaren naast elkaar staan.
  const chartData = useMemo(() => {
    // Bepaal welke maand-indices zichtbaar zijn (leeg = alle 12)
    const monthIndices =
      selectedMonths.length > 0
        ? selectedMonths.map((m) => parseInt(m, 10) - 1).filter((i) => i >= 0 && i < 12)
        : Array.from({ length: 12 }, (_, i) => i)

    if (period === "quarter") {
      // Aggregeer maanddata per kwartaal per geselecteerd jaar
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

    // Per maand — één entry per zichtbare maand per geselecteerd jaar
    return monthIndices.map((i) => {
      const entry = { label: MONTH_LABELS[i], _monthIndex: i + 1 }
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

  const activeSeries = SERIES.filter((s) => visible.includes(s.key))
  const multiYear    = selectedYears.length > 1

  // ── Bar-descriptors genereren voor beide charts ───────────────────────────
  // Bij meerdere jaren: jaar-suffix in naam + lagere opacity per ouder jaar
  const shiftBars = useMemo(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s) => ({
        dataKey:   `${year}_${s.key}`,
        name:      multiYear ? `${s.label} '${String(year).slice(2)}` : s.label,
        color:     s.color,
        opacity:   YEAR_OPACITY[yi] ?? 0.25,
        year,
        seriesKey: s.key,
      }))
    ), [selectedYears, activeSeries, multiYear])

  const hoursBars = useMemo(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s) => ({
        dataKey:   `${year}_${s.key}_uren`,
        name:      multiYear ? `${s.label} '${String(year).slice(2)}` : s.label,
        color:     s.color,
        opacity:   YEAR_OPACITY[yi] ?? 0.25,
        year,
        seriesKey: `${s.key}_uren`,
      }))
    ), [selectedYears, activeSeries, multiYear])

  // ── Drill-down: bouw URL-params en open drawer ────────────────────────────
  const handleBarClick = (datum, barMeta) => {
    const { year, seriesKey } = barMeta
    const baseMetric = seriesKey.replace("_uren", "") // strip _uren suffix
    const params     = new URLSearchParams()

    if (period === "quarter") {
      params.set("quarter", datum._quarter ?? datum.label)
      params.set("year", year)
    } else {
      const mm = String(datum._monthIndex ?? 1).padStart(2, "0")
      params.set("month", `${year}-${mm}`)
    }

    params.set("metric", baseMetric)
    selectedJobTypes.forEach((j) => params.append("job_type[]", j))
    selectedLocations.forEach((l) => params.append("location_id[]", l))

    const seriesLabel = SERIES.find((s) => s.key === baseMetric)?.label ?? baseMetric
    const yearSuffix  = multiYear ? ` '${String(year).slice(2)}` : ""
    setDrill({
      title:    `${seriesLabel}${yearSuffix} — ${datum.label}`,
      fetchUrl: `reports/shifts-per-month/detail?${params}`,
    })
  }

  const periodLabel = `${selectedYears.join(", ")} — per ${period === "quarter" ? "kwartaal" : "maand"}`

  // Jaar toggle: minimaal 1 jaar altijd geselecteerd
  const toggleYear = (v) =>
    setSelectedYears((prev) => {
      const n = Number(v)
      if (prev.includes(n)) return prev.length > 1 ? prev.filter((y) => y !== n) : prev
      return [...prev, n].sort()
    })

  // ── Filter groups samenstellen voor rechter sidebar ───────────────────────
  const filterGroups = useMemo(() => {
    const groups = [
      {
        key:      "periode",
        label:    "Periode",
        selected: [period],
        options:  [
          { value: "month",   label: "Per maand" },
          { value: "quarter", label: "Per kwartaal" },
        ],
        onToggle: (v) => setPeriod(v),
      },
      {
        key:      "jaren",
        label:    "Jaren",
        selected: selectedYears.map(String),
        options:  YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) })),
        onToggle: toggleYear,
      },
    ]

    // Maanden-filter alleen relevant bij maandweergave
    if (period === "month") {
      groups.push({
        key:      "maanden",
        label:    "Maanden",
        // Leeg = alle maanden actief → toon ze allemaal als checked
        selected: selectedMonths.length > 0
          ? selectedMonths.map(String)
          : MONTH_LABELS.map((_, i) => String(i + 1)),
        options:  MONTH_LABELS.map((label, i) => ({ value: String(i + 1), label })),
        onToggle: (v) =>
          setSelectedMonths((prev) =>
            prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]
          ),
      })
    }

    // Reeksen — welke statuslijnen zichtbaar zijn in beide charts
    groups.push({
      key:      "reeksen",
      label:    "Reeksen",
      selected: visible,
      options:  SERIES.map((s) => ({ value: s.key, label: s.label })),
      onToggle: (v) =>
        setVisible((prev) =>
          prev.includes(v) ? prev.filter((k) => k !== v) : [...prev, v]
        ),
    })

    // Functie-filter — alleen tonen als backend functies terugstuurt
    if (filterOptions.job_types.length > 0) {
      groups.push({
        key:      "functie",
        label:    "Functie",
        selected: selectedJobTypes,
        options:  filterOptions.job_types.map((j) => ({ value: j, label: j })),
        onToggle: (v) =>
          setSelectedJobTypes((prev) =>
            prev.includes(v) ? prev.filter((j) => j !== v) : [...prev, v]
          ),
      })
    }

    // Locatie/klant-filter — klant naam als context in het label
    if (filterOptions.locations.length > 0) {
      groups.push({
        key:      "locatie",
        label:    "Klant / locatie",
        selected: selectedLocations,
        options:  filterOptions.locations.map((l) => ({
          value: l.id,
          label: l.customer ? `${l.name} (${l.customer})` : l.name,
        })),
        onToggle: (v) =>
          setSelectedLocations((prev) =>
            prev.includes(v) ? prev.filter((l) => l !== v) : [...prev, v]
          ),
      })
    }

    return groups
  }, [period, selectedYears, selectedMonths, visible, selectedJobTypes, selectedLocations, filterOptions])

  // ── Sync filterGroups naar rechter panel via context ──────────────────────
  // Unieke key 'shifts-charts' zodat andere pagina-componenten niet worden overschreven.
  // Ruimt zichzelf op bij unmount zodat de filterknop verdwijnt bij navigatie.
  useEffect(() => {
    registerFilters('shifts-charts', filterGroups)
    return () => unregisterFilters('shifts-charts')
  }, [filterGroups])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="p-5">

        {/* Header — geen filterknop meer, die zit in de topbar */}
        <div className="mb-5">
          <h3 className="text-base font-semibold text-slate-900">Diensten &amp; uren</h3>
          <p className="text-sm text-slate-500">{periodLabel}</p>
        </div>

        {/* Laadstatus */}
        {loading && (
          <div className="flex items-center justify-center h-64 text-slate-400">Laden…</div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center h-64 text-red-500">{error}</div>
        )}

        {/* Twee charts naast elkaar */}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">Aantal uren</p>
              <BarChartWidget data={chartData} bars={hoursBars} onBarClick={handleBarClick} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">Aantal diensten</p>
              <BarChartWidget data={chartData} bars={shiftBars} onBarClick={handleBarClick} />
            </div>
          </div>
        )}
      </div>

      {/* Drill-down drawer — toont onderliggende diensten bij klik op bar */}
      {drill && (
        <DrillDownDrawer
          title={drill.title}
          fetchUrl={drill.fetchUrl}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  )
}