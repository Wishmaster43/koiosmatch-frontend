/**
 * AddMatchModal — "+ Match" from the candidate Match tab: create a direct match on
 * a vacancy (§3B "direct match" path, no funnel), POST /matches. The vacancy is
 * required. On success the host reloads the Match tab (matches + applications).
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

export default function AddMatchModal({ candidateId, onClose, onCreated }: {
  candidateId: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation('candidates')
  const vacancyOptions = useVacancyOptions(true)
  const [vacancyId, setVacancyId] = useState('')
  const [saving, setSaving] = useState(false)

  // Direct match on the chosen vacancy (G-2 POST /matches).
  const submit = async () => {
    if (!vacancyId) return
    setSaving(true)
    try {
      await api.post('/matches', { candidate_id: candidateId, vacancy_id: vacancyId })
      notifySuccess(t('work.matchCreated'))
      onCreated(); onClose()
    } catch {
      notifyError(t('work.matchFailed'))
    } finally { setSaving(false) }
  }

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div style={panel} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('work.addMatch')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={fieldLabel}>{t('work.vacancy')}</div>
          <SelectMenu value={vacancyId || null} onChange={setVacancyId} placeholder={t('work.pickVacancy')}
            options={vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={submit} disabled={saving || !vacancyId}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: vacancyId ? 'pointer' : 'default', opacity: vacancyId ? 1 : 0.4 }}>
            {saving ? t('common:saving') : t('work.createMatch')}
          </button>
        </div>
      </div>
    </>
  )
}
