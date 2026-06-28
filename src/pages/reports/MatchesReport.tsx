/**
 * MatchesReport — matches & placements summary (GET /reports/matches).
 *
 * KPI strip (total · via-funnel vs direct) over a placements breakdown
 * (sent/active/ended by HelloFlex contract status). `avg_placement_duration_days`
 * is honestly null until the HelloFlex coupling fills placement start/end — we
 * show a note rather than a fabricated number. Data lives in useMatchesReport.
 */
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useMatchesReport } from './useMatchesReport'
import type { ReportPeriod } from '@/types/analytics'

// One placement stat tile.
function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 120, padding: '14px 16px', borderRadius: 10,
                  background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: accent ? 'var(--color-primary)' : 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function MatchesReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error } = useMatchesReport(period)
  const isEmpty = !loading && !error && (!data || data.total === 0)

  const kpis: KpiSpec[] = [
    { key: 'total',  label: t('matches.total'),     value: data?.total ?? 0 },
    { key: 'funnel', label: t('matches.viaFunnel'), value: data?.by_origin.funnel ?? 0 },
    { key: 'direct', label: t('matches.direct'),    value: data?.by_origin.direct ?? 0 },
    { key: 'dur',    label: t('matches.avgDuration'),
      value: data?.avg_placement_duration_days != null ? t('matches.daysValue', { days: Math.round(data.avg_placement_duration_days) }) : '—' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t('matches.title')}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matches.subtitle')}</p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)',
                      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {t('matches.loading')}
        </div>
      )}
      {error && !loading && (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)',
                      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {t('matches.error')}
        </div>
      )}
      {isEmpty && (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)',
                      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {t('matches.empty')}
        </div>
      )}

      {!loading && !error && !isEmpty && data && (
        <>
          {/* Origin KPIs */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
            <InsightsRow kpis={kpis} padding="14px 20px" />
          </div>

          {/* Placements breakdown */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matches.placements.title')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <StatTile label={t('matches.placements.sent')}   value={data.placements.sent} />
              <StatTile label={t('matches.placements.active')} value={data.placements.active} accent />
              <StatTile label={t('matches.placements.ended')}  value={data.placements.ended} />
              <StatTile label={t('matches.placements.total')}  value={data.placements.total} />
            </div>
            {data.avg_placement_duration_days == null && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>{t('matches.durationNote')}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
