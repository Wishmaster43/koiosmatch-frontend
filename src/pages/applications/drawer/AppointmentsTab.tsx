import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Plus, Save, X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useDateFormat } from '@/lib/datetime'
import type { ApplicationDetail } from '@/types/application'

type Appt = ApplicationDetail['appointments'][number]

const inputStyle = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box' as const, fontFamily: 'inherit' }

/**
 * AppointmentsTab — the application's appointments (shared appointments entity,
 * B-17/C-22). Lists the planned appointments and lets the recruiter add one via
 * an inline composer → POST /candidates/{id}/appointments (optimistic + revert).
 */
export default function AppointmentsTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const { formatDate } = useDateFormat()
  const [appointments, setAppointments] = useState<Appt[]>(a.appointments ?? [])
  const [adding, setAdding] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [type, setType] = useState('')
  const [title, setTitle] = useState('')

  const reset = () => { setAdding(false); setScheduledAt(''); setType(''); setTitle('') }

  // Add an appointment: optimistic prepend, then persist; revert + toast on failure.
  const save = () => {
    if (!scheduledAt || a.candidateId == null) return
    const when = formatDate(scheduledAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const local: Appt = { id: -Date.now(), type, title, when, with: '', status: 'planned' }
    const snapshot = appointments
    setAppointments(prev => [local, ...prev])
    reset()
    api.post(`/candidates/${a.candidateId}/appointments`, { application_id: a.id, scheduled_at: scheduledAt, type, title })
      .catch(() => { setAppointments(snapshot); notifyError(t('common:actionFailed')) })
  }

  // New-appointment button; disabled when the application has no candidate link.
  const newButton = (
    <button onClick={() => setAdding(true)} disabled={a.candidateId == null}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
        fontSize: 12, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
        background: 'none', color: 'var(--text)', cursor: a.candidateId == null ? 'not-allowed' : 'pointer',
        opacity: a.candidateId == null ? 0.5 : 1 }}>
      <Plus size={13} /> {t('appointments.new')}
    </button>
  )

  // Inline composer (date + type + optional title).
  const composer = (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('appointments.datetime')}</div>
        <input type="datetime-local" aria-label={t('appointments.datetime')} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('appointments.type')}</div>
        <input value={type} onChange={e => setType(e.target.value)} placeholder={t('appointments.typePlaceholder')} style={inputStyle} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('appointments.title')}</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('appointments.titlePlaceholder')} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button onClick={save} disabled={!scheduledAt} title={t('appointments.save')}
          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: scheduledAt ? 'pointer' : 'not-allowed', opacity: scheduledAt ? 1 : 0.5 }}>
          <Save size={15} />
        </button>
        <button onClick={reset} title={t('appointments.cancel')}
          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
            background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          <X size={15} />
        </button>
      </div>
    </div>
  )

  // Empty state (no appointments, not composing) — calm state with the CTA.
  if (!appointments.length && !adding) {
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
      {adding ? composer : <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{newButton}</div>}
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
