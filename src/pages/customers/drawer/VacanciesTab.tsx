/**
 * VacanciesTab — read-only list of the customer's vacancies (via
 * useCustomerVacancies → GET /vacancies?customer_id={id}). Loading/empty handled;
 * a missing endpoint (C-26 not live yet) is treated as empty rather than an error.
 */
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import { useCustomerVacancies } from '../hooks/useCustomerDrawerData'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

export default function VacanciesTab({ customerId, params }: { customerId?: Id; params?: Record<string, unknown> }) {
  const { t } = useTranslation('customers')
  const { rows, loading } = useCustomerVacancies(customerId, params)

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title, render: v => <span style={{ color: 'var(--text)' }}>{v.title}</span> },
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: v => v.applications, render: v => v.applications },
  ]

  return <DataTable columns={columns} rows={rows} loading={loading} loadingText={t('page.loading')} emptyText={t('vacancies.empty')} />
}
