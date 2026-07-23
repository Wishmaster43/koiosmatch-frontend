/**
 * ShiftsChartsBlock presentational pieces — the bar chart itself, a small
 * multi-year indicator and the card wrapper (title + loading/error/empty
 * states). Dumb: they receive data + handlers, no fetching or business logic.
 */
import { useMemo } from "react"
import type { ReactNode, CSSProperties } from "react"
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
import { useTranslation } from "react-i18next"
import ErrorBoundary from "../ui/ErrorBoundary"
import { YEAR_OPACITY } from "./shiftsChartsConfig"
import type { ShiftsChartDatum, ShiftBar } from '@/types/shiftmanager'
import { formatNumber } from '@/lib/formatters'

export function BarChartWidget({ data, bars, onBarClick }: {
  data: ShiftsChartDatum[]
  bars: ShiftBar[]
  onBarClick: (datum: ShiftsChartDatum, bar: ShiftBar) => void
}) {
  // Deduplicate legend: only show the first bar per series name (avoids double
  // legend entries when several years are plotted). The swatch reads `fill` (not the
  // plain `color`) so a muted older-year bar (SM-2YR) shows its muted swatch too.
  const legendPayload = useMemo(() => {
    const seen = new Set<string>()
    return bars
      .filter(b => b.legendType !== "none")
      .filter(b => {
        if (seen.has(b.name)) return false
        seen.add(b.name)
        return true
      })
      .map(b => ({ value: b.name, type: "square" as const, color: b.fill ?? b.color }))
  }, [bars])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
        {/* nl-NL thousands separator + force the series order (Totaal · Niet ingevuld · Geen
            kandidaat · Prognose · Werkelijk) instead of recharts' default alphabetical sort. */}
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 13 }}
          formatter={(value) => formatNumber(Number(value) || 0)}
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
            fill={b.fill ?? b.color}
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

// Small year indicator, only shown when more than one year is selected. `colors`
// (SM-2YR, optional) carries the single selected metric's per-year tint (newest =
// plain colour, older = color-mix) so the dot matches the actual bars; without it,
// falls back to the old generic slate dots.
export function YearIndicator({ years, colors }: { years: number[]; colors?: (string | undefined)[] }) {
  if (years.length < 2) return null
  return (
    <div className="flex items-center gap-2 mb-3">
      {years.map((y, i) => {
        const tint = colors?.[i]
        return (
          <span key={y} className="flex items-center gap-1.5 text-xs" style={{ color: tint ? undefined : 'var(--text-muted)', opacity: tint ? 1 : YEAR_OPACITY[i] }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                           background: tint ?? 'var(--text-muted)', opacity: tint ? 1 : YEAR_OPACITY[i] }} />
            {y}
          </span>
        )
      })}
    </div>
  )
}

