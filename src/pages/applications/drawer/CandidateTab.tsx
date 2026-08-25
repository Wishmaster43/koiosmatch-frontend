/**
 * CandidateTab — the FULL candidate drill-down inside the application drawer.
 * Fetches the complete candidate (GET /candidates/{id}) and reuses the candidate
 * feature's own tab components + sub-tab bar, so all sub-tabs (Profile / Background
 * / Match / Preferences / ZZP / Communication / Documents / Statistics) show here.
 * Edits update locally and best-effort PATCH /candidates/{id}. (A shared
 * CandidateDetail extraction is the longer-term de-dup; see worklist.)
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { invalidateCandidate } from '@/lib/invalidateEntity'
import { buildEntityDeepLink } from '@/components/ui/EntityLink'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { mapCandidate } from '@/pages/candidates/shared'
import { buildCandidatePatch } from '@/pages/candidates/shared'
import { ProfilePanel } from '@/pages/candidates/shared'
import { BackgroundTab } from '@/pages/candidates/shared'
import { WorkTab } from '@/pages/candidates/shared'
import { PreferencesTab, ZzpTab } from '@/pages/candidates/shared'
import { CommunicationTab } from '@/pages/candidates/shared'
import { DocumentsSection } from '@/pages/candidates/shared'
import { StatisticsTab } from '@/pages/candidates/shared'
import { SectionTitle } from '@/components/ui/typography'
import { rememberReturnTab } from './constants'
import type { Candidate } from '@/types/candidate'
import type { ApplicationDetail } from '@/types/application'

const ZZP_TYPES = ['freelance', 'zzp']
const muted = { fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }

export default function CandidateTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('candidates')
  const queryClient = useQueryClient()
  const [edits, setEdits]     = useState<Record<string, unknown>>({})
  const [tab, setTab]         = useState('profile')

  // Full candidate for the linked application, keyed ['candidates', candidateId] —
  // the SAME key shape the candidate drawer's own edit/save path invalidates on a
  // PATCH (REFRESH-FIX-2), so an edit made from EITHER surface refetches this tab
  // too, instead of leaving it showing the pre-edit record until an F5.
  const candidateId = a.candidateId
  const candQuery = useQuery({
    queryKey: ['candidates', candidateId],
    enabled: candidateId != null,
    queryFn: async ({ signal }): Promise<Candidate> => mapCandidate(unwrap(await api.get(`/candidates/${candidateId}`, { signal }))),
  })
  const cand    = candQuery.data ?? null
  const loading = candidateId != null && candQuery.isLoading
  const error   = candQuery.isError

  // A different linked candidate: drop the local edit overlay so it never leaks
  // onto the newly loaded record (the query itself refetches via its own key).
  useEffect(() => { setEdits({}) }, [candidateId])

  // Optimistic local edit (camelCase UI merge) + persist via the SAME UI-patch →
  // API-body mapping as the real candidate drawer (buildCandidatePatch, used by
  // useCandidateRecord().patchCandidate) — the raw camelCase patch used to go
  // straight to the API and get silently dropped by CandidateProfileRequest's
  // all-sometimes rules (dob, placeOfBirth, houseNumber(+suffix), postalCode,
  // linkedin, candidateTypes, zzp, consent.retentionOptIn, …).
  // OPTIMISTIC-REVERT-1 (audit 2026-07-28, same bug class as
  // useApplicationDrawerActions/VacancyTab's updateVacancy): this used to
  // `.catch(() => notifyError(...))` with no revert, so a rejected PATCH left the
  // edited value in `edits` forever, looking saved. `edits` is a SPARSE delta
  // merged over the fetched `cand` (see `c` below) — snapshot ONLY the keys this
  // patch touches (their `edits` value AND whether they were present at all)
  // before the optimistic write, then restore exactly those on failure. A key
  // that was never locally edited before must be DELETED on revert, not set to
  // `undefined` — an explicit `undefined` still wins the `{...cand, ...edits}`
  // merge and would hide the real, last-fetched candidate value.
  const onUpdate = (id: string | number, patch: Record<string, unknown>) => {
    const touchedKeys = Object.keys(patch)
    const before: Record<string, unknown> = {}
    const hadKey: Record<string, boolean> = {}
    setEdits(e => {
      touchedKeys.forEach(k => { hadKey[k] = Object.prototype.hasOwnProperty.call(e, k); before[k] = e[k] })
      return { ...e, ...patch }
    })
    const body = buildCandidatePatch(patch)
    if (!Object.keys(body).length) return
    api.patch(`/candidates/${id}`, body)
      // REFRESH-FIX-2: reconcile the candidate + applications caches — the
      // optimistic `edits` overlay above only updates THIS tab's own view.
      .then(() => invalidateCandidate(queryClient))
      .catch(err => {
        setEdits(e => {
          const next = { ...e }
          touchedKeys.forEach(k => { if (hadKey[k]) next[k] = before[k]; else delete next[k] })
          return next
        })
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
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
          <SectionTitle as="span" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {/* The query result first (Opus F1): the application's own `candidate.name`
                is a plain-state snapshot handleCandidateUpdated never renames. */}
            {c?.name ?? a.candidate?.name ?? a.candidateName}
          </SectionTitle>
        </div>
        {/* S14/S22: stash the current subtab so browser BACK from the full candidate
            page reopens THIS application's drawer on the Kandidaat tab again.
            Danny 21-07: this is an explicit "Open candidate" AFFORDANCE (not the
            name+trailing-icon EntityLink pattern), so it is a real new-tab anchor
            rather than EntityLink's in-app button wrapped around the icon+label. */}
        <span onClickCapture={() => { if (a.id != null) rememberReturnTab(a.id, 'candidate') }}>
          {a.candidateId != null ? (
            // A TRUE text link (accent ink, no chrome) — V7 covers button-lookalikes
            // only. Block form: the style attribute sits inside the opening tag
            // (mirrors VacancyTab's identical "Open vacancy" anchor).
            /* eslint-disable huisstijlLegacy/no-restricted-syntax -- deliberate calm text-link, not a button-lookalike (V7 scope) */
            <a href={buildEntityDeepLink('candidates', a.candidateId)} target="_blank" rel="noopener noreferrer"
              title={t('applications:drawer.openCandidate')} aria-label={t('applications:drawer.openCandidate')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, flexShrink: 0, color: 'var(--color-primary-text)', textDecoration: 'none' }}>
              <ExternalLink size={13} /> {t('applications:drawer.openCandidate')}
            </a>
            /* eslint-enable huisstijlLegacy/no-restricted-syntax */
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
