/**
 * ShiftsChartsBlock presentational pieces — the bar chart itself, a small
 * multi-year indicator and the card wrapper (title + loading/error/empty
 * states). Dumb: they receive data + handlers, no fetching or business logic.
 */
import { useMemo } from "react"
import type { ReactNode } from "react"
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
import { useTranslation } from "react-i18next"
import { YEAR_OPACITY } from "./shiftsChartsConfig"
import type { ShiftsChartDatum, ShiftBar } from '@/types/shiftmanager'

export function BarChartWidget({ data, bars, onBarClick }: {
  data: ShiftsChartDatum[]
  bars: ShiftBar[]
  onBarClick: (datum: ShiftsChartDatum, bar: ShiftBar) => void
}) {
  // Deduplicate legend: only show the first bar per series name (avoids double
  // legend entries when several years are plotted).
  const legendPayload = useMemo(() => {
    const seen = new Set<string>()
    return bars
      .filter(b => b.legendType !== "none")
      .filter(b => {
        if (seen.has(b.name)) return false
        seen.add(b.name)
        return true
      })
      .map(b => ({ value: b.name, type: "square" as const, color: b.color }))
  }, [bars])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
        <Legend
          // @ts-expect-error recharts omits `payload` from its public prop types but renders it at runtime
          payload={legendPayload}
          wrapperStyle={{ fontSize: 12 }}
        />
        {bars.map((b) => (
          <Bar
            key={b.dataKey}
            dataKey={b.dataKey}
            name={b.name}
            fill={b.color}
            fillOpacity={b.opacity}
            legendType="none"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(datum) => onBarClick(datum as unknown as ShiftsChartDatum, b)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Small year indicator, only shown when more than one year is selected.
export function YearIndicator({ years }: { years: number[] }) {
  if (years.length < 2) return null
  return (
    <div className="flex items-center gap-2 mb-3">
      {years.map((y, i) => (
        <span key={y} className="flex items-center gap-1.5 text-xs"
          style={{ color: '#64748b', opacity: YEAR_OPACITY[i] }}>
          <span style={{ display: 'inline-block', width: 10, height: 10,
                         borderRadius: 2, background: '#64748b', opacity: YEAR_OPACITY[i] }} />
          {y}
        </span>
      ))}
    </div>
  )
}

// Card shell with title/subtitle and the loading/error/content states.
export function ChartCard({ title, subtitle, loading, error, children }: {
  title: ReactNode
  subtitle?: ReactNode
  loading?: boolean
  error?: string | null
  children?: ReactNode
}) {
  const { t } = useTranslation('shiftmanager')
  return (
    <div className="overflow-hidden bg-[var(--surface)] border shadow-sm rounded-2xl border-slate-200">
      <div className="p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {loading && (
          <div className="flex items-center justify-center h-64 text-slate-400">{t('charts.loading')}</div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center h-64 text-[var(--color-danger)]">{error}</div>
        )}
        {!loading && !error && children}
      </div>
    </div>
  )
}
