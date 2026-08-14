/**
 * WhatsAppPage — overview dashboard for WhatsApp candidate messaging.
 *
 * Nine-card KPI band (WA-KPI9-1, mirrors the reports/dashboard nine-card
 * standard): the four original tiles (messages today, candidates contacted,
 * shifts filled, open escalations) plus five more built from data this page
 * already loads — today's inbound/outbound split, today's queued/failed WABA
 * sends, and escalations without a reply. Every value is a real field or a real
 * aggregate of real rows; anything the backend can't back today renders the
 * house dash and keeps its slot (see cardValue() below) — never a padded zero.
 * Data: GET /whatsapp/stats, /messages, /escalations, /activity, /whatsapp-queue.
 *
 * Main blocks below:
 *   - helpers           → date/time formatting (PAD, time-ago, etc.)
 *   - ActivityChart     → recharts area chart of inbound/outbound volume
 *   - MessageFeed       → recent messages with direction + status
 *   - EscalationList    → conversations flagged for human follow-up
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useWhatsAppData } from './hooks/useWhatsAppData'
import { useWhatsAppQueue, sumBatches } from './hooks/useWhatsAppQueue'
// Cross-page import, deliberate (WA-KPI9-1): ReportKpiBand is the ONE shared
// nine-card KPI strip (also used by the dashboard and all 17 reports) — no
// surface of its own, two-line labels, dev-time nine-card guard. Reusing it here
// keeps one look instead of a second hand-rolled strip (CLAUDE.md §0.9/§11).
import ReportKpiBand from '@/pages/reports/ReportKpiBand'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import RightDrawer from '@/components/ui/RightDrawer'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { MessageFeed, EscalationList, ActivityChart } from './components'
import QueueTab from './QueueTab'

// The one house placeholder for "the server did not return this" — never a padded zero.
const DASH = '—'
// A KPI value is only shown once its source is loaded AND didn't error; otherwise dash.
const cardValue = (ready: boolean, v: number | undefined | null): number | string =>
  (!ready || v === undefined || v === null) ? DASH : v

// ─── main page ───────────────────────────────────────────────────────────────

export default function WhatsAppPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('whatsapp')
  // Data layer (4 parallel loads + refresh) lives in the hook; the page stays presentational.
  const { stats, messages, escalations, activity, loading, errors, noConnection, reload } = useWhatsAppData()
  // Today's WABA fan-out batches (WA-KPI9-1) — lifted here from QueueTab so the KPI
  // band has "queued/failed today" on every tab, not just while Queue is active.
  const { batches, loading: queueLoading, error: queueError, notAvailable: queueNotAvailable, reload: reloadQueue } = useWhatsAppQueue()

  // Right-panel filters for the message feed (status + direction). Registering them
  // shows the shared topbar filter button — consistent with the other pages.
  const [selectedStatus,    setSelectedStatus]    = useState<string[]>([])
  const [selectedDirection, setSelectedDirection] = useState<string[]>([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  const statusOptions = useMemo(() => [...new Set(messages.map(m => m.status))].filter((v): v is string => Boolean(v))
    .map(v => ({ value: v, label: t(`msgStatus.${v}`, { defaultValue: v }), count: messages.filter(m => m.status === v).length })), [messages, t])
  const directionOptions = useMemo(() => [...new Set(messages.map(m => m.direction))].filter((v): v is string => Boolean(v))
    .map(v => ({ value: v, label: t(`msgDirection.${v}`, { defaultValue: v }), count: messages.filter(m => m.direction === v).length })), [messages, t])

  const filterGroups = useMemo(() => [
    { key: 'status',    label: t('filters.status'),    selected: selectedStatus,    options: statusOptions,
      onToggle: (v: string) => setSelectedStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'direction', label: t('filters.direction'), selected: selectedDirection, options: directionOptions,
      onToggle: (v: string) => setSelectedDirection(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, selectedStatus, selectedDirection, statusOptions, directionOptions])

  // Only register groups that actually have options (none while disconnected/empty).
  useEffect(() => {
    registerFilters('whatsapp-page', filterGroups.filter(g => g.options.length > 0))
    return () => unregisterFilters('whatsapp-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filteredMessages = useMemo(() => messages.filter(m => {
    if (selectedStatus.length    && !selectedStatus.includes(m.status as string))       return false
    if (selectedDirection.length && !selectedDirection.includes(m.direction as string)) return false
    return true
  }), [messages, selectedStatus, selectedDirection])

  // Active tab (personal-WhatsApp queue removed 2026-07-04 — Business API only;
  // 'queue' below is the WABA/Business batch queue, R3a — a different feature).
  const [tab, setTab] = useState<'overview' | 'messages' | 'queue' | 'escalations'>('overview')
  // Open a specific tab when arriving via a dashboard link (messages / queue / escalations).
  useEffect(() => {
    const wanted = (intent as { tab?: string } | undefined)?.tab
    if (wanted && ['overview', 'messages', 'queue', 'escalations'].includes(wanted)) setTab(wanted as typeof tab)
  }, [intent])
  // Which KPI's right drill-down drawer is open (null = closed).
  const [drill, setDrill] = useState<null | 'today' | 'contacted' | 'filled' | 'escal'>(null)
  // Refresh both data sources; briefly lock the button so it can't be double-clicked.
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    reload()
    reloadQueue()
    setTimeout(() => setRefreshing(false), 1000)
  }

  // Drill a KPI click into the Messages tab, replacing the direction filter with the
  // clicked value (the page's OWN existing right-panel filter state — never a new one).
  const drillDirection = (direction: 'inbound' | 'outbound') => {
    setSelectedDirection([direction])
    setTab('messages')
  }

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
      color: 'var(--color-success)', onClick: () => setDrill('filled') },
    { key: 'escal', label: t('kpi.openEscalations'), value: cardValue(statsReady, stats?.open_escalations),
      color: 'var(--color-danger)', onClick: () => setDrill('escal') },
    { key: 'sentToday', label: t('kpi.sentToday'), value: cardValue(activityReady, todaysActivity?.outbound),
      color: 'var(--color-secondary)', onClick: () => drillDirection('outbound') },
    { key: 'receivedToday', label: t('kpi.receivedToday'), value: cardValue(activityReady, todaysActivity?.inbound),
      color: 'var(--color-success)', onClick: () => drillDirection('inbound') },
    // Plain stats (no matching filter exists yet to drill into — §0 no fake affordances).
    { key: 'queuedToday', label: t('kpi.queuedToday'), value: cardValue(queueReady, queuedToday), color: 'var(--color-info)' },
    { key: 'failedToday', label: t('kpi.failedToday'), value: cardValue(queueReady, failedToday), color: 'var(--color-danger)' },
    { key: 'noReplyEscalations', label: t('kpi.noReplyEscalations'), value: cardValue(escalationsReady, noReplyCount), color: 'var(--color-warning)' },
  ]

  // Overzicht-charts — afgeleid uit de geladen data zodat het scherm leeft.
  const statusData = useMemo(() => {
    const c: Record<string, number> = {}
    messages.forEach(m => { const s = (m.status as string) || 'unknown'; c[s] = (c[s] ?? 0) + 1 })
    return Object.entries(c).map(([s, value]) => ({ name: t(`msgStatus.${s}`, { defaultValue: s }), value }))
  }, [messages, t])
  const reasonsData = useMemo(() => {
    const c: Record<string, number> = {}
    escalations.forEach(e => { const r = (e.reason as string) || 'unknown'; c[r] = (c[r] ?? 0) + 1 })
    return Object.entries(c).map(([r, value]) => ({ name: t(`reasons.${r}`, { defaultValue: r }), value }))
  }, [escalations, t])

  // WhatsApp Business connection down — shown inside the tabs that read /whatsapp/*
  // only. The Wachtrij tab queries its own /whatsapp-queue endpoint and handles its
  // own not-available/error states, so it stays reachable independent of this flag.
  const wabaDown = noConnection && !loading.stats
  const NoConn = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-success-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <MessageCircle size={26} color="var(--color-success)" />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('noConn.title')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>{t('noConn.desc')}</p>
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)', textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{t('noConn.errorLabel')}</div>
          <code style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'monospace' }}>No query results for model WhatsappConnection</code>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Nine-card KPI band (WA-KPI9-1) — click = drill-down into a tab/filter, or a plain stat */}
      <ReportKpiBand kpis={kpis} />

      {/* Tabs + verversen op één lijn; badge = wachtrij-achterstand */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <div role="tablist" style={{ display: 'flex', gap: 4 }}>
        {([['overview', t('tabs.overview')], ['messages', t('tabs.messages')], ['queue', t('tabs.queue')], ['escalations', t('tabs.escalations')]] as const).map(([id, label]) => {
          const active = id === tab
          const badge = id === 'escalations' ? escalations.length : 0
          const badgeDanger = id === 'escalations'
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
                // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                color: active ? 'var(--color-primary-text)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {label}
              {badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 5px', borderRadius: 99,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: badgeDanger ? 'var(--color-danger)' : 'var(--color-primary)',
                  /* Text colour on a danger/primary badge fill uses the on-* contrast token, never raw white */
                  color: badgeDanger ? 'var(--color-on-danger)' : 'var(--color-on-accent)' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', marginBottom: 6,
                   fontSize: 12, fontWeight: 500, borderRadius: 8, flexShrink: 0, border: 'none',
                   background: 'var(--color-primary)', color: 'var(--color-on-accent)',
                   cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1 }}>
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} /> {t('refresh')}
        </button>
      </div>

      {/* Overzicht — activiteit + verdelingen (KPI's staan bovenaan; verhuist later naar Rapportage) */}
      {tab === 'overview' && (wabaDown ? NoConn : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ActivityChart data={activity} loading={loading.activity} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PieChartCard title={t('overview.statusTitle')} data={statusData} showPercent />
            <BarChartCard title={t('overview.reasonsTitle')} data={reasonsData} />
          </div>
        </div>
      ))}

      {/* Berichten — de feed */}
      {tab === 'messages' && (wabaDown ? NoConn : <MessageFeed messages={filteredMessages} loading={loading.messages} />)}

      {/* Wachtrij — today's WABA/Business batches (R3a); hook + polling live in the page now (WA-KPI9-1). */}
      {tab === 'queue' && <QueueTab batches={batches} loading={queueLoading} error={queueError} notAvailable={queueNotAvailable} />}

      {/* Escalaties */}
      {tab === 'escalations' && (wabaDown ? NoConn : <EscalationList escalations={escalations} loading={loading.escalations} />)}

      {/* KPI drill-down (rechter drawer) — berichten + escalaties hebben data; rest wacht op backend */}
      {drill && (
        <RightDrawer
          title={drill === 'today' ? t('kpi.messagesToday') : drill === 'contacted' ? t('kpi.candidatesContacted') : drill === 'filled' ? t('kpi.shiftsFilled') : t('kpi.openEscalations')}
          onClose={() => setDrill(null)}>
          {drill === 'today' ? <MessageFeed messages={filteredMessages} loading={loading.messages} />
            : drill === 'escal' ? <EscalationList escalations={escalations} loading={loading.escalations} />
            : <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 8px' }}>{t('drill.noDetail')}</p>}
        </RightDrawer>
      )}

    </div>
  )
}
