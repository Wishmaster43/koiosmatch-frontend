/**
 * DashboardListRow — the clickable dashboard-tile list row shell (optional
 * leading slot, primary title, optional secondary caption line, optional
 * trailing content, bottom border rule) shared by WidgetListBlock,
 * CouplingErrorsList, PlacementsTodayLists, TasksDueTodayList and the five
 * RecentLists tiles; this unit owns only the shell, each host keeps its own
 * row DATA and leading/trailing content. Typography atoms carry the identity;
 * only layout lives in the style prop (HUISSTIJL r6).
 * (DRY round 11, LAYOUT; `leading` slot added DRY round 12 for RecentLists.)
 */
import type { ReactNode } from 'react'
import { interactive } from '@/lib/a11y'
import { BodyText, Caption } from '@/components/ui/typography'

export default function DashboardListRow({ leading, title, subtitle, trailing, onClick, isLast }: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  isLast: boolean
}) {
  return (
    <div {...interactive(onClick)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: onClick ? 'pointer' : 'default',
        borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </BodyText>
        {subtitle && (
          <Caption as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</Caption>
        )}
      </div>
      {trailing}
    </div>
  )
}
