import type { CSSProperties } from 'react'

/**
 * TimelineRail — the dot + connecting vertical line for one row in a chronological
 * timeline/activity list. Shared across every entity's Tijdlijn render so events
 * never show as disconnected dots (Danny 05-08: "waar is de echte lijn?" — no
 * connector between the bolletjes). `alignSelf: 'stretch'` makes the rail fill its
 * row's full height regardless of the row's own `alignItems` (mirrors the working
 * tasks ActivityTab pattern), so the line always reaches the next item's dot.
 * `isLast` skips the trailing segment so the rail terminates cleanly on the final
 * item instead of dangling below it.
 */
export default function TimelineRail({ isLast = false, color = 'var(--color-primary)', size = 8 }: { isLast?: boolean; color?: string; size?: number }) {
  const dotStyle: CSSProperties = { width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, alignSelf: 'stretch' }}>
      <span style={dotStyle} data-testid="timeline-dot" />
      {/* data-testid: purely a test hook (no visible/user-facing role) so callers
          can assert the connector renders/terminates without scraping inline styles. */}
      {!isLast && <span style={{ flex: 1, width: 1, background: 'var(--border)', marginTop: 2 }} data-testid="timeline-connector" />}
    </div>
  )
}
