/**
 * feedRegistry — the ONE registry of work-feed tiles rendered by FeedTileGrid.
 * Each role folder (ops/recruiter/accountmanager/sales/planning) appends its own
 * tiles to its own index.tsx; this file only concatenates them into FEED_TILES.
 * Types/arrayFeed live in feedTileKit.ts (re-exported here) so role tile files
 * can import them without a circular dependency back through this file.
 */
import type { FeedTileEntry } from './feedTileKit'

// Re-export BEFORE the role imports: a role index imports arrayFeed from this
// file, and if this export sits after the role imports, ESM's circular-import
// evaluation order finds it uninitialized (TDZ ReferenceError at module init).
export type { FeedTileContext, FeedTileEntry } from './feedTileKit'
export { arrayFeed } from './feedTileKit'

import { OPS_TILES } from './ops'
import { RECRUITER_TILES } from './recruiter'
import { ACCOUNTMANAGER_TILES } from './accountmanager'
import { SALES_TILES } from './sales'
import { PLANNING_TILES } from './planning'

// One flat list of every role's tiles, in role order.
export const FEED_TILES: FeedTileEntry[] = [
  ...OPS_TILES, ...RECRUITER_TILES, ...ACCOUNTMANAGER_TILES, ...SALES_TILES, ...PLANNING_TILES,
]
