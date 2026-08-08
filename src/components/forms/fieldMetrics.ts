/**
 * fieldMetrics — the ONE canonical style for real form fields (text/select/
 * date/number inputs) across the whole app (§4 consistency; G33, Danny's core
 * complaint: "why do we have 7 different input styles").
 *
 * Before this, every drawer/modal/settings screen hand-rolled its own
 * `inputStyle`/`fieldBox`/`inputBase` constant. A survey of 34 existing
 * declarations (08-08) found padding 6-11px, radius 6-8, font-size 12-14 and
 * an explicit height anywhere from 28 to 38 — no single winner by accident,
 * but three clear ones by count: font-size 13 (23/34), radius 8 (21/34) and,
 * among the ones with an explicit height, 34 (8/13 — more than any other
 * value, including the 38 some newer screens picked). 34 also happens to be
 * `BTN_H` (src/config/buttonMetrics.ts), the app-wide button height — so a
 * field sitting next to a Save/Cancel button in the same row lines up
 * pixel-for-pixel instead of a 4px seam. That combination (majority + already
 * load-bearing elsewhere) is why height stays 34, not the newer 38 some
 * settings screens (apikeys/webhooks Create forms) had drifted to.
 *
 * Horizontal padding: 10px is the overwhelming majority (18/34 declarations);
 * a couple of outliers used 11 or 12 — 10 wins.
 *
 * Change the four numbers below once to re-tune every field on the platform.
 * Purpose-built compact controls (table filter bars, chip pickers, toolbar
 * buttons) are OUT of scope for this module by design — they intentionally
 * stay smaller/denser; only real form fields adopt this.
 */
import type { CSSProperties } from 'react'
import { BTN_H } from '@/config/buttonMetrics'

// The canon numbers.
export const FIELD_HEIGHT = BTN_H // 34 — matches the one app-wide button height
export const FIELD_FONT_SIZE = 13
export const FIELD_RADIUS = 8
export const FIELD_PADDING_X = 10

// Canon single-line control: text/number/date input, native <select>. Explicit
// height + box-sizing:border-box makes the rendered box pixel-exact regardless
// of border/font differences (mirrors the BTN_H button convention).
export const fieldInputStyle: CSSProperties = {
  width: '100%', height: FIELD_HEIGHT, padding: `0 ${FIELD_PADDING_X}px`,
  fontSize: FIELD_FONT_SIZE, borderRadius: FIELD_RADIUS,
  border: '1px solid var(--border)', background: 'var(--input-bg)',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

// <select>-flavoured canon: same box, room for a chevron overlay + pointer cursor.
export const fieldSelectStyle: CSSProperties = {
  ...fieldInputStyle, paddingRight: 28, cursor: 'pointer', appearance: 'none',
}

// Multi-line canon: a <textarea> grows with rows/content, so height doesn't
// apply — keep the same font/radius/border/background and use vertical padding.
export const fieldTextareaStyle: CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: FIELD_FONT_SIZE, borderRadius: FIELD_RADIUS,
  border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box', resize: 'vertical',
}
