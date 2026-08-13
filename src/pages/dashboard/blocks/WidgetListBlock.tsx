/**
 * WidgetListBlock — ONE shared, config-driven list tile for the dashboard (§3A:
 * "equal-footprint tegels", reuse not re-invention). Backs the KD11 sales
 * dashboards' four widget feeds (expiring matches, stale leads, stale vacancies,
 * Koios suggestions) and any future feed shaped the same way — a title + rows of
 * {primary, secondary?, meta?, onClick?}. Mirrors TouchpointsFeed/RecentListsRow's
 * row layout so every dashboard list reads as one system.
 *
 * Four UI states: `loading` shows a spinner (only relevant while the parent's
 * own critical feeds are still in flight — pass it through, don't invent a
 * second one), `rows.length === 0` self-hides (an empty widget tile is not an
 * error — same convention as TouchpointsFeed/AttentionCandidates), otherwise renders.
 */
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { interactive } from '@/lib/a11y'
import { Block } from '../DashboardPrimitives'

export interface WidgetRow {
  key: string | number
  primary: string
  secondary?: string
  meta?: string
  onClick?: () => void
}

export default function WidgetListBlock({ title, action, onAction, rows, loading }: {
  title: string
  action?: string
  onAction?: () => void
  rows: WidgetRow[]
  loading?: boolean
}) {
  const { t } = useTranslation('dashboard')
  if (loading) {
    return (
      <Block title={title}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px', color: 'var(--text-muted)' }}>
          <Loader2 size={16} className="animate-spin" />
        </div>
      </Block>
    )
  }
  // Empty = self-hide (not an error/zero-state banner) — matches TouchpointsFeed.
  if (!rows.length) return null

  return (
    <Block title={title} action={action} onAction={onAction}>
      {rows.map((r, i) => (
        <div key={r.key} {...interactive(r.onClick)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: r.onClick ? 'pointer' : 'default',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.primary || t('widget.unknown')}
            </div>
            {r.secondary && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.secondary}</div>
            )}
          </div>
          {r.meta && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{r.meta}</span>}
        </div>
      ))}
    </Block>
  )
}
