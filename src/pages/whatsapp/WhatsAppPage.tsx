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
import { MessageCircle, Users, CheckSquare, AlertTriangle, RefreshCw } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useWhatsAppData } from './hooks/useWhatsAppData'
import { PAD, KpiCard, MessageFeed, EscalationList, ActivityChart } from './components'

// ─── main page ───────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const { t } = useTranslation('whatsapp')
  // Data layer (4 parallel loads + refresh) lives in the hook; the page stays presentational.
  const { stats, messages, escalations, activity, loading, lastRefresh, noConnection, reload } = useWhatsAppData()

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

  if (noConnection && !loading.stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-success-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px' }}>
            <MessageCircle size={26} color="var(--color-success)" />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {t('noConn.title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('noConn.desc')}
          </p>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px',
                        border: '1px solid var(--border)', textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 8 }}>
              {t('noConn.errorLabel')}
            </div>
            <code style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'monospace' }}>
              No query results for model WhatsappConnection
            </code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {t('title')}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('updatedAt', { time: `${PAD(lastRefresh.getHours())}:${PAD(lastRefresh.getMinutes())}` })}
          </p>
        </div>
        <button onClick={reload}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                   fontSize: 12, fontWeight: 500, borderRadius: 8,
                   border: '1px solid var(--border)', background: 'var(--surface)',
                   color: 'var(--text-muted)', cursor: 'pointer' }}>
          <RefreshCw size={12} /> {t('refresh')}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={MessageCircle} label={t('kpi.messagesToday')}        value={stats?.messages_today}            color="#3B8FD4" loading={loading.stats} />
        <KpiCard icon={Users}         label={t('kpi.candidatesContacted')} value={stats?.candidates_contacted}      color="#7C3AED" loading={loading.stats} />
        <KpiCard icon={CheckSquare}   label={t('kpi.shiftsFilled')}        value={stats?.shifts_filled_via_whatsapp} color="var(--color-success)" loading={loading.stats} />
        <KpiCard icon={AlertTriangle} label={t('kpi.openEscalations')}     value={stats?.open_escalations}          color="var(--color-danger)" loading={loading.stats} />
      </div>

      {/* Chart */}
      <div style={{ marginBottom: 20 }}>
        <ActivityChart data={activity} loading={loading.activity} />
      </div>

      {/* Feed + Escalaties */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
        <MessageFeed    messages={filteredMessages} loading={loading.messages} />
        <EscalationList escalations={escalations} loading={loading.escalations} />
      </div>

    </div>
  )
}
