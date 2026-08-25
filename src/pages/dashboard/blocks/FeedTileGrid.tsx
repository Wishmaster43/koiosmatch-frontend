/**
 * FeedTileGrid — DASH-FEEDS-V3: ONE packed grid for every work-feed tile
 * (blocks/feedRegistry.ts). A tile that self-hides (no data, or its role's
 * template does not show it) never leaves a hole beside its neighbour — cells
 * simply pack in declaration order, mirroring the DASH-FEEDS-PACK-1 idiom.
 */
import type { DashData } from '@/types/dashboard'
import { FEED_TILES, type FeedTileContext } from './feedRegistry'

export default function FeedTileGrid({ dash, vis, onNavigate, hasPlanning }: {
  dash: DashData | null
  vis: (id: string) => boolean
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
  hasPlanning: boolean
}) {
  // Only tiles whose block id is visible for this role AND whose feed has data.
  const entries = dash == null ? [] : FEED_TILES.filter(e => vis(e.blockId) && e.hasData(dash))
  if (!entries.length) return null

  const ctx: FeedTileContext = { onNavigate, hasPlanning }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      {entries.map(e => (
        <div key={e.blockId} style={e.span === 2 ? { gridColumn: '1 / -1', minWidth: 0 } : { minWidth: 0 }}>
          {e.render(dash as DashData, ctx)}
        </div>
      ))}
    </div>
  )
}
