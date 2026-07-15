import { useState, useEffect } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { mapApplication } from './data/mapApplication'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

interface PickOption { value: Id; label: string; client?: string }
interface AppUser { id: Id; name?: string }

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
 * POST /applications; a failure keeps the modal open with the server's message
 * (never a fabricated local row). `lockedVacancy` preselects + LOCKS the vacancy
 * field when opened from the vacancy drawer's Sollicitaties tab ("+ Sollicitatie",
 * vacancies/drawer/ApplicantsTab) — only the candidate needs picking then
 * (mirrors PlanIntakeModal's defaultVacancyId, but locked rather than editable
 * since the whole point of that entry point is "for THIS vacancy").
 */
export default function AddApplicationModal({ onClose, onCreated, lockedVacancy }: {
  onClose: () => void
  onCreated: (app: Application) => void
  lockedVacancy?: { id: Id; title: string; client?: string }
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('applications')
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }
  // Owner dropdown = the assignable (tenant-scoped) users list only — POST
  // /applications 422s with "owner does not belong to this tenant" for anyone
  // NOT in it (measured: e.g. a super-admin login isn't always a tenant user
  // row), so — unlike the cosmetic-only AddCandidateModal merge (0115255) — an
  // owner outside this list is never offered as a pickable/submittable option.
  const ownerOptions = users.map(u => ({ value: String(u.id), label: u.name ?? '—' }))
  const meIsAssignable = me?.id != null && ownerOptions.some(o => o.value === String(me.id))
  const [candidates, setCandidates] = useState<PickOption[]>([])
  const [vacancies, setVacancies]   = useState<PickOption[]>([])
  const [candidateId, setCandidateId] = useState('')
  const [vacancyId, setVacancyId]     = useState(lockedVacancy ? String(lockedVacancy.id) : '')
  // Default owner = the logged-in user, so a new application isn't ownerless by
  // default (APP-OWNER-1 — Danny: applications were created with "Geen eigenaar")
  // — but ONLY when they are actually an assignable tenant user; otherwise leave
  // it empty and let the backend's own default apply once it lands.
  const [ownerId, setOwnerId]         = useState('')
  useEffect(() => { if (meIsAssignable && !ownerId) setOwnerId(String(me!.id)) }, [meIsAssignable]) // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving]           = useState(false)

  // Load candidate options always; the vacancy list only when NOT locked (data
  // minimisation, §8/§9 — a locked value never needs the full option list).
  useEffect(() => {
    api.get('/candidates', { params: { per_page: 100 } })
      .then(r => setCandidates(unwrapList<{ id?: Id; name?: string; first_name?: string; last_name?: string }>(r).rows.map(c => ({ value: c.id ?? '', label: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' ') }))))
      .catch(() => setCandidates([]))
    if (lockedVacancy) return
    api.get('/vacancies', { params: { per_page: 100 } })
      .then(r => setVacancies(unwrapList<{ id?: Id; title?: string; titel?: string; client_name?: string; client?: string }>(r).rows.map(v => ({ value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client }))))
      .catch(() => setVacancies([]))
    // Only the presence of a locked vacancy matters (checked once, on mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Create the application. AUDIT-1 (CRITICAL, 15-07): the old catch fabricated a
  // fake local row (id: -Date.now()) and closed the modal as if it succeeded —
  // masking real failures INCLUDING the matrix-guard 422s. A failure now keeps the
  // modal open and shows the server's message inline.
  const [createError, setCreateError] = useState<string | null>(null)
  const create = async () => {
    if (!candidateId || !vacancyId || saving) return
    setSaving(true)
    setCreateError(null)
    try {
      const res = await api.post('/applications', { candidate_id: candidateId, vacancy_id: vacancyId, owner_id: ownerId || null })
      onCreated(mapApplication(res.data?.data ?? res.data))
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('add.title')} tabIndex={-1}
        className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white',
        borderRadius: 12, width: 440, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{t('add.title')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PickField label={t('add.candidate')} placeholder={t('add.candidatePlaceholder')}
            options={candidates} value={candidateId} onChange={setCandidateId} />
          {lockedVacancy ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('add.vacancy')}</div>
              <div style={{ padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)' }}>
                {lockedVacancy.client ? `${lockedVacancy.title} · ${lockedVacancy.client}` : lockedVacancy.title}
              </div>
            </div>
          ) : (
            <PickField label={t('add.vacancy')} placeholder={t('add.vacancyPlaceholder')}
              options={vacancies} value={vacancyId} onChange={setVacancyId} />
          )}
          <PickField label={t('add.owner')} placeholder={t('add.ownerPlaceholder')}
            options={ownerOptions} value={ownerId} onChange={setOwnerId} />
        </div>

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 4px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {createError}
          </div>
        )}

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
