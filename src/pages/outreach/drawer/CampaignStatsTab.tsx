/**
 * CampaignStatsTab — G31: GET /outreach-campaigns/{id}/stats (by_status /
 * by_outcome / by_assignee) existed on the backend but was never shown. Built
 * from the SAME config-driven donut/KPI components every entity insights row
 * uses (§3A — InsightsRow's donuts[]/kpis[], MiniDonut, KpiCard; never
 * hand-rolled tiles). Each donut segment click sets the drawer's target
 * filter; the Targets tab reads that SAME filter to narrow its list, so a
 * click genuinely does something instead of being a static chart (§3A donut
 * convention — filtering on the biggest segment must not look dead).
 */
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { useOutreachStats } from '../hooks/useOutreachStats'
import { useOutreachStatuses } from '@/lib/useOutreachStatuses'
import { useOutreachOutcomes } from '@/lib/useOutreachOutcomes'
import type { TargetFilter } from './targetFilter'

// Recharts hands the clicked segment back at top level AND under `.payload`
// (mirrors the vacancy/opportunity donuts' own local pickKey helper).
const pickKey = (d: unknown): string | undefined => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  return o?.key ?? o?.payload?.key ?? o?.name
}

export default function CampaignStatsTab({ campaignId, filter, onPick, onClear }: {
  campaignId: string | null
  filter: TargetFilter
  onPick: (axis: 'status' | 'outcome' | 'assignee', value: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation('outreach')
  const { stats, loading, error } = useOutreachStats(campaignId)
  const { metaOf: statusMeta } = useOutreachStatuses()
  const { metaOf: outcomeMeta } = useOutreachOutcomes()

  // Four UI states — never a blank panel.
  if (loading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.loading')}</p>
  if (error) return <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.stats.error')}</p>
  if (!stats || stats.total === 0) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.empty')}</p>

  // Zero-count segments are dropped for the donut (backend zero-fills every
  // tenant lookup value; an empty ring is more honest than a full circle of
  // invisible slivers, mirrors vacancy StatisticsTab's phaseData filter).
  const statusData = stats.by_status
    .map(s => ({ name: statusMeta(s.status)?.label ?? s.status, key: s.status, value: s.count, color: statusMeta(s.status)?.color }))
    .filter(d => d.value > 0)
  const outcomeData = stats.by_outcome
    .map(o => ({ name: outcomeMeta(o.outcome)?.label ?? o.outcome, key: o.outcome, value: o.count, color: outcomeMeta(o.outcome)?.color }))
    .filter(d => d.value > 0)
  // Sentinel '' key for "unassigned" (owner_id null) — TargetsTab's filter check
  // matches the same String(assignee?.id ?? '') so both sides agree on the key.
  const assigneeData = stats.by_assignee
    .map(a => ({ name: a.name, key: String(a.owner_id ?? ''), value: a.count, color: undefined as string | undefined }))
    .filter(d => d.value > 0)

  // One donut spec per axis, wired to the SAME onPick/onClear the Targets tab
  // filter reads — clicking a segment toggles that axis's filter (click again
  // to clear, matching the page-level insights row convention).
  const makeDonut = (key: 'status' | 'outcome' | 'assignee', title: string, data: typeof statusData): DonutSpec => ({
    key, title, data,
    onPick: (d: unknown) => { const v = pickKey(d); if (v != null) onPick(key, v) },
    active: filter?.axis === key,
    onClear,
    picked: filter?.axis === key ? (data.find(d => d.key === filter.value)?.name ?? filter.value) : null,
  })

  const reached = stats.by_status
    .filter(s => statusMeta(s.status)?.is_reached)
    .reduce((sum, row) => sum + row.count, 0)

  const donuts: DonutSpec[] = [
    makeDonut('status', t('drawer.stats.byStatus'), statusData),
    makeDonut('outcome', t('drawer.stats.byOutcome'), outcomeData),
    makeDonut('assignee', t('drawer.stats.byAssignee'), assigneeData),
  ]
  const kpis: KpiSpec[] = [
    { key: 'total', label: t('drawer.stats.total'), value: stats.total, color: 'var(--text)' },
    { key: 'reached', label: t('drawer.stats.reached'), value: reached, color: 'var(--color-success)' },
  ]

  // padding: '0' — InsightsRow's page-top default (16px 24px 12px) would double
  // up on the drawer body's own 14px/16px padding (EntityDrawer.tsx).
  return <InsightsRow donuts={donuts} kpis={kpis} clearTitle={t('insights.clearFilter')} padding="0" />
}
