/**
 * VacanciesTab — read-only list of the customer's vacancies (GET
 * /vacancies?customer_id={id}). Empty/loading states are handled; a missing
 * endpoint (C-26 not live yet) is treated as empty rather than an error.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import type { Id } from '@/types/common'

interface VacancyRow { id?: Id; title: string; status: { label?: string; color?: string }; applications: number }

// Defensive vacancy row mapper (snake_case-tolerant; status as object or string).
const mapRow = (v: Record<string, unknown> = {}): VacancyRow => {
  const status = v.status
  return {
    id: v.id as Id | undefined,
    title: (v.title as string) ?? '—',
    status: (status && typeof status === 'object')
      ? (status as { label?: string; color?: string })
      : { label: String(v.status_label ?? v.status ?? '—'), color: v.status_color as string | undefined },
    applications: (v.applications_count ?? v.applicationsCount ?? 0) as number,
  }
}

export default function VacanciesTab({ customerId, params }: { customerId?: Id; params?: Record<string, unknown> }) {
  const { t } = useTranslation('customers')
  const [rows, setRows]       = useState<VacancyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    api.get('/vacancies', { params: { customer_id: customerId, ...params }, signal: ctrl.signal })
      .then(res => setRows(unwrapList<Record<string, unknown>>(res).rows.map(mapRow)))
      .catch(e => { if (!isAbortError(e)) setRows([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [customerId, JSON.stringify(params ?? {})]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title, render: v => <span style={{ color: 'var(--text)' }}>{v.title}</span> },
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: v => v.applications, render: v => v.applications },
  ]

  return <DataTable columns={columns} rows={rows} loading={loading} loadingText={t('page.loading')} emptyText={t('vacancies.empty')} />
}
