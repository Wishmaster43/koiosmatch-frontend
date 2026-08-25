/**
 * VacancyTab — the FULL vacancy drill-down inside the application drawer, the
 * vacancy-side mirror of CandidateTab.tsx (Danny, with emphasis: the Vacature
 * ("Vacancy") tab must show the real vacancy drill-down). Fetches the linked
 * vacancy and reuses the vacancy feature's own tab components + a sub-tab bar,
 * so it looks and BEHAVES identical to the real VacancyDrawer instead of the
 * old bespoke Details+Description stack with no tab bar.
 *
 * Tab set mirrors VacancyDrawer's own TABS 1:1, minus the same THREE categories
 * CandidateTab already excludes from its own mirror of CandidateDrawer:
 * autoExpand tabs that need the drawer to widen (candidateSearch, like the
 * candidate side's vacancySearch), the PDOK/koppelingen tab (like the
 * candidate side's integrations tab), and the tenant-custom-fields "Extra" tab
 * (conditional on ≥1 active custom field, like the candidate side's own
 * "extra" exclusion here). There is no module-gated tab on the vacancy side
 * (candidate excludes "planning" for hasModule('plan')).
 *
 * The empty state (no vacancy linked yet) keeps its OWN "Vacature koppelen"
 * ("link a vacancy") link flow — unlike CandidateTab's absent-candidate fallback
 * (which just reuses the loading/error copy, since an application always has a
 * candidate), an application legitimately has no vacancy yet, and this flow is
 * the real, tested business path for it (VacancyLinkField, useVacancyLinkOptions).
 */
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Link2, Save, X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { buildEntityDeepLink } from '@/components/ui/EntityLink'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import { ApplicantsTab } from '@/pages/vacancies/shared'
import { AppointmentsTab } from '@/pages/vacancies/shared'
import { buildVacancyPatch } from '@/pages/vacancies/shared'
import { DescriptionTab } from '@/pages/vacancies/shared'
import { DetailsTab } from '@/pages/vacancies/shared'
import { DocumentsTab } from '@/pages/vacancies/shared'
import { MatchesTab } from '@/pages/vacancies/shared'
import { MatchingTab } from '@/pages/vacancies/shared'
import { NotesTab } from '@/pages/vacancies/shared'
import { PublishingTab } from '@/pages/vacancies/shared'
import { StatisticsTab } from '@/pages/vacancies/shared'
import { TimelineTab } from '@/pages/vacancies/shared'
import { VacancyAgentTab } from '@/pages/vacancies/shared'
import { VacancyTasksTab } from '@/pages/vacancies/shared'
import { SectionTitle } from '@/components/ui/typography'
import { useApplicationVacancy } from '../hooks/useApplicationVacancy'
import VacancyLinkField from './VacancyLinkField'
import { useVacancyLinkOptions } from '../hooks/useVacancyLinkOptions'
import { rememberReturnTab } from './constants'
import type { ApplicationDetail } from '@/types/application'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

type LoadState = 'loading' | 'error' | 'empty' | 'ok'
const muted: CSSProperties = { fontSize: 12, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }

interface VacancyTabProps {
  application: ApplicationDetail
  // Re-link (or unlink, null) the vacancy — the SAME handler as ApplicationTab's
  // Details block (§3A: one shared surface, never a per-tab fork).
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
}

