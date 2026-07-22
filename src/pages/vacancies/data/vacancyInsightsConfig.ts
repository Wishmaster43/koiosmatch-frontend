/**
 * buildVacancyInsightsConfig — pure builder for VacanciesPage's insights row: the
 * 7 donuts + 2 KPI cards (VAC-KPI-REDESIGN 22-07, Danny 22-07). Extracted once the
 * page crossed ~400 lines (§3 size discipline), mirroring how the candidate page's
 * equivalent config already lives in candidateInsights.tsx. No hooks, no state —
 * the donut data + the page's own state/setters arrive as arguments.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { pickKey } from './vacanciesShared'
import { pickFunnelPhase, pickAgentSegment } from './insightPicks'

interface Aggregate { name: string; key: string; color?: string; value: number }
type PublishedBucket = 'all' | 'published' | 'unpublished'

interface Args {
  t: TFunction
  // NavigationContext's cross-page jump — the funnel donut's click target.
  navigate: (page: string, intent?: unknown) => void
  statusData: Aggregate[]; ownerData: Aggregate[]; clientData: Aggregate[]
  categoryData: Aggregate[]; publishedData: Aggregate[]; funnelData: Aggregate[]; agentData: Aggregate[]
  statusBucket: string; setStatusBucket: Dispatch<SetStateAction<string>>
  selectedOwner: string[]; pickOwner: (v: string | undefined) => void; clearOwner: () => void
  selectedClient: string[]; pickClient: (v: string | undefined) => void; clearClient: () => void
  selectedCategory: string[]; pickCategory: (v: string | undefined) => void; clearCategory: () => void
  publishedBucket: PublishedBucket; setPublishedBucket: Dispatch<SetStateAction<PublishedBucket>>
  selectedAgentId: string | null; setSelectedAgentId: Dispatch<SetStateAction<string | null>>
  showWithoutAgent: boolean; setShowWithoutAgent: Dispatch<SetStateAction<boolean>>
  // Shared with the toolbar QuickViewToggle + the "Zonder AI-agent" KPI card —
  // one definition (VacanciesPage) so all three stay in sync.
  toggleWithoutAgent: () => void
  applicationsTotal: number
}

export function buildVacancyInsightsConfig({
  t, navigate, statusData, ownerData, clientData, categoryData, publishedData, funnelData, agentData,
  statusBucket, setStatusBucket, selectedOwner, pickOwner, clearOwner, selectedClient, pickClient, clearClient,
  selectedCategory, pickCategory, clearCategory, publishedBucket, setPublishedBucket,
  selectedAgentId, setSelectedAgentId, showWithoutAgent, setShowWithoutAgent, toggleWithoutAgent, applicationsTotal,
}: Args) {
  // 7 donuts (VAC-KPI-REDESIGN 22-07: was 5 donuts + 6 funnel-KPI cards = 11 tiles;
  // the funnel collapsed into one donut and an AI-agent donut was added, keeping
  // the agreed 9-tile footprint with the 2 KPI cards below).
  const donuts: DonutSpec[] = [
    { key: 'status', title: t('insights.statusTitle'), data: statusData,
      onPick: d => { const k = pickKey(d); setStatusBucket(prev => (prev === k ? 'all' : (k ?? 'all'))) },
      active: statusBucket !== 'all', onClear: () => setStatusBucket('all') },
    { key: 'owner',  title: t('insights.ownerTitle'),  data: ownerData,  onPick: d => pickOwner(pickKey(d)),  active: selectedOwner.length > 0,  onClear: clearOwner },
    { key: 'client', title: t('insights.clientTitle'), data: clientData, onPick: d => pickClient(pickKey(d)), active: selectedClient.length > 0, onClear: clearClient },
    // V28: functie donut — server-wide by_category aggregate, click-to-filter onto
    // the existing category[] param. §4/§3A equal-footprint note (audit R1 item 7):
    // this is one of the row's extra donuts, not the candidate blueprint's 3 — a
    // deliberate product choice (Danny asked for this + the V27 published donut on
    // 17-07), not drift; see useVacancyInsights.ts's docblock for the full reason.
    { key: 'category', title: t('insights.categoryTitle'), data: categoryData,
      onPick: d => pickCategory(pickKey(d)), active: selectedCategory.length > 0, onClear: clearCategory },
    // V27: click a segment → publishedBucket ('published'/'unpublished'); click again clears.
    { key: 'published', title: t('insights.publishedTitle'), data: publishedData,
      onPick: d => { const k = pickKey(d); setPublishedBucket(prev => (prev === k ? 'all' : (k === 'published' || k === 'unpublished' ? k : 'all'))) },
      active: publishedBucket !== 'all', onClear: () => setPublishedBucket('all') },
    // VAC-KPI-REDESIGN 22-07: one funnel donut (was 6 separate KPI cards). Funnel
    // counts are APPLICATION numbers, not a vacancy-list filter — a segment click
    // jumps to Sollicitaties with that stage pre-filtered (mirrors the old cards'
    // click target, Danny's "Gesolliciteerd doet niks" fix), so this donut has no
    // active/onClear (it never filters the vacancy list itself). pickFunnelPhase is
    // the pure resolver (insightPicks.ts) so the click-target is unit-tested.
    { key: 'funnel', title: t('insights.funnelTitle'), data: funnelData,
      onPick: d => { const k = pickFunnelPhase(d); if (k) navigate('applications', { stage: k }) } },
    // VAC-KPI-REDESIGN 22-07: AI-agent donut (NEW). A real-agent segment sets
    // ?agent_id=; the "Geen agent" segment (key '__none') is the same quick view as
    // the toolbar toggle/KPI card — see agentData's honest-gate comment in
    // useVacancyInsights.ts for why this still falls back to page-scope counts.
    // pickAgentSegment is the pure resolver (insightPicks.ts) so the mutually-
    // exclusive agent_id/without_agent toggle is unit-tested.
    { key: 'agent', title: t('insights.agentTitle'), data: agentData,
      onPick: d => {
        const next = pickAgentSegment(d, selectedAgentId, showWithoutAgent)
        setSelectedAgentId(next.selectedAgentId); setShowWithoutAgent(next.showWithoutAgent)
      },
      active: Boolean(selectedAgentId) || showWithoutAgent, onClear: () => { setSelectedAgentId(null); setShowWithoutAgent(false) } },
  ]

  // 2 KPI cards (VAC-KPI-REDESIGN proposal, Danny: "makkelijk te wisselen" — swap
  // these for a different pair any time, nothing else depends on this exact set).
  const agentNoneCount = agentData.find(d => d.key === '__none')?.value ?? 0
  const kpis: KpiSpec[] = [
    // #1: vacancies without a linked AI agent — same quick view as the toolbar toggle.
    { key: 'withoutAgent', label: t('kpi.withoutAgent'), value: agentNoneCount, color: 'var(--color-violet)',
      onClick: toggleWithoutAgent, active: showWithoutAgent },
    // #2: total applications across every funnel phase — informational only (no filter).
    { key: 'applicationsTotal', label: t('kpi.applicationsTotal'), value: applicationsTotal, color: 'var(--color-primary)' },
  ]

  return { donuts, kpis }
}
