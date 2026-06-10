import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import api from "../../lib/api"; // DE FIX: Accolades wegehaald, zodat de default export matcht!
import ReportFilterSidebar from "./ReportFilterSidebar";
import DrillDownDrawer from "./DrillDownDrawer";

const SERIES = [
  { key: "totaal",         label: "Totaal",          color: "#1e293b" },
  { key: "niet_ingevuld",  label: "Niet ingevuld",   color: "#f59e0b" },
  { key: "geen_kandidaat", label: "Geen kandidaat",  color: "#ef4444" },
  { key: "prognose",       label: "Prognose",        color: "#6366f1" },
  { key: "werkelijk",      label: "Werkelijk",       color: "#10b981" },
];

const MONTH_LABELS = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

const CURRENT_YEAR = new Date().getFullYear();

export default function ShiftsPerMonthChart() {
  const [year, setYear]             = useState(CURRENT_YEAR);
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [visible, setVisible]       = useState(SERIES.map((s) => s.key));
  const [filterOpen, setFilterOpen] = useState(false);
  const [drill, setDrill]           = useState(null); // { month, metric }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api
      .get(`reports/shifts-per-month?year=${year}`)
      .then((res) => {
        if (!active) return;
        const data = res.data?.data ?? res.data ?? [];
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => active && setError(err.message ?? "Laden mislukt"))
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [year]);

  // Fill all 12 months so the x-axis is always complete
  const chartData = useMemo(() => {
    const byMonth = new Map(rows.map((r) => [r.maand, r]));
    return MONTH_LABELS.map((label, i) => {
      const key = `${year}-${String(i + 1).padStart(2, "0")}`;
      const row = byMonth.get(key) ?? {};
      return {
        month:          key,
        label,
        totaal:         Number(row.totaal         ?? 0),
        niet_ingevuld:  Number(row.niet_ingevuld  ?? 0),
        geen_kandidaat: Number(row.geen_kandidaat ?? 0),
        prognose:       Number(row.prognose       ?? 0),
        werkelijk:      Number(row.werkelijk      ?? 0),
      };
    });
  }, [rows, year]);

  const filterGroups = useMemo(() => [
    {
      title: "Jaar",
      type: "single",
      options: [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => ({
        value: String(y),
        label: String(y),
        selected: y === year,
      })),
      onSelect: (value) => setYear(Number(value)),
    },
    {
      title: "Reeksen",
      type: "multi",
      options: SERIES.map((s) => ({
        value: s.key,
        label: s.label,
        selected: visible.includes(s.key),
      })),
      onToggle: (value) =>
        setVisible((prev) =>
          prev.includes(value)
            ? prev.filter((k) => k !== value)
            : [...prev, value]
        ),
    },
  ], [year, visible]);

  const activeSeries = SERIES.filter((s) => visible.includes(s.key));
  const drillLabel   = drill
    ? `${SERIES.find((s) => s.key === drill.metric)?.label} — ${drill.month}`
    : "";

  return (
    <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Diensten per maand</h3>
          <p className="text-sm text-slate-500">{year}</p>
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Filters
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-72 text-slate-400">
          Laden…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center justify-center text-red-500 h-72">
          {error}
        </div>
      )}

      {/* Chart */}
      {!loading && !error && (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            {activeSeries.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(data) => setDrill({ month: data.month, metric: s.key })}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Filter sidebar */}
      {filterOpen && (
        <ReportFilterSidebar
          title="Diensten per maand"
          groups={filterGroups}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {/* Drill-down drawer */}
      {drill && (
        <DrillDownDrawer
          title={drillLabel}
          fetchUrl={`reports/shifts-per-month/detail?month=${drill.month}&metric=${drill.metric}`}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}