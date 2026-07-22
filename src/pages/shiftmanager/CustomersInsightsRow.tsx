/**
 * CustomersInsightsRow — compact strip of equal-size cards (donuts + KPIs) above
 * the customers table. Same layout contract as the candidates strip.
 *
 *   donuts: Array<{ key, title, data, colors?, onPick, active?, onClear? }>
 *   kpis:   Array<{ key, label, value, sub?, color, onClick?, active? }>
 */
import { FilterX } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MiniDonut from '@/components/charts/MiniDonut'
import { interactive } from '@/lib/a11y'
import { useNumberFormat } from '@/lib/formatters'
// Same contract as the shared InsightsRow — this is a near-duplicate (DUP: fold into it later).
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import type { ChartDatum } from '@/components/charts/chartTypes'

const CARD: CSSProperties = {
  flex: '1 1 0', minWidth: 0, height: 96, boxSizing: 'border-box',
  border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
  background: 'var(--surface)', display: 'flex', flexDirection: 'column',
}
const TITLE: CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

function DonutCard({ title, data, colors, onPick, active, onClear, clearTitle }: Omit<DonutSpec, 'key'> & { clearTitle: string }) {
  // Total in the title row (ring stays clean at any size — mirrors InsightsRow).
  const { formatNumber } = useNumberFormat()
  const donutTotal = (data as Array<{ value?: number }>).reduce((s, d) => s + (d.value ?? 0), 0)
  return (
    <div style={{ ...CARD, position: 'relative' }}>
      {/* Title left, total right-aligned (mirrors the shared InsightsRow, §4). */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ ...TITLE, minWidth: 0 }}>{title}</div>
        {data.length > 0 && (
          <span style={{ ...TITLE, color: 'var(--text)', flexShrink: 0 }}>{formatNumber(donutTotal)}</span>
        )}
      </div>
      {active && onClear && (
        <button onClick={onClear} title={clearTitle}
          style={{ position: 'absolute', bottom: 6, right: 6, width: 20, height: 20, borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            background: 'var(--color-primary-bg)', color: 'var(--color-primary)', border: 'none', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary)', e.currentTarget.style.color = 'var(--surface)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary-bg)', e.currentTarget.style.color = 'var(--color-primary)')}>
          <FilterX size={12} />
        </button>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {data.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          : <MiniDonut data={data as ChartDatum[]} colors={colors} size={62} showCenter={false} onItemClick={d => onPick?.(d)} />}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color, onClick, active }: Omit<KpiSpec, 'key'>) {
  const clickable = typeof onClick === 'function'
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  return (
    <div {...interactive(onClick)} title={typeof sub === 'string' ? sub : undefined}
      style={{ ...CARD,
        background: active ? 'var(--color-primary-bg)' : 'var(--surface)',
        borderColor: active ? 'var(--color-primary)' : 'var(--border)',
        cursor: clickable ? 'pointer' : 'default', transition: 'border-color 0.12s, background 0.12s' }}
      onMouseEnter={clickable ? e => { if (!active) e.currentTarget.style.borderColor = 'var(--color-primary-light)' } : undefined}
      onMouseLeave={clickable ? e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)' } : undefined}>
      <div style={TITLE}>{label}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: color || 'var(--text)' }}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
        )}
      </div>
    </div>
  )
}

export default function CustomersInsightsRow({ donuts = [], kpis = [] }: { donuts?: DonutSpec[]; kpis?: KpiSpec[] }) {
  // Existing `insights.clearFilter` key (customers.json) — mirrors how the
  // shared InsightsRow takes a translated `clearTitle` prop (§5, no hardcoded copy).
  const { t } = useTranslation('customers')
  const clearTitle = t('insights.clearFilter')
  return (
    <div style={{ padding: '16px 24px 12px', display: 'flex', gap: 10, flexShrink: 0,
      flexWrap: 'nowrap', overflowX: 'auto' }}>
      {donuts.map(({ key, ...d }) => <DonutCard key={key} {...d} clearTitle={clearTitle} />)}
      {kpis.map(({ key, ...k }) => <KpiCard key={key} {...k} />)}
    </div>
  )
}
