/**
 * useCandidateOptions — derives the filter option-lists, the donut chart data and
 * the attention/intake/conversation counts for CandidatesPage. Prefers the
 * server-wide totals from /candidates/stats; falls back to counting the loaded
 * page when stats is unavailable. Pure derivation from data + lookups.
 */
import { useMemo, useState } from 'react'
import { metaOf, optsFrom, isStale, isNeverContacted, isNoFollowup } from '../data/candidatesShared'
import { NL_PROVINCES } from '../drawer/constants'
import type { Candidate, CandidateStats } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

interface LocationOption { id?: Id; name?: string }
interface OwnerOption { value: Id; label: string; count: number }

interface UseCandidateOptionsParams {
  stats: CandidateStats | null
  candidates: Candidate[]
  locations: LocationOption[]
  statuses: LookupOption[]
  funnelTypes: LookupOption[]
  candidateTypes: LookupOption[]
  genders: LookupOption[]
}

export function useCandidateOptions({ stats, candidates, locations, statuses, funnelTypes, candidateTypes, genders }: UseCandidateOptionsParams) {
  // Status / funnel / owner options come from stats (whole filtered set); fall
  // back to page-based counts when stats is unavailable.
  const statusOptions = useMemo(() =>
    stats?.by_status
      ? stats.by_status.map(o => { const v = o.value ?? o.status; const m = metaOf(statuses, v); return { value: v, label: m?.label ?? v, color: m?.color, count: o.count } })
      : statuses.map(s => ({ value: s.value, label: s.label, color: s.color, count: candidates.filter(c => c.status === s.value).length })).filter(o => o.count > 0)
  , [stats, candidates, statuses])
  const funnelOptions = useMemo(() =>
    stats?.by_funnel
      ? stats.by_funnel.map(o => { const v = o.value ?? o.funnel_type; return { value: v, label: o.label ?? metaOf(funnelTypes, v)?.label ?? v, color: o.color, count: o.count } })
      : funnelTypes.map(f => ({ value: f.value, label: f.label, color: f.color, count: candidates.filter(c => c.stage === f.value).length })).filter(o => o.count > 0)
  , [stats, candidates, funnelTypes])
  const typeOptions = useMemo(() =>
    candidateTypes.map(ct => ({ value: ct.value, label: ct.label, color: ct.color, count: candidates.filter(c => (c.candidateTypes ?? []).includes(ct.value)).length })).filter(o => o.count > 0)
  , [candidates, candidateTypes])
  // Owner is id-based: options + counts from stats.by_owner; fall back to the page.
  const ownerOptions = useMemo(() => {
    if (stats?.by_owner) {
      // Accept both shapes (id | owner_id); drop the "no owner" bucket + guard a null name.
      return stats.by_owner.map(o => ({ value: o.id ?? o.owner_id, label: o.name || '—', count: o.count })).filter(o => o.value)
    }
    const m: Record<string, OwnerOption> = {}
    candidates.forEach(c => { if (c.ownerId) (m[c.ownerId] ??= { value: c.ownerId, label: c.owner || '—', count: 0 }).count++ })
    return Object.values(m)
  }, [stats, candidates])
  // Gender options come from the /genders lookup (CFG-1); province is a fixed list;
  // title is page-derived until a dedicated options endpoint exists.
  const genderOptions   = useMemo(() => genders.map(g => ({ value: g.value, label: g.label })), [genders])
  const provinceOptions = useMemo(() => NL_PROVINCES.map(p => ({ value: p, label: p })), [])
  const titleOptions    = useMemo(() => optsFrom(candidates.map(c => c.title).filter(Boolean)), [candidates])
  const locationOptions = useMemo(() => (locations ?? []).map(l => ({ value: l.id, label: l.name })).filter(o => o.value != null), [locations])

  // Donut-data: reuse the count-options, enriched with the lookup colour per value.
  const colorFor = (list: LookupOption[], v: unknown) => list.find(x => x.value === v)?.color
  const statusData = useMemo(() =>
    statusOptions.map(o => ({ name: o.label, value: o.count, key: o.value, color: colorFor(statuses, o.value) }))
  , [statusOptions, statuses])
  const funnelData = useMemo(() =>
    funnelOptions.map(o => ({ name: o.label, value: o.count, key: o.value, color: o.color ?? colorFor(funnelTypes, o.value) }))
  , [funnelOptions, funnelTypes])
  const rcData = useMemo(() =>
    ownerOptions.map(o => ({ name: o.label, value: o.count, key: o.value }))
  , [ownerOptions])

  // Attention counts: prefer server-wide totals from /candidates/stats (they honour
  // the active filters); fall back to counting the loaded page.
  const staleCount          = stats?.attention?.stale_6m        ?? candidates.filter(isStale).length
  const neverContactedCount = stats?.attention?.never_contacted ?? candidates.filter(isNeverContacted).length
  // "No follow-up planned": server-wide total (C-13, honours the active filters),
  // with a page-local fallback while the stats endpoint is unavailable.
  const noFollowupCount = stats?.attention?.no_followup_planned ?? candidates.filter(isNoFollowup).length
  // Intake stages are flag-driven (§3B: requires_appointment), never a hardcoded value key.
  const intakeStages = useMemo(() => new Set(funnelTypes.filter(f => (f as { requires_appointment?: boolean }).requires_appointment).map(f => f.value)), [funnelTypes])
  // "Intake planned" = the server-wide appointment-based total from /candidates/stats (honours the
  // active filters); page-local stage-count fallback while stats is unavailable.
  const intakeCount  = useMemo(() =>
    stats?.attention?.intake_planned ?? candidates.filter(c => c.stage && intakeStages.has(c.stage)).length
  , [stats, candidates, intakeStages])
  // Proxy for "active conversations" until WhatsApp/e-mail threads exist: contacted
  // in the last 14 days. Cutoff captured once (lazy init) so the memo stays pure.
  const [convCutoff] = useState(() => Date.now() - 14 * 86400000)
  const activeConvCount = useMemo(() =>
    candidates.filter(c => c.lastContactAt && new Date(c.lastContactAt).getTime() > convCutoff).length
  , [candidates, convCutoff])
  // Open candidate-linked tasks (server total from stats.attention.tasks).
  const tasksCount = stats?.attention?.tasks ?? 0

  return {
    statusOptions, funnelOptions, typeOptions, ownerOptions,
    genderOptions, provinceOptions, titleOptions, locationOptions,
    statusData, funnelData, rcData, intakeStages,
    staleCount, neverContactedCount, noFollowupCount, intakeCount, activeConvCount, tasksCount,
  }
}
