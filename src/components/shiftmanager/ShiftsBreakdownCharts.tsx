/**
 * ShiftsBreakdownCharts — the two SM-CHARTS2 charts under the tables: open diensten
 * (geen_kandidaat) per klant and per functie. Horizontal ranked bars (not donuts —
 * Danny: "past niet") so long labels like "Stichting Zorgpartners Midden-Holland"
 * and "Verzorgende IG - UZK" read cleanly. Value follows the block's Uren/Diensten
 * unit. Dumb: receives rows + unit, no fetching.
 */
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useTranslation } from 'react-i18next'
import { ChartCard } from './shiftsChartsWidgets'
import type { BreakdownRow } from './useShiftsBreakdown'

// One horizontal ranked bar chart (top 10 by value).
function HBars({ rows, unit, color, empty }: { rows: BreakdownRow[]; unit: 'hours' | 'count'; color: string; empty: string }) {
  const data = [...rows]
    .map(r => ({ label: r.label || '—', value: unit === 'hours' ? Number(r.hours) || 0 : Number(r.count) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  if (data.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 13, color: 'var(--text-muted)' }}>{empty}</div>
  }
  const fmt = (v: unknown) => (Number(v) || 0).toLocaleString('nl-NL')

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmt} />
        <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11, fill: '#334155' }} />
        <Tooltip formatter={fmt} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
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
        <HBars rows={customerRows} unit={unit} color="#1B60A9" empty={t('charts.empty', { defaultValue: '—' })} />
      </ChartCard>
      <ChartCard title={t('charts.byFunctionTitle')} subtitle={sub} loading={loading} error={error}>
        <HBars rows={functionRows} unit={unit} color="#19A5CA" empty={t('charts.empty', { defaultValue: '—' })} />
      </ChartCard>
    </div>
  )
}
