/**
 * candidateInsights — pure builder for the candidates page KPI strip (§3A
 * config-driven InsightsRow; §0.3 split from CandidatesPage). Three donuts
 * (status / funnel / recruiter, click-to-filter) + the attention KPI cards.
 * No hooks, no state — everything arrives as arguments.
 */
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

// Recharts hands the clicked segment back at top level AND under `.payload`.
type PickArg = { filterValue?: unknown; name?: unknown; payload?: { filterValue?: unknown } }
const pickKey = (d: PickArg) => d?.filterValue ?? d?.payload?.filterValue ?? d?.name

// Teal accent for the "tasks" KPI card — no dedicated design token exists for this
// hue yet (tracked as a §4 gap); kept as one documented constant instead of a raw
// inline hex. Mirrors the identical #0D9488 ApplicationsPage's "aiTasks" KPI uses,
// so both "tasks" cards read as the same accent across entities.
// eslint-disable-next-line no-restricted-syntax -- no matching token hue close enough; tracked as a token-set follow-up (mirrors modules/message_lookup.ts precedent)
const TASKS_ACCENT = '#0D9488'

// Loose datum shape — the option hooks may emit undefined name/value for empty
// buckets, and owner keys are Ids (string | number).
interface DonutDatum { name?: string; value?: number; filterValue?: Id; color?: string }

interface Args {
  t: TFunction
  statusData: DonutDatum[]; funnelData: DonutDatum[]; rcData: DonutDatum[]
  pickStatus: (v: string) => void; pickFunnel: (v: string) => void; pickOwner: (v: string) => void
  // Lead-segment click filters the PHASE axis (PHASE-FILTER-1).
  pickPhase: (v: string) => void; entryPhase: string
  selectedStatus: string[]; setSelectedStatus: (v: string[]) => void
  selectedPhase: string[]; setSelectedPhase: (v: string[]) => void
  selectedFunnel: string[]; setSelectedFunnel: (v: string[]) => void
  selectedOwner: Id[]; setSelectedOwner: (v: Id[]) => void
  attentionFilter: string | null
  toggleAttention: (key: string) => void
  staleMonths: number
  counts: { stale: number; neverContacted: number; noFollowup: number; intake: number; activeConv: number; tasks: number }
}

export function buildCandidateInsights({
  t, statusData, funnelData, rcData, pickStatus, pickFunnel, pickOwner, pickPhase, entryPhase,
  selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedFunnel, setSelectedFunnel,
  selectedOwner, setSelectedOwner, attentionFilter, toggleAttention, staleMonths, counts,
}: Args) {
  // One strip: 3 donuts + KPI cards, all equal footprint (§3A).
  const donuts = [
    // '__none' = the Leads bucket (no deployability status): clicking it filters
    // on the PHASE axis (phase[]=<entry>, PHASE-FILTER-1) — other segments filter
    // on the status axis as before.
    { key: 'status', title: t('analytics.statusTitle'), data: statusData, onPick: (d: PickArg) => { const k = pickKey(d) as string; if (k === '__none') pickPhase(entryPhase); else pickStatus(k) },
      active: selectedStatus.length > 0 || selectedPhase.length > 0,
      onClear: () => { setSelectedStatus([]); setSelectedPhase([]) } },
    { key: 'funnel', title: t('analytics.funnelTitle'), data: funnelData, onPick: (d: PickArg) => pickFunnel(pickKey(d) as string),
      active: selectedFunnel.length > 0, onClear: () => setSelectedFunnel([]) },
    { key: 'rc',     title: t('analytics.rcTitle'),     data: rcData,     onPick: (d: PickArg) => pickOwner(pickKey(d) as string),
      active: selectedOwner.length > 0, onClear: () => setSelectedOwner([]) },
  ]
  const kpis = [
    { key: 'stale',      label: t('analytics.staleMonths', { months: staleMonths }), value: counts.stale, sub: t('analytics.stale6mSub'), color: 'var(--color-warning)',
      onClick: () => toggleAttention('stale6m'),    active: attentionFilter === 'stale6m' },
    { key: 'neverContacted', label: t('analytics.neverContacted'), value: counts.neverContacted, sub: t('analytics.neverContactedSub'), color: 'var(--color-info)',
      onClick: () => toggleAttention('neverContacted'), active: attentionFilter === 'neverContacted' },
    { key: 'noFollowup', label: t('analytics.noFollowup'), value: counts.noFollowup, sub: t('analytics.noFollowupSub'), color: 'var(--color-danger)',
      onClick: () => toggleAttention('noFollowup'), active: attentionFilter === 'noFollowup' },
    // Click filters on the SAME definition as the stat (planned intake appointments) via
    // the intake_planned param (INTAKE-1) — the old funnel-stage set never matched the count.
    // Nearest semantic token for the old #8B5CF6: --color-violet is the shared
    // "system/AI-ish accent" token whose own doc comment already names "intake" (§4).
    { key: 'intake',     label: t('kpi.intake'),           value: counts.intake,     sub: t('kpi.intakeSub'),           color: 'var(--color-violet)',
      onClick: () => toggleAttention('intakePlanned'), active: attentionFilter === 'intakePlanned' },
    // "Actieve gesprekken" = contact in de laatste 14 dagen; the card filters the LIST
    // to exactly those candidates (Danny 2026-07-06 — no WhatsApp jump).
    { key: 'conversations', label: t('analytics.conversations'), value: counts.activeConv, color: 'var(--color-success)',
      onClick: () => toggleAttention('activeConv'), active: attentionFilter === 'activeConv' },
    { key: 'tasks', label: t('kpi.tasks'), value: counts.tasks, sub: t('kpi.tasksSub'), color: TASKS_ACCENT,
      onClick: () => toggleAttention('hasTasks'), active: attentionFilter === 'hasTasks' },
  ]
  return { donuts, kpis }
}
