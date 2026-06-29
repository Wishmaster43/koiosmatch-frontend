import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Ban, Download, Edit2, Save, X } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from './CandidateCvTemplate'
import type { CvCandidate } from './CandidateCvTemplate'
import { useCvSettings } from '@/lib/useCvSettings'
import { useTranslation } from 'react-i18next'
import { useLocale, useDateFormat } from '@/lib/datetime'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import EntityDrawerJs from '@/components/drawer/EntityDrawer'
import EntityHeaderJs from '@/components/drawer/EntityHeader'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useLookups } from '@/context/LookupsContext'
import { useGenders } from '@/lib/useGenders'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useFunctions } from '@/lib/useFunctions'
import { useAuth } from '@/context/AuthContext'
import ProfilePanel from './drawer/ProfilePanel'
import BackgroundTab from './drawer/BackgroundTab'
import WorkTab from './drawer/WorkTab'
import PlanningPanel from './drawer/PlanningPanel'
import { PreferencesTab, ZzpTab } from './drawer/PreferencesZzpTabs'
import CommunicationTab from './drawer/CommunicationTab'
import DocumentsSection from './drawer/DocumentsSection'
import StatisticsTab from './drawer/StatisticsTab'
import ChangelogPopover from './drawer/ChangelogPopover'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

// Still-untyped JS drawer shells — declare the props this drawer passes (typed boundary).
const EntityDrawer = EntityDrawerJs as ComponentType<{
  entity: unknown; expanded?: boolean; onToggleExpand?: () => void; footer?: ReactNode
  tabs?: Array<{ id: string; label: string; autoExpand?: boolean; render: () => ReactNode }>
  header?: () => ReactNode
}>
const EntityHeader = EntityHeaderJs as ComponentType<{
  label?: string; expanded?: boolean; onToggleExpand?: () => void; onClose?: () => void
  avatar?: unknown; onPhotoChange?: (url: string | null) => void; photoLabels?: unknown
  renderTitle?: () => ReactNode; titleActions?: ReactNode; actions?: ReactNode
  meta?: unknown; metaExtra?: ReactNode; tags?: unknown; tagsLabel?: string; children?: ReactNode
}>
interface AppUser { id: Id; name: string; [k: string]: unknown }
interface HeaderForm { firstname: string; lastname: string; middleName: string; title: string }

const TABS = [
  { id: 'profile',       tKey: 'profile'       },
  { id: 'background',   tKey: 'background'    },
  { id: 'work',          tKey: 'match'         },
  { id: 'planning',      tKey: 'planning'      },
  { id: 'preferences',    tKey: 'preferences'   },
  { id: 'administration', tKey: 'zzp'           },
  { id: 'communication',  tKey: 'communication' },
  { id: 'documents',   tKey: 'documents'     },
  { id: 'statistics',  tKey: 'statistics'    },
]

// Contract-type slugs (stable, backend-matching) that mark a freelancer — drives
// the Freelance (ZZP) tab's visibility. Selecting this type reveals the tab.
const ZZP_TYPE_SLUGS = ['freelance', 'zzp']

interface CandidateDrawerProps {
  candidate: Candidate | null
  onClose: () => void
  expanded: boolean
  onToggleExpand: () => void
  onUpdate?: (id: Id, patch: Record<string, unknown>) => void
  users?: AppUser[]
}

