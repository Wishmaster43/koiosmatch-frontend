/**
 * feedTileKit — the FeedTileEntry/FeedTileContext types + helpers, split out of
 * feedRegistry.ts so role tile files (sales/index.tsx, …) can import them
 * WITHOUT a circular import through feedRegistry.ts (which itself imports every
 * role's tile array). feedRegistry.ts re-exports these verbatim.
 *
 * DASH-PAIRS-1 (Danny 25-08: "Belasting per recruiter en Fill rate naast
 * elkaar", "Recente sollicitaties en Recente uitvoeringen naast elkaar",
 * "Pipelinewaarde en Leads in pipeline naast elkaar"): a PAIR is an entry with
 * `children` — the grid renders its visible children side by side in one
 * full-width cell, so two blocks that belong together never drift apart when a
 * neighbour self-hides. The recent lists and the KD11 widgets live in the same
 * registry (blocks/lists), so a pair can mix a feed tile with a list.
 */
import type { ReactNode } from 'react'
import type { DashData } from '@/types/dashboard'
import type { DashboardViewModel } from '../hooks/useDashboardViewModel'

// The viewmodel-mapped rows the recent-list tiles render (labels/colours already
// resolved through the tenant lookups there) — handed to every tile via ctx.
export interface FeedTileLists {
  recentCandidates: DashboardViewModel['recentCandidates']
  recentApplications: DashboardViewModel['recentApplications']
  recentLeads: DashboardViewModel['recentLeads']
  runs: DashboardViewModel['runs']
  conversations: DashboardViewModel['conversations']
  expiringMatchesRows: DashboardViewModel['expiringMatchesRows']
  staleVacanciesRows: DashboardViewModel['staleVacanciesRows']
  koiosSuggestionsRows: DashboardViewModel['koiosSuggestionsRows']
}

// Context passed to every tile's render function and hasData predicate.
export interface FeedTileContext {
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
  hasPlanning: boolean
  lists?: FeedTileLists
}

// One tile: which feed key it reads, whether it has data, and how it renders.
// A PAIR entry carries `children` instead: the grid decides per child.
export interface FeedTileEntry {
  blockId: string
  feedKey: keyof DashData & string
  span?: 1 | 2
  hasData: (dash: DashData, ctx?: FeedTileContext) => boolean
  render: (dash: DashData, ctx: FeedTileContext) => ReactNode
  children?: FeedTileEntry[]
}

// Shared self-hide predicate: true when the feed key holds a non-empty array.
export const arrayFeed = (key: keyof DashData & string) => (dash: DashData): boolean =>
  Array.isArray(dash[key]) && (dash[key] as unknown[]).length > 0

// A pair/group of tiles rendered together: visible when any child is. The
// blockId is only a React key (visibility is decided per child, never on the
// group), feedKey mirrors the first child for the registry tests.
export const pairTiles = (blockId: string, children: FeedTileEntry[]): FeedTileEntry => ({
  blockId,
  feedKey: children[0].feedKey,
  hasData: (dash, ctx) => children.some(c => c.hasData(dash, ctx)),
  render: () => null,
  children,
})

// Resolve which entries (and which children of a pair) actually render.
export function resolveTiles(entries: FeedTileEntry[], dash: DashData, vis: (id: string) => boolean, ctx: FeedTileContext, exclude?: ReadonlySet<string>) {
  const shown = (e: FeedTileEntry) => !exclude?.has(e.blockId) && vis(e.blockId) && e.hasData(dash, ctx)
  return entries
    .map(e => e.children ? { entry: e, children: e.children.filter(shown) } : { entry: e, children: shown(e) ? [] : null })
    .filter(r => r.children !== null && (!r.entry.children || r.children.length > 0)) as { entry: FeedTileEntry; children: FeedTileEntry[] }[]
}

// The block ids a grid renders — used to keep a tile that a pair already shows
// from rendering a second time in a later grid.
export function renderedTileIds(entries: FeedTileEntry[], dash: DashData, vis: (id: string) => boolean, ctx: FeedTileContext): Set<string> {
  const ids = new Set<string>()
  for (const r of resolveTiles(entries, dash, vis, ctx)) {
    if (r.entry.children) r.children.forEach(c => ids.add(c.blockId))
    else ids.add(r.entry.blockId)
  }
  return ids
}
