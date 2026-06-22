import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronDown, Check } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { USE_MOCKS } from '../../lib/mocks'
import { mapApplication } from './data/mapApplication'
import { MOCK_APPLICATIONS, VACANCIES } from './data/mocks'

// Two-letter initials from a name.
const initialsOf = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

// A searchable single-select field (candidate / vacancy picker).
function SearchField({ label, placeholder, options, value, onChange, searchLabel }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const current = options.find(o => o.value === value)
  const shown = query ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{label}</div>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 38,
          padding: '0 12px', fontSize: 13, borderRadius: 8, border: '1px solid #E5E7EB', background: 'white',
          color: current ? '#111827' : '#9CA3AF', cursor: 'pointer' }}>
        {current?.label ?? placeholder}
        <ChevronDown size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, marginTop: 4,
          background: 'white', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={searchLabel} autoFocus
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {shown.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>}
            {shown.map(o => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px',
                  fontSize: 12, textAlign: 'left', cursor: 'pointer', border: 'none',
                  background: value === o.value ? 'var(--color-primary-bg)' : 'none', color: 'var(--text)' }}>
                {o.label}
                {value === o.value && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Mock fallbacks (USE_MOCKS only): unique candidates from the demo applications + the demo vacancies.
const mockCandidateOptions = () => {
  const seen = new Map()
  MOCK_APPLICATIONS.forEach(a => { if (!seen.has(a.candidateId)) seen.set(a.candidateId, { value: a.candidateId, label: a.candidateName }) })
  return [...seen.values()]
}
const mockVacancyOptions = () => VACANCIES.map(v => ({ value: v.id, label: v.title, client: v.client }))

/**
 * AddApplicationModal — create a new application by linking an existing candidate
 * to a vacancy. Pickers load from /candidates and /vacancies (mock fallback under
 * USE_MOCKS). Persists to POST /applications; on failure it still adds the row
 * locally so the flow works before the endpoint is live.
 */
export default function AddApplicationModal({ onClose, onCreated }) {
  const { t } = useTranslation('applications')
  const [candidates, setCandidates] = useState([])
  const [vacancies, setVacancies]   = useState([])
  const [candidateId, setCandidateId] = useState('')
  const [vacancyId, setVacancyId]     = useState('')
  const [saving, setSaving]           = useState(false)

  // Load candidate + vacancy options (fail soft to mocks).
  useEffect(() => {
    api.get('/candidates', { params: { per_page: 100 } })
      .then(r => setCandidates(unwrapList(r).rows.map(c => ({ value: c.id, label: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' ') }))))
      .catch(() => { if (USE_MOCKS) setCandidates(mockCandidateOptions()) })
    api.get('/vacancies', { params: { per_page: 100 } })
      .then(r => setVacancies(unwrapList(r).rows.map(v => ({ value: v.id, label: v.title ?? v.titel, client: v.client_name ?? v.client }))))
      .catch(() => { if (USE_MOCKS) setVacancies(mockVacancyOptions()) })
  }, [])

  // Create the application; optimistic local row if the endpoint isn't live yet.
  const create = async () => {
    if (!candidateId || !vacancyId || saving) return
    setSaving(true)
    const cand = candidates.find(c => c.value === candidateId)
    const vac  = vacancies.find(v => v.value === vacancyId)
    try {
      const res = await api.post('/applications', { candidate_id: candidateId, vacancy_id: vacancyId })
      onCreated(mapApplication(res.data?.data ?? res.data))
    } catch {
      onCreated({
        id: -Date.now(), candidateId, candidateName: cand?.label ?? '—', candidateInitials: initialsOf(cand?.label),
        vacancyId, vacancyTitle: vac?.label ?? '—', client: vac?.client ?? '—',
        score: null, task: '', phaseKey: 'applied', bucket: 'active', source: 'Handmatig',
        owner: { name: '', initials: '' }, candidateStatusLabel: '', candidateStatusColor: '#9CA3AF',
        created: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }), isNew: true,
      })
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
          <SearchField label={t('add.candidate')} placeholder={t('add.candidatePlaceholder')} searchLabel={t('add.search')}
            options={candidates} value={candidateId} onChange={setCandidateId} />
          <SearchField label={t('add.vacancy')} placeholder={t('add.vacancyPlaceholder')} searchLabel={t('add.search')}
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
