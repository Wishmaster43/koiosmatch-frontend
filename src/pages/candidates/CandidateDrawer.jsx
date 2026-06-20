import { useState } from 'react'
import { Download, Edit2, Save, X } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from './CandidateCvTemplate'
import { useCvSettings } from '../../lib/useCvSettings'
import { useTranslation } from 'react-i18next'
import { useLocale, useDateFormat } from '../../lib/datetime'
import EntityDrawer from '../../components/drawer/EntityDrawer'
import EntityHeader from '../../components/drawer/EntityHeader'
import { useLookups } from '../../context/LookupsContext'
import { useGenders } from '../../lib/useGenders'
import { useAuth } from '../../context/AuthContext'
import ProfilePanel from './drawer/ProfilePanel'
import ApplicationStageChips from './drawer/ApplicationStageChips'
import BackgroundTab from './drawer/BackgroundTab'
import WorkTab from './drawer/WorkTab'
import PlanningPanel from './drawer/PlanningPanel'
import { PreferencesTab, ZzpTab } from './drawer/PreferencesZzpTabs'
import CommunicationTab from './drawer/CommunicationTab'
import StatisticsTab from './drawer/StatisticsTab'

// ── Candidate Drawer ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile',       tKey: 'profile'       },
  { id: 'background',   tKey: 'background'    },
  { id: 'work',          tKey: 'work'          },
  { id: 'planning',      tKey: 'planning'      },
  { id: 'preferences',    tKey: 'preferences'   },
  { id: 'administration', tKey: 'zzp'           },
  { id: 'communication',  tKey: 'communication' },
  { id: 'statistics',  tKey: 'statistics'    },
]

export default function CandidateDrawer({ candidate: c, onClose, expanded, onToggleExpand, onUpdate, users = [] }) {
  const { settings: cvSettings } = useCvSettings()
  const { t } = useTranslation('candidates')
  const locale = useLocale()
  const { formatDate } = useDateFormat()
  const { candidateTypes, statuses } = useLookups()
  const { colorOf: genderColor } = useGenders()
  const { hasModule } = useAuth()
  // Planning-tab alleen tonen als de tenant de Planning-module heeft (zelfde gate als sidebar).
  const tabs = TABS.filter(tab => tab.id !== 'planning' || hasModule('plan'))
  // Cross-cutting state used by the header; tab-specific state lives in each tab.
  const [cvGenerating,  setCvGenerating]  = useState(false)
  const [recruiter,     setRecruiter]     = useState(null)
  const [status,        setStatus]        = useState(null)
  const [types,         setTypes]         = useState(null)
  const [tags,          setTags]          = useState(null)
  // Header (name + function) edit — independent from the Profile-tab fields.
  const [headerEditing, setHeaderEditing] = useState(false)
  const [profileEdits,  setProfileEdits]  = useState(null)
  const [photoUrl,      setPhotoUrl]      = useState(null)
  // Header name + function fields (controlled while editing).
  const [headerForm,    setHeaderForm]    = useState(null)

  // Reset the header overrides when a different candidate is shown — done by
  // adjusting state during render (React's recommended pattern) so there's no effect.
  const [prevId, setPrevId] = useState(c?.id)
  if (c?.id !== prevId) {
    setPrevId(c?.id)
    setRecruiter(null); setStatus(null); setTypes(null)
    setTags(null); setHeaderEditing(false); setProfileEdits(null); setPhotoUrl(null); setHeaderForm(null)
  }

  if (!c) return null

  const currentStatus  = status ?? c.status
  const currentTypes   = types ?? c.candidateTypes ?? []
  const toggleType = (v) => {
    const next = currentTypes.includes(v) ? currentTypes.filter(x => x !== v) : [...currentTypes, v]
    setTypes(next)
    onUpdate?.(c.id, { candidateTypes: next })
  }
  const changeStatus = (v) => { setStatus(v); onUpdate?.(c.id, { status: v }) }
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
  const setHF = (k, v) => setHeaderForm(f => ({ ...f, [k]: v }))
  const saveHeader = () => {
    if (headerForm) {
      const name = [headerForm.firstname, headerForm.middleName, headerForm.lastname].filter(Boolean).join(' ')
      onUpdate?.(c.id, { ...headerForm, name })
    }
    setHeaderEditing(false)
  }
  const hf = (k) => headerForm?.[k] ?? ''

  const renderTabContent = (activeTab) => {
    const mergedC = { ...c, ...(profileEdits ?? {}) }
    switch (activeTab) {
      case 'profile':       return <ProfilePanel c={mergedC} onEditSave={v => { setProfileEdits(v); onUpdate?.(c.id, v) }} />
      case 'background':   return <BackgroundTab c={c} />
      case 'work':          return <WorkTab c={c} />
      case 'planning':      return <PlanningPanel c={c} />
      case 'preferences':    return <PreferencesTab c={c} onSave={p => onUpdate?.(c.id, { preferences: p })} />
      case 'administration': return <ZzpTab c={c} onSave={p => onUpdate?.(c.id, { zzp: p })} />
      case 'communication':  return <CommunicationTab c={c} />
      case 'statistics':  return <StatisticsTab c={c} />
      default:              return null
    }
  }

  const ownerInitialsOf = (name) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '??'
  const ownerOptions = [
    ...(recruiter ? [] : [{ value: '__current', label: c.owner || '-', initials: c.ownerInitials }]),
    ...users.map(u => ({ value: u.id, label: u.name, initials: ownerInitialsOf(u.name) })),
  ]
  const ownerValue = recruiter?.id ?? '__current'
  const onOwnerChange = (id) => {
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
      <input placeholder={t('columns.function')} value={hf('title')} onChange={e => setHF('title', e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text)' }} />
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
            const blob = await pdf(<CvDocument c={c} settings={cvSettings} locale={locale} t={t} />).toBlob()
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
            { key: 'status', label: t('drawer.status'), value: currentStatus, options: statuses.map(s => ({ value: s.value, label: s.label })), onChange: changeStatus, menuWidth: 160 },
            { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions, onChange: onOwnerChange, menuWidth: 200 },
          ]}
          tags={{ items: currentTags, onAdd: tag => setTags([...currentTags, tag]), onRemove: tag => setTags(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
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
          {/* Application stages — read-only chips, only for applicants (see model). */}
          <ApplicationStageChips applications={c.applications} label={t('drawer.applications')} />
          {(c.lastContactDate || c.lastContactType) ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              {t('drawer.lastContact')}:&nbsp;
              {c.lastContactDate && <span style={{ color: 'var(--text)' }}>{formatDate(c.lastContactDate)}</span>}
              {c.lastContactDate && c.lastContactType && <span> · </span>}
              {c.lastContactType && <span style={{ color: 'var(--text)' }}>{c.lastContactType}</span>}
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
