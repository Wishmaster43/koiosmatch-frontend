/**
 * VacanciesAttentionTable — accountmanager work-feed tile (dash.vacancies_attention_by_customer):
 * open vacancies that need attention, grouped with their customer, days open,
 * candidates in process and the last application date. Span-2 wide table (§3A
 * table blueprint via the shared DataTable). Row click deep-links to the
 * vacancy's applicants tab. Its registry entry lives in ./index.tsx.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { Mono } from '@/components/ui/typography'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import { useDateFormat } from '@/lib/datetime'
import type { VacancyAttentionRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Accountmanager work-feed tile (see the module doc above): row click deep-links to the vacancy's applicants tab.
export default function VacanciesAttentionTable({ rows, onNavigate }: {
  rows: VacancyAttentionRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()

  // Column set mirrors the brief exactly: title, customer (dash placeholder), the
  // two Mono counts and a formatted last-application date, all right-aligned counts.
  const columns: Column<VacancyAttentionRow>[] = useMemo(() => [
    { key: 'title', header: t('feed.col.vacancy'), render: r => r.title },
    { key: 'customer', header: t('feed.col.customer'), render: r => r.customer || '—' },
    { key: 'days_open', header: t('feed.col.daysOpen'), align: 'right', render: r => <Mono>{r.days_open}</Mono> },
    { key: 'candidates_in_process', header: t('feed.col.inProcess'), align: 'right', render: r => <Mono>{r.candidates_in_process}</Mono> },
    { key: 'last_application_at', header: t('feed.col.lastApplication'), render: r => r.last_application_at ? formatDate(r.last_application_at) : '—' },
  ], [t, formatDate])

  return (
    <Block title={t('block.vacanciesAttentionByCustomer')}>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={r => r.vacancy_id}
        onRowClick={onNavigate ? (r) => onNavigate('vacancies', { open: r.vacancy_id, tab: 'applicants' }) : undefined}
      />
    </Block>
  )
}
