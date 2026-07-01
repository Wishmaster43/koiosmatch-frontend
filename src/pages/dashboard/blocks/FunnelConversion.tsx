/**
 * FunnelConversion — a management dashboard block: the funnel stages in order with
 * count, % of the top-of-funnel, and the drop-off vs the previous stage. Fully
 * derived from the existing funnel counts (no backend needed). Click a stage →
 * jump to Applications filtered on that phase.
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import type { ChartDatum } from '@/components/charts/chartTypes'

export default function FunnelConversion({ data, onStageClick }: {
  data: ChartDatum[]
  onStageClick?: (filterValue: unknown) => void
}) {
  const { t } = useTranslation('dashboard')
  const top = data[0]?.value ?? 0

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('chart.funnelConversion')}</div>
      {data.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('chart.noData')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((d, i) => {
            const pct  = top > 0 ? Math.round((d.value / top) * 100) : 0
            const prev = i > 0 ? data[i - 1].value : d.value
            const drop = prev > 0 ? Math.round(((prev - d.value) / prev) * 100) : 0
            const color = d.color || 'var(--color-primary)'
            const fv = (d as { filterValue?: unknown }).filterValue
            const clickable = Boolean(onStageClick && fv != null)
            return (
              <div key={i} {...interactive(clickable ? () => onStageClick?.(fv) : undefined)}
                style={{ cursor: clickable ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)' }}>{d.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {d.value} · {pct}%
                    {i > 0 && drop > 0 && <span style={{ color: 'var(--color-danger)' }}> −{drop}%</span>}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
