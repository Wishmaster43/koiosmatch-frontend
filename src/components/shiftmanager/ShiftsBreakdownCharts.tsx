/**
 * ShiftsBreakdownCharts — the two SM-CHARTS2 charts under the tables: open diensten
 * (geen_kandidaat) per klant and per functie. Horizontal ranked bars (not donuts —
 * Danny: "past niet") so long labels like "Stichting Zorgpartners Midden-Holland"
 * and "Verzorgende IG - UZK" read cleanly. Value follows the block's Uren/Diensten
 * unit. Dumb: receives rows + unit, no fetching.
 */
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useTranslation } from 'react-i18next'
import { ChartCard } from './shiftsChartsWidgets'
import { BREAKDOWN_PALETTE } from './useShiftsBreakdown'
import type { BreakdownRow } from './useShiftsBreakdown'
import { formatNumber } from '@/lib/formatters'

// Both breakdown charts share one fixed height so the labels line up nicely (Danny).
const CHART_HEIGHT = 340

// One horizontal ranked bar chart (top 8 by value) — each bar its own colour (Danny).
function HBars({ rows, unit, offset, empty }: { rows: BreakdownRow[]; unit: 'hours' | 'count'; offset: number; empty: string }) {
  const data = [...rows]
    .map(r => ({ label: r.label || '—', value: unit === 'hours' ? Number(r.hours) || 0 : Number(r.count) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  if (data.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: CHART_HEIGHT, fontSize: 13, color: 'var(--text-muted)' }}>{empty}</div>
  }
  const fmt = (v: unknown) => formatNumber(Number(v) || 0)

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} layout="vertical" barCategoryGap="22%" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={fmt} />
        {/* eslint-disable-next-line no-restricted-syntax -- DATA: deliberately darker than --text-muted for legibility of long customer/function labels on horizontal bars; no close token for this specific shade */}
        <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11, fill: '#334155' }} />
        <Tooltip formatter={fmt} contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((_, i) => <Cell key={i} fill={BREAKDOWN_PALETTE[(i + offset) % BREAKDOWN_PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Small numbers table under a chart: name · uren · diensten (top 8 by hours).
function MiniTable({ rows, nameCol }: { rows: BreakdownRow[]; nameCol: string }) {
  const { t } = useTranslation('shiftmanager')
  const fmt = (v: unknown) => formatNumber(Number(v) || 0)
  const top = [...rows].sort((a, b) => (Number(b.hours) || 0) - (Number(a.hours) || 0)).slice(0, 8)
  if (top.length === 0) return null
  const th: React.CSSProperties = { padding: '5px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '5px 8px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)', fontVariantNumeric: 'tabular-nums' }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
      <thead><tr>
        <th style={{ ...th, textAlign: 'left' }}>{nameCol}</th>
        <th style={{ ...th, textAlign: 'right' }}>{t('charts.colHours')}</th>
        <th style={{ ...th, textAlign: 'right' }}>{t('charts.colShifts')}</th>
      </tr></thead>
      <tbody>
        {top.map((r, i) => (
          <tr key={r.key + i}>
            <td style={{ ...td, textAlign: 'left' }}>{r.label || '—'}</td>
            <td style={{ ...td, textAlign: 'right' }}>{fmt(r.hours)}</td>
            <td style={{ ...td, textAlign: 'right' }}>{fmt(r.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function ShiftsBreakdownCharts({ customerRows, functionRows, unit, loading, error }: {
  customerRows: BreakdownRow[]
  functionRows: BreakdownRow[]
  unit: 'hours' | 'count'
  loading?: boolean
  error?: string | null
}) {
  const { t } = useTranslation('shiftmanager')
  const sub = unit === 'hours' ? t('charts.inHours') : t('charts.inShifts')

  return (
    <div className="grid grid-cols-1 gap-4 mt-4 lg:grid-cols-2">
      <ChartCard title={t('charts.byCustomerTitle')} subtitle={sub} loading={loading} error={error}>
        <HBars rows={customerRows} unit={unit} offset={0} empty={t('charts.empty', { defaultValue: '—' })} />
        <MiniTable rows={customerRows} nameCol={t('shiftsDrawer.byCustomer')} />
      </ChartCard>
      <ChartCard title={t('charts.byFunctionTitle')} subtitle={sub} loading={loading} error={error}>
        <HBars rows={functionRows} unit={unit} offset={3} empty={t('charts.empty', { defaultValue: '—' })} />
        <MiniTable rows={functionRows} nameCol={t('shiftsDrawer.byFunction')} />
      </ChartCard>
    </div>
  )
}
