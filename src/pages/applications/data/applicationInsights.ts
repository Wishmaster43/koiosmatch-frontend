/**
 * applicationInsights — pure builder for the applications page KPI strip (§3A
 * config-driven InsightsRow; §0.3 split from ApplicationsPage, mirrors
 * candidateInsights.tsx). Aggregate builders (phase/owner/source donuts, the
 * vacancy filter options, avg-score/AI-task figures) plus the final donuts+kpis
 * assembler. No hooks, no state — everything arrives as arguments; the page
 * still owns the useMemo wrapping (memoization stays with the render layer).
 */
import type { TFunction } from 'i18next'
import type { Dispatch, SetStateAction } from 'react'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import type { Application } from '@/types/application'
import type { BoardPhase } from '../ApplicationsBoard'

export interface Aggregate { name: string; key: string; color?: string; value: number }

interface AppStats { by_phase?: Array<{ phase_key?: string; key?: string; value?: string; count?: number }>; by_bucket?: Record<string, number> }

// Teal accent for the "AI tasks" KPI card — no dedicated design token exists for
// this hue yet (§4 gap, tracked); kept as one documented constant instead of a
// raw inline hex. Mirrors candidateInsights.tsx's identical TASKS_ACCENT so both
// "tasks" cards read as the same accent across entities.
// eslint-disable-next-line no-restricted-syntax -- no matching token hue close enough; tracked as a token-set follow-up (mirrors candidateInsights.tsx precedent)
const AI_TASKS_ACCENT = '#0D9488'

// Donut click → set exactly one filter value (or clear when clicking it again).
export const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}

// Counts prefer the server-wide stats (real totals, unaffected by any row cap);
// fall back to counting the wide (≤200) sample when stats hasn't loaded.
export const phaseCount = (stats: AppStats | null, wideRows: Application[], key: string): number => {
  const s = stats?.by_phase?.find(o => (o.phase_key ?? o.key ?? o.value) === key)
  return s ? (s.count ?? 0) : wideRows.filter(a => a.phaseKey === key).length
}
export const bucketCount = (stats: AppStats | null, wideRows: Application[], b: string): number =>
  stats?.by_bucket?.[b] ?? wideRows.filter(a => a.bucket === b).length

// ── Donut data (phase / recruiter / source), each with counts ──
export const buildPhaseData = (phases: BoardPhase[], stats: AppStats | null, wideRows: Application[]): Aggregate[] =>
  phases.map(p => ({ name: p.label, key: p.key, color: p.color, value: phaseCount(stats, wideRows, p.key) }))
    .filter(d => d.value > 0)

// Owner/source have NO server-wide aggregate (BE gap — see useApplicationsData's
// header comment), so they derive from the wide (≤200) sample; wideIsPartial
// (computed by the data hook) flags when that sample doesn't cover every
// matching application.
export const buildOwnerData = (wideRows: Application[], noOwnerLabel: string, ownerNoneKey: string): Aggregate[] => {
  // owner_id is legitimately nullable (imports, API-created, pre-assignment):
  // unowned rows form an explicit "No owner" slice instead of being dropped.
  const m: Record<string, Aggregate> = {}
  wideRows.forEach(a => {
    const n = a.owner?.name
    const key = n || ownerNoneKey
    ;(m[key] ??= { name: n || noOwnerLabel, key, color: n ? (a.owner?.color ?? undefined) : '#9CA3AF', value: 0 }).value++
  })
  return Object.values(m)
}
export const buildSourceData = (wideRows: Application[]): Aggregate[] => {
  const m: Record<string, Aggregate> = {}
  wideRows.forEach(a => { const s = a.source; if (s) (m[s] ??= { name: s, key: s, value: 0 }).value++ })
  return Object.values(m)
}

// Filter option lists (value/label/count) reuse the donut aggregates.
export const buildVacOptions = (wideRows: Application[]): Array<{ value: string; label: string; count: number }> => {
  const m: Record<string, { value: string; label: string; count: number }> = {}
  wideRows.forEach(a => { if (a.vacancyId) { const k = String(a.vacancyId); (m[k] ??= { value: k, label: a.vacancyTitle, count: 0 }).count++ } })
  return Object.values(m)
}
export const asOptions = (data: Aggregate[]) => data.map(d => ({ value: d.key, label: d.name, count: d.value }))

// Average match score across non-rejected applications (KPI, "—" when none scored).
// No server-wide aggregate (BE gap) — derived from the wide (≤200) sample.
export const computeAvgScore = (wideRows: Application[]): string => {
  const scored = wideRows.filter(a => a.bucket !== 'rejected' && typeof a.score === 'number')
  return scored.length ? Math.round(scored.reduce((s, a) => s + (a.score as number), 0) / scored.length) + '%' : '—'
}
// Active applications that still carry an AI task (attention KPI); same wide sample.
export const computeAiTaskCount = (wideRows: Application[]): number =>
  wideRows.filter(a => a.task && a.bucket === 'active').length

