/**
 * IntakesReport — intake appointments over time (GET /reports/intakes, C-22).
 *
 * The shared period control drives the endpoint's `bucket` (day/week/month). Shows
 * the total, the intake time series, and a switchable breakdown (recruiter/location/
 * source/function/region). Pure presentation; data lives in useIntakesReport. The
 * endpoint is gated `candidates.view` server-side.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useIntakesReport } from './useIntakesReport'
import type { ReportPeriod, IntakeBucket } from '@/types/analytics'

// The five breakdown dimensions the endpoint returns; the selector switches between them.
const GROUPS = ['recruiter', 'location', 'source', 'function', 'region'] as const
type Group = typeof GROUPS[number]
const GROUP_KEY: Record<Group, 'by_recruiter' | 'by_location' | 'by_source' | 'by_function' | 'by_region'> = {
  recruiter: 'by_recruiter', location: 'by_location', source: 'by_source',
  function: 'by_function', region: 'by_region',
}

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// One horizontal bar row: label, a proportional bar, and the count.
function Bars({ items }: { items: IntakeBucket[] }) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
      {items.map((it, i) => (
        <div key={it.key ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

export default function IntakesReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error } = useIntakesReport(period)
  const [group, setGroup] = useState<Group>('recruiter')

  const total     = data?.total ?? 0
  const series    = data?.series ?? []
  const breakdown = data?.[GROUP_KEY[group]] ?? []
  const hasData   = !loading && !error && total > 0

  const kpis: KpiSpec[] = [{ key: 'total', label: t('intakes.total'), value: total }]

  return (
    <div>
      {/* KPI strip — total intakes, above the tabs (candidate-page order) */}
      {hasData && (
        <div style={{ ...card, marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('intakes.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('intakes.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('intakes.empty')}</div>}
        {hasData && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Intakes over time */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('intakes.series')}</h3>
              <Bars items={series} />
            </section>

            {/* Switchable breakdown per dimension */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <h3 style={head}>{t('intakes.groupBy')}</h3>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {GROUPS.map(g => {
                    const on = group === g
                    return (
                      <button key={g} type="button" onClick={() => setGroup(g)}
                        style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 999, cursor: 'pointer',
                          fontWeight: on ? 600 : 400,
                          color: on ? 'var(--color-primary)' : 'var(--text-muted)',
                          background: on ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
                          border: `1px solid ${on ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'var(--border)'}`,
                        }}>
                        {t(`intakes.by.${g}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Bars items={breakdown} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
