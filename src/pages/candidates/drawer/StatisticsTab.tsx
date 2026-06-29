import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import StatsTabJs from '@/components/drawer/tabs/StatsTab'
import { useDateFormat } from '@/lib/datetime'
import type { Candidate } from '@/types/candidate'

// StatsTab is still untyped JS — declare the props this tab passes.
const StatsTab = StatsTabJs as ComponentType<{ kpisTitle?: unknown; kpis?: unknown[]; overview?: unknown; activity?: unknown }>

/** Statistics tab — maps the candidate onto the generic StatsTab. */
export default function StatisticsTab({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  return (
    <StatsTab
      kpisTitle={t('drawer.tabs.statistics')}
      kpis={[
        { label: t('statistics.placements'),  value: c.matches?.length ?? 0,        sub: t('statistics.total'),    color: 'var(--color-primary)' },
        { label: t('statistics.applications'), value: (c.applications ?? []).length, sub: t('statistics.total'),    color: 'var(--color-secondary)' },
        // Tijdelijk verborgen (2026-06-27) — Diensten + Uren gewerkt terug zodra de planning-data live is.
        // { label: t('statistics.shifts'),       value: c.shiftsCount ?? 24,         sub: t('statistics.thisYear'), color: 'var(--color-success)' },
        // { label: t('statistics.hoursWorked'),  value: c.hoursWorked ?? 186,          sub: t('statistics.thisYear'), color: 'var(--color-warning)' },
      ]}
      overview={{
        title: t('statistics.statusOverview'),
        rows: [
          [t('statistics.status'),      c.status ?? '-'],
          [t('statistics.lastContact'), c.lastContactDate ? formatDate(c.lastContactDate) : '-'],
          [t('statistics.contactType'), c.lastContactType ?? '-'],
          [t('statistics.memberSince'), c.created ? formatDate(c.created) : '-'],
          [t('statistics.branch'),      (c.branches ?? []).join(', ') || '-'],
        ],
      }}
    />
  )
}
