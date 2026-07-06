/**
 * ShiftsChartsBlock presentational pieces — the bar chart itself, a small
 * multi-year indicator and the card wrapper (title + loading/error/empty
 * states). Dumb: they receive data + handlers, no fetching or business logic.
 */
import { useMemo, useState } from "react"
import type { ReactNode, CSSProperties } from "react"
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
import { useTranslation } from "react-i18next"
import ErrorBoundary from "../ui/ErrorBoundary"
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
        {/* nl-NL thousands separator + force the series order (Totaal · Niet ingevuld · Geen
            kandidaat · Prognose · Werkelijk) instead of recharts' default alphabetical sort. */}
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
          formatter={(value) => (Number(value) || 0).toLocaleString('nl-NL')}
          itemSorter={(item) => bars.findIndex(b => b.dataKey === (item as { dataKey?: unknown }).dataKey)} />
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
            isAnimationActive={false}
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

// Data table under a chart: one row per bucket (month/quarter), one column per
// series (in SERIES order), a totals row, nl-NL thousands separators.
export function ShiftsDataTable({ data, bars, monthLabel, totalLabel, multiYear }: {
  data: ShiftsChartDatum[]
  bars: ShiftBar[]
  monthLabel: ReactNode
  totalLabel: ReactNode
  multiYear: boolean
}) {
  const { t } = useTranslation('shiftmanager')
  const [pct, setPct] = useState(false)
  const fmt = (v: unknown) => (Number(v) || 0).toLocaleString('nl-NL')
  const totals = bars.map(b => data.reduce((s, r) => s + (Number(r[b.dataKey]) || 0), 0))
  // Cell value: absolute, or the bucket's share of that series' total across the shown period (%).
  const cell = (v: unknown, colTotal: number) => pct ? (colTotal ? `${Math.round((Number(v) || 0) / colTotal * 100)}%` : '—') : fmt(v)
  const th: CSSProperties = { padding: '7px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: CSSProperties = { padding: '7px 10px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)', fontVariantNumeric: 'tabular-nums' }
  return (
    <div>
      {/* Waarden / % switch — % shows each month's share of that column's total. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {([[false, t('charts.asValues')], [true, t('charts.asPct')]] as const).map(([val, label]) => (
            <button key={String(val)} type="button" onClick={() => setPct(val)}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: pct === val ? 600 : 400, border: 'none', cursor: 'pointer',
                background: pct === val ? 'var(--color-primary-bg)' : 'transparent',
                color: pct === val ? 'var(--color-primary)' : 'var(--text-muted)' }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>{monthLabel}</th>
              {bars.map(b => (
                <th key={b.dataKey} style={{ ...th, textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: b.color, opacity: b.opacity, marginRight: 5, verticalAlign: 'middle' }} />
                  {b.name}{multiYear ? ` ${b.year}` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={String(row.label) + ri}>
                <td style={{ ...td, fontWeight: 500, textAlign: 'left' }}>{String(row.label)}</td>
                {bars.map((b, j) => <td key={b.dataKey} style={{ ...td, textAlign: 'right' }}>{cell(row[b.dataKey], totals[j])}</td>)}
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 700, borderBottom: 'none', textAlign: 'left' }}>{totalLabel}</td>
              {totals.map((v, i) => <td key={i} style={{ ...td, fontWeight: 700, borderBottom: 'none', textAlign: 'right' }}>{pct ? (v ? '100%' : '—') : fmt(v)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
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
        {/* Local boundary: a broken chart (bad data / lib error) shows a fallback, not a dead page. */}
        {!loading && !error && (
          <ErrorBoundary fallback={() => (
            <div className="flex items-center justify-center h-64 text-slate-400">—</div>
          )}>
            {children}
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
