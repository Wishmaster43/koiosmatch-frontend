/**
 * OpportunitiesTab — the actionable open demand for this customer:
 *   A) open vacancies to fill (GET /vacancies?customer_id&status=open),
 *   B) open flex shifts from planning (via useCustomerOpenShifts) —
 *      MODULE-GATED behind the Planning module.
 * Both sections handle their own loading/empty state.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import SectionCard from '@/components/ui/SectionCard'
import VacanciesTab from './VacanciesTab'
import { useCustomerOpenShifts } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

const Muted = ({ text }: { text: ReactNode }) => <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>

// Section B — open flex shifts (planning), only when the tenant has the module.
function OpenShifts({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const hasModule = auth?.hasModule ?? (() => false)
  const { formatDate } = useDateFormat()
  const enabled = hasModule('plan')
  const { rows, loading } = useCustomerOpenShifts(customerId, enabled)

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

export default function OpportunitiesTab({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation('customers')
  // Open-shifts section only exists when the tenant has the Planning module —
  // no dead placeholder ("moet weg, module staat toch uit" — Danny 2026-07-04).
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard title={t('opportunities.openVacancies')}>
        <VacanciesTab customerId={customerId} params={{ status: 'open' }} />
      </SectionCard>
      {hasPlanning && (
        <SectionCard title={t('opportunities.openShifts')}>
          <OpenShifts customerId={customerId} />
        </SectionCard>
      )}
    </div>
  )
}
