/**
 * WidgetListBlock — ONE shared, config-driven list tile for the dashboard (§3A:
 * "equal-footprint tegels", reuse not re-invention). Backs the KD11 sales
 * dashboards' four widget feeds (expiring matches, stale leads, stale vacancies,
 * Koios suggestions) and any future feed shaped the same way — a title + rows of
 * {primary, secondary?, meta?, onClick?}. Mirrors RecentListsRow's
 * row layout so every dashboard list reads as one system.
 *
 * Four UI states: `loading` shows a spinner (only relevant while the parent's
 * own critical feeds are still in flight — pass it through, don't invent a
 * second one), `rows.length === 0` self-hides (an empty widget tile is not an
 * error — the dashboard-wide feed convention), otherwise renders.
 */
import { useTranslation } from 'react-i18next'
import Spinner from '@/components/ui/Spinner'
import { interactive } from '@/lib/a11y'
import { Block } from '../DashboardPrimitives'
import { BodyText, Caption } from '@/components/ui/typography'

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
          <Spinner size={16} />
        </div>
      </Block>
    )
  }
  // Empty = self-hide (not an error/zero-state banner) — the dashboard feed convention.
  if (!rows.length) return null

  return (
    <Block title={title} action={action} onAction={onAction}>
      {rows.map((r, i) => (
        <div key={r.key} {...interactive(r.onClick)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: r.onClick ? 'pointer' : 'default',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Typography atoms carry the identity; only layout lives in the style prop (HUISSTIJL r6). */}
            <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.primary || t('widget.unknown')}
            </BodyText>
            {r.secondary && (
              <Caption as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.secondary}</Caption>
            )}
          </div>
          {r.meta && <Caption style={{ flexShrink: 0 }}>{r.meta}</Caption>}
        </div>
      ))}
    </Block>
  )
}
