/**
 * AiReport — Koios AI activity report (GET /reports/ai, RAPPORTEN-SUITE-2).
 * SPECIAL vs. every sibling report: there is NO /reports/ai/drill endpoint, so
 * every axis bar here is display-only (no button role, no hover affordance, no
 * click handler at all — SegmentBars renders non-clickable whenever `onPick`
 * is omitted, so this report simply never passes one). The KPI band reads only
 * total/tokens/amount off the summary; `amount` is a SALES figure where present
 * — this report NEVER renders or computes a cost/margin figure, by contract.
 * There is no per-report advice block: the codebase's only Koios-advice pattern
 * is the per-segment click-through drawer (ReportDrillDrawer), which needs a
 * drill target this report doesn't have — inventing a new standalone-advice
 * shape for one screen would be a one-off, so it is deliberately skipped here.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useAiReport } from './useAiReport'
import SegmentBars from './SegmentBars'
import { useDateFormat } from '@/lib/datetime'
import { formatNumber } from '@/lib/formatters'
import type { ReportPeriod, AiActivitySegment } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

export default function AiReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useAiReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Non-clickable bars: no onPick means SegmentBars drops the button role,
  // tabIndex, cursor and onClick entirely — there is nowhere for a click to go.
  const bars = (segs: AiActivitySegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    return <SegmentBars max={max}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  // KPI band: total activity + tokens + sales amount only. No cost/margin key
  // exists in the envelope and none is derived here.
  const s = data?.summary
  const kpis: KpiSpec[] = [
    { key: 'total',  label: t('ai.total'),  value: total },
    { key: 'tokens', label: t('ai.summary.tokens'), value: s?.tokens != null ? formatNumber(s.tokens) : '—' },
    { key: 'amount', label: t('ai.summary.amount'), value: s?.amount != null ? formatNumber(s.amount) : '—' },
  ]

  return (
    <div>
      {/* KPI band — total/tokens/amount only, above the tabs (candidate-page order) */}
      {hasData && (
        <div style={{ ...card, marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('ai.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('ai.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('ai.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('ai.empty')}</div>}
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Activity over time — week/day timeseries, bucket set server-side.
                Display-only, like every axis on this report. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('ai.series')}</h3>
              <SegmentBars max={data.timeseries.series.reduce((m, p) => Math.max(m, p.value), 0)}
                items={data.timeseries.series.map(p => ({ key: p.date, label: p.label, count: p.value, color: null }))} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('ai.axes.activity')}</h3>
              {bars(data.by_activity)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('ai.axes.model')}</h3>
              {bars(data.by_model)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('ai.axes.user')}</h3>
              {bars(data.by_user)}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
