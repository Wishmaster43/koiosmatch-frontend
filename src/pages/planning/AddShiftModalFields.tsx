/**
 * AddShiftModalFields — small presentational helpers for AddShiftModal (the
 * labelled Field wrapper, the deterministic-colour Avatar, and the candidate
 * search result row). Extracted from AddShiftModal.tsx (CLAUDE.md §3: a
 * component approaching ~400 lines splits its helpers out) — behaviour is
 * verbatim, this file only moves code, it doesn't change it.
 */
import { useId, cloneElement, isValidElement } from 'react'
import type { ReactNode, ReactElement } from 'react'
import SharedAvatar from '@/components/ui/Avatar'
import { interactive } from '@/lib/a11y'
import type { ShiftCandidateOption } from './hooks/useShiftLookups'

const LABEL = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 } as const

// Associates a label with its single input via a generated id (§6). No self
// margin (mirrors @/components/forms/fields' shared Field) — spacing between
// stacked fields comes from the parent cardBox's own gap:12.
export function Field({ label, children }: { label?: ReactNode; children: ReactNode }) {
  const id = useId()
  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children
  return <div><label htmlFor={id} style={LABEL}>{label}</label>{child}</div>
}

// One fixed palette, picked deterministically from a name's initials — no
// per-candidate "colour" field exists (or should — see ./hooks/useShiftLookups'
// header for why favourite/ranking data isn't faked), this replaces that need
// for both the avatar and the scheduled-candidate accent border.
// eslint-disable-next-line no-restricted-syntax -- DATA: avatar colour-cycling palette, not UI element styling
const AVATAR_COLORS = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', '#8B5CF6', '#EC4899']
// Deterministic colour for an avatar/accent border from a name's initials, since no per-candidate colour field exists.
export function colorFor(initials: string) {
  return AVATAR_COLORS[initials.charCodeAt(0) % AVATAR_COLORS.length]
}

// "Jan de Boer" → "JD" (max 2 letters); falls back to "?" for an empty name.
export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const chars = [parts[0]?.[0], parts[1]?.[0]].filter(Boolean).join('')
  return (chars || '?').toUpperCase()
}

// Delegates to the ONE shared Avatar (HUISSTIJL-1) — the local copy hardcoded
// white initials, which the shared component already solves for accent fills.
export function Avatar({ initials, size = 26 }: { initials: string; size?: number }) {
  return <SharedAvatar initials={initials} size={size} color={colorFor(initials)} />
}

// One candidate row in the right-hand search results list.
export function CandidateRow({ candidate, selected, onClick }: { candidate: ShiftCandidateOption; selected?: boolean; onClick?: () => void }) {
  const initials = getInitials(candidate.name)
  return (
    <div {...interactive(onClick)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8,
        background: selected ? 'var(--color-primary-bg)' : 'transparent',
        border: selected ? `1px solid var(--color-primary)` : '1px solid transparent',
        cursor: 'pointer', marginBottom: 4, transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}>
      <Avatar initials={initials} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {candidate.name}
        </div>
        {candidate.functionTitle && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {candidate.functionTitle}
          </div>
        )}
      </div>
      {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
    </div>
  )
}
