/**
 * VacanciesTab — read-only list of the customer's vacancies (GET
 * /vacancies?customer_id={id}). Empty/loading states are handled; a missing
 * endpoint (C-26 not live yet) is treated as empty rather than an error.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '../../../lib/api'
import { isAbortError } from '../../../lib/mocks'
import DataTable from '../../../components/ui/DataTable'
import StatusPill from '../../../components/ui/StatusPill'

// Defensive vacancy row mapper (snake_case-tolerant; status as object or string).
const mapRow = (v = {}) => ({
  id: v.id,
  title: v.title ?? '—',
  status: (v.status && typeof v.status === 'object') ? v.status : { label: v.status_label ?? v.status ?? '—', color: v.status_color },
  applications: v.applications_count ?? v.applicationsCount ?? 0,
})

export default function VacanciesTab({ customerId, params }) {
  const { t } = useTranslation('customers')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    api.get('/vacancies', { params: { customer_id: customerId, ...params }, signal: ctrl.signal })
      .then(res => setRows(unwrapList(res).rows.map(mapRow)))
      .catch(e => { if (!isAbortError(e)) setRows([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [customerId, JSON.stringify(params ?? {})]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title, render: v => <span style={{ color: 'var(--text)' }}>{v.title}</span> },
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: v => v.applications, render: v => v.applications },
  ]

  return <DataTable columns={columns} rows={rows} loading={loading} loadingText={t('page.loading')} emptyText={t('vacancies.empty')} />
}
