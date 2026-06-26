import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Download, Edit2, Save, X } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from './CandidateCvTemplate'
import type { CvCandidate } from './CandidateCvTemplate'
import { useCvSettings } from '@/lib/useCvSettings'
import { useTranslation } from 'react-i18next'
import { useLocale, useDateFormat } from '@/lib/datetime'
import EntityDrawerJs from '@/components/drawer/EntityDrawer'
import EntityHeaderJs from '@/components/drawer/EntityHeader'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useLookups } from '@/context/LookupsContext'
import { useGenders } from '@/lib/useGenders'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useFunctions } from '@/lib/useFunctions'
import { useAuth } from '@/context/AuthContext'
import ProfilePanel from './drawer/ProfilePanel'
import ApplicationStageChipsJs from './drawer/ApplicationStageChips'
import BackgroundTab from './drawer/BackgroundTab'
import WorkTab from './drawer/WorkTab'
import PlanningPanel from './drawer/PlanningPanel'
import { PreferencesTab, ZzpTab } from './drawer/PreferencesZzpTabs'
import CommunicationTab from './drawer/CommunicationTab'
import StatisticsTab from './drawer/StatisticsTab'
import ChangelogTab from './drawer/ChangelogTab'
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
  renderTitle?: () => ReactNode; actions?: ReactNode
  meta?: unknown; metaExtra?: ReactNode; tags?: unknown; tagsLabel?: string; children?: ReactNode
}>
const ApplicationStageChips = ApplicationStageChipsJs as ComponentType<{ applications?: unknown[]; label?: string; compact?: boolean }>

interface AppUser { id: Id; name: string; [k: string]: unknown }
interface HeaderForm { firstname: string; lastname: string; middleName: string; title: string }

