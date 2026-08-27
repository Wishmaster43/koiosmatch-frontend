/**
 * WhatsAppPage — overview dashboard for WhatsApp candidate messaging.
 *
 * Nine-card KPI band (WA-KPI9-1, mirrors the reports/dashboard nine-card
 * standard): the four original tiles (messages today, candidates contacted,
 * shifts filled, open escalations) plus five more built from data this page
 * already loads — today's inbound/outbound split, today's queued/failed WABA
 * sends, and escalations without a reply. Every value is a real field or a real
 * aggregate of real rows; anything the backend can't back today renders the
 * house dash and keeps its slot (see cardValue() in useWhatsappPageData) — never
 * a padded zero. Data: GET /whatsapp/stats, /messages, /escalations, /activity,
 * /whatsapp-queue.
 *
 * Main blocks below:
 *   - useWhatsappPageData → KPI assembly + overview chart derivations (own hook, ./hooks/useWhatsappPageData)
 *   - WhatsAppTabBar      → the tab bar + refresh button (own file, ./WhatsAppTabBar)
 *   - ActivityChart       → recharts area chart of inbound/outbound volume (own file, ./ActivityChart)
 *   - MessagesTable       → messages table (recipient/conversation gateways)
 *   - EscalationList      → conversations flagged for human follow-up
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { useWhatsAppData } from './hooks/useWhatsAppData'
import { useWhatsAppQueue } from './hooks/useWhatsAppQueue'
import { useWhatsappPageData } from './hooks/useWhatsappPageData'
import WhatsAppTabBar from './WhatsAppTabBar'
import type { WhatsAppTabId } from './WhatsAppTabBar'
import { useWaPhoneNumbers, useWaMessagePurposes, useWaTemplates } from './hooks/useWaFilterOptions'
import { useWaMessageTypes } from '@/hooks/useWaMessageTypes'
import { useUsers } from '@/lib/queries'
import { buildWaMessageFilterGroups } from './data/waMessageFilterGroups'
import { buildWaWebQueueFilterGroups } from './data/waWebQueueFilterGroups'
import type { MessageFilterPatch } from './messagesTable/messageColumns'
import WaWebQueueTab from './WaWebQueueTab'
import ConversationsTab from './ConversationsTab'
// Cross-page import, deliberate (WA-KPI9-1): ReportKpiBand is the ONE shared
// nine-card KPI strip (also used by the dashboard and all 17 reports) — no
// surface of its own, two-line labels, dev-time nine-card guard. Reusing it here
// keeps one look instead of a second hand-rolled strip (CLAUDE.md §0.9/§11).
import { ReportKpiBand } from '@/pages/reports/shared'
import RightDrawer from '@/components/ui/RightDrawer'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { EscalationList } from './components'
import ActivityChart from './ActivityChart'
import ChannelActivityChart from './ChannelActivityChart'
import MessagesTable from './messagesTable/MessagesTable'
import QueueTab from './QueueTab'
import { GroupLabel, BodyText } from '@/components/ui/typography'
import { WA_DIRECTION_VALUES, WA_STATUS_VALUES } from './shared'

// Server-validated direction/status vocabulary (WA-MSG-TABLE-1 FIX, 26-08) —
// mirrors WhatsappDashboardController's `in:` validation rules exactly. This is
// the SOURCE for the right-panel filter values; i18n only supplies the label.

// ─── main page ───────────────────────────────────────────────────────────────

export default function WhatsAppPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('whatsapp')
  // Channel names live in the candidates namespace (one label per enum value, app-wide).
  const { t: tCandidates } = useTranslation('candidates')
  // K-193 fase 1: the WA-Web queue + Conversations tabs are module-gated —
  // hasModule stays presence-based (rol-onafhankelijk), mirroring every other
  // whatsapp_web-gated surface (CONTRACT-CHANGELOG 25-08).
  // Optional-chained: useAuth() is null without a Provider (e.g. a bare unit
  // test render) — default both gates closed rather than throwing.
  const auth = useAuth()
  const waWebEnabled = auth?.hasModule('whatsapp_web') ?? false
  // Queue mutations are whatsapp.manage on the server (CMBE audit round 4). The previous
  // name was not a real permission, so these actions were offered to roles the server
  // always refused — the same permission the WhatsApp settings screens already read.
  const canManageQueue = auth?.hasPermission('whatsapp.manage') ?? false
  // K-193: right-panel status filter for the WA-Web queue tab (registered only
  // while that tab is active, same pattern as the message filters below).
  const [waWebStatus, setWaWebStatus] = useState('')
  // Data layer (4 parallel loads + refresh) lives in the hook; the page stays presentational.
  // Right-panel filters (status + direction) are declared before the data hook
  // call so their selection can be handed straight in as SERVER params (WA-MSG-
  // TABLE-1) — replacing the old client-side filter over the first 50 rows.
  const [selectedStatus,    setSelectedStatus]    = useState<string[]>([])
  const [selectedDirection, setSelectedDirection] = useState<string[]>([])
  // Full K-194 filter set (WA-MSG-TABLE-1 stage B) — every axis lives in the
  // right panel (§3A), never a toolbar control.
  const [selectedChannel,  setSelectedChannel]  = useState<string[]>([])
  const [selectedType,     setSelectedType]     = useState<string[]>([])
  const [priorityOnly,     setPriorityOnly]     = useState(false)
  const [selectedPurpose,  setSelectedPurpose]  = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string[]>([])
  const [selectedOwner,    setSelectedOwner]    = useState<string[]>([])
  const [selectedNumber,   setSelectedNumber]   = useState<string[]>([])
  const [dateRange,        setDateRange]        = useState({ from: '', to: '' })
  const [sort,              setSort]            = useState<'asc' | 'desc'>('desc')
  const {
    stats, messages, escalations, activity, loading, errors, noConnection, reload,
    loadMoreMessages, loadingMoreMessages, messagesExhausted,
  } = useWhatsAppData({
    direction: selectedDirection, status: selectedStatus, channel: selectedChannel,
    type: selectedType, priority: priorityOnly ? true : undefined,
    purpose: selectedPurpose, template: selectedTemplate, owner: selectedOwner,
    number: selectedNumber, from: dateRange.from || undefined, to: dateRange.to || undefined,
    sort,
  })
  // Lookup options for the type/owner/number filters (React Query, cached app-wide).
  const { data: messageTypes = [] } = useWaMessageTypes()
  const { data: purposes = [] } = useWaMessagePurposes()
  const { data: templates = [] } = useWaTemplates()
  const { data: phoneNumbers = [] } = useWaPhoneNumbers()
  // useUsers() is untyped (shared cross-page query); narrow to the owner shape this page needs.
  const { data: users = [] } = useUsers() as { data: { id: string | number; name?: string | null }[] }
  // Today's WABA fan-out batches (WA-KPI9-1) — lifted here from QueueTab so the KPI
  // band has "queued/failed today" on every tab, not just while Queue is active.
  const { batches, loading: queueLoading, error: queueError, notAvailable: queueNotAvailable, reload: reloadQueue } = useWhatsAppQueue()

  // Right-panel filters for the message feed (status + direction). Registering them
  // shows the shared topbar filter button — consistent with the other pages.
  const { registerFilters, unregisterFilters } = useRightPanel()

  // Static option lists (WA-MSG-TABLE-1 FIX, 26-08): the value list is pinned to
  // the SERVER's own validation vocabulary (WhatsappDashboardController: direction
  // in:inbound,outbound · status in:sent,delivered,read,failed,received), NEVER
  // derived from the translation file — `Object.keys(t(...))` used to make the
  // filter vocabulary an accidental artifact of whatsapp.json, and silently
  // dropped 'received' (MessageStatus::derive returns 'received' for every
  // inbound message with no read/delivered receipt yet), making that value
  // unfilterable and rendering as a raw untranslated chip. Labels still come
  // from i18n; the VALUES come from the contract.
  const directionOptions = useMemo(() => WA_DIRECTION_VALUES
    .map(v => ({ value: v, label: t(`msgDirection.${v}`, { defaultValue: v }) })), [t])
  // Status filter options, values pinned to the server contract (see comment above).
  const statusOptions = useMemo(() => WA_STATUS_VALUES
    .map(v => ({ value: v, label: t(`msgStatus.${v}`, { defaultValue: v }) })), [t])

  // Generic multi-select toggle (add/remove a value from the array) — shared by
  // every `search-select` group below (mirrors buildMatchFilterGroups' `tog`).
  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) =>
    set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  // Full filter-group config (WA-MSG-TABLE-1 stage B) — pure builder, mirrors
  // buildMatchFilterGroups/buildTaskFilterGroups (§0.3 size split).
  const filterGroups = useMemo(() => buildWaMessageFilterGroups({
    t, tog,
    selectedStatus, setSelectedStatus, selectedDirection, setSelectedDirection,
    selectedChannel, setSelectedChannel, selectedType, setSelectedType,
    priorityOnly, setPriorityOnly, selectedPurpose, setSelectedPurpose,
    selectedTemplate, setSelectedTemplate, selectedOwner, setSelectedOwner,
    selectedNumber, setSelectedNumber, dateRange, setDateRange, sort, setSort,
    statusOptions, directionOptions, messageTypes, purposes, templates, phoneNumbers, users,
  }), [t, selectedStatus, selectedDirection, selectedChannel, selectedType, priorityOnly,
      selectedPurpose, selectedTemplate, selectedOwner, selectedNumber, dateRange, sort,
      statusOptions, directionOptions, messageTypes, purposes, templates, phoneNumbers, users])

  // Table chip gateway (messageColumns onFilter, CEL-DOORKLIK-CANON): a type/
  // template chip click sets the SAME panel filter state this builder reads,
  // so the chip and the panel can never disagree.
  const onTableFilter = useCallback((patch: MessageFilterPatch) => {
    if (patch.type !== undefined) setSelectedType([patch.type])
    if (patch.template !== undefined) setSelectedTemplate([patch.template])
  }, [])

  // Only register groups that actually have options (none while disconnected/
  // empty) — a group with no `options` field at all (date-range, checkbox) is
  // always kept, it has nothing to be empty of.
  useEffect(() => {
    registerFilters('whatsapp-page', filterGroups.filter(g => !Array.isArray(g.options) || g.options.length > 0))
    return () => unregisterFilters('whatsapp-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Active tab (personal-WhatsApp queue removed 2026-07-04 — Business API only;
  // 'queue' below is the WABA/Business batch queue, R3a; 'wa-web-queue' + 'conversations'
  // are K-193 fase 1 — a different feature, module-gated on whatsapp_web).
  const [tab, setTab] = useState<WhatsAppTabId>('overview')
  // Deep link (dashboard tile, F3): a conversation id to open once the tab is active.
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)
  // Open a specific tab when arriving via a dashboard link — includes the new
  // wa-web-queue/conversations targets (F1A) and an optional conversation to open.
  useEffect(() => {
    const target = intent as { tab?: string; open?: string; status?: string } | undefined
    const wanted = target?.tab
    // A module-gated target with the module off has no tab button and no body:
    // fall back to overview instead of leaving the tab bar with nothing selected.
    if (wanted === 'wa-web-queue' && !waWebEnabled) { setTab('overview'); return }
    if (wanted && ['overview', 'messages', 'queue', 'escalations', 'wa-web-queue', 'conversations'].includes(wanted)) {
      setTab(wanted as WhatsAppTabId)
    }
    if (wanted === 'conversations' && target?.open) setOpenConversationId(String(target.open))
    // A dashboard count deep-links pre-filtered: the tile's status lands on the queue's
    // own filter, so the destination shows the same population as the number clicked.
    if (wanted === 'wa-web-queue' && target?.status) setWaWebStatus(String(target.status))
  }, [intent, waWebEnabled])

  // K-193: the WA-Web queue's own status filter — registered only while that
  // tab is the active one, so it never bleeds into the message feed's panel.
  const waWebFilterGroups = useMemo(() => buildWaWebQueueFilterGroups({ t, status: waWebStatus, setStatus: setWaWebStatus }), [t, waWebStatus])
  // Register the WA-Web queue's own status filter only while that tab is active;
  // switching away unregisters it so it never bleeds into the message feed's panel.
  useEffect(() => {
    if (tab !== 'wa-web-queue') { unregisterFilters('whatsapp-wa-web-queue'); return }
    registerFilters('whatsapp-wa-web-queue', waWebFilterGroups)
    return () => unregisterFilters('whatsapp-wa-web-queue')
  }, [tab, waWebFilterGroups, registerFilters, unregisterFilters])

  // Which KPI's right drill-down drawer is open (null = closed).
  const [drill, setDrill] = useState<null | 'today' | 'contacted' | 'filled' | 'escal'>(null)
  // Refresh both data sources; briefly lock the button so it can't be double-clicked.
  const [refreshing, setRefreshing] = useState(false)
  // User clicked refresh: reload both data sources and briefly disable the
  // button so a repeated click can't fire the same reload twice.
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

  // Nine-card KPI assembly + overview chart derivations (WA-KPI9-1) live in the shared hook.
  const { kpis, statusData, reasonsData, channelData, hasChannelSplit, hasChannelSeries } = useWhatsappPageData({
    t, tCandidates, stats, messages, escalations, activity, loading, errors,
    batches, queueLoading, queueError, queueNotAvailable, setDrill, drillDirection,
  })

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
        {/* Heraudit r5: this box used to print an INVENTED Eloquent quote under a
            "backend error" label — §10 forbids raw server errors in the UI, so the
            honest content is a translated next-step hint, via the atoms. */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)', textAlign: 'left' }}>
          <GroupLabel style={{ marginBottom: 8 }}>{t('noConn.hintLabel')}</GroupLabel>
          <BodyText as="div" style={{ fontSize: 12 }}>{t('noConn.hint')}</BodyText>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Nine-card KPI band (WA-KPI9-1) — click = drill-down into a tab/filter, or a plain stat */}
      <ReportKpiBand kpis={kpis} />

      {/* Tabs + refresh on one line; badge = queue backlog */}
      <WhatsAppTabBar tab={tab} setTab={setTab} escalationsCount={escalations.length}
        refreshing={refreshing} onRefresh={handleRefresh} refreshLabel={t('refresh')}
        tabs={([
          ['overview', t('tabs.overview')], ['messages', t('tabs.messages')],
          // Distinct label from the new WA-Web queue below (measured page brief) —
          // both queues share the tab bar, so their names must not read as one thing.
          ['queue', t('queue.wabaTitle')], ['escalations', t('tabs.escalations')],
          // K-193 fase 1: the outbox queue is module-gated, presence-based
          // (rol-onafhankelijk); Conversations reads the general /conversations
          // endpoint (page.whatsapp only, same as the rest of this page) so it
          // is NOT gated behind the whatsapp_web module.
          ...(waWebEnabled ? [['wa-web-queue', t('waWebQueue.title')]] as const : []),
          ['conversations', t('conversations.title')],
        ] as const)} />

      {/* Overview — activity + distributions (KPIs sit above; moves to Reporting later) */}
      {tab === 'overview' && (wabaDown ? NoConn : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ActivityChart data={activity} loading={loading.activity} />
          {hasChannelSeries && <ChannelActivityChart data={activity} />}
          <div style={{ display: 'grid', gridTemplateColumns: hasChannelSplit ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16 }}>
            <PieChartCard title={t('overview.statusTitle')} data={statusData} showPercent />
            {hasChannelSplit && <PieChartCard title={t('overview.channelTitle')} data={channelData} colors={channelData.map(d => d.color)} />}
            <BarChartCard title={t('overview.reasonsTitle')} data={reasonsData} />
          </div>
        </div>
      ))}

      {/* Messages — the feed */}
      {tab === 'messages' && (wabaDown ? NoConn : (
        // The server cursor only pages BACKWARD (older than the oldest loaded row),
        // so "load more" is disabled while sort=asc — appending older rows to the
        // bottom of an ascending list would read wrong and never reach recent ones.
        <MessagesTable messages={messages} loading={loading.messages} onLoadMore={loadMoreMessages}
          loadingMore={loadingMoreMessages} exhausted={sort === 'asc' ? true : messagesExhausted} onFilter={onTableFilter} />
      ))}

      {/* Queue — today's WABA/Business batches (R3a); hook + polling live in the page now (WA-KPI9-1). */}
      {tab === 'queue' && <QueueTab batches={batches} loading={queueLoading} error={queueError} notAvailable={queueNotAvailable} />}

      {/* Escalations */}
      {tab === 'escalations' && (wabaDown ? NoConn : <EscalationList escalations={escalations} loading={loading.escalations} />)}

      {/* K-193 fase 1: WA-Web outbox queue — its own endpoint, reachable independent of the WABA connection state. */}
      {tab === 'wa-web-queue' && waWebEnabled && <WaWebQueueTab status={waWebStatus} canManage={canManageQueue} />}

      {/* K-193/K-194: the bureau-wide Conversations inbox — also independent of the WABA connection. */}
      {tab === 'conversations' && <ConversationsTab openConversationId={openConversationId} />}

      {/* KPI drill-down (right drawer) — messages + escalations have data; the rest waits on backend */}
      {drill && (
        <RightDrawer
          title={drill === 'today' ? t('kpi.messagesToday') : drill === 'contacted' ? t('kpi.candidatesContacted') : drill === 'filled' ? t('kpi.shiftsFilled') : t('kpi.openEscalations')}
          onClose={() => setDrill(null)}>
          {drill === 'today' ? <MessagesTable messages={messages} loading={loading.messages} />
            : drill === 'escal' ? <EscalationList escalations={escalations} loading={loading.escalations} />
            : <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 8px' }}>{t('drill.noDetail')}</p>}
        </RightDrawer>
      )}

    </div>
  )
}
