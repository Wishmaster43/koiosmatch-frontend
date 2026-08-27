/**
 * useWhatsappPageData — the nine-card KPI assembly (WA-KPI9-1) + the overview
 * chart derivations (status/reasons/channel breakdowns) for WhatsAppPage,
 * extracted verbatim (pure split, no behaviour change) so the page component
 * stays composition + drawer wiring.
 */
import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { CHANNEL_COLORS } from '@/components/drawer/channelColors'
import { sumBatches } from './useWhatsAppQueue'
import type { WaStats, WaMessage, WaEscalation, WaActivityDatum, WaQueueBatch } from '@/types/whatsapp'

// The one house placeholder for "the server did not return this" — never a padded zero.
const DASH = '—'
// A KPI value is only shown once its source is loaded AND didn't error; otherwise dash.
const cardValue = (ready: boolean, v: number | undefined | null): number | string =>
  (!ready || v === undefined || v === null) ? DASH : v

export function useWhatsappPageData({
  t, tCandidates, stats, messages, escalations, activity, loading, errors,
  batches, queueLoading, queueError, queueNotAvailable, setDrill, drillDirection,
}: {
  t: TFunction
  tCandidates: TFunction
  stats: WaStats | null | undefined
  messages: WaMessage[]
  escalations: WaEscalation[]
  activity: WaActivityDatum[]
  loading: { stats: boolean; activity: boolean; escalations: boolean }
  errors: { stats?: boolean; activity?: boolean; escalations?: boolean }
  batches: WaQueueBatch[]
  queueLoading: boolean
  queueError: boolean
  queueNotAvailable: boolean
  setDrill: (drill: 'today' | 'contacted' | 'filled' | 'escal') => void
  drillDirection: (direction: 'inbound' | 'outbound') => void
}) {
  // Today's point on the 14-day activity series is always the LAST entry — the
  // backend builds it oldest→newest ending on today (WhatsappDashboardController::activity).
  const todaysActivity = activity.length ? activity[activity.length - 1] : undefined
  const activityReady = !loading.activity && !errors.activity
  // Escalations flagged specifically "no reply" (a real subset of the full,
  // unpaginated /whatsapp/escalations list — see WaEscalation.reason).
  const escalationsReady = !loading.escalations && !errors.escalations
  const noReplyCount = escalationsReady ? escalations.filter(e => e.reason === 'no_reply').length : undefined
  // Today's WABA batches are always today's-only server-side (WhatsappQueueController
  // filters by started_at = today) — a plain sum, no client-side date filtering needed.
  const queueReady = !queueLoading && !queueError && !queueNotAvailable
  const queuedToday = queueReady ? sumBatches(batches, 'queued') : undefined
  const failedToday = queueReady ? sumBatches(batches, 'failed') : undefined
  const statsReady = !loading.stats && !!stats

  // Nine honest cards (WA-KPI9-1): the four legacy stats tiles unchanged in meaning,
  // plus today's inbound/outbound split (from /whatsapp/activity), today's queued/
  // failed WABA sends (from /whatsapp-queue) and no-reply escalations (from
  // /whatsapp/escalations). No card here invents a number — see cardValue() above.
  const kpis: KpiSpec[] = [
    { key: 'today', label: t('kpi.messagesToday'), value: cardValue(statsReady, stats?.messages_today),
      color: 'var(--color-secondary)', onClick: () => setDrill('today') },
    { key: 'contacted', label: t('kpi.candidatesContacted'), value: cardValue(statsReady, stats?.candidates_contacted),
      color: 'var(--color-violet)', onClick: () => setDrill('contacted') },
    { key: 'filled', label: t('kpi.shiftsFilled'), value: cardValue(statsReady, stats?.shifts_filled_via_whatsapp),
      color: 'var(--color-success-text)', onClick: () => setDrill('filled') },
    { key: 'escal', label: t('kpi.openEscalations'), value: cardValue(statsReady, stats?.open_escalations),
      color: 'var(--color-danger-text)', onClick: () => setDrill('escal') },
    { key: 'sentToday', label: t('kpi.sentToday'), value: cardValue(activityReady, todaysActivity?.outbound),
      color: 'var(--color-secondary)', onClick: () => drillDirection('outbound') },
    { key: 'receivedToday', label: t('kpi.receivedToday'), value: cardValue(activityReady, todaysActivity?.inbound),
      color: 'var(--color-success-text)', onClick: () => drillDirection('inbound') },
    // Plain stats (no matching filter exists yet to drill into — §0 no fake affordances).
    { key: 'queuedToday', label: t('kpi.queuedToday'), value: cardValue(queueReady, queuedToday), color: 'var(--color-info)' },
    { key: 'failedToday', label: t('kpi.failedToday'), value: cardValue(queueReady, failedToday), color: 'var(--color-danger-text)' },
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    { key: 'noReplyEscalations', label: t('kpi.noReplyEscalations'), value: cardValue(escalationsReady, noReplyCount), color: 'var(--color-warning)' },
  ]

  // Overview charts, derived from the data already loaded so the screen has
  // something to show without a second round trip.
  const statusData = useMemo(() => {
    const c: Record<string, number> = {}
    messages.forEach(m => { const s = (m.status as string) || 'unknown'; c[s] = (c[s] ?? 0) + 1 })
    return Object.entries(c).map(([s, value]) => ({ name: t(`msgStatus.${s}`, { defaultValue: s }), value }))
  }, [messages, t])
  // Escalation reasons, tallied client-side from the already-loaded list, for the overview chart.
  const reasonsData = useMemo(() => {
    const c: Record<string, number> = {}
    escalations.forEach(e => { const r = (e.reason as string) || 'unknown'; c[r] = (c[r] ?? 0) + 1 })
    return Object.entries(c).map(([r, value]) => ({ name: t(`reasons.${r}`, { defaultValue: r }), value }))
  }, [escalations, t])

  // K-197: today's messages per channel (sent + received); the server zero-fills all
  // three channels, an older envelope has no by_channel and hides the card.
  const channelData = useMemo(() => (stats?.by_channel ?? []).map(c => ({
    name: tCandidates(`conversations.channel.${c.channel}`, { defaultValue: c.label ?? c.channel }),
    value: (c.sent ?? 0) + (c.received ?? 0), key: c.channel,
    color: CHANNEL_COLORS[c.channel] ?? 'var(--color-primary)',
  })), [stats, tCandidates])
  const hasChannelSplit = channelData.length > 0
  const hasChannelSeries = activity.some(d => d.by_channel != null)

  return { kpis, statusData, reasonsData, channelData, hasChannelSplit, hasChannelSeries }
}
