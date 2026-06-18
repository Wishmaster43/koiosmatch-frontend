import { useState, useEffect } from 'react'
import { Download, Edit2 } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from './CandidateCvTemplate'
import { useCvSettings } from '../../lib/useCvSettings'
import api from '../../lib/api'
import { useTranslation } from 'react-i18next'
import { useLocale } from '../../lib/datetime'
import EntityDrawer from '../../components/drawer/EntityDrawer'
import EntityHeader from '../../components/drawer/EntityHeader'
import SelectMenu from '../../components/ui/SelectMenu'
import { useLookups } from '../../context/LookupsContext'
import ProfilePanel from './drawer/ProfilePanel'
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
  const { candidateTypes, funnelTypes, statuses, typeMeta, funnelMeta } = useLookups()
  // Cross-cutting state used by the header; tab-specific state lives in each tab.
  const [cvGenerating,  setCvGenerating]  = useState(false)
  const [recruiter,     setRecruiter]     = useState(null)
  const [status,        setStatus]        = useState(null)
  const [types,         setTypes]         = useState(null)
  const [stageVal,      setStageVal]      = useState(null)
  const [stageVacancy,  setStageVacancy]  = useState(null)
  const [stageVacancies, setStageVacancies] = useState([])
  const [tags,          setTags]          = useState(null)
  const [editing,       setEditing]       = useState(false)
  const [profileEdits,  setProfileEdits]  = useState(null)
  const [photoUrl,      setPhotoUrl]      = useState(null)

  // Reset the header overrides when a different candidate is shown — done by
  // adjusting state during render (React's recommended pattern) so there's no effect.
  const [prevId, setPrevId] = useState(c?.id)
  if (c?.id !== prevId) {
    setPrevId(c?.id)
    setRecruiter(null); setStatus(null); setTypes(null); setStageVal(null); setStageVacancy(null)
    setTags(null); setEditing(false); setProfileEdits(null); setPhotoUrl(null)
  }

  // Vacancies for the optional link shown when stage = Applicant.
  useEffect(() => {
    api.get('/vacancies').then(r => {
      const d = r.data; setStageVacancies(Array.isArray(d) ? d : (d?.data ?? []))
    }).catch(() => {})
  }, [])

  if (!c) return null

  const funnelValues   = funnelTypes.map(f => f.value)
  const currentStatus  = status ?? c.status
  const currentTypes   = types ?? c.candidateTypes ?? []
  const currentStage   = stageVal ?? (funnelValues.includes(c.stage) ? c.stage : (funnelValues[0] ?? ''))
  const stageOptions   = funnelTypes.map(f => ({ value: f.value, label: f.label }))
  const currentVacancy = stageVacancy ?? c.stageVacancyId ?? ''
  const toggleType = (v) => {
    const next = currentTypes.includes(v) ? currentTypes.filter(x => x !== v) : [...currentTypes, v]
    setTypes(next)
    onUpdate?.(c.id, { candidateTypes: next })
  }
  const changeStatus = (v) => { setStatus(v); onUpdate?.(c.id, { status: v }) }
  const changeStage  = (v) => { setStageVal(v); onUpdate?.(c.id, { stage: v }) }
  const currentTags    = tags ?? c.tags ?? []

  const renderTabContent = (activeTab) => {
    const mergedC = { ...c, ...(profileEdits ?? {}) }
    switch (activeTab) {
      case 'profile':       return <ProfilePanel c={mergedC} editing={editing} onEditSave={v => { setProfileEdits(v); setEditing(false) }} onEditCancel={() => setEditing(false)} onStartEdit={() => setEditing(true)} />
      case 'background':   return <BackgroundTab c={c} />
      case 'work':          return <WorkTab c={c} />
      case 'planning':      return <PlanningPanel c={c} />
      case 'preferences':    return <PreferencesTab c={c} />
      case 'administration': return <ZzpTab c={c} />
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

  const renderTitle = () => editing ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        <input placeholder={t('modal.fields.firstName')} defaultValue={c.firstname ?? c.name?.split(' ')[0] ?? ''}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
        <input placeholder={t('modal.fields.lastName')} defaultValue={c.lastname ?? c.name?.split(' ').slice(-1)[0] ?? ''}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
      </div>
      <input placeholder={t('modal.fields.middleName')} defaultValue={c.middleName ?? ''}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text-muted)' }} />
    </div>
  ) : (
    <>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{profileEdits ? [c.firstname, c.middleName, c.lastname].filter(Boolean).join(' ') || c.name : c.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.title || '—'}</div>
    </>
  )

  const headerActions = (setActiveTab) => (
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
      <button onClick={() => { setEditing(e => !e); setActiveTab('profile') }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500, borderRadius: 7, cursor: 'pointer', background: editing ? 'var(--color-primary)' : 'var(--bg)', color: editing ? '#fff' : 'var(--text)', border: editing ? 'none' : '1px solid var(--border)' }}>
        <Edit2 size={11} /> {editing ? t('drawer.editing') : t('drawer.edit')}
      </button>
    </>
  )

  return (
    <EntityDrawer
      entity={c}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: c.created ?? '—' })}</span>}
      tabs={TABS.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), autoExpand: tab.id === 'planning', render: () => renderTabContent(tab.id) }))}
      header={({ setActiveTab }) => (
        <EntityHeader
          label={funnelMeta(currentStage).label}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: photoUrl ?? c.photo }}
          onPhotoChange={setPhotoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
          renderTitle={renderTitle}
          actions={headerActions(setActiveTab)}
          meta={[
            { key: 'status', label: t('drawer.status'), value: currentStatus, options: statuses.map(s => ({ value: s.value, label: s.label })), onChange: changeStatus, menuWidth: 160 },
            { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions, onChange: onOwnerChange, menuWidth: 200 },
            { key: 'stage', label: t('drawer.stage'), value: currentStage, options: stageOptions, onChange: changeStage, menuWidth: 180 },
          ]}
          tags={{ items: currentTags, onAdd: tag => setTags([...currentTags, tag]), onRemove: tag => setTags(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Candidate type — multi-value contract form, rendered as toggle chips */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.candidateType')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {candidateTypes.map(ct => {
                const active = currentTypes.includes(ct.value)
                return (
                  <button key={ct.value} type="button" onClick={() => toggleType(ct.value)}
                    style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                      background: active ? ct.color : 'var(--surface)',
                      color: active ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${active ? ct.color : 'var(--border)'}`, transition: 'all 0.12s' }}>
                    {ct.label}
                  </button>
                )
              })}
            </div>
          </div>
          {currentStage === 'intake' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('modal.linkVacancy')}</div>
              <SelectMenu value={currentVacancy} onChange={setStageVacancy} placeholder={t('common:optional')} menuWidth={280}
                options={[{ value: '', label: t('common:optional') }, ...stageVacancies.map(v => ({ value: String(v.id), label: v.title ?? v.name ?? t('modal.vacancyFallback', { id: v.id }) }))]} />
            </div>
          )}
          {(c.lastContactDate || c.lastContactType) ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              {t('drawer.lastContact')}:&nbsp;
              {c.lastContactDate && <span style={{ color: 'var(--text)' }}>{c.lastContactDate}</span>}
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
