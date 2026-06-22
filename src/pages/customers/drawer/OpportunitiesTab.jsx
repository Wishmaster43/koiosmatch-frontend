/**
 * OpportunitiesTab — the actionable open demand for this customer:
 *   A) open vacancies to fill (GET /vacancies?customer_id&status=open),
 *   B) open flex shifts from planning (GET /customers/{id}/open-shifts) —
 *      MODULE-GATED behind the Planning module.
 * Both sections handle their own loading/empty state.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '../../../lib/api'
import { isAbortError } from '../../../lib/mocks'
import { useAuth } from '../../../context/AuthContext'
import { useDateFormat } from '../../../lib/datetime'
import SectionCard from '../../../components/ui/SectionCard'
import VacanciesTab from './VacanciesTab'

const Muted = ({ text }) => <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>

// Section B — open flex shifts (planning), only when the tenant has the module.
function OpenShifts({ customerId }) {
  const { t } = useTranslation('customers')
  const { hasModule } = useAuth()
  const { formatDate } = useDateFormat()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const enabled = hasModule('plan')

  useEffect(() => {
    if (!enabled || !customerId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    api.get(`/customers/${customerId}/open-shifts`, { signal: ctrl.signal })
      .then(res => setRows(unwrapList(res).rows))
      .catch(e => { if (!isAbortError(e)) setRows([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [enabled, customerId])

  if (!enabled) return <Muted text={t('opportunities.planningOff')} />
  if (loading)  return <Muted text={t('page.loading')} />
  if (rows.length === 0) return <Muted text={t('opportunities.openShiftsEmpty')} />

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {rows.map((s, i) => (
        <div key={s.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12,
          borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ width: 78, flexShrink: 0, color: 'var(--text-muted)' }}>{s.date ? formatDate(s.date) : '—'}</span>
          <span style={{ flex: 1, color: 'var(--text)' }}>{[s.shift, s.department].filter(Boolean).join(' · ') || '—'}</span>
        </div>
      ))}
    </div>
  )
}

export default function OpportunitiesTab({ customerId }) {
  const { t } = useTranslation('customers')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard title={t('opportunities.openVacancies')}>
        <VacanciesTab customerId={customerId} params={{ status: 'open' }} />
      </SectionCard>
      <SectionCard title={t('opportunities.openShifts')}>
        <OpenShifts customerId={customerId} />
      </SectionCard>
    </div>
  )
}
