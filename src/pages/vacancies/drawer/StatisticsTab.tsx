import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import StatsTabJs from '@/components/drawer/tabs/StatsTab'
import MiniDonutJs from '@/components/charts/MiniDonut'
import { sectionTitle } from '@/components/ui/SectionCard'
import { useNavigation } from '@/context/NavigationContext'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useDateFormat } from '@/lib/datetime'
import { daysSince } from './vacancyAiInsights'
import { pickKey } from '../data/vacanciesShared'
import type { VacancyDetail } from '@/types/vacancy'

type AnyProps = Record<string, unknown>
// StatsTab/MiniDonut are still untyped JS — accept any props at the boundary.
const StatsTab  = StatsTabJs as ComponentType<{ kpisTitle?: unknown; kpis?: unknown[]; overview?: unknown; activity?: unknown }>
const MiniDonut = MiniDonutJs as unknown as ComponentType<AnyProps>

/**
 * StatisticsTab — conversion + operational numbers for one vacancy, built entirely
 * from the detail payload the drawer already loaded (no extra fetch): applied→hired
 * conversion, leads→applications, days open, published job-board channels and the
 * per-phase funnel (donut, click-through to Sollicitaties pre-filtered on this
 * vacancy + stage). Mirrors the shared `components/drawer/tabs/StatsTab` the
 * candidate/customer drawers already use (this tab used to hand-roll its own tiles
 * — a blueprint-conformance drift, V25) so every entity's Statistics tab reads the
 * same. V25 root cause: GET /vacancies/{id} never attached applications_by_phase
 * (only the list endpoint did) — mapVacancyDetail now derives it from the loaded
 * `applications` array instead, so this tab (and the Sollicitaties tab) are no
 * longer empty for a real vacancy.
 */
export default function StatisticsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  // Phase-donut click → Sollicitaties, pre-filtered on this vacancy + that stage.
  const { navigate } = useNavigation()
  const { phases } = useVacancyLookups()
  const { formatDate, formatDateTime } = useDateFormat()

  const byPhase = (v.applicationsByPhase ?? {}) as Record<string, number>
  const applied = byPhase.applied ?? v.applicationsCount ?? 0
  const hired = byPhase.hired ?? 0
  const totalApps = v.applicationsCount ?? 0
  const leads = v.leadsCount ?? 0
  const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—')

  // Not enough data to show anything meaningful.
  if (totalApps === 0 && leads === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('statistics.empty')}</div>
  }

  // Days the vacancy has been open (created → now); undefined date → no tile value.
  const daysOpen = daysSince(v.created)
  // Job-board channels this vacancy is actually published on, out of the configured set.
  const publishedChannels = (v.channels ?? []).filter(c => c.published)
  // Most recent drawer event (notes/applications/matches — the timeline is already newest-first).
  const lastActivity = v.timeline?.[0]?.time

  // Per-phase breakdown for the donut — only phases with a real count, tenant order/colour.
  const phaseData = phases
    .map(p => ({ name: p.label, key: p.value, color: p.color, value: byPhase[p.value] ?? 0 }))
    .filter(d => d.value > 0)
  const jumpToPhase = (stage: string) => navigate('applications', { stage, vacancy: String(v.id) })

  return (
    <div>
      <StatsTab
        kpisTitle={t('drawer.tabs.statistics')}
        kpis={[
          { label: t('statistics.conversionRate'), value: pct(hired, applied || totalApps),
            sub: t('statistics.appliedToHired'), color: 'var(--color-success)' },
          { label: t('statistics.leadsToApplications'), value: pct(totalApps, leads),
            sub: t('statistics.ofLeads', { count: leads }), color: 'var(--color-primary)' },
          { label: t('statistics.daysOpen'), value: daysOpen ?? '—',
            sub: v.created ? t('statistics.daysOpenSub', { date: formatDate(v.created) }) : undefined, color: 'var(--color-secondary)' },
          { label: t('statistics.channelsPublished'), value: publishedChannels.length,
            sub: t('statistics.channelsPublishedSub', { total: (v.channels ?? []).length }), color: '#8B5CF6' },
        ]}
        overview={{
          title: t('statistics.overviewTitle'),
          rows: [
            [t('statistics.createdOn'), v.created ? formatDate(v.created) : '—'],
            [t('statistics.lastActivity'), lastActivity ? formatDateTime(lastActivity) : '—'],
            [t('columns.leads'), String(leads)],
            [t('columns.applications'), String(totalApps)],
          ],
        }}
      />

      {/* Per-phase funnel — donut + clickable legend (same click-to-filter convention
          as the insights row's donuts, §3A), replacing the old hand-rolled bar list. */}
      <div style={{ marginTop: 16 }}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>{t('applicants.byPhase')}</div>
        {phaseData.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <MiniDonut data={phaseData} size={72} showCenter={false}
              onItemClick={(d: unknown) => { const k = pickKey(d); if (k) jumpToPhase(k) }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              {phaseData.map(p => (
                <button key={p.key} type="button" onClick={() => jumpToPhase(p.key)}
                  title={t('statistics.openApplications')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.value}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
