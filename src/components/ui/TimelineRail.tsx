import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

// One fixed rail width for every row that participates in the axis, so the
// vertical line lands on the SAME x whether the row carries a marker, only the
// connecting line (past a day heading) or just an indent. A bare dot keeps its
// intrinsic width so the pre-existing hosts (NotesTab) render unchanged.
const RAIL_WIDTH = 22

interface TimelineRailProps {
  // Skip the trailing segment so the axis terminates once, at the very bottom.
  isLast?: boolean
  // Semantic token for the marker; the axis line itself stays neutral (§4).
  color?: string
  // Diameter of the bare dot (ignored when an icon is given).
  size?: number
  // Meaning-carrying icon; renders the §4 soft-tint marker instead of a dot.
  icon?: LucideIcon
  // 'marker'    — dot/icon + the segment down to the next row (default)
  // 'connector' — line only: carries the axis past a day heading
  // 'spacer'    — width only, no line: above the very first marker
  variant?: 'marker' | 'connector' | 'spacer'
  // NOTES-TIMELINE-CONVERGE-1: when given, the marker becomes a real <button>
  // (e.g. the candidate/customer "open changelog" affordance that used to sit on
  // NotesTab's own hand-rolled system-event row). Omitted (every other caller) →
  // the marker stays the previous inert, aria-hidden dot — zero behaviour change.
  onClick?: () => void
  // Accessible name for the button variant above; required together with onClick.
  ariaLabel?: string
}

/**
 * TimelineRail — the vertical axis column of one timeline row: a marker (bare dot
 * or a soft-tinted icon) plus the connecting line down to the next row. Shared
 * across every entity's Tijdlijn so events read as one continuous axis instead of
 * disconnected bolletjes (Danny 05-08). `alignSelf: 'stretch'` makes the column
 * fill its row's full height regardless of the row's own `alignItems`, so the line
 * always reaches the next marker; `isLast` drops the trailing segment so nothing
 * dangles below the final event.
 */
export default function TimelineRail({
  isLast = false, color = 'var(--color-primary)', size = 8, icon: Icon, variant = 'marker',
  onClick, ariaLabel,
}: TimelineRailProps) {
  // The axis is structure, not decoration — it stays in the neutral border token
  // while only the marker carries the event's semantic colour (§4).
  // `flex: 1` (not a fixed height) so the segment always grows to the row's real
  // height — the column is stretched, so the line meets the next marker exactly.
  const segment: CSSProperties = { flex: 1, minHeight: 6, width: 1, background: 'var(--border)', flexShrink: 0 }

  // Marker and connector/spacer rows share the fixed width; a legacy bare dot does not.
  const fixedWidth = Boolean(Icon) || variant !== 'marker'
  const column: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    flexShrink: 0, alignSelf: 'stretch', ...(fixedWidth ? { width: RAIL_WIDTH } : null),
  }

  // A day heading sits beside the axis, so the line runs past it uninterrupted;
  // above the FIRST heading it must not, or the axis dangles into empty space.
  if (variant !== 'marker') {
    return (
      <div style={column}>
        {variant === 'connector' && <span style={segment} data-testid="timeline-connector" />}
      </div>
    )
  }

  // Soft-tint marker (§4): background/border are color-mix tints of the token,
  // icon is the token itself — never a solid fill. aria-hidden on purpose: the
  // row's own text already names the event, so announcing it twice is noise.
  const dot: CSSProperties = Icon
    ? {
        width: RAIL_WIDTH, height: RAIL_WIDTH, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        // House tint pair via lib/tint; icon ink via chipInk (raw colour on its
        // own tint read 2.3-3.0:1 against even the 3:1 graphics floor — r3.5).
        background: tintBg(color), border: tintBorder(color), color: chipInk(color),
      }
    : { width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }

  return (
    <div style={column}>
      {/* data-testid: purely a test hook (no visible/user-facing role) so callers
          can assert the axis renders/terminates without scraping inline styles.
          onClick swaps the inert dot for a real button (same visual footprint,
          no layout shift) — the only case where the marker itself is interactive. */}
      {/* The rail's own 22px circular marker made clickable (same footprint as
          the inert dot), not a Button copy — block form: the flagged style
          attribute sits a line into the opening tag. */}
      {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
      {onClick ? (
        <button type="button" onClick={onClick} title={ariaLabel} aria-label={ariaLabel}
          style={{ ...dot, border: dot.border ?? 'none', cursor: 'pointer', padding: 0 }} data-testid="timeline-dot">
          {Icon && <Icon size={12} />}
        </button>
      ) : (
        <span style={dot} data-testid="timeline-dot" aria-hidden="true">
          {Icon && <Icon size={12} />}
        </span>
      )}
      {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
      {!isLast && <span style={{ ...segment, marginTop: 2 }} data-testid="timeline-connector" />}
    </div>
  )
}