// Data table under a chart: one row per bucket (month/quarter), one column per
// series (in SERIES order), a totals row, nl-NL thousands separators.
export function ShiftsDataTable({ data, bars, monthLabel, totalLabel, multiYear, onCellClick, pct = false, deltaMode = false }: {
  data: ShiftsChartDatum[]
  bars: ShiftBar[]
  monthLabel: ReactNode
  totalLabel: ReactNode
  multiYear: boolean
  // Same drill-down as a chart bar: a cell click opens (row = datum, bar = series).
  onCellClick?: (row: ShiftsChartDatum, bar: ShiftBar) => void
  // Waarden ↔ % (controlled — the toggle lives on the card title row for more space).
  pct?: boolean
  // SM-2YR: when true, `bars` is one column per YEAR for a single metric, so the "%"
  // toggle means "Δ vs the previous selected year" instead of "% of that year's Totaal"
  // (there is no Totaal column to divide by once only one metric is on screen).
  deltaMode?: boolean
}) {
  const fmt = (v: unknown) => formatNumber(Number(v) || 0)
  const fmtDelta = (d: number) => `${d > 0 ? '+' : ''}${d}%`
  const totals = bars.map(b => data.reduce((s, r) => s + (Number(r[b.dataKey]) || 0), 0))
  // Per year the "Totaal" series is the 100% baseline; every other series is a share of it
  // (Danny: "Totaal = 100%, de rest is afleiding daarvan"). Map year → its Totaal column.
  const totaalKeyByYear   = new Map<number, string>()
  const totaalTotalByYear = new Map<number, number>()
  bars.forEach((b, i) => {
    if (b.seriesKey.replace('_uren', '') === 'totaal') {
      totaalKeyByYear.set(b.year, b.dataKey)
      totaalTotalByYear.set(b.year, totals[i])
    }
  })
  // Cell text: absolute value, a Δ vs the previous column (deltaMode), or a percentage
  // of that row's Totaal series (same year, the pre-SM-2YR single-year behaviour).
  const cell = (row: ShiftsChartDatum, b: ShiftBar, idx: number) => {
    if (!pct) return fmt(row[b.dataKey])
    if (deltaMode) {
      if (idx === 0) return fmt(row[b.dataKey]) // oldest selected year — no earlier baseline to diff
      const prevVal = Number(row[bars[idx - 1].dataKey]) || 0
      const curVal  = Number(row[b.dataKey]) || 0
      return prevVal ? fmtDelta(Math.round((curVal - prevVal) / prevVal * 100)) : '—'
    }
    const denom = Number(row[totaalKeyByYear.get(b.year) ?? '']) || 0
    return denom ? `${Math.round((Number(row[b.dataKey]) || 0) / denom * 100)}%` : '—'
  }
  const totalCell = (b: ShiftBar, colTotal: number, idx: number) => {
    if (!pct) return fmt(colTotal)
    if (deltaMode) {
      if (idx === 0) return fmt(colTotal)
      const prevTotal = totals[idx - 1]
      return prevTotal ? fmtDelta(Math.round((colTotal - prevTotal) / prevTotal * 100)) : '—'
    }
    const denom = totaalTotalByYear.get(b.year) ?? 0
    return denom ? `${Math.round(colTotal / denom * 100)}%` : '—'
  }
  const th: CSSProperties = { padding: '7px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: CSSProperties = { padding: '7px 10px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)', fontVariantNumeric: 'tabular-nums' }
  const clickable = !!onCellClick
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>{monthLabel}</th>
              {bars.map(b => (
                <th key={b.dataKey} style={{ ...th, textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: b.fill ?? b.color, marginRight: 5, verticalAlign: 'middle' }} />
                  {b.name}{multiYear && !b.name.includes(String(b.year)) ? ` ${b.year}` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={String(row.label) + ri}>
                <td style={{ ...td, fontWeight: 500, textAlign: 'left' }}>{String(row.label)}</td>
                {bars.map((b, i) => (
                  <td key={b.dataKey}
                    onClick={clickable ? () => onCellClick!(row, b) : undefined}
                    onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCellClick!(row, b) } } : undefined}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    title={clickable ? `${b.name} — ${String(row.label)}` : undefined}
                    style={{ ...td, textAlign: 'right', cursor: clickable ? 'pointer' : undefined }}
                    onMouseEnter={clickable ? (e) => (e.currentTarget.style.background = 'var(--hover-bg)') : undefined}
                    onMouseLeave={clickable ? (e) => (e.currentTarget.style.background = 'none') : undefined}>
                    {cell(row, b, i)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 700, borderBottom: 'none', textAlign: 'left' }}>{totalLabel}</td>
              {bars.map((b, i) => <td key={b.dataKey} style={{ ...td, fontWeight: 700, borderBottom: 'none', textAlign: 'right' }}>{totalCell(b, totals[i], i)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Small "Waarden | %" segmented toggle — rendered on a card's title row (action slot).
// `deltaMode` (SM-2YR) relabels the right pill "Δ" (year-over-year) instead of "%".
export function PctToggle({ pct, onChange, deltaMode = false }: { pct: boolean; onChange: (v: boolean) => void; deltaMode?: boolean }) {
  const { t } = useTranslation('shiftmanager')
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      {([[false, t('charts.asValues')], [true, deltaMode ? t('charts.asDelta') : t('charts.asPct')]] as const).map(([val, label]) => (
        <button key={String(val)} type="button" onClick={() => onChange(val)}
          style={{ padding: '3px 10px', fontSize: 11, fontWeight: pct === val ? 600 : 400, border: 'none', cursor: 'pointer',
            background: pct === val ? 'var(--color-primary-bg)' : 'transparent',
            color: pct === val ? 'var(--color-primary)' : 'var(--text-muted)' }}>{label}</button>
      ))}
    </div>
  )
}

// Card shell with title/subtitle and the loading/error/content states.
export function ChartCard({ title, subtitle, action, loading, error, children }: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  loading?: boolean
  error?: string | null
  children?: ReactNode
}) {
  const { t } = useTranslation('shiftmanager')
  return (
    <div className="overflow-hidden bg-[var(--surface)] border shadow-sm rounded-2xl border-slate-200">
      <div className="p-5">
        {/* Title + subtitle on one line; optional action (e.g. Waarden|%) on the right (Danny). */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <span className="text-xs text-slate-500">· {subtitle}</span>}
          </div>
          {action}
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
