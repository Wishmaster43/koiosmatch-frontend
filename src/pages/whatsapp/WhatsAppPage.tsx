/**
 * WhatsAppPage — overview dashboard for WhatsApp candidate messaging.
 *
 * Shows KPI cards (messages today, candidates contacted, shifts filled, open
 * escalations), an activity chart (inbound vs outbound over time), a live
 * message feed, and a list of escalations needing attention.
 * Data: GET /whatsapp/stats, /messages, /escalations, /activity.
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
import { useWhatsAppQueue } from './hooks/useWhatsAppQueue'
import QueueTab from './QueueTab'
import InsightsRow from '@/components/insights/InsightsRow'
import RightDrawer from '@/components/ui/RightDrawer'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { MessageFeed, EscalationList, ActivityChart } from './components'

// ─── main page ───────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const { t } = useTranslation('whatsapp')
  // Data layer (4 parallel loads + refresh) lives in the hook; the page stays presentational.
  const { stats, messages, escalations, activity, loading, noConnection, reload } = useWhatsAppData()

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

  // Operational queue (privé outbox) + active tab. The queue hook is graceful —
  // it stays empty (badge 0) until backend C-43 is live.
  const queue = useWhatsAppQueue()
  const [tab, setTab] = useState<'overview' | 'messages' | 'queue' | 'escalations'>('overview')
  // Which KPI's right drill-down drawer is open (null = closed).
  const [drill, setDrill] = useState<null | 'today' | 'contacted' | 'filled' | 'escal'>(null)
  // Refresh both data sources; briefly lock the button so it can't be double-clicked.
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    reload(); queue.reload()
    setTimeout(() => setRefreshing(false), 1000)
  }

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

  // WhatsApp Business connection down — shown inside the WABA-dependent tabs only,
  // so the privé Wachtrij (independent) stays reachable.
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

      {/* KPI's bovenaan (gedeelde InsightsRow, gelijk aan candidates) — klik = drill-down naar tab */}
      <InsightsRow padding="0 0 16px" kpis={[
        { key: 'today',     label: t('kpi.messagesToday'),       value: loading.stats ? '—' : (stats?.messages_today ?? 0),             color: '#3B8FD4',              onClick: () => setDrill('today') },
        { key: 'contacted', label: t('kpi.candidatesContacted'), value: loading.stats ? '—' : (stats?.candidates_contacted ?? 0),       color: '#7C3AED',              onClick: () => setDrill('contacted') },
        { key: 'filled',    label: t('kpi.shiftsFilled'),        value: loading.stats ? '—' : (stats?.shifts_filled_via_whatsapp ?? 0), color: 'var(--color-success)', onClick: () => setDrill('filled') },
        { key: 'escal',     label: t('kpi.openEscalations'),     value: loading.stats ? '—' : (stats?.open_escalations ?? 0),           color: 'var(--color-danger)',  onClick: () => setDrill('escal') },
      ]} />

      {/* Tabs + verversen op één lijn; badge = wachtrij-achterstand */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <div role="tablist" style={{ display: 'flex', gap: 4 }}>
        {([['overview', t('tabs.overview')], ['messages', t('tabs.messages')], ['queue', t('tabs.queue')], ['escalations', t('tabs.escalations')]] as const).map(([id, label]) => {
          const active = id === tab
          const badge = id === 'queue' ? queue.count : id === 'escalations' ? escalations.length : 0
          const badgeDanger = id === 'escalations' || (id === 'queue' && queue.failed > 0)
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
                color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {label}
              {badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 5px', borderRadius: 99,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: badgeDanger ? 'var(--color-danger)' : 'var(--color-primary)', color: '#fff' }}>
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
                   background: 'var(--color-primary)', color: '#fff',
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

      {/* Wachtrij — privé outbox (backend C-43) */}
      {tab === 'queue' && <QueueTab queue={queue} />}

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
