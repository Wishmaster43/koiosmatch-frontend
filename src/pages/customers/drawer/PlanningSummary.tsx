/**
 * PlanningSummary — lightweight "currently at work + upcoming shifts" block for a
 * customer (and, with params, a single location/department). MODULE-GATED: only
 * renders when the tenant has the Planning module; otherwise shows a calm note.
 * Reads GET /customers/{id}/planning-summary via useCustomerPlanning.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useCustomerPlanning } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

const Muted = ({ text }: { text: ReactNode }) => <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>

export default function PlanningSummary({ customerId, params }: { customerId: Id; params?: Record<string, unknown> }) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const hasModule = auth?.hasModule ?? (() => false)
  const { formatDate } = useDateFormat()
  const enabled = hasModule('plan')
  const { data, loading } = useCustomerPlanning(customerId, enabled, params)

  // Planning module not active for this tenant → calm placeholder.
  if (!enabled) return <Muted text={t('planning.off')} />
  if (loading)  return <Muted text={t('page.loading')} />

  const activeNow = data?.active_now ?? 0
  const upcoming  = data?.upcoming ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* "Currently at work" tile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--color-success-bg, #ECFDF5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={16} color="var(--color-success)" />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{activeNow}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{t('planning.activeNow')} · {t('planning.activeNowSub')}</div>
        </div>
      </div>

      {/* Upcoming shifts list */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('planning.upcoming')}</div>
        {upcoming.length === 0 ? <Muted text={t('planning.upcomingEmpty')} /> : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {upcoming.map((s, i) => {
              const candName = typeof s.candidate === 'object' && s.candidate ? s.candidate.name : s.candidate
              return (
                <div key={s.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12,
                  borderBottom: i < upcoming.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 78, flexShrink: 0, color: 'var(--text-muted)' }}>{s.date ? formatDate(s.date) : '—'}</span>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{[s.shift, s.department].filter(Boolean).join(' · ') || '—'}</span>
                  <span style={{ color: s.candidate ? 'var(--text)' : 'var(--color-warning)' }}>{candName ?? t('planning.open')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
