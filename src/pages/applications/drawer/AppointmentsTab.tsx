import { useTranslation } from 'react-i18next'
import { Calendar, Plus } from 'lucide-react'
import type { ApplicationDetail } from '@/types/application'

/**
 * AppointmentsTab — the application's appointments (= the shared appointments
 * entity, B-17/C-22). List of cards, or a calm empty state with a CTA.
 */
export default function AppointmentsTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const appointments = a.appointments ?? []

  // New-appointment button (wiring lands with the appointments entity, C-22).
  const newButton = (
    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
      fontSize: 12, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
      background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
      <Plus size={13} /> {t('appointments.new')}
    </button>
  )

  if (!appointments.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, textAlign: 'center', color: 'var(--text-muted)' }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Calendar size={22} style={{ opacity: 0.6 }} />
        </span>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('appointments.empty')}</div>
        <div style={{ fontSize: 12, marginTop: 4, maxWidth: 260 }}>{t('appointments.hint')}</div>
        <div style={{ marginTop: 14 }}>{newButton}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{newButton}</div>
      {appointments.map(ap => (
        <div key={ap.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{ap.title || ap.type}</span>
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
              background: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' }}>{t('appointments.statusPlanned')}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ap.when}</div>
          {ap.with && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('appointments.with')}: {ap.with}</div>}
        </div>
      ))}
    </div>
  )
}
