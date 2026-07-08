/**
 * PlanIntakeModal — "+ Intake plannen" from the candidate Match tab. Picking an
 * appointment TYPE proposes its duration + modality (overridable); the default
 * time is today rounded UP to the next quarter (nobody books 08:03 — it becomes
 * 08:15). The vacancy is OPTIONAL — empty makes the backend create the Intake
 * application (CONSIST-2). On success the host reloads.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import SelectMenu from '@/components/ui/SelectMenu'
import { useUsers } from '@/lib/queries'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
import type { Modality } from '@/lib/useAppointmentTypes'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import type { Id } from '@/types/common'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 440, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }
const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }

interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string }
const userName = (u: UserLike) => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// Today, rounded UP to the next quarter hour, as a datetime-local value (YYYY-MM-DDTHH:MM).
function defaultWhen(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  const q = 15 - (d.getMinutes() % 15)
  if (q !== 15) d.setMinutes(d.getMinutes() + q)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface ExistingAppointment { id: Id; scheduled_at?: string; duration_min?: number | null; modality?: string; owner_id?: Id; type?: string; vacancy_id?: Id | null }

export default function PlanIntakeModal({ candidateId, onClose, onCreated, existing }: {
  candidateId: Id
  onClose: () => void
  onCreated: () => void
  // When present the modal EDITS this appointment (prefill + PATCH) instead of creating.
  existing?: ExistingAppointment
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const { intakeTypes, metaOf } = useAppointmentTypes()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const vacancyOptions = useVacancyOptions(true)

  // datetime-local wants "YYYY-MM-DDTHH:MM" — trim an ISO string to that shape.
  const toLocalInput = (iso?: string) => iso ? iso.slice(0, 16) : ''
  const [type, setType] = useState(() => existing?.type ?? intakeTypes[0]?.value ?? '')
  const [when, setWhen] = useState(() => existing?.scheduled_at ? toLocalInput(existing.scheduled_at) : defaultWhen())
  // Duration + modality prefill from the existing appointment, else from the type.
  const [duration, setDuration] = useState<number>(() => existing?.duration_min ?? intakeTypes[0]?.default_duration_min ?? 30)
  const [modality, setModality] = useState<Modality>(() => (existing?.modality as Modality) ?? intakeTypes[0]?.default_modality ?? 'office')
  const [ownerId, setOwnerId] = useState(() => existing?.owner_id ? String(existing.owner_id) : '')
  const [vacancyId, setVacancyId] = useState(() => existing?.vacancy_id ? String(existing.vacancy_id) : '')
  const [saving, setSaving] = useState(false)
  const editing = !!existing

  // Selecting a type re-proposes its duration + modality (the user can still change them).
  const pickType = (v: string) => {
    setType(v)
    const m = metaOf(v)
    if (m) { setDuration(m.default_duration_min); setModality(m.default_modality) }
  }

  const modalityOptions: Array<{ value: Modality; label: string }> = [
    { value: 'office', label: t('work.modalityOffice') },
    { value: 'remote', label: t('work.modalityRemote') },
    { value: 'phone',  label: t('work.modalityPhone') },
  ]

  // Book the intake; vacancy_id optional (BE auto-creates the intake application).
  const submit = async () => {
    if (!when) return
    setSaving(true)
    const body = {
      scheduled_at: when, type: type || 'intake', duration_min: duration, modality,
      ...(ownerId ? { owner_id: ownerId } : {}),
      ...(vacancyId ? { vacancy_id: vacancyId } : {}),
    }
    try {
      if (editing) await api.patch(`/candidates/${candidateId}/appointments/${existing.id}`, body)
      else         await api.post(`/candidates/${candidateId}/appointments`, body)
      notifySuccess(t(editing ? 'work.intakeUpdated' : 'work.intakePlanned'))
      onCreated(); onClose()
    } catch {
      notifyError(t('work.intakeFailed'))
    } finally { setSaving(false) }
  }

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div style={panel} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t(editing ? 'work.editIntake' : 'work.planIntake')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* Type → proposes duration + modality. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>{t('work.appointmentType')}</div>
          <SelectMenu value={type || null} onChange={pickType} placeholder={t('work.pickType')}
            options={intakeTypes.map(x => ({ value: x.value, label: x.label }))} />
        </div>

        {/* Date/time (default = today, rounded up to the quarter) + duration override. */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="intake-when" style={fieldLabel as React.CSSProperties}>{t('work.intakeWhen')}</label>
            <input id="intake-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={input} />
          </div>
          <div style={{ width: 110 }}>
            <label htmlFor="intake-dur" style={fieldLabel as React.CSSProperties}>{t('work.duration')}</label>
            <input id="intake-dur" type="number" min={5} max={480} step={5} value={duration}
              onChange={e => setDuration(Number(e.target.value) || 0)} style={input} />
          </div>
        </div>

        {/* Office / remote / phone + recruiter. */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>{t('work.modality')}</div>
            <SelectMenu value={modality} onChange={v => setModality(v as Modality)} options={modalityOptions} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>{t('work.owner')}</div>
            <SelectMenu value={ownerId || null} onChange={setOwnerId} placeholder={t('work.pickOwner')}
              options={users.map(u => ({ value: String(u.id), label: userName(u) }))} />
          </div>
        </div>

        {/* Vacancy optional — empty = vacancy-less intake application. */}
        <div style={{ marginBottom: 20 }}>
          <div style={fieldLabel}>{t('work.vacancyOptional')}</div>
          <SelectMenu value={vacancyId || null} onChange={setVacancyId} placeholder={t('work.noVacancy')}
            options={vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{t('work.intakeVacancyHint')}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={submit} disabled={saving || !when}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: when ? 'pointer' : 'default', opacity: when ? 1 : 0.4 }}>
            {saving ? t('common:saving') : t(editing ? 'common:save' : 'work.createIntake')}
          </button>
        </div>
      </div>
    </>
  )
}
