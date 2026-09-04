/**
 * addShiftFieldStyles — the shared native-input style object for AddShiftModal
 * and its two extracted columns (SIZE-SPLIT-B repair pass), split out of the
 * mixed component/constants file so this pure-constant export never trips the
 * react-refresh "only export components" rule.
 */
import type { CSSProperties } from 'react'

// House field footprint (padding '8px 11px', fontSize 13, borderRadius 8, §3A/§4) —
// shared by AddShiftModal and its two extracted columns so the input chrome never drifts.
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- shared style OBJECT applied directly to native <input>/<textarea> elements; a form field's own text colour must sit on the element itself, not on a wrapping BodyText atom
export const INPUT: CSSProperties = { padding: '8px 11px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  outline: 'none', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
