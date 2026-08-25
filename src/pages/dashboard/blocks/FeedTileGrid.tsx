/**
 * FeedTileGrid — DASH-FEEDS-V3: ONE packed grid for every work-feed tile
 * (blocks/feedRegistry.ts). A tile that self-hides (no data, or its role's
 * template does not show it) never leaves a hole beside its neighbour — cells
 * simply pack in declaration order, mirroring the DASH-FEEDS-PACK-1 idiom.
 * DASH-PAIRS-1: a pair entry (children) renders its visible children side by
 * side inside one full-width cell, so the pair holds whatever else hides.
 */
import type { DashData } from '@/types/dashboard'
import { FEED_TILES, type FeedTileContext, type FeedTileEntry } from './feedRegistry'
import { resolveTiles } from './feedTileKit'

export default function FeedTileGrid({ dash, vis, onNavigate, hasPlanning, entries = FEED_TILES, lists, exclude }: {
  dash: DashData | null
  vis: (id: string) => boolean
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
  hasPlanning: boolean
  // Which registry to render (the work feeds by default; the recent lists below).
  entries?: FeedTileEntry[]
  lists?: FeedTileContext['lists']
  // Block ids already rendered by an earlier grid (a pair pulled them in).
  exclude?: ReadonlySet<string>
}) {
  const ctx: FeedTileContext = { onNavigate, hasPlanning, lists }
  // While the critical feeds load `dash` is null; list tiles still have their
  // rows via ctx, feed tiles simply see no data.
  const data = dash ?? ({} as DashData)
  const rows = resolveTiles(entries, data, vis, ctx, exclude)
  if (!rows.length) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      {rows.map(({ entry, children }) => entry.children ? (
        // A pair: one full-width cell, its visible children side by side (a
        // lone child takes the whole cell — never a hole next to it).
        <div key={entry.blockId} style={{ gridColumn: '1 / -1', minWidth: 0, display: 'grid', gridTemplateColumns: children.length > 1 ? '1fr 1fr' : '1fr', gap: 16 }}>
          {children.map(c => <div key={c.blockId} style={{ minWidth: 0 }}>{c.render(data, ctx)}</div>)}
        </div>
      ) : (
        <div key={entry.blockId} style={entry.span === 2 ? { gridColumn: '1 / -1', minWidth: 0 } : { minWidth: 0 }}>
          {entry.render(data, ctx)}
        </div>
      ))}
    </div>
  )
}
