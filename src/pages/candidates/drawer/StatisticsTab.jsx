import { useTranslation } from 'react-i18next'
import StatsTab from '../../../components/drawer/tabs/StatsTab'
import { useDateFormat } from '../../../lib/datetime'

/** Statistics tab — maps the candidate onto the generic StatsTab. */
export default function StatisticsTab({ c }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  return (
    <StatsTab
      kpis={[
        { label: t('statistics.placements'),  value: c.matches?.length ?? 0,        sub: t('statistics.total'),    color: 'var(--color-primary)' },
        { label: t('statistics.applications'), value: (c.applications ?? []).length, sub: t('statistics.total'),    color: 'var(--color-secondary)' },
        { label: t('statistics.shifts'),       value: c.shiftsCount ?? 24,         sub: t('statistics.thisYear'), color: 'var(--color-success)' },
        { label: t('statistics.hoursWorked'),  value: c.hoursWorked ?? 186,          sub: t('statistics.thisYear'), color: 'var(--color-warning)' },
      ]}
      overview={{
        title: t('statistics.statusOverview'),
        rows: [
          [t('statistics.status'),      c.status ?? '-'],
          [t('statistics.lastContact'), c.lastContactDate ? formatDate(c.lastContactDate) : '-'],
          [t('statistics.contactType'), c.lastContactType ?? '-'],
          [t('statistics.memberSince'), c.created ?? '-'],
          [t('statistics.branch'),      (c.branches ?? []).join(', ') || '-'],
        ],
      }}
      activity={{
        title: t('statistics.recentActivity'),
        items: (c.timeline ?? []).slice(0, 5).map(ev => ({ text: ev.text ?? ev.description, time: ev.time ?? ev.created_at })),
        emptyText: t('statistics.noActivity'),
      }}
    />
  )
}
