import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import EntityLink from '@/components/ui/EntityLink'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { mapCandidate } from '@/pages/candidates/data/mapCandidate'
import ProfilePanel from '@/pages/candidates/drawer/ProfilePanel'
import BackgroundTab from '@/pages/candidates/drawer/BackgroundTab'
import WorkTab from '@/pages/candidates/drawer/WorkTab'
import { PreferencesTab, ZzpTab } from '@/pages/candidates/drawer/PreferencesZzpTabs'
import CommunicationTab from '@/pages/candidates/drawer/CommunicationTab'
import DocumentsSection from '@/pages/candidates/drawer/DocumentsSection'
import StatisticsTab from '@/pages/candidates/drawer/StatisticsTab'
import type { Candidate } from '@/types/candidate'
import type { ApplicationDetail } from '@/types/application'

const ZZP_TYPES = ['freelance', 'zzp']
const muted = { fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }

/**
 * CandidateTab — the FULL candidate drill-down inside the application drawer.
 * Fetches the complete candidate (GET /candidates/{id}) and reuses the candidate
 * feature's own tab components + sub-tab bar, so all sub-tabs (Profile / Background
 * / Match / Preferences / ZZP / Communication / Documents / Statistics) show here.
 * Edits update locally and best-effort PATCH /candidates/{id}. (A shared
 * CandidateDetail extraction is the longer-term de-dup; see worklist.)
 */
export default function CandidateTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('candidates')
  const [cand, setCand]       = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [edits, setEdits]     = useState<Record<string, unknown>>({})
  const [tab, setTab]         = useState('profile')

  // Load the full candidate for the linked application.
  useEffect(() => {
    const id = a.candidateId
    if (!id) { setLoading(false); return }
    let alive = true
    setLoading(true); setError(false); setEdits({})
    api.get(`/candidates/${id}`)
      .then(r => { if (alive) setCand(mapCandidate(unwrap(r))) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [a.candidateId])

  // Optimistic local edit + best-effort persist (full key-mapping lives in the Candidates page).
  const onUpdate = (id: string | number, patch: Record<string, unknown>) => {
    setEdits(e => ({ ...e, ...patch }))
    api.patch(`/candidates/${id}`, patch).catch(() => notifyError(t('common:actionFailed')))
  }

  // The default namespace here is 'candidates' (every sub-tab below needs it), so
  // these two loading/error strings — an applications-drawer concern, not a
  // candidates one — are explicitly namespaced (mirrors VacancyTab's vacancyDetail.*).
  if (loading) return <div style={muted}>{t('applications:candidateDetail.loading')}</div>
  if (error || !cand) return <div style={muted}>{t('applications:candidateDetail.error')}</div>

  // Merge local edits over the fetched record for the tab components.
  const c = { ...cand, ...edits } as Candidate
  const isFreelancer = (c.candidateTypes ?? []).some(v => ZZP_TYPES.includes(v))
  const hasWork = Boolean(c.matches?.length || c.applications?.length)

  // Sub-tab bar — mirrors the candidate drawer (conditional Match/ZZP; planning hidden).
  const tabs = [
    { id: 'profile',       label: t('drawer.tabs.profile') },
    { id: 'background',    label: t('drawer.tabs.background') },
    ...(hasWork ? [{ id: 'work', label: t('drawer.tabs.match') }] : []),
    { id: 'preferences',   label: t('drawer.tabs.preferences') },
    ...(isFreelancer ? [{ id: 'administration', label: t('drawer.tabs.zzp') }] : []),
    { id: 'communication', label: t('drawer.tabs.communication') },
    { id: 'documents',     label: t('drawer.tabs.documents') },
    { id: 'statistics',    label: t('drawer.tabs.statistics') },
  ]

  const renderTab = () => {
    switch (tab) {
      case 'profile':        return <ProfilePanel c={c} onEditSave={(v: Record<string, unknown>) => onUpdate(c.id, v)} />
      case 'background':     return <BackgroundTab c={c} onEditSave={(v: Record<string, unknown>) => onUpdate(c.id, v)} />
      case 'work':           return <WorkTab c={c} />
      case 'preferences':    return <PreferencesTab c={c}
        onSave={(p: unknown) => onUpdate(c.id, { preferences: { ...(c.preferences ?? {}), ...(p as Record<string, unknown>) } })}
        onTypesChange={(types: string[]) => onUpdate(c.id, { candidateTypes: types })} />
      case 'administration': return <ZzpTab c={c} onSave={(p: unknown) => onUpdate(c.id, { zzp: p })} />
      case 'communication':  return <CommunicationTab c={c} onSave={(p: unknown) => onUpdate(c.id, { consent: p })} />
      case 'documents':      return <DocumentsSection c={c} />
      case 'statistics':     return <StatisticsTab c={c} />
      default:               return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Jump to the full candidate record (page + drawer). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <EntityLink page="candidates" id={a.candidateId} title={t('applications:drawer.openCandidate')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <ExternalLink size={13} /> {t('applications:drawer.openCandidate')}
          </span>
        </EntityLink>
      </div>
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        <DrawerTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {renderTab()}
    </div>
  )
}
