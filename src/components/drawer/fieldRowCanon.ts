/**
 * fieldRowCanon — the ONE label-column width + label style for every drawer's
 * label/value row (§3A). The candidate ProfileTab (profileFieldShared.tsx's
 * FieldRow) is the leading pattern (Danny 05-08: "IS NIET HETZELFDE!!! LOOP
 * ALLE DRILL-DOWNS NA!!") — every other drawer (customers, matches, vacancies,
 * tasks, opportunities) drifted to width:130/140/150/160/180 and lost the
 * label's fontSize/color convention along the way. Import this instead of a
 * fresh literal; a caller with a genuinely longer label documents its
 * exception in a comment rather than picking a new number silently.
 */
import { createElement } from 'react'
import type { CSSProperties } from 'react'

// The one label-column width used by every drawer's field row.
export const CANON_LABEL_WIDTH = 120

// The one label style: 11px muted text, fixed width, never grows/shrinks.
export const CANON_LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  width: CANON_LABEL_WIDTH,
  flexShrink: 0,
}

// The shared em-dash empty-value glyph (never a blank cell, §3 states) — the
// ONE `dash` every field row across the app renders for an unset value.
// K-281 repair (MUST-FIX 2): moved here off MatchFieldRow.tsx so that
// component-only file never needs a react-refresh/only-export-components
// disable again. `createElement` (not JSX) because this module is `.ts`, not
// `.tsx` — renaming it would touch all 20 existing importers for no reason.
export const dash = createElement('span', { style: { color: 'var(--text-muted)' } }, '—')
