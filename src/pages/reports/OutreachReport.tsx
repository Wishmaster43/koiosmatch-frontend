/**
 * OutreachReport — tenant-wide call-list ratios (GET /reports/outreach, REPORTS-2
 * fase 1): how much of the outreach work gets done (reach rate) and what the calls
 * yield (outcome shares). Hand-rolled bars (no Recharts, §3B calm-by-default) mirror
 * IntakesReport's `Bars`. This report has no drill-down — the /reports/outreach/drill
 * endpoint doesn't exist (reportDrillGate), and there is nothing to drill into besides
 * the two breakdowns already shown here.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useOutreachReport } from './useOutreachReport'
import type { ReportPeriod } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// One horizontal bar row: label, a proportional bar, and the count — mirrors IntakesReport.
function Bars({ items }: { items: { key: string; label: string; count: number }[] }) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
      {items.map((it) => (
        <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: '0 0 34%', fontSize: 12, color: 'var(--text)', overflow: 'hidden',
                         textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <span style={{ flex: 1, height: 8, background: 'var(--hover-bg)', borderRadius: 999, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(it.count / max) * 100}%`,
                           background: 'var(--color-primary)', borderRadius: 999 }} />
          </span>
          <span style={{ flex: '0 0 40px', textAlign: 'right', fontSize: 12, fontWeight: 600,
                         fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{it.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function OutreachReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  // `period` is accepted for call-signature parity with the other reports but this
  // endpoint has no bucket — see the hook's own doc comment.
  const { data, loading, error } = useOutreachReport(period)

  const total   = data?.total_targets ?? 0
  const hasData = !loading && !error && total > 0

  const kpis: KpiSpec[] = [
    { key: 'total',   label: t('outreach.total'),   value: total },
    { key: 'reached', label: t('outreach.reached'), value: data?.reached ?? 0 },
    { key: 'rate',    label: t('outreach.reachRate'),
      value: data?.reach_rate != null ? `${Math.round(data.reach_rate * 100)}%` : '—' },
  ]

  const statusBars = (data?.by_status ?? []).map(s => ({ key: s.status, label: s.status, count: s.count }))
  const outcomeBars = (data?.by_outcome ?? []).map(o => ({ key: o.outcome, label: o.label, count: o.count }))

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {hasData && (
        <div style={{ ...card, marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('outreach.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('outreach.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('outreach.empty')}</div>}
        {hasData && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Pipeline distribution */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.byStatus')}</h3>
              <Bars items={statusBars} />
            </section>

            {/* Outcome distribution */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.byOutcome')}</h3>
              {outcomeBars.length > 0
                ? <Bars items={outcomeBars} />
                : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('outreach.noOutcomes')}</div>}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
