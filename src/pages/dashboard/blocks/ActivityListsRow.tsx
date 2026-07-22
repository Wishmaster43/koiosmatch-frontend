/**
 * ActivityListsRow — leads pipeline + recent workflow runs + recent conversations,
 * laid out in an auto-flow row (columns = however many of the three render for the
 * active role/data). Extracted from Dashboard.tsx (§0.3 size split); rendering
 * identical to the original inline lists (shown on data-presence — the backend
 * gates these feeds per module).
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { Block, Avatar, StatusBadge } from '../DashboardPrimitives'
import type { DashboardViewModel } from '../hooks/useDashboardViewModel'

export default function ActivityListsRow({ vis, showRuns, showConv, recentLeads, runs, conversations, onNavigate }: {
  vis: DashboardViewModel['vis']
  showRuns: DashboardViewModel['showRuns']
  showConv: DashboardViewModel['showConv']
  recentLeads: DashboardViewModel['recentLeads']
  runs: DashboardViewModel['runs']
  conversations: DashboardViewModel['conversations']
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  const showLeads = vis('list.leads')
  const showRunsBlock = showRuns && vis('list.runs')
  const showConvBlock = showConv && vis('list.conversations')
  if (!(showLeads || showRunsBlock || showConvBlock)) return null

  return (
    // Leads + (AI-runs / conversaties) — getoond op data-aanwezigheid (backend gate't per module)
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${((showLeads ? 1 : 0) + (showRunsBlock ? 1 : 0) + (showConvBlock ? 1 : 0)) || 1}, 1fr)`, gap: 16 }}>
      {showLeads && (
      <Block title={t('block.leadsPipeline')} action={t('action.allCustomers')} onAction={() => onNavigate?.('customers')}>
        {recentLeads.map((l, i) => (
          <div key={i} {...interactive(l.id != null ? () => onNavigate?.('customers', { open: l.id }) : undefined)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: l.id != null ? 'pointer' : 'default',
            borderBottom: i < recentLeads.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{l.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.contact}</div>
            </div>
            <StatusBadge label={l.status} color={l.statusColor} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{l.time}</span>
          </div>
        ))}
      </Block>
      )}

      {showRunsBlock && (
        <Block title={t('block.recentRuns')} action={t('action.all')} onAction={() => onNavigate?.('workflows')}>
          {runs.map((r, i) => (
            <div key={i} {...interactive(() => onNavigate?.('workflows'))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
              borderBottom: i < runs.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: r.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.ok ? <CheckCircle size={13} color="var(--color-success)" /> : <AlertCircle size={13} color="var(--color-danger)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.ok ? t('run.processed', { count: r.n }) : r.err}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{r.time}</span>
            </div>
          ))}
        </Block>
      )}

      {showConvBlock && (
        <Block title={t('block.recentConversations')} action={t('action.all')} onAction={() => onNavigate?.('whatsapp', { tab: 'messages' })}>
          {conversations.map((c, i) => (
            <div key={i} {...interactive(() => onNavigate?.('whatsapp', { tab: 'messages' }))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
              borderBottom: i < conversations.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <Avatar initials={c.name.split(' ').map(n=>n[0]).join('')} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
            </div>
          ))}
        </Block>
      )}
    </div>
  )
}
