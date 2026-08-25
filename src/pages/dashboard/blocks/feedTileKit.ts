/**
 * feedTileKit — the FeedTileEntry/FeedTileContext types + arrayFeed helper,
 * split out of feedRegistry.ts so role tile files (sales/index.tsx, …) can
 * import them WITHOUT a circular import through feedRegistry.ts (which itself
 * imports every role's tile array). feedRegistry.ts re-exports these verbatim.
 */
import type { ReactNode } from 'react'
import type { DashData } from '@/types/dashboard'

// Context passed to every tile's render function.
export interface FeedTileContext {
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
  hasPlanning: boolean
}

// One tile: which feed key it reads, whether it has data, and how it renders.
export interface FeedTileEntry {
  blockId: string
  feedKey: keyof DashData & string
  span?: 1 | 2
  hasData: (dash: DashData) => boolean
  render: (dash: DashData, ctx: FeedTileContext) => ReactNode
}

// Shared self-hide predicate: true when the feed key holds a non-empty array.
export const arrayFeed = (key: keyof DashData & string) => (dash: DashData): boolean =>
  Array.isArray(dash[key]) && (dash[key] as unknown[]).length > 0