// `picked` = the chip label; phase filters store the SLUG, so resolve it to its label.
const pickedLabel = (data: Aggregate[], v?: string): string | null => (v ? (data.find(d => d.key === v)?.name ?? v) : null)

interface Counts { active: number; matched: number; rejected: number; new: number }

interface BuildArgs {
  t: TFunction
  phaseData: Aggregate[]; ownerData: Aggregate[]; sourceData: Aggregate[]
  selectedPhase: string[]; setSelectedPhase: Dispatch<SetStateAction<string[]>>
  selectedOwner: string[]; setSelectedOwner: Dispatch<SetStateAction<string[]>>
  selectedSource: string[]; setSelectedSource: Dispatch<SetStateAction<string[]>>
  bucket: string; setBucket: Dispatch<SetStateAction<string>>
  attention: string | null; setAttention: Dispatch<SetStateAction<string | null>>
  toggleAttention: (k: string) => void
  showArchived: boolean; setShowArchived: Dispatch<SetStateAction<boolean>>
  clearAllFilters: () => void
  counts: Counts
  avgScore: string; aiTaskCount: number
}

// ── Insights strip: 3 donuts (filterable) + 6 KPI cards, equal footprint (§3A) ──
export function buildApplicationInsights({
  t, phaseData, ownerData, sourceData,
  selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
  bucket, setBucket, attention, setAttention, toggleAttention, showArchived, setShowArchived, clearAllFilters,
  counts, avgScore, aiTaskCount,
}: BuildArgs): { donuts: DonutSpec[]; kpis: KpiSpec[] } {
  const donuts: DonutSpec[] = [
    { key: 'phase',  title: t('insights.phase'),  data: phaseData,  onPick: pickOne(setSelectedPhase),  active: selectedPhase.length > 0,  onClear: () => setSelectedPhase([]),  picked: pickedLabel(phaseData, selectedPhase[0]) },
    { key: 'owner',  title: t('insights.owner'),  data: ownerData,  onPick: pickOne(setSelectedOwner),  active: selectedOwner.length > 0,  onClear: () => setSelectedOwner([]),  picked: pickedLabel(ownerData, selectedOwner[0]) },
    { key: 'source', title: t('insights.source'), data: sourceData, onPick: pickOne(setSelectedSource), active: selectedSource.length > 0, onClear: () => setSelectedSource([]), picked: pickedLabel(sourceData, selectedSource[0]) },
  ]
  // KPI cards — mirror the candidate strip: count + sub-line, click-to-filter where it maps.
  const kpis: KpiSpec[] = [
    // TOTAAL ACTIEF spans two buckets — clicking shows BOTH (active + matched), so the
    // list always matches the number on the card (Danny: "waar zijn ze allemaal?").
    { key: 'totalActive', label: t('kpi.totalActive'), value: counts.active + counts.matched,
      sub: t('kpi.totalActiveSub'), color: 'var(--color-primary)',
      onClick: () => { clearAllFilters(); setShowArchived(false); setBucket(bucket === 'allActive' ? 'active' : 'allActive'); setAttention(null) },
      active: bucket === 'allActive' },
    { key: 'new', label: t('kpi.new'), value: counts.new,
      sub: t('kpi.newSub'), color: 'var(--color-warning)',
      onClick: () => { setShowArchived(false); setBucket('active'); toggleAttention('new') }, active: attention === 'new' },
    { key: 'matched', label: t('kpi.matched'), value: counts.matched, sub: t('kpi.matchedSub'),
      color: 'var(--color-success)', onClick: () => { setShowArchived(false); setBucket('matched') }, active: !showArchived && bucket === 'matched' },
    { key: 'rejected', label: t('kpi.rejected'), value: counts.rejected, sub: t('kpi.rejectedSub'),
      color: 'var(--color-danger)', onClick: () => { setShowArchived(false); setBucket('rejected') }, active: !showArchived && bucket === 'rejected' },
    { key: 'avgScore', label: t('kpi.avgScore'), value: avgScore, sub: t('kpi.avgScoreSub'), color: 'var(--color-secondary)',
      onClick: () => { setShowArchived(false); toggleAttention('scored') }, active: attention === 'scored' },
    { key: 'aiTasks', label: t('kpi.aiTasks'), value: aiTaskCount, sub: t('kpi.aiTasksSub'), color: AI_TASKS_ACCENT,
      onClick: () => { setShowArchived(false); setBucket('active'); toggleAttention('aiTasks') }, active: attention === 'aiTasks' },
  ]
  return { donuts, kpis }
}
