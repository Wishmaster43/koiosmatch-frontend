/**
 * StatisticsTab — the customer's numbers: matches over time + active now + open
 * vacancies + fill rate, from GET /customers/{id}/stats (via useCustomerStats).
 * The KPI cards are click-to-navigate (StatsTab's own onClick support — cursor +
 * keyboard/aria already built in there):
 *   - "Open vacatures" switches the drawer to the Vacatures tab (onGoToVacancies).
 *   - "Matches totaal" / "Nu aan het werk" navigate to the Matches page. GAP: the
 *     Matches page filters by client NAME via local page-memory, not a customer-id
 *     deep link, so this can only land on the unfiltered page today (reported in
 *     the delivery notes — a customer-id filter/intent on Matches would close it).
 *   - "Vervulgraad" is derived, not clickable; its `sub` states the formula inline.
 */
import { useTranslation } from 'react-i18next'
import StatsTab from '@/components/drawer/tabs/StatsTab'
import { useNavigation } from '@/context/NavigationContext'
import { useCustomerStats } from '../hooks/useCustomerDrawerData'
import type { Customer } from '@/types/customer'

export default function StatisticsTab({ c, onGoToVacancies }: { c: Customer; onGoToVacancies?: () => void }) {
  const { t } = useTranslation('customers')
  const stats = useCustomerStats(c?.id)
  const { navigate } = useNavigation()

  // Prefer server stats; fall back to the counts already on the record.
  const matchesTotal  = stats?.matches_total  ?? (c as { matchesTotal?: number }).matchesTotal ?? 0
  const activeMatches = stats?.active_matches  ?? c.activeMatchesCount ?? 0
  const openVacancies = stats?.open_vacancies  ?? c.openVacanciesCount ?? 0
  const fillRate      = stats?.fill_rate != null ? `${stats.fill_rate}%` : '—'

  const kpis = [
    { label: t('statistics.matchesTotal'),  value: matchesTotal,  sub: t('statistics.matchesTotalSub'),  color: 'var(--color-primary)', onClick: () => navigate('matches') },
    { label: t('statistics.activeMatches'), value: activeMatches, sub: t('statistics.activeMatchesSub'), color: 'var(--color-success)', onClick: () => navigate('matches') },
    { label: t('statistics.openVacancies'), value: openVacancies, sub: t('statistics.openVacanciesSub'), color: 'var(--color-secondary)', onClick: onGoToVacancies },
    { label: t('statistics.fillRate'),      value: fillRate,      sub: t('statistics.fillRateFormula'),  color: 'var(--color-violet)' },
  ]

  return <StatsTab kpis={kpis} />
}
