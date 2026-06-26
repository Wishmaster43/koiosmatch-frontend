import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useVacancyLookups } from '../../../context/VacancyLookupsContext'
import type { VacancyDetail } from '../../../types/vacancy'

// A single labelled metric tile.
function Stat({ label, value, color }: { label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--surface)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)', marginTop: 4 }}>{value}</div>
    </div>
  )
}

/**
 * StatisticsTab — conversion view for one vacancy: applied→hired rate, the
 * per-phase funnel and the leads→applications ratio. Derived from the detail's
 * phase counts + leads; no hardcoded data.
 */
export default function StatisticsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { phases } = useVacancyLookups()

  const byPhase = (v.applicationsByPhase ?? {}) as Record<string, number>
  const applied = byPhase.applied ?? v.applicationsCount ?? 0
  const hired = byPhase.hired ?? 0
  const totalApps = v.applicationsCount ?? 0
  const leads = v.leadsCount ?? 0

  const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—')
  const maxPhase = Math.max(1, ...phases.map(p => byPhase[p.value] ?? 0))

  // Not enough data to show anything meaningful.
  if (totalApps === 0 && leads === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('statistics.empty')}</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Stat label={t('statistics.conversionRate')} value={pct(hired, applied || totalApps)} color="var(--color-success)" />
        <Stat label={t('statistics.leadsToApplications')} value={pct(totalApps, leads)} color="var(--color-primary)" />
      </div>

      {/* Funnel — applications per phase as relative bars. */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('statistics.appliedToHired')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {phases.map(p => {
          const count = byPhase[p.value] ?? 0
          const width = Math.round((count / maxPhase) * 100)
          return (
            <div key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{p.label}</span>
              <div style={{ flex: 1, height: 18, borderRadius: 5, background: 'var(--hover-bg)', overflow: 'hidden' }}>
                <div style={{ width: `${width}%`, height: '100%', background: `${p.color}59` }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', width: 28, textAlign: 'right' }}>{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
