/**
 * useOutreachInsights — the outreach page's insights-row config: status/
 * channel donuts, owner/target-group filter options, board columns and the
 * total/active/targets KPI cards — all derived from the ACTIVE campaign list
 * (never the filtered/paginated view, mirroring the page's original
 * behaviour). Extracted from OutreachPage.tsx (§0.3 size split).
 *
 * KPI-RIJ-9-1 (O22, Bellijsten 5→9): `stats` (from the sibling
 * useOutreachFleetStats hook — kept out of THIS hook so it stays pure/hook-free for its existing
 * renderHook-without-QueryClientProvider tests) adds 4 plain KPI cards
 * (called_today/to_call/reached_pct/overdue). These are PLAIN (no onClick):
 * the server's by_status vocabulary (todo/contacted/skipped/answered — a
 * TARGET pipeline stage) is a different axis than this page's campaign-level
 * status donut (draft/active/done) and channel donut counts CAMPAIGNS, not
 * targets, so neither existing donut can safely be swapped for the new
 * aggregate without breaking its click-to-filter route (declined; see the
 * lane report).
 */
import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { useNumberFormat } from '@/lib/formatters'
import type { Campaign } from './useOutreachCampaigns'
import type { OutreachFleetStats } from './useOutreachFleetStats'
import { STATUSES, CHANNELS, statusKey, channelKey, targetsOf, ownerNameOf, targetGroupNameOf } from '../data/outreachCampaignFields'

interface UseOutreachInsightsArgs {
  campaigns: Campaign[]
  selectedStatus: string[]
  setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedChannel: string[]
  setSelectedChannel: Dispatch<SetStateAction<string[]>>
  kpiTargets: boolean
  setKpiTargets: Dispatch<SetStateAction<boolean>>
  // KPI-RIJ-9-1: optional so every existing call site/test keeps working unchanged.
  stats?: OutreachFleetStats | null
}

// A plain (non-filterable) KPI card — see the file docblock for why these 4 have no onClick.
const plainCard = (key: string, label: string, value: number | string | null, sub: string, color: string): KpiSpec =>
  ({ key, label, value, sub, color })

// Board columns + donuts/KPIs derived from the active campaign list, plus the
// owner/target-group filter option lists (see file docblock).
export function useOutreachInsights({ campaigns, selectedStatus, setSelectedStatus, selectedChannel, setSelectedChannel, kpiTargets, setKpiTargets, stats }: UseOutreachInsightsArgs) {
  const { t } = useTranslation('outreach')
  const { formatPercent } = useNumberFormat()

  // Board columns + donut items, labelled via i18n.
  const columns = useMemo(() => STATUSES.map((s) => ({ key: s.key, label: t(`status.${s.key}`), color: s.color })), [t])
  const donutBy = (defs: { key: string; color: string }[], ns: string, keyOf: (c: Campaign) => string) => defs
    .map((d) => ({ name: t(`${ns}.${d.key}`), key: d.key, color: d.color, value: campaigns.filter((c) => keyOf(c) === d.key).length }))
    .filter((d) => d.value > 0)
  // Status donut data, only non-empty buckets, recomputed when the row set or locale changes.
  const statusData  = useMemo(() => donutBy(STATUSES, 'status', statusKey), [campaigns, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const channelData = useMemo(() => donutBy(CHANNELS, 'channel', channelKey), [campaigns, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // Right-panel-only options: owner + target group (source pool), derived from
  // the loaded rows — never a hardcoded list. useCallback-wrapped (stable-setter
  // recipe, mirrors CandidatesPage/CustomersPage/VacanciesPage) so the two memos
  // below can list the real dependency (`optionsFrom`) instead of dropping it.
  const optionsFrom = useCallback((nameOf: (c: Campaign) => string): { value: string; label: string; count: number }[] => {
    const m = new Map<string, number>()
    campaigns.forEach((c) => { const n = nameOf(c); if (n) m.set(n, (m.get(n) ?? 0) + 1) })
    return [...m.entries()].map(([value, count]) => ({ value, label: value, count }))
  }, [campaigns])
  // Owner filter options, derived from the loaded campaigns (never hardcoded).
  const ownerOptions = useMemo(() => optionsFrom(ownerNameOf), [optionsFrom])
  const targetGroupOptions = useMemo(() => optionsFrom(targetGroupNameOf), [optionsFrom])

  // Donut/KPI click = set exactly one status/channel value (or clear when clicked again).
  const pickStatus  = (v?: string) => { if (v != null) setSelectedStatus((p) => (p.length === 1 && p[0] === v) ? [] : [v]) }
  const pickChannel = (v?: string) => { if (v != null) setSelectedChannel((p) => (p.length === 1 && p[0] === v) ? [] : [v]) }

  // ── Insights: 2 donuts (status/channel, filterable) + 7 KPI cards (3 client-derived + 4 plain fleet-stat cards, KPI-RIJ-9-1) ──
  const insightDonuts: DonutSpec[] = [
    { key: 'status',  title: t('insights.status'),  data: statusData,  onPick: (d) => pickStatus((d as { key?: string })?.key), active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'channel', title: t('insights.channel'), data: channelData, onPick: (d) => pickChannel((d as { key?: string })?.key), active: selectedChannel.length > 0, onClear: () => setSelectedChannel([]) },
  ]
  const insightKpis: KpiSpec[] = [
    { key: 'total',   label: t('kpi.total'),   value: campaigns.length,                                          sub: t('kpi.totalSub'),
      onClick: () => { setSelectedStatus([]); setSelectedChannel([]); setKpiTargets(false) },
      // Reset-to-all tile — clickable, but never highlighted (no filter = nothing active).
      active: false },
    { key: 'active',  label: t('kpi.active'),  value: campaigns.filter((c) => statusKey(c) === 'active').length, sub: t('kpi.activeSub'), color: 'var(--color-success-text)',
      onClick: () => pickStatus('active'), active: selectedStatus.length === 1 && selectedStatus[0] === 'active' },
    { key: 'targets', label: t('kpi.targets'), value: campaigns.reduce((n, c) => n + targetsOf(c), 0),           sub: t('kpi.targetsSub'), color: 'var(--color-primary-text)',
      onClick: () => setKpiTargets(v => !v), active: kpiTargets },
    // KPI-RIJ-9-1 (5 → 9): fleet-wide server aggregate, see file docblock —
    // `value == null` while `stats` has not loaded renders the house dash (§3).
    plainCard('calledToday', t('kpi.calledToday'), stats?.called_today ?? null, t('kpi.calledTodaySub'), 'var(--color-success-text)'),
    plainCard('toCall',      t('kpi.toCall'),      stats?.to_call ?? null,      t('kpi.toCallSub'),      'var(--color-info)'),
    // reached_pct is a 0..100 VALUE from the server, not a share-of-sum — formatPercent, never formatRatio (EENHEID-LES).
    plainCard('reachedPct',  t('kpi.reachedPct'),  stats ? formatPercent(stats.reached_pct) : null, t('kpi.reachedPctSub'), 'var(--color-primary-text)'),
    plainCard('overdue',     t('kpi.overdue'),     stats?.overdue ?? null,      t('kpi.overdueSub'),     'var(--color-violet)'),
  ]

  return { columns, statusData, channelData, ownerOptions, targetGroupOptions, insightDonuts, insightKpis }
}
