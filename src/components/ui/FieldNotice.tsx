/**
 * FieldNotice — the one-line message under a form field. Replaces the four
 * hand-rolled `FieldError` copies that had drifted into the add-modals
 * (customers × 3, candidates × 1) and adds the second severity the per-country
 * KvK/BTW check needs (Danny 2026-08-08, points 10 + 11): a WARNING that says
 * "this looks wrong" without refusing the value.
 *
 * Severity 'error' keeps the exact DOM the old FieldError rendered (role=alert,
 * danger token, 11px, 3px top margin) so nothing regresses at the adopted call
 * sites; 'warning' is announced politely (role=status) because it never blocks.
 */
import type { CSSProperties } from 'react'

const TONE: Record<'error' | 'warning', { color: string; role: 'alert' | 'status' }> = {
  error: { color: 'var(--color-danger-text)', role: 'alert' },
  warning: { color: 'var(--color-warning-text)', role: 'status' },
}

// The notice itself: renders nothing without text, and picks its color/ARIA role from the severity tone map.
export default function FieldNotice({ text, severity = 'error', style }: {
  text?: string | null
  severity?: 'error' | 'warning'
  style?: CSSProperties
}) {
  if (!text) return null
  const tone = TONE[severity]
  return <div role={tone.role} style={{ fontSize: 11, color: tone.color, marginTop: 3, ...style }}>{text}</div>
}
