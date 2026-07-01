import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Download, Edit2, Save, UserCheck, X } from 'lucide-react'
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
import { useAllSettings, getBoolSetting, getJsonSetting } from '@/lib/settings/useAllSettings'
import { useFunctions } from '@/lib/useFunctions'
import { useCreateMatch } from './hooks/useCreateMatch'
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
  header?: (arg: { activeTab?: string; setActiveTab: (id: string) => void }) => ReactNode
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
  const { phases, statuses, phaseMeta, statusMeta } = useLookups() as unknown as { phases: LookupOption[]; statuses: LookupOption[]; phaseMeta: (v?: string | null) => { label: string; color: string }; statusMeta: (v?: string | null) => { label: string; color: string } }
  const { colorOf: genderColor } = useGenders() as { colorOf: (g?: string) => string | undefined }
  // Avatar colour follows the same tenant setting as the table: neutral grey by
  // default, per-gender only when enabled (Settings → Candidate → Table display).
  const allSettings = useAllSettings()
  const coloredByGender = getBoolSetting(allSettings, 'candidate_avatar_colored_by_gender', false)
  const avatarColor = coloredByGender ? (genderColor(c?.gender) ?? '#9CA3AF') : '#9CA3AF'
  const { functions, allowFreeEntry } = useFunctions() as { functions: Array<string | { value: string; label: string }>; allowFreeEntry: boolean }
  const { createMatch, creating: creatingMatch } = useCreateMatch(c?.id ?? '')
  const { hasModule } = useAuth() as unknown as { hasModule: (m: string) => boolean }
  // Conditional tabs: Match only when the candidate has (had) a match or
  // application; Freelance (zzp) only when flagged ZZP; Planning behind its module.
  const hasMatchOrApplication = !!(c?.matches?.length || c?.applications?.length)
  // Freelance (ZZP) tab shows when the candidate holds the freelance/ZZP type.
  const isFreelancer = (c?.candidateTypes ?? []).some(v => ZZP_TYPE_SLUGS.includes(v))
  const tabs = TABS.filter(tab => {
    if (tab.id === 'planning')       return hasModule('plan')
    if (tab.id === 'work')           return hasMatchOrApplication
    if (tab.id === 'administration') return isFreelancer
    return true
  })
  // Cross-cutting state used by the header; tab-specific state lives in each tab.
  const [cvGenerating,  setCvGenerating]  = useState(false)
  const [recruiter,     setRecruiter]     = useState<(AppUser & { initials: string }) | null>(null)
  const [phase,         setPhase]         = useState<string | null>(null)
  const [status,        setStatus]        = useState<string | null>(null)
  // "Geplaatst" requires a linked Match — pick an existing one (dropdown) or create
  // a new one (title → C-19 POST). `matchChoice` = picked id; `newMatchTitle` = create.
  const [matchPrompt,   setMatchPrompt]   = useState(false)
  const [matchChoice,   setMatchChoice]   = useState<string | null>(null)
  const [newMatchTitle, setNewMatchTitle] = useState('')
  // Convert guard (blocks an accidental CV click right after) + a signal that opens Profile edit.
  const [converting,    setConverting]    = useState(false)
  const [profileEditSignal, setProfileEditSignal] = useState(0)
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
    setRecruiter(null); setPhase(null); setStatus(null); setMatchPrompt(false); setMatchChoice(null); setStatusModal(null); setConverting(false)
    setTags(null); setHeaderEditing(false); setProfileEdits(null); setPhotoUrl(null); setHeaderForm(null)
  }

  if (!c) return null

  const currentPhase   = phase ?? c.phase
  const changePhase = (v: string) => { setPhase(v); onUpdate?.(c.id, { phase: v }) }
  // Fase: colour-coded read-only badge (no picker); "convert" advances the entry (first) phase.
  const phaseInfo    = phaseMeta(currentPhase)
  const phaseIdx     = phases.findIndex(p => p.value === currentPhase)
  const nextPhase    = phaseIdx >= 0 ? phases[phaseIdx + 1] : undefined
  const isEntryPhase = phaseIdx === 0
  // Required-field completeness for a phase (Settings → Verplichte velden), mapped to candidate fields.
  const REQ_GET: Record<string, () => unknown> = {
    first_name: () => c.name, last_name: () => c.name, email: () => c.email, phone: () => c.phone,
    function_title: () => c.title, date_of_birth: () => c.dob, gender: () => c.gender,
    street: () => c.street, postal_code: () => c.postalCode, city: () => c.city,
  }
  const requiredComplete = (phaseVal: string) => {
    const cfg = getJsonSetting<Record<string, string[]>>(allSettings, 'candidate_required_fields',
      { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'email', 'phone', 'function_title'] })
    return (cfg[phaseVal] ?? []).every(k => { const g = REQ_GET[k]; return g ? String(g() ?? '').trim() !== '' : true })
  }
  // Convert to the next phase; jump to Profile-edit unless the new phase's required fields are already complete.
  const doConvert = (setActiveTab?: (id: string) => void) => {
    if (!nextPhase) return
    changePhase(nextPhase.value)
    setConverting(true); setTimeout(() => setConverting(false), 1000)
    if (!requiredComplete(nextPhase.value)) { setActiveTab?.('profile'); setProfileEditSignal(s => s + 1) }
  }
  const currentStatus  = status ?? c.status
  // Deployability (status) only applies once someone is a Kandidaat — a Lead isn't
  // deployable yet. So hide the Status picker in the entry (Lead) phase.
  const showStatus = !!currentPhase && !isEntryPhase
  // Human-readable status detail line — shows once the backend returns the audit
  // fields (reason + the change-log date `statusChangedAt`). Empty until then.
  const statusInfoLine: string | null = (() => {
    const st = currentStatus
    // Blacklist = a status value; "who/when" comes from the status change-log
    // (statusChangedAt), the reason from the lookup-validated blacklist_reason.
    if (st === 'blacklist' && (c.blacklistReason || c.statusChangedAt)) {
      return [
        c.statusChangedAt ? t('drawer.statusSince', { status: statusMeta(st).label, date: formatDate(c.statusChangedAt) }) : t('drawer.blacklisted'),
        c.blacklistReason,
      ].filter(Boolean).join(' · ')
    }
    if ((st === 'unavailable' || st === 'sick' || st === 'leave') && (c.statusReason || c.statusReturnDate || c.statusChangedAt)) {
      return [
        c.statusChangedAt ? t('drawer.statusSince', { status: statusMeta(st).label, date: formatDate(c.statusChangedAt) }) : statusMeta(st).label,
        c.statusReason,
        c.statusReturnDate ? t('drawer.availableAgain', { date: formatDate(c.statusReturnDate) }) : null,
      ].filter(Boolean).join(' · ')
    }
    return null
  })()
  // Status (deployability) change, driven by the status lookup flags:
  // requires_match → must link a Match; requires_reason/expects_return_date → ask first.
  const changeStatus = (v: string) => {
    const it = statuses.find(s => s.value === v) as (LookupOption & { requires_match?: unknown; requires_reason?: unknown; expects_return_date?: unknown }) | undefined
    if (Boolean(it?.requires_match) || v === 'placed') { setMatchChoice(null); setMatchPrompt(true); return }
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
      case 'profile':       return <ProfilePanel c={mergedC} autoEditSignal={profileEditSignal} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }} />
      case 'background':   return <BackgroundTab c={mergedC} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }} />
      case 'work':          return <WorkTab c={c} />
      case 'planning':      return <PlanningPanel c={c} />
      case 'preferences':    return <PreferencesTab c={c}
        onSave={(p: unknown) => onUpdate?.(c.id, { preferences: { ...(c.preferences ?? {}), ...(p as Record<string, unknown>) } })}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
        {/* Fase = colour-coded read-only badge (no picker); convert lives in the header actions. */}
        {currentPhase && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
            background: phaseInfo.color + '1A', color: phaseInfo.color, border: `1px solid ${phaseInfo.color}55` }}>{phaseInfo.label}</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.title || '—'}</div>
      {statusInfoLine && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{statusInfoLine}</div>}
    </>
  )

  const headerActions = (setActiveTab?: (id: string) => void) => (
    <>
      {/* Entry phase (Lead) → prominent convert (CV is illogical for a lead); else → download CV. */}
      {(isEntryPhase && nextPhase) ? (
        <button onClick={() => doConvert(setActiveTab)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'white' }}>
          <UserCheck size={11} />{t('drawer.convertTo', { phase: nextPhase.label })}
        </button>
      ) : (
        <button disabled={cvGenerating || converting}
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
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: (cvGenerating || converting) ? 'not-allowed' : 'pointer', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'white', opacity: (cvGenerating || converting) ? 0.7 : 1 }}>
          <Download size={11} />{cvGenerating ? t('drawer.generating') : t('drawer.downloadCv')}
        </button>
      )}
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
      header={({ setActiveTab }) => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: photoUrl ?? c.photo, color: avatarColor, soft: true }}
          onPhotoChange={setPhotoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
          renderTitle={renderTitle}
          titleActions={<ChangelogPopover c={c} />}
          actions={headerActions(setActiveTab)}
          meta={[
            // Status only for a Kandidaat (not a Lead) — a Lead isn't deployable yet.
            ...(showStatus ? [{ key: 'status', label: t('drawer.deployability'), value: currentStatus, options: statuses.map(s => ({ value: s.value, label: s.label })), onChange: changeStatus, menuWidth: 170, width: 160 }] : []),
            { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions, onChange: onOwnerChange, menuWidth: 200, width: 190 },
          ]}
          tags={{ items: currentTags, onAdd: (tag: string) => setTags([...currentTags, tag]), onRemove: (tag: string) => setTags(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        />
      )}
    />
    {/* "Geplaatst" → pick one of the candidate's matches to link; if none, prompt to create one first. */}
    {matchPrompt && (
      <div onClick={() => setMatchPrompt(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('drawer.placedPickMatch')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t('drawer.placedPickMatchBody')}</div>

          {/* Pick one of the candidate's existing matches (dropdown). */}
          {(c.matches?.length ?? 0) > 0 && (
            <select value={matchChoice ?? ''} onChange={e => { setMatchChoice(e.target.value || null); if (e.target.value) setNewMatchTitle('') }}
              style={{ width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none', marginBottom: 12 }}>
              <option value="">{t('drawer.placedPickPlaceholder')}</option>
              {(c.matches ?? []).map((m, i) => {
                const mid = String((m as { id?: string | number }).id ?? i)
                const mm = m as { vacancyTitle?: string; client?: string }
                return <option key={mid} value={mid}>{[mm.vacancyTitle || '—', mm.client].filter(Boolean).join(' · ')}</option>
              })}
            </select>
          )}

          {/* Or create a new match from a vacancy/role title (C-19 POST). */}
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '2px 0 6px' }}>{t('drawer.placedOrNew')}</div>
          <input value={newMatchTitle} onChange={e => { setNewMatchTitle(e.target.value); if (e.target.value) setMatchChoice(null) }}
            placeholder={t('drawer.placedNewPlaceholder')} aria-label={t('drawer.placedNewPlaceholder')}
            style={{ width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none', marginBottom: 16 }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setMatchPrompt(false)} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:cancel')}</button>
            <button disabled={(!matchChoice && !newMatchTitle.trim()) || creatingMatch}
              onClick={async () => {
                // Use the picked match, or create one from the typed title first.
                let mid = matchChoice
                if (!mid && newMatchTitle.trim()) mid = await createMatch(newMatchTitle.trim())
                if (!mid) return
                setStatus('placed'); onUpdate?.(c.id, { status: 'placed', match_id: mid })
                setMatchPrompt(false); setMatchChoice(null); setNewMatchTitle('')
              }}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', opacity: ((matchChoice || newMatchTitle.trim()) && !creatingMatch) ? 1 : 0.5 }}>{t('drawer.placedConfirm')}</button>
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
    </>
  )
}
