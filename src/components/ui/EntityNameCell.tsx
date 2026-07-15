/**
 * EntityNameCell — shared "avatar + name" table cell (§3A blueprint). One soft,
 * round initials/photo bubble next to a single-line ellipsis label — the same
 * treatment the candidates table gives its own identity column and the
 * customers table gives a company. Reused for SECONDARY reference columns too
 * (a Klant/customer name on opportunities/matches/applications, a linked-entity
 * chip on tasks) so every entity list reads the same instead of four hand-rolled
 * copies (AVATAR-CHIP-1, Danny 2026-07-15).
 */
import type { CSSProperties } from 'react'
import Avatar from './Avatar'
import { initialsOf } from '@/lib/initials'

// The app-wide "missing value" marker (mapOpportunity/mapTask/…) — never render
// an avatar bubble for it, just the muted dash like every other empty cell.
const EMPTY_VALUES = new Set([undefined, null, '', '—'])

interface EntityNameCellProps {
  name?: string | null
  initials?: string          // pre-computed initials; derived from `name` when omitted
  photo?: string | null
  color?: string | null      // explicit avatar colour; omitted = Avatar's own hash palette
  size?: number
  maxWidth?: number
  textStyle?: CSSProperties  // override the label span's style (colour/weight)
  extra?: number             // "+N" suffix when the row links to more than one entity
}

export default function EntityNameCell({ name, initials, photo, color, size = 20, maxWidth = 170, textStyle, extra }: EntityNameCellProps) {
  // Graceful empty state — mirrors the dash convention used across every table.
  if (EMPTY_VALUES.has(name)) return <span style={{ color: 'var(--text-muted)' }}>—</span>

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Avatar initials={initials ?? initialsOf(name)} size={size} photo={photo ?? undefined} color={color ?? undefined} soft />
      <span title={name ?? undefined}
        style={{ color: 'var(--text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', display: 'block', maxWidth, ...textStyle }}>
        {name}
      </span>
      {!!extra && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>+{extra}</span>}
    </span>
  )
}
