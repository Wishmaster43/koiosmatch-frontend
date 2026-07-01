/**
 * StatisticsTab — the customer's numbers: matches over time + active now + open
 * vacancies + fill rate, from GET /customers/{id}/stats (via useCustomerStats).
 * Renders the shared StatsTab (KPI grid). Missing stats fall back to the record.
 */
import { useTranslation } from 'react-i18next'
import StatsTab from '@/components/drawer/tabs/StatsTab'
import { useCustomerStats } from '../hooks/useCustomerDrawerData'
import type { Customer } from '@/types/customer'

export default function StatisticsTab({ c }: { c: Customer }) {
  const { t } = useTranslation('customers')
  const stats = useCustomerStats(c?.id)

  // Prefer server stats; fall back to the counts already on the record.
  const matchesTotal  = stats?.matches_total  ?? (c as { matchesTotal?: number }).matchesTotal ?? 0
  const activeMatches = stats?.active_matches  ?? c.activeMatchesCount ?? 0
  const openVacancies = stats?.open_vacancies  ?? c.openVacanciesCount ?? 0
  const fillRate      = stats?.fill_rate != null ? `${stats.fill_rate}%` : '—'

  const kpis = [
    { label: t('statistics.matchesTotal'),  value: matchesTotal,  sub: t('statistics.matchesTotalSub'),  color: 'var(--color-primary)' },
    { label: t('statistics.activeMatches'), value: activeMatches, sub: t('statistics.activeMatchesSub'), color: 'var(--color-success)' },
    { label: t('statistics.openVacancies'), value: openVacancies, sub: t('statistics.openVacanciesSub'), color: 'var(--color-secondary)' },
    { label: t('statistics.fillRate'),      value: fillRate,      sub: t('statistics.fillRateSub'),      color: '#8B5CF6' },
  ]

  return <StatsTab kpis={kpis} />
}
