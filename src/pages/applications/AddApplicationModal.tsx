import { useState, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { mapApplication } from './data/mapApplication'
import CreatableSelectJs from '../../components/ui/CreatableSelect'
import { initialsOf } from '@/lib/initials'
import type { Application } from '../../types/application'
import type { Id } from '../../types/common'

type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

interface PickOption { value: Id; label: string; client?: string }

// Field label + shared searchable single-select (CreatableSelect) — replaces the
// old inline SearchField dropdown (DUP-1). allowCreate off = pick-only.
function PickField({ label, ...rest }: { label: ReactNode } & AnyProps) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <CreatableSelect allowCreate={false} style={{ width: '100%' }} {...rest} />
    </div>
  )
}

/**
 * AddApplicationModal — create a new application by linking an existing candidate
 * to a vacancy. Pickers load from /candidates and /vacancies. Persists to
 * POST /applications; on failure it still adds the row locally so the flow works
 * before the endpoint is live.
 */
export default function AddApplicationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (app: Application) => void }) {
  const { t } = useTranslation('applications')
  const [candidates, setCandidates] = useState<PickOption[]>([])
  const [vacancies, setVacancies]   = useState<PickOption[]>([])
  const [candidateId, setCandidateId] = useState('')
  const [vacancyId, setVacancyId]     = useState('')
  const [saving, setSaving]           = useState(false)

  // Load candidate + vacancy options; an empty list on failure, never demo rows.
  useEffect(() => {
    api.get('/candidates', { params: { per_page: 100 } })
      .then(r => setCandidates(unwrapList<{ id?: Id; name?: string; first_name?: string; last_name?: string }>(r).rows.map(c => ({ value: c.id ?? '', label: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' ') }))))
      .catch(() => setCandidates([]))
    api.get('/vacancies', { params: { per_page: 100 } })
      .then(r => setVacancies(unwrapList<{ id?: Id; title?: string; titel?: string; client_name?: string; client?: string }>(r).rows.map(v => ({ value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client }))))
      .catch(() => setVacancies([]))
  }, [])

  // Create the application; optimistic local row if the endpoint isn't live yet.
  const create = async () => {
    if (!candidateId || !vacancyId || saving) return
    setSaving(true)
    const cand = candidates.find(c => String(c.value) === candidateId)
    const vac  = vacancies.find(v => String(v.value) === vacancyId)
    try {
      const res = await api.post('/applications', { candidate_id: candidateId, vacancy_id: vacancyId })
      onCreated(mapApplication(res.data?.data ?? res.data))
    } catch {
      onCreated({
        id: -Date.now(), candidateId, candidateName: cand?.label ?? '—', candidateInitials: initialsOf(cand?.label),
        vacancyId, vacancyTitle: vac?.label ?? '—', client: vac?.client ?? '—',
        score: null, task: '', phaseKey: 'applied', bucket: 'active', source: 'Handmatig',
        owner: { name: '', initials: '', color: null }, candidateStatusLabel: '', candidateStatusColor: '#9CA3AF',
        created: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }), isNew: true,
      } as Application)
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white',
        borderRadius: 12, width: 440, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{t('add.title')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PickField label={t('add.candidate')} placeholder={t('add.candidatePlaceholder')}
            options={candidates} value={candidateId} onChange={setCandidateId} />
          <PickField label={t('add.vacancy')} placeholder={t('add.vacancyPlaceholder')}
            options={vacancies} value={vacancyId} onChange={setVacancyId} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid #F3F4F6' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>{t('add.cancel')}</button>
          <button onClick={create} disabled={!candidateId || !vacancyId || saving}
            style={{ height: 36, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8,
              background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: (candidateId && vacancyId) ? 1 : 0.4 }}>
            {t('add.create')}
          </button>
        </div>
      </div>
    </>
  )
}
