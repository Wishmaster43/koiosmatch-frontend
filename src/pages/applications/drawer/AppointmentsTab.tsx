import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Plus, Clock, User, MapPin, Pencil } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
import PlanIntakeModal from '@/pages/candidates/drawer/PlanIntakeModal'
import type { ExistingAppointment } from '@/pages/candidates/drawer/PlanIntakeModal'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

// One row from GET /candidates/{id}/appointments — the shared appointments entity,
// filtered client-side to this application (that endpoint has no ?application_id filter).
interface RawAppt {
  id: Id; application_id?: Id | null; type?: string; scheduled_at?: string
  duration_min?: number | null; modality?: string
  owner?: { id?: Id; name?: string } | null
  location_name?: string | null; location_id?: Id | null; status?: string
}

const dateTimeOpts = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } as const

/**
 * AppointmentsTab — the application's appointments (shared entity, B-17/C-22).
 * Reuses the SAME PlanIntakeModal as the candidate + vacancy drawers for both
 * create and edit (Danny 2026-07-13: one appointment experience everywhere — this
 * used to be a hand-rolled free-text composer showing raw ISO datetimes). Reads
 * straight from /candidates/{id}/appointments so it always reflects the shared
 * appointments entity, not a stale copy nested under the application.
 */
export default function AppointmentsTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate } = useDateFormat()
  const { metaOf } = useAppointmentTypes()

  const [appointments, setAppointments] = useState<RawAppt[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [creating, setCreating] = useState(false)
  // The appointment being edited (pencil on a card) → prefilled shared modal → PATCH.
  const [editing, setEditing] = useState<ExistingAppointment | null>(null)

  // Load this candidate's appointments and keep only the ones linked to this application.
  const load = useCallback(() => {
    if (a.candidateId == null) { setAppointments([]); setLoading(false); return }
    setLoading(true); setLoadFailed(false)
    api.get(`/candidates/${a.candidateId}/appointments`, { quiet404: true })
      .then(r => {
        const rows = (unwrapList(r).rows) as RawAppt[]
        setAppointments(rows.filter(ap => String(ap.application_id) === String(a.id)))
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false))
  }, [a.candidateId, a.id])
  useEffect(() => { load() }, [load])

  // New-appointment button; disabled when the application has no candidate link.
  const newButton = (
    <button onClick={() => setCreating(true)} disabled={a.candidateId == null}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
        fontSize: 12, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
        background: 'none', color: 'var(--text)', cursor: a.candidateId == null ? 'not-allowed' : 'pointer',
        opacity: a.candidateId == null ? 0.5 : 1 }}>
      <Plus size={13} /> {t('appointments.new')}
    </button>
  )

  // Loading state.
  if (loading) {
    return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
  }

  // Error state — the shared appointments entity failed to load; offer a retry.
  if (loadFailed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 40, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>{t('appointments.loadError')}</span>
        <button onClick={load} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          {t('common:error.retry')}
        </button>
      </div>
    )
  }

  // Empty state (no appointments, not creating) — calm state with the CTA.
  if (!appointments.length && !creating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, textAlign: 'center', color: 'var(--text-muted)' }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Calendar size={22} style={{ opacity: 0.6 }} />
        </span>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('appointments.empty')}</div>
        <div style={{ fontSize: 12, marginTop: 4, maxWidth: 260 }}>{t('appointments.hint')}</div>
        <div style={{ marginTop: 14 }}>{newButton}</div>
        {creating && a.candidateId != null && (
          <PlanIntakeModal candidateId={a.candidateId} applicationId={a.id ?? null} defaultVacancyId={a.vacancyId} mode="appointment"
            onClose={() => setCreating(false)} onCreated={load} />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{newButton}</div>
      {appointments.map(ap => {
        const typeLabel = metaOf(ap.type)?.label ?? ap.type
        const statusLabel = ap.status === 'planned' ? t('appointments.statusPlanned') : (ap.status || '—')
        return (
          <div key={ap.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{typeLabel}</span>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
                background: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' }}>{statusLabel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              {/* Wall-time DD-MM-YYYY HH:mm — the BE stores it in UTC as-entered, so no local-tz shift. */}
              {ap.scheduled_at && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {formatDate(ap.scheduled_at, dateTimeOpts)}</span>}
              {ap.duration_min != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {t('appointments.durationMin', { count: ap.duration_min })}</span>}
              {ap.owner?.name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={12} /> {t('appointments.with')}: {ap.owner.name}</span>}
              {ap.location_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {ap.location_name}</span>}
              {/* Edit: opens the same shared modal, prefilled → PATCH. */}
              {a.candidateId != null && (
                <button onClick={() => setEditing({
                  id: ap.id, scheduled_at: ap.scheduled_at, duration_min: ap.duration_min, modality: ap.modality,
                  type: ap.type, owner_id: ap.owner?.id, location_id: ap.location_id ?? null,
                })}
                  title={t('common:edit')} aria-label={t('common:edit')}
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <Pencil size={12} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {creating && a.candidateId != null && (
        <PlanIntakeModal candidateId={a.candidateId} applicationId={a.id ?? null} defaultVacancyId={a.vacancyId} mode="appointment"
          onClose={() => setCreating(false)} onCreated={load} />
      )}
      {editing && a.candidateId != null && (
        <PlanIntakeModal candidateId={a.candidateId} existing={editing} mode="appointment"
          onClose={() => setEditing(null)} onCreated={load} />
      )}
    </div>
  )
}
