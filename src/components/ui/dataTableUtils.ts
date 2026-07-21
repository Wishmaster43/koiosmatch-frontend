import type { CSSProperties } from 'react'
import type { RowId } from './DataTable'

/**
 * DataTable pure helpers & shared constants (split out 2026-07-21, audit item —
 * DataTable.tsx was approaching the 400-line split threshold). Pure logic + static
 * styles only, no rendering — shared by DataTable.tsx and DataTableRow.tsx.
 */

// Read a column's default field off an unknown-shaped row (dynamic accessor).
export const field = (row: unknown, key: string): unknown => (row as Record<string, unknown>)[key]

// Job 43 — pure range helper (unit-tested directly, no rendering needed): given the
// row-id order on the current page, the last "anchor" id and the row just clicked,
// return every id between them (inclusive, works whether the click landed above or
// below the anchor). Unknown anchor/target ids (stale ref against a re-sorted page)
// fall back to just the target row — never guess a range against a wrong index.
export function shiftRangeIds<T extends RowId>(pageIds: T[], anchorId: T | null, targetId: T): T[] {
  if (anchorId == null || anchorId === targetId) return [targetId]
  const anchorIndex = pageIds.indexOf(anchorId)
  const targetIndex = pageIds.indexOf(targetId)
  if (anchorIndex === -1 || targetIndex === -1) return [targetId]
  const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
  return pageIds.slice(start, end + 1)
}

// Comparator: empty/null sort last; numbers numerically; strings naturally.
export function compare(a: unknown, b: unknown): number {
  const na = a === '' || a == null
  const nb = b === '' || b == null
  if (na && nb) return 0
  if (na) return 1
  if (nb) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// Shared static styles (module scope — no closures, so no reason to recreate per render).
export const checkboxCol: CSSProperties = { width: 36, padding: '8px 10px', textAlign: 'center' }
export const stopPropagation = (e: { stopPropagation: () => void }) => e.stopPropagation()

// Selected/checked row tint (audit item 1, 2026-07-16): a STICKY column (e.g. the
// pinned Name cell) paints its OWN opaque background on top of the <tr>'s background
// so scrolled-under content stays hidden while scrolling horizontally. Painting the
// translucent `var(--color-primary-bg)` token on BOTH layers double-composites it —
// the sticky cell reads as a visibly darker/different-coloured block than the rest
// of the same row (reported as "the name turns a different colour when selected",
// most visible whenever --color-primary-bg is translucent: any tenant with a custom
// brand colour, and dark mode for every tenant). Pre-mixing straight into the opaque
// --bg token keeps this single-layer and fully opaque in both states, so the sticky
// cell and the rest of the row always render the exact same solid tint.
export const HIGHLIGHT_BG = 'color-mix(in srgb, var(--color-primary) 12%, var(--bg))'

// Loading skeleton (audit item 17): a fixed number of placeholder rows so the
// table header/chrome stays put and the body doesn't "jump" from a centred
// spinner to real rows. Bar widths vary per column so the shape reads as text,
// not a solid block; token-based colour only (no ad-hoc grey, works in dark mode).
export const SKELETON_ROWS = 8
export const SKELETON_BAR_WIDTHS = ['85%', '60%', '75%', '50%', '90%', '65%']
export const skeletonBarWidth = (i: number) => SKELETON_BAR_WIDTHS[i % SKELETON_BAR_WIDTHS.length]
