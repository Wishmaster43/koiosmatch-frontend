import type { ReactNode } from 'react'

/**
 * MatchExplorerLayout — the shared "search around this entity" split layout for
 * Match-zoeker (fase 1: vacancy → candidates; a later fase mirrors it for
 * candidate → vacancies). Purely presentational: no i18n, no API calls, no
 * business logic — the host tab owns all data and passes rendered slots in.
 * Renders a filters row on top, then a flex-wrap split of a wider map pane and a
 * narrower, independently-scrolling list pane — side by side in the expanded
 * drawer, stacked on narrow screens.
 */
export default function MatchExplorerLayout({ filters, map, list }: { filters: ReactNode; map: ReactNode; list: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>{filters}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {/* Map pane — wider (flex 1.4), the primary spatial view. */}
        <div style={{ flex: '1.4 1 360px', minWidth: 360 }}>{map}</div>
        {/* List pane — narrower, own scroll so a long result list never grows the drawer. */}
        <div style={{ flex: '1 1 300px', minWidth: 300, maxHeight: 520, overflowY: 'auto' }}>{list}</div>
      </div>
    </div>
  )
}