const TABS = [
  { id: 'profile',       tKey: 'profile'       },
  { id: 'background',   tKey: 'background'    },
  { id: 'work',          tKey: 'work'          },
  { id: 'planning',      tKey: 'planning'      },
  { id: 'preferences',    tKey: 'preferences'   },
  { id: 'administration', tKey: 'zzp'           },
  { id: 'communication',  tKey: 'communication' },
  { id: 'statistics',  tKey: 'statistics'    },
  { id: 'changelog',   tKey: 'changelog'     },
]

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
  const { formatDate } = useDateFormat() as { formatDate: (d?: string | null) => string }
  const { candidateTypes, statuses, funnelMeta } = useLookups() as unknown as {
    candidateTypes: LookupOption[]; statuses: LookupOption[]; funnelMeta: (v: string) => { label: string; color: string }
  }
  const { colorOf: genderColor } = useGenders() as { colorOf: (g?: string) => string | undefined }
  const { labelOf: lastContactLabel } = useLastContactTypes() as { labelOf: (v?: string | null) => string }
  const { functions, allowFreeEntry } = useFunctions() as { functions: Array<string | { value: string; label: string }>; allowFreeEntry: boolean }
  const { hasModule } = useAuth() as unknown as { hasModule: (m: string) => boolean }
  // Planning-tab alleen tonen als de tenant de Planning-module heeft (zelfde gate als sidebar).
  const tabs = TABS.filter(tab => tab.id !== 'planning' || hasModule('plan'))
  // Cross-cutting state used by the header; tab-specific state lives in each tab.
  const [cvGenerating,  setCvGenerating]  = useState(false)
  const [recruiter,     setRecruiter]     = useState<(AppUser & { initials: string }) | null>(null)
  const [status,        setStatus]        = useState<string | null>(null)
  const [types,         setTypes]         = useState<string[] | null>(null)
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
    setRecruiter(null); setStatus(null); setTypes(null)
    setTags(null); setHeaderEditing(false); setProfileEdits(null); setPhotoUrl(null); setHeaderForm(null)
  }

  if (!c) return null

  const currentStatus  = status ?? c.status
  const currentTypes   = types ?? c.candidateTypes ?? []
  // Funnel display — per-application chips when available, else a single read-only
  // chip from the legacy stage (until the backend sends `candidate.applications`).
  const hasApplications = !!c.applications?.length
  const stageChips = hasApplications
    ? c.applications
    : (c.stage ? [{ id: 'stage', stageLabel: funnelMeta(c.stage).label, stageColor: funnelMeta(c.stage).color }] : [])
  const toggleType = (v: string) => {
    const next = currentTypes.includes(v) ? currentTypes.filter(x => x !== v) : [...currentTypes, v]
    setTypes(next)
    onUpdate?.(c.id, { candidateTypes: next })
  }
  const changeStatus = (v: string) => { setStatus(v); onUpdate?.(c.id, { status: v }) }
  const currentTags    = tags ?? c.tags ?? []
  // Funnel = per-application concern (decided model): strictly it shows only with a
  // running application (hasApplications). TEMPORARY until C-10 sends
  // candidate.applications: also fall back to the legacy `stage` chip so it's visible now.
  const showFunnel = hasApplications || !!c.stage

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
      case 'background':   return <BackgroundTab c={c} />
      case 'work':          return <WorkTab c={c} />
      case 'planning':      return <PlanningPanel c={c} />
      case 'preferences':    return <PreferencesTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { preferences: p })} />
      case 'administration': return <ZzpTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { zzp: p })} />
      case 'communication':  return <CommunicationTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { consent: p })} />
      case 'statistics':  return <StatisticsTab c={c} />
      case 'changelog':   return <ChangelogTab c={c} />
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
    <EntityDrawer
      entity={c}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: c.created ?? '—' })}</span>}
      tabs={tabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), autoExpand: tab.id === 'planning', render: () => renderTabContent(tab.id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: photoUrl ?? c.photo, color: genderColor(c.gender), soft: true }}
          onPhotoChange={setPhotoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
          renderTitle={renderTitle}
          actions={headerActions()}
          meta={[
            { key: 'status', label: t('drawer.status'), value: currentStatus, options: statuses.map(s => ({ value: s.value, label: s.label })), onChange: changeStatus, menuWidth: 160, width: 150 },
            { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions, onChange: onOwnerChange, menuWidth: 200, width: 190 },
          ]}
          metaExtra={showFunnel && (
            <ApplicationStageChips applications={stageChips} label={t(hasApplications ? 'drawer.applications' : 'drawer.stage')} compact />
          )}
          tags={{ items: currentTags, onAdd: (tag: string) => setTags([...currentTags, tag]), onRemove: (tag: string) => setTags(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Candidate type — multi-value contract form, rendered as toggle chips */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.candidateType')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {candidateTypes.map(ct => {
                const active = currentTypes.includes(ct.value)
                return (
                  <button key={ct.value} type="button" onClick={() => toggleType(ct.value)}
                    style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                      background: active ? ct.color + '1A' : 'var(--surface)',
                      color: active ? ct.color : 'var(--text-muted)',
                      border: `1px solid ${active ? ct.color + '55' : 'var(--border)'}`, transition: 'all 0.12s' }}>
                    {ct.label}
                  </button>
                )
              })}
            </div>
          </div>
          {(c.lastContactDate || c.lastContactType) ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              {t('drawer.lastContact')}:&nbsp;
              {c.lastContactDate && <span style={{ color: 'var(--text)' }}>{formatDate(c.lastContactDate)}</span>}
              {c.lastContactDate && c.lastContactType && <span> · </span>}
              {c.lastContactType && <span style={{ color: 'var(--text)' }}>{lastContactLabel(c.lastContactType)}</span>}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              {t('drawer.lastContact')}: <span style={{ fontStyle: 'italic' }}>{t('drawer.notRegistered')}</span>
            </div>
          )}
        </EntityHeader>
      )}
    />
  )
}
