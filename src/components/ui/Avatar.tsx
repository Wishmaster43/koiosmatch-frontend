/**
 * Avatar — round photo or coloured initials bubble.
 *
 * Shared by the candidates list, drawer header, notes and timeline. An explicit
 * `color` (candidate gender lookup, owner avatar_color) wins; otherwise the colour
 * is derived from the initials so the same person always gets the same colour.
 */
// Exported so avatarColor.ts (ShiftManager department/contact/location avatars)
// consumes this SAME palette — one hash, one colour, app-wide (was two drifting
// 6- vs 7-colour arrays).
/* eslint-disable no-restricted-syntax -- DATA: avatar colour-hash palette entries (mixed with token entries), not a themeable UI colour choice */
export const AVATAR_COLORS = [
  'var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)',
  'var(--color-warning)', 'var(--color-danger)', '#8B5CF6', '#EC4899',
]
/* eslint-enable no-restricted-syntax */

// Neutral grey fallback for "no colour assigned" avatars/markers — candidates
// table/drawer/map view each redeclared this hex locally; one shared constant
// so it can't quietly drift (audit R1 item 4).
// eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice (mirrors TitleBadge's identical constant)
export const NEUTRAL_AVATAR = '#9CA3AF'

interface AvatarProps {
  initials?: string
  size?: number
  photo?: string | null
  color?: string | null
  soft?: boolean
}

export default function Avatar({ initials, size = 28, photo, color, soft = false }: AvatarProps) {
  const bg = color || AVATAR_COLORS[(initials ?? '?').charCodeAt(0) % AVATAR_COLORS.length]

  if (photo) {
    return (
      <img src={photo} alt={initials}
        style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', display: 'block' }} />
    )
  }
  // Soft variant — pale tinted bubble with dark, legible initials (calmer than a
  // saturated solid fill); used in detail headers where the avatar is large. The
  // tint must work for hex (+alpha suffix) AND CSS-var colours (via color-mix), so a
  // no-photo avatar ALWAYS shows a coloured placeholder — never a blank/grey bubble.
  const isHex      = typeof bg === 'string' && bg.startsWith('#')
  const softBg     = isHex ? bg + '1A' : `color-mix(in srgb, ${bg} 12%, transparent)`
  const softBorder = isHex ? bg + '55' : `color-mix(in srgb, ${bg} 40%, transparent)`
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: soft ? softBg : bg,
      color: soft ? 'var(--text)' : '#fff',
      border: soft ? `1px solid ${softBorder}` : 'none',
      fontSize: size * 0.36, fontWeight: 700 }}>
      {initials}
    </div>
  )
}
