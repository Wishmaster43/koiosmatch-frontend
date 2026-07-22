import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { buildEntityDeepLink } from '@/components/ui/EntityLink'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { mapCandidate } from '@/pages/candidates/data/mapCandidate'
import { buildCandidatePatch } from '@/pages/candidates/data/candidatesShared'
import ProfilePanel from '@/pages/candidates/drawer/ProfilePanel'
import BackgroundTab from '@/pages/candidates/drawer/BackgroundTab'
import WorkTab from '@/pages/candidates/drawer/WorkTab'
import { PreferencesTab, ZzpTab } from '@/pages/candidates/drawer/PreferencesZzpTabs'
import CommunicationTab from '@/pages/candidates/drawer/CommunicationTab'
import DocumentsSection from '@/pages/candidates/drawer/DocumentsSection'
import StatisticsTab from '@/pages/candidates/drawer/StatisticsTab'
import { rememberReturnTab } from './constants'
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

  // Optimistic local edit (camelCase UI merge) + persist via the SAME UI-patch →
  // API-body mapping as the real candidate drawer (buildCandidatePatch, used by
  // useCandidateRecord().patchCandidate) — the raw camelCase patch used to go
  // straight to the API and get silently dropped by CandidateProfileRequest's
  // all-sometimes rules (dob, placeOfBirth, houseNumber(+suffix), postalCode,
  // linkedin, candidateTypes, zzp, consent.retentionOptIn, …).
  const onUpdate = (id: string | number, patch: Record<string, unknown>) => {
    setEdits(e => ({ ...e, ...patch }))
    const body = buildCandidatePatch(patch)
    if (!Object.keys(body).length) return
    api.patch(`/candidates/${id}`, body).catch(() => notifyError(t('common:actionFailed')))
  }

  // Merge local edits over the fetched record for the tab components (undefined
  // while the full candidate is still loading — the header above works without it).
  const c = cand ? ({ ...cand, ...edits } as Candidate) : null
  const isFreelancer = (c?.candidateTypes ?? []).some(v => ZZP_TYPES.includes(v))
  const hasWork = Boolean(c?.matches?.length || c?.applications?.length)

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

  // Rendered only once `c` (the fetched full candidate) is confirmed non-null below.
  const renderTab = (cc: Candidate) => {
    switch (tab) {
      case 'profile':        return <ProfilePanel c={cc} onEditSave={(v: Record<string, unknown>) => onUpdate(cc.id, v)} />
      case 'background':     return <BackgroundTab c={cc} onEditSave={(v: Record<string, unknown>) => onUpdate(cc.id, v)} />
      case 'work':           return <WorkTab c={cc} />
      case 'preferences':    return <PreferencesTab c={cc}
        onSave={(p: unknown) => onUpdate(cc.id, { preferences: { ...(cc.preferences ?? {}), ...(p as Record<string, unknown>) } })}
        onTypesChange={(types: string[]) => onUpdate(cc.id, { candidateTypes: types })} />
      case 'administration': return <ZzpTab c={cc} onSave={(p: unknown) => onUpdate(cc.id, { zzp: p })} />
      case 'communication':  return <CommunicationTab c={cc} onSave={(p: unknown) => onUpdate(cc.id, { consent: p })} />
      case 'documents':      return <DocumentsSection c={cc} />
      case 'statistics':     return <StatisticsTab c={cc} />
      default:               return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Candidate NAME only — no status chip here (Danny 21-07: the drawer header
          already shows the application's own status "Actief"; a second candidate-
          deployability chip next to it read as "two conflicting statuses". The
          candidate's own status lives on their own drawer, one "Open kandidaat" away. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.candidate?.name ?? a.candidateName}
          </span>
        </div>
        {/* S14/S22: stash the current subtab so browser BACK from the full candidate
            page reopens THIS application's drawer on the Kandidaat tab again.
            Danny 21-07: this is an explicit "Open candidate" AFFORDANCE (not the
            name+trailing-icon EntityLink pattern), so it is a real new-tab anchor
            rather than EntityLink's in-app button wrapped around the icon+label. */}
        <span onClickCapture={() => { if (a.id != null) rememberReturnTab(a.id, 'candidate') }}>
          {a.candidateId != null ? (
            <a href={buildEntityDeepLink('candidates', a.candidateId)} target="_blank" rel="noopener noreferrer"
              title={t('applications:drawer.openCandidate')} aria-label={t('applications:drawer.openCandidate')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, flexShrink: 0, color: 'var(--color-primary)', textDecoration: 'none' }}>
              <ExternalLink size={13} /> {t('applications:drawer.openCandidate')}
            </a>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, flexShrink: 0, color: 'var(--text-muted)' }}>
              <ExternalLink size={13} /> {t('applications:drawer.openCandidate')}
            </span>
          )}
        </span>
      </div>
      {/* The default namespace here is 'candidates' (every sub-tab below needs it), so
          these two loading/error strings — an applications-drawer concern, not a
          candidates one — are explicitly namespaced (mirrors VacancyTab's vacancyDetail.*). */}
      {loading ? (
        <div style={muted}>{t('applications:candidateDetail.loading')}</div>
      ) : error || !c ? (
        <div style={muted}>{t('applications:candidateDetail.error')}</div>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
            <DrawerTabs tabs={tabs} active={tab} onChange={setTab} />
          </div>
          {renderTab(c)}
        </>
      )}
    </div>
  )
}