export default function VacancyTab({ application: a, onLinkVacancy }: VacancyTabProps) {
  const { t } = useTranslation(['applications', 'vacancies', 'common'])
  const queryClient = useQueryClient()
  // Shared vacancy-detail fetch (adopted from useApplicationVacancy — §11: land the
  // new helper WITH adoption at this exact copy site instead of leaving VacancyTab's
  // own useEffect/useState/api.get running alongside it). CompetitionBlock reads the
  // same cache entry, so the two tabs never issue duplicate requests.
  const { vacancy: vac, loading, error } = useApplicationVacancy(a.vacancyId)
  const state: LoadState = a.vacancyId == null ? 'empty' : loading ? 'loading' : error ? 'error' : vac ? 'ok' : 'empty'
  // Sub-tab bar state — mirrors CandidateTab's own local `tab` state (this drill-down
  // has no EntityDrawer of its own, so it owns its active tab locally).
  const [tab, setTab] = useState('details')
  // Linking flow (empty state) — the CTA opens the shared picker directly (there
  // is nothing read-only to show yet, so no separate pencil step is needed).
  const [linking, setLinking] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const vacancyOptions = useVacancyLinkOptions(linking)

  // Once a vacancy is actually linked, drop any in-flight linking draft.
  useEffect(() => { if (state === 'ok') setLinking(false) }, [state])

  // Save the picked vacancy (link) or clear it (unlink) via the shared handler;
  // the parent PATCHes /applications/{id} and reconciles from the response.
  const saveLink = () => {
    if (!vacancyId) return
    const picked = vacancyOptions.find(v => String(v.value) === vacancyId)
    onLinkVacancy?.(a.id, vacancyId, { title: picked?.label, client: picked?.client })
  }

  // Make the reused vacancy tabs actually persist — optimistic local merge into the
  // shared React Query cache entry, then PATCH /vacancies/{id} with the same
  // UI-patch → API-body mapping the real vacancy drawer uses (buildVacancyPatch).
  // OPTIMISTIC-REVERT-1 (audit 2026-07-27, same bug class as useApplicationDrawerActions):
  // snapshot ONLY the fields this patch touches, read off the cache BEFORE the optimistic
  // write, and revert exactly those fields on failure — never the whole cached vacancy,
  // so a parallel edit to another field (e.g. from CompetitionBlock reading the same
  // entry) is not clobbered by the revert.
  const updateVacancy = (id: Id | undefined, patch: Record<string, unknown>) => {
    if (id == null) return
    const queryKey = ['vacancies', id, 'detail']
    const cached = queryClient.getQueryData<VacancyDetail>(queryKey) as Record<string, unknown> | undefined
    const beforeFields = cached ? Object.fromEntries(Object.keys(patch).map(k => [k, cached[k]])) : null
    // Optimistic merge straight into the shared React Query cache entry (the same
    // key useApplicationVacancy reads), so every embedded tab sees the edit
    // immediately without a duplicate local copy of the vacancy.
    queryClient.setQueryData(queryKey, (prev: VacancyDetail | undefined) =>
      prev ? ({ ...prev, ...patch } as VacancyDetail) : prev)
    const body = buildVacancyPatch(patch)
    if (!Object.keys(body).length) return
    api.patch(`/vacancies/${id}`, body).catch(err => {
      // Revert only the touched fields onto the CURRENT cache value — a rejected PATCH
      // must not leave an edited field showing a value the server never accepted.
      if (beforeFields) {
        queryClient.setQueryData(queryKey, (prev: VacancyDetail | undefined) =>
          prev ? ({ ...prev, ...beforeFields } as VacancyDetail) : prev)
      }
      notifyError(extractApiError(err, t('common:actionFailed')))
    })
  }

  // Sub-tab bar — mirrors VacancyDrawer's own tab list (see the file doc comment
  // for the three excluded categories). "Beschrijving" ("Description") reuses the
  // SAME details.description key the real drawer's tab label does (VAC-TEKST-TAB-1).
  const tabs = [
    { id: 'details',      label: t('vacancies:drawer.tabs.details') },
    { id: 'description',  label: t('vacancies:details.description') },
    { id: 'applicants',   label: t('vacancies:drawer.tabs.applicants') },
    { id: 'appointments', label: t('vacancies:drawer.tabs.appointments') },
    { id: 'matching',     label: t('vacancies:drawer.tabs.matching') },
    { id: 'matches',      label: t('vacancies:drawer.tabs.matches') },
    { id: 'aiagent',      label: t('vacancies:drawer.tabs.aiagent') },
    { id: 'publishing',   label: t('vacancies:drawer.tabs.publishing') },
    { id: 'documents',    label: t('vacancies:drawer.tabs.documents') },
    { id: 'timeline',     label: t('vacancies:drawer.tabs.timeline') },
    { id: 'notes',        label: t('vacancies:drawer.tabs.notes') },
    { id: 'tasks',        label: t('vacancies:drawer.tabs.tasks') },
    { id: 'statistics',   label: t('vacancies:drawer.tabs.statistics') },
  ]

  // Mirror EntityDrawer's own guard (EntityDrawer.tsx:52): a navigation to a tab
  // this curated set does not carry must never blank the pane (Opus 22-08 —
  // StatisticsTab's Leads used to jump to the excluded candidateSearch).
  const goTab = (id: string) => { if (tabs.some(x => x.id === id)) setTab(id) }

  // Rendered only once `vv` (the fetched vacancy) is confirmed non-null below.
  const renderTab = (vv: VacancyDetail) => {
    switch (tab) {
      case 'details':      return <DetailsTab vacancy={vv} onUpdate={updateVacancy} />
      case 'description':  return <DescriptionTab vacancy={vv} onUpdate={updateVacancy} />
      case 'applicants':   return <ApplicantsTab vacancy={vv} />
      case 'appointments': return <AppointmentsTab vacancy={vv} />
      case 'matching':     return <MatchingTab vacancy={vv} onUpdate={updateVacancy} />
      case 'matches':      return <MatchesTab vacancyId={vv.id} />
      case 'aiagent':      return <VacancyAgentTab vacancy={vv} onUpdate={updateVacancy} />
      case 'publishing':   return <PublishingTab vacancy={vv} onUpdate={updateVacancy} />
      case 'documents':    return <DocumentsTab vacancy={vv} />
      case 'timeline':     return <TimelineTab vacancy={vv} />
      case 'notes':        return <NotesTab vacancy={vv} />
      case 'tasks':        return <VacancyTasksTab vacancy={vv} />
      case 'statistics':   return <StatisticsTab vacancy={vv} onNavigateTab={goTab} navigableTabs={tabs.map(x => x.id)} />
      default:             return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Vacancy NAME left + "Open vacature" ("Open vacancy") right on ONE row —
          mirrors the Kandidaat ("Candidate") tab's [name … Open kandidaat ("Open
          candidate")] header so both drill-downs read the same
          (Danny 21-07: "vacature moet zelfde soort worden … naam van de vacature
          links" — "vacancy must become the same kind … name of the vacancy on
          the left"). Shown whenever a vacancy is linked, independent of the
          fetch state below (the title/id are denormalised on the application
          already). Deliberate sibling deviation: CandidateTab still renders a
          muted non-clickable placeholder without an id — here NOTHING renders
          instead, because a dead "Open vacature" text is a §3 fake affordance. */}
      {a.vacancyId != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <SectionTitle as="span" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {a.vacancyTitle}
          </SectionTitle>
          {/* S14/S22: stash the current subtab so browser BACK from the full vacancy
              page reopens THIS application's drawer on the Vacature tab again.
              Danny 21-07: this is an explicit "Open vacancy" AFFORDANCE (not the
              name+trailing-icon EntityLink pattern), so it is a real new-tab anchor
              rather than EntityLink's in-app button wrapped around the icon+label. */}
          <span onClickCapture={() => { if (a.id != null) rememberReturnTab(a.id, 'vacancy') }} style={{ flexShrink: 0 }}>
            {/* A TRUE text link (accent ink, no chrome) — V7 covers button-lookalikes
                only. Block form: the style attribute sits inside the opening tag. */}
            {/* eslint-disable huisstijlLegacy/no-restricted-syntax -- deliberate calm text-link, not a button-lookalike (V7 scope) */}
            <a href={buildEntityDeepLink('vacancies', a.vacancyId)} target="_blank" rel="noopener noreferrer"
              title={t('drawer.openVacancy')} aria-label={t('drawer.openVacancy')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-primary-text)', textDecoration: 'none' }}>
              <ExternalLink size={13} /> {t('drawer.openVacancy')}
            </a>
            {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
          </span>
        </div>
      )}
      {state === 'loading' ? (
        <div style={muted}>{t('vacancyDetail.loading')}</div>
      ) : state === 'error' ? (
        <div style={muted}>{t('vacancyDetail.error')}</div>
      ) : state === 'empty' || !vac ? (
        // Empty state — offer to link a vacancy right here (respects the guard-422
        // toast on save, surfaced by the parent handler).
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('vacancyDetail.empty')}</div>
          {onLinkVacancy && (linking ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', maxWidth: 340 }}>
              <div style={{ flex: 1 }}>
                <VacancyLinkField value={vacancyId} options={vacancyOptions} onChange={setVacancyId} />
              </div>
              <Button variant="primary" iconOnly size="sm" onClick={saveLink} disabled={!vacancyId} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
              <Button variant="secondary" iconOnly size="sm" onClick={() => setLinking(false)} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
            </div>
          ) : (
            // Primary, not secondary (Danny 20-08, pasted this button: "Huisstijl" —
            // "house style") —
            // coupling the vacancy is THE action of this empty state.
            <Button variant="primary" size="sm" onClick={() => { setVacancyId(''); setLinking(true) }}>
              <Link2 size={13} /> {t('vacancyDetail.linkButton')}
            </Button>
          ))}
        </div>
      ) : (
        // Full reuse: the tabs need the vacancy lookups they render labels from, and
        // each gets the real onUpdate so its edit pencils actually persist. A link
        // still jumps to the full vacancy record. Ontkoppelen ("Unlink") lives ONLY in the drawer
        // footer (Danny 21-07: no duplicate top link) — that one collects the required
        // reason (S15); the top affordance both duplicated it and skipped that reason.
        <VacancyLookupsProvider>
          <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
            <DrawerTabs tabs={tabs} active={tab} onChange={setTab} />
          </div>
          {renderTab(vac)}
        </VacancyLookupsProvider>
      )}
    </div>
  )
}
