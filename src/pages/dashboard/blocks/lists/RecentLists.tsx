/**
 * RecentLists — the five recent-activity lists as registry tiles (DASH-PAIRS-1):
 * recent candidates, recent applications, leads in pipeline, recent workflow
 * runs, recent conversations. Moved out of RecentListsRow/ActivityListsRow so
 * they pack in the ONE dashboard grid (and can be paired with a feed tile);
 * rows are the viewmodel-mapped rows (labels/colours from the tenant lookups).
 * Each row composes the shared `DashboardListRow` shell (D1/D2 — the same
 * shell WidgetListBlock uses one file over) instead of hand-rolling it.
 * Typography atoms carry the identity (HUISSTIJL r6), layout via style only.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { Block, Avatar, StatusBadge } from '@/pages/dashboard/DashboardPrimitives'
import { Caption } from '@/components/ui/typography'
import DashboardListRow from '../DashboardListRow'
import WidgetListBlock, { type WidgetRow } from '../WidgetListBlock'
import type { FeedTileLists } from '../feedTileKit'

type Nav = (page: string, params?: Record<string, unknown>) => void

// The KD11 widget feeds (expiring matches, stale vacancies, Koios suggestions)
// on the shared WidgetListBlock — a component so the title can be translated.
export function WidgetFeedList({ titleKey, rows }: { titleKey: string; rows: WidgetRow[] }) {
  const { t } = useTranslation('dashboard')
  return <WidgetListBlock title={t(titleKey)} rows={rows} />
}

// Recent-candidates dashboard tile; each row deep-links to that candidate when onNavigate is given.
export function RecentCandidatesList({ rows, onNavigate }: { rows: FeedTileLists['recentCandidates']; onNavigate?: Nav }) {
  const { t } = useTranslation('dashboard')
  return (
    <Block title={t('block.recentCandidates')} action={onNavigate ? t('action.allCandidates') : undefined} onAction={onNavigate ? () => onNavigate('candidates') : undefined}>
      {rows.map((c, i) => (
        <DashboardListRow key={i} isLast={i === rows.length - 1}
          onClick={c.id != null && onNavigate ? () => onNavigate('candidates', { open: c.id }) : undefined}
          leading={<Avatar initials={c.initials} size={28} />}
          title={c.name}
          subtitle={c.role}
          trailing={<>
            <StatusBadge label={c.status} color={c.statusColor} />
            <Caption as="span" style={{ flexShrink: 0 }}>{c.time}</Caption>
          </>} />
      ))}
    </Block>
  )
}

// Recent-applications dashboard tile; each row deep-links to that application when onNavigate is given.
export function RecentApplicationsList({ rows, onNavigate }: { rows: FeedTileLists['recentApplications']; onNavigate?: Nav }) {
  const { t } = useTranslation('dashboard')
  return (
    <Block title={t('block.recentApplications')} action={onNavigate ? t('action.allApplications') : undefined} onAction={onNavigate ? () => onNavigate('applications') : undefined}>
      {rows.map((a, i) => (
        <DashboardListRow key={i} isLast={i === rows.length - 1}
          onClick={a.id != null && onNavigate ? () => onNavigate('applications', { open: a.id }) : undefined}
          title={a.candidate}
          subtitle={a.vacancy}
          trailing={<>
            <StatusBadge label={a.status} color={a.statusColor} />
            <Caption as="span" style={{ flexShrink: 0 }}>{a.time}</Caption>
          </>} />
      ))}
    </Block>
  )
}

// Leads-in-pipeline dashboard tile; each row deep-links to that customer when onNavigate is given.
export function LeadsPipelineList({ rows, onNavigate }: { rows: FeedTileLists['recentLeads']; onNavigate?: Nav }) {
  const { t } = useTranslation('dashboard')
  return (
    <Block title={t('block.leadsPipeline')} action={onNavigate ? t('action.allCustomers') : undefined} onAction={onNavigate ? () => onNavigate('customers') : undefined}>
      {rows.map((l, i) => (
        <DashboardListRow key={i} isLast={i === rows.length - 1}
          onClick={l.id != null && onNavigate ? () => onNavigate('customers', { open: l.id }) : undefined}
          title={l.name}
          subtitle={l.contact}
          trailing={<>
            <StatusBadge label={l.status} color={l.statusColor} />
            <Caption as="span" style={{ flexShrink: 0 }}>{l.time}</Caption>
          </>} />
      ))}
    </Block>
  )
}

// Recent workflow-runs dashboard tile; success/failure is shown by icon+tint AND stated in words, never colour alone.
export function RecentRunsList({ rows, onNavigate }: { rows: FeedTileLists['runs']; onNavigate?: Nav }) {
  const { t } = useTranslation('dashboard')
  return (
    <Block title={t('block.recentRuns')} action={onNavigate ? t('action.all') : undefined} onAction={onNavigate ? () => onNavigate('workflows') : undefined}>
      {rows.map((r, i) => (
        <DashboardListRow key={i} isLast={i === rows.length - 1}
          onClick={onNavigate ? () => onNavigate('workflows') : undefined}
          // Outcome icon + tint: success/danger tokens, and the caption states the outcome in words.
          leading={
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: r.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {r.ok ? <CheckCircle size={13} color="var(--color-success)" /> : <AlertCircle size={13} color="var(--color-danger)" />}
            </div>
          }
          title={r.name}
          subtitle={r.ok ? t('run.processed', { count: r.n }) : r.err}
          trailing={<Caption as="span" style={{ flexShrink: 0 }}>{r.time}</Caption>} />
      ))}
    </Block>
  )
}

// Recent-conversations dashboard tile; rows deep-link to the WhatsApp messages tab, never to a specific candidate (no per-row id).
export function RecentConversationsList({ rows, onNavigate }: { rows: FeedTileLists['conversations']; onNavigate?: Nav }) {
  const { t } = useTranslation('dashboard')
  return (
    <Block title={t('block.recentConversations')} action={onNavigate ? t('action.all') : undefined} onAction={onNavigate ? () => onNavigate('whatsapp', { tab: 'messages' }) : undefined}>
      {rows.map((c, i) => (
        <DashboardListRow key={i} isLast={i === rows.length - 1}
          onClick={onNavigate ? () => onNavigate('whatsapp', { tab: 'messages' }) : undefined}
          leading={<Avatar initials={c.name.split(' ').map(n => n[0]).join('')} size={28} />}
          title={c.name}
          subtitle={c.msg}
          trailing={<Caption as="span" style={{ flexShrink: 0 }}>{c.time}</Caption>} />
      ))}
    </Block>
  )
}
