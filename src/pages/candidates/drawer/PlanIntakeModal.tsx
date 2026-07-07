/**
 * PlanIntakeModal — "+ Intake plannen" from the candidate Match tab: book an
 * intake appointment. The date/time is required; the vacancy is OPTIONAL — leaving
 * it empty makes the backend create a vacancy-less application in the Intake phase
 * (CONSIST-2), so "intake gepland" and the Intake funnel phase can never drift
 * apart. On success the host reloads (applications + appointments).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import SelectMenu from '@/components/ui/SelectMenu'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import type { Id } from '@/types/common'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }
const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }

export default function PlanIntakeModal({ candidateId, onClose, onCreated }: {
  candidateId: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation('candidates')
  const vacancyOptions = useVacancyOptions(true)
  const [when, setWhen] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [saving, setSaving] = useState(false)

  // Book the intake; vacancy_id is optional (BE auto-creates the intake application).
  const submit = async () => {
    if (!when) return
    setSaving(true)
    try {
      await api.post(`/candidates/${candidateId}/appointments`, {
        scheduled_at: when, type: 'intake', ...(vacancyId ? { vacancy_id: vacancyId } : {}),
      })
      notifySuccess(t('work.intakePlanned'))
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
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('work.planIntake')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="intake-when" style={fieldLabel as React.CSSProperties}>{t('work.intakeWhen')}</label>
          <input id="intake-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={input} />
        </div>
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
            {saving ? t('common:saving') : t('work.createIntake')}
          </button>
        </div>
      </div>
    </>
  )
}
