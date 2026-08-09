import type { CSSProperties } from 'react'

/**
 * Shared column geometry for the candidate drawer's Sollicitaties list — the ONE
 * source both WorkTab's header bar and ApplicationRow's own row read, so a
 * column width can never drift between the two again (Danny 09-08: "de koppen
 * staan niet boven hun eigen kolom" — the header declared its own fixed widths
 * while the row built its cells completely differently, with a whole trailing
 * actions cluster the header had no column for at all). Each constant below is
 * spread verbatim at BOTH call sites — change a number here and the header
 * label and the cell it labels move together in the same edit.
 */

// Stage pill column — width picked to fit the seed funnel-stage labels
// (Aangevraagd/Uitgenodigd/Voorgesteld/Aangenomen/Afgewezen) at the pill's own
// 11px font without wrapping. A tenant-renamed stage that runs longer than this
// simply overflows the column visually rather than being clipped — the same
// trade-off the header's own fixed width already accepted.
// 90 was too tight for the seed labels themselves — "Gesolliciteerd" is 14
// characters plus the pill's own padding, so the pill spilled past its column
// (Danny 09-08, second look). Measured against the longest seed stage.
export const APPLICATION_COL_STATUS: CSSProperties = { width: 108, flexShrink: 0 }

// The vacancy title cell — shared so the header's own first cell matches it.
// minWidth 140 (not 0) keeps the row's IDENTITY readable when the drawer narrows;
// without a floor the title was squeezed to a single letter while the fixed
// columns kept every pixel (Danny 09-08, "vacature naam niet te lezen").
export const APPLICATION_COL_TITLE: CSSProperties = { flex: 1, minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// Applied-on date column (DD-MM-YYYY), right-aligned toward the actions cluster.
// nowrap + a width that actually fits the format: at 64 the date broke over two
// lines ("08-08-" / "2026"), which is the one thing a fixed-format column should
// never do. The format has a known maximum length, so the column is sized to it.
export const APPLICATION_COL_DATE: CSSProperties = { width: 78, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }

// Trailing actions cluster: pencil (22px) + unlink (22px) + external-link link
// (24px) + disclosure chevron (22px), three 8px gaps between up to four icons —
// 22 + 22 + 24 + 22 + 3*8 = 114. Reserved at this FIXED width regardless of how
// many of the four actually render for a given viewer/row (permissions and a
// missing vacancy URL both drop icons) — right-aligned within it — so the
// column's right edge, and the empty header cell above it, never shifts based
// on data or role.
export const APPLICATION_COL_ACTIONS: CSSProperties = { width: 114, flexShrink: 0 }