export default function CandidateDrawer({ candidate: c, onClose, expanded, onToggleExpand, onUpdate, users = [] }: CandidateDrawerProps) {
  const { settings: cvSettings } = useCvSettings() as { settings?: unknown }
  const { t } = useTranslation('candidates')
  const locale = useLocale() as string
  const { formatDate } = useDateFormat() as { formatDate: (d?: string | null, opts?: Intl.DateTimeFormatOptions) => string }
  const { labelOf: lastContactLabel } = useLastContactTypes()
  // Only the status lookup is needed here now — candidate-type chips moved to the
  // Preferences tab, last-contact to Communication, funnel chips dropped (shown in Match).
  const { phases, statuses } = useLookups() as unknown as { phases: LookupOption[]; statuses: LookupOption[] }
  const { colorOf: genderColor } = useGenders() as { colorOf: (g?: string) => string | undefined }
  // Avatar colour follows the same tenant setting as the table: neutral grey by
  // default, per-gender only when enabled (Settings → Candidate → Table display).
  const allSettings = useAllSettings()
  const coloredByGender = getBoolSetting(allSettings, 'candidate_avatar_colored_by_gender', false)
  const avatarColor = coloredByGender ? (genderColor(c?.gender) ?? '#9CA3AF') : '#9CA3AF'
  const { functions, allowFreeEntry } = useFunctions() as { functions: Array<string | { value: string; label: string }>; allowFreeEntry: boolean }
  const { hasModule } = useAuth() as unknown as { hasModule: (m: string) => boolean }
  // Planning-tab tijdelijk verborgen (2026-06-26) — niet verwijderd, alleen uit.
  // Zet PLANNING_TAB_ENABLED weer op true om de tab (achter de module-gate) terug te tonen.
  const PLANNING_TAB_ENABLED = false
  // Conditional tabs: Match only when the candidate has (had) a match or
  // application; Freelance (zzp) only when flagged ZZP; Planning behind its module.
  const hasMatchOrApplication = !!(c?.matches?.length || c?.applications?.length)
  // Freelance (ZZP) tab shows when the candidate holds the freelance/ZZP type.
  const isFreelancer = (c?.candidateTypes ?? []).some(v => ZZP_TYPE_SLUGS.includes(v))
  const tabs = TABS.filter(tab => {
    if (tab.id === 'planning')       return PLANNING_TAB_ENABLED && hasModule('plan')
    if (tab.id === 'work')           return hasMatchOrApplication
    if (tab.id === 'administration') return isFreelancer
    return true
  })
  // Cross-cutting state used by the header; tab-specific state lives in each tab.
  const [cvGenerating,  setCvGenerating]  = useState(false)
  const [recruiter,     setRecruiter]     = useState<(AppUser & { initials: string }) | null>(null)
  const [phase,         setPhase]         = useState<string | null>(null)
  const [status,        setStatus]        = useState<string | null>(null)
  // "Geplaatst" requires a linked Match — when none exists, prompt instead of setting it.
  const [matchPrompt,   setMatchPrompt]   = useState(false)
  const [blacklisted,   setBlacklisted]   = useState<boolean | null>(null)
  const [blacklistModal, setBlacklistModal] = useState<{ reason: string } | null>(null)
  // Status change that needs a reason and/or a return date (driven by the status lookup flags).
  const [statusModal,   setStatusModal]   = useState<{ target: string; reason: string; date: string; needReason: boolean; needDate: boolean } | null>(null)
  const [tags,          setTags]          = useState<string[] | null>(null)
  // Header (name + function) edit — independent from the Profile-tab fields.
  const [headerEditing, setHeaderEditing] = useState(false)
  const [profileEdits,  setProfileEdits]  = useState<Record<string, unknown> | null>(null)
  const [photoUrl,      setPhotoUrl]      = useState<string | null>(null)
  // Header name + function fields (controlled while editing).
  const [headerForm,    setHeaderForm]    = useState<HeaderForm | null>(null)

  // Reset the header overrides when a different candidate is shown — done by
  // adjusting state during render (React's recommended pattern) so there's no effect.
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) {
    setPrevId(c?.id)
    setRecruiter(null); setPhase(null); setStatus(null); setMatchPrompt(false)
    setBlacklisted(null); setBlacklistModal(null); setStatusModal(null)
    setTags(null); setHeaderEditing(false); setProfileEdits(null); setPhotoUrl(null); setHeaderForm(null)
  }

  if (!c) return null

  const currentPhase   = phase ?? c.phase
  const changePhase = (v: string) => { setPhase(v); onUpdate?.(c.id, { phase: v }) }
  const currentStatus  = status ?? c.status
  // Status (deployability) change, driven by the status lookup flags:
  // requires_match → must link a Match; requires_reason/expects_return_date → ask first.
  const changeStatus = (v: string) => {
    const it = statuses.find(s => s.value === v) as (LookupOption & { requires_match?: unknown; requires_reason?: unknown; expects_return_date?: unknown }) | undefined
    if (Boolean(it?.requires_match) && !(c.matches?.length)) { setMatchPrompt(true); return }
    if (Boolean(it?.requires_reason) || Boolean(it?.expects_return_date)) {
      setStatusModal({ target: v, reason: '', date: '', needReason: Boolean(it?.requires_reason), needDate: Boolean(it?.expects_return_date) })
      return
    }
    setStatus(v); onUpdate?.(c.id, { status: v })
  }
  // Confirm a reason/return-date status change.
  const confirmStatus = () => {
    if (!statusModal) return
    setStatus(statusModal.target)
    onUpdate?.(c.id, { status: statusModal.target, status_reason: statusModal.reason || null, status_return_date: statusModal.date || null })
    setStatusModal(null)
  }
  // Blacklist is a separate flag; turning it on asks for a reason when the tenant requires it.
  const blacklistReasonRequired = getBoolSetting(allSettings, 'blacklist_reason_required', true)
  const isBlacklisted = blacklisted ?? c.blacklisted
  const toggleBlacklist = () => {
    if (isBlacklisted) { setBlacklisted(false); onUpdate?.(c.id, { blacklisted: false, blacklist_reason: null }); return }
    if (blacklistReasonRequired) { setBlacklistModal({ reason: '' }); return }
    setBlacklisted(true); onUpdate?.(c.id, { blacklisted: true })
  }
  const confirmBlacklist = () => {
    if (!blacklistModal) return
    setBlacklisted(true); onUpdate?.(c.id, { blacklisted: true, blacklist_reason: blacklistModal.reason || null })
    setBlacklistModal(null)
  }
  const currentTags    = tags ?? c.tags ?? []

  // Enter header edit: capture the fields so they're controlled + saveable.
  const startHeaderEdit = () => {
    setHeaderForm({
      firstname:  c.firstname  ?? c.name?.split(' ')[0] ?? '',
      lastname:   c.lastname   ?? c.name?.split(' ').slice(-1)[0] ?? '',
      middleName: c.middleName ?? '',
      title:      c.title ?? '',
    })
    setHeaderEditing(true)
  }
  const setHF = (k: keyof HeaderForm, v: string) => setHeaderForm(f => f ? { ...f, [k]: v } : f)
  const saveHeader = () => {
    if (headerForm) {
      const name = [headerForm.firstname, headerForm.middleName, headerForm.lastname].filter(Boolean).join(' ')
      onUpdate?.(c.id, { ...headerForm, name })
    }
    setHeaderEditing(false)
  }
  const hf = (k: keyof HeaderForm) => headerForm?.[k] ?? ''

  const renderTabContent = (activeTab: string) => {
    const mergedC = { ...c, ...(profileEdits ?? {}) }
    switch (activeTab) {
      case 'profile':       return <ProfilePanel c={mergedC} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }} />
      case 'background':   return <BackgroundTab c={mergedC} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }} />
      case 'work':          return <WorkTab c={c} />
      case 'planning':      return <PlanningPanel c={c} />
      case 'preferences':    return <PreferencesTab c={c}
        onSave={(p: unknown) => onUpdate?.(c.id, { preferences: p })}
        onTypesChange={(types: string[]) => onUpdate?.(c.id, { candidateTypes: types })} />
      case 'administration': return <ZzpTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { zzp: p })} />
      case 'communication':  return <CommunicationTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { consent: p })} />
      case 'documents':   return <DocumentsSection c={c} />
      case 'statistics':  return <StatisticsTab c={c} />
      default:              return null
    }
  }

  const ownerInitialsOf = (name?: string) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '??'
  const ownerOptions = [
    ...(recruiter ? [] : [{ value: '__current', label: c.owner || '-', initials: c.ownerInitials }]),
    ...users.map(u => ({ value: u.id, label: u.name, initials: ownerInitialsOf(u.name) })),
  ]
  const ownerValue = recruiter?.id ?? '__current'
  const onOwnerChange = (id: string | number) => {
    if (id === '__current') return
    const u = users.find(x => x.id === id)
    if (u) setRecruiter({ ...u, initials: ownerInitialsOf(u.name) })
  }

  const renderTitle = () => headerEditing ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        <input placeholder={t('modal.fields.firstName')} value={hf('firstname')} onChange={e => setHF('firstname', e.target.value)}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
        <input placeholder={t('modal.fields.lastName')} value={hf('lastname')} onChange={e => setHF('lastname', e.target.value)}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
      </div>
      <input placeholder={t('modal.fields.middleName')} value={hf('middleName')} onChange={e => setHF('middleName', e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text-muted)' }} />
      <CreatableSelect value={hf('title')} options={functions} onChange={v => setHF('title', v)}
        allowCreate={allowFreeEntry} placeholder={t('columns.function')} menuWidth={260} />
    </div>
  ) : (
    <>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.title || '—'}</div>
    </>
  )

  const headerActions = () => (
    <>
      {/* Blacklist toggle (separate flag) — red when active; reason asked when required. */}
      <button onClick={toggleBlacklist} title={t('drawer.blacklist')}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
          border: `1px solid ${isBlacklisted ? 'var(--color-danger)' : 'var(--border)'}`,
          background: isBlacklisted ? 'var(--color-danger)' : 'var(--bg)',
          color: isBlacklisted ? '#fff' : 'var(--text-muted)' }}>
        <Ban size={11} />{t('drawer.blacklist')}
      </button>
      <button disabled={cvGenerating}
        onClick={async () => {
          setCvGenerating(true)
          try {
            const blob = await pdf(<CvDocument c={c as unknown as CvCandidate} settings={cvSettings as never} locale={locale} t={t} />).toBlob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `CV - ${c?.name ?? 'candidate'}.pdf`
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
          } finally { setCvGenerating(false) }
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: cvGenerating ? 'not-allowed' : 'pointer', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'white', opacity: cvGenerating ? 0.7 : 1 }}>
        <Download size={11} />{cvGenerating ? t('drawer.generating') : t('drawer.downloadCv')}
      </button>
      {headerEditing ? (
        <>
          <button onClick={saveHeader} title={t('common:save')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
              background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            <Save size={14} />
          </button>
          <button onClick={() => setHeaderEditing(false)} title={t('common:cancel')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
              background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <X size={14} />
          </button>
        </>
      ) : (
        <button onClick={startHeaderEdit} title={t('drawer.edit')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
            background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Edit2 size={13} />
        </button>
      )}
    </>
  )

  return (
    <>
    <EntityDrawer
      entity={c}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={
        // Created-at on the left, last-contact (date · channel) on the right.
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: c.created ? formatDate(c.created, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' })}</span>
          <span>
            {t('drawer.lastContact')}:{' '}
            {(c.lastContactDate || c.lastContactType) ? (
              <span style={{ color: 'var(--text)' }}>
                {c.lastContactDate && formatDate(c.lastContactDate)}
                {c.lastContactDate && c.lastContactType && ' · '}
                {c.lastContactType && lastContactLabel(c.lastContactType)}
              </span>
            ) : (
              <span style={{ fontStyle: 'italic' }}>{t('drawer.notRegistered')}</span>
            )}
          </span>
        </div>
      }
      tabs={tabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), autoExpand: tab.id === 'planning', render: () => renderTabContent(tab.id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: photoUrl ?? c.photo, color: avatarColor, soft: true }}
          onPhotoChange={setPhotoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
          renderTitle={renderTitle}
          titleActions={<ChangelogPopover c={c} />}
          actions={headerActions()}
          meta={[
            { key: 'phase', label: t('drawer.phase'), value: currentPhase, options: phases.map(s => ({ value: s.value, label: s.label })), onChange: changePhase, menuWidth: 150, width: 140 },
            { key: 'status', label: t('drawer.deployability'), value: currentStatus, options: statuses.map(s => ({ value: s.value, label: s.label })), onChange: changeStatus, menuWidth: 170, width: 160 },
            { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions, onChange: onOwnerChange, menuWidth: 200, width: 190 },
          ]}
          tags={{ items: currentTags, onAdd: (tag: string) => setTags([...currentTags, tag]), onRemove: (tag: string) => setTags(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        />
      )}
    />
    {/* "Geplaatst" requires a linked Match — inform + block until one is coupled (backend match-flow). */}
    {matchPrompt && (
      <div onClick={() => setMatchPrompt(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('drawer.placedNeedsMatchTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>{t('drawer.placedNeedsMatchBody')}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setMatchPrompt(false)} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:close')}</button>
          </div>
        </div>
      </div>
    )}
    {/* Status change asking a reason and/or a "available again" date (status flags). */}
    {statusModal && (
      <div onClick={() => setStatusModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('drawer.statusReasonTitle')}</div>
          {statusModal.needReason && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.reasonLabel')}</div>
              <textarea value={statusModal.reason} onChange={e => setStatusModal(m => m && ({ ...m, reason: e.target.value }))} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, outline: 'none', resize: 'vertical' }} />
            </div>
          )}
          {statusModal.needDate && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.returnDateLabel')}</div>
              <input type="date" value={statusModal.date} onChange={e => setStatusModal(m => m && ({ ...m, date: e.target.value }))}
                style={{ padding: '7px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, outline: 'none' }} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setStatusModal(null)} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:cancel')}</button>
            <button onClick={confirmStatus} disabled={statusModal.needReason && !statusModal.reason.trim()}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', opacity: (statusModal.needReason && !statusModal.reason.trim()) ? 0.5 : 1 }}>{t('common:save')}</button>
          </div>
        </div>
      </div>
    )}
    {/* Blacklist reason prompt (when the tenant requires a reason). */}
    {blacklistModal && (
      <div onClick={() => setBlacklistModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('drawer.blacklistReasonTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.reasonLabel')}</div>
          <textarea value={blacklistModal.reason} onChange={e => setBlacklistModal(m => m && ({ ...m, reason: e.target.value }))} rows={3}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, outline: 'none', resize: 'vertical', marginBottom: 12 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setBlacklistModal(null)} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:cancel')}</button>
            <button onClick={confirmBlacklist} disabled={!blacklistModal.reason.trim()}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--color-danger)', color: '#fff', border: 'none', cursor: 'pointer', opacity: blacklistModal.reason.trim() ? 1 : 0.5 }}>{t('drawer.blacklistConfirm')}</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
