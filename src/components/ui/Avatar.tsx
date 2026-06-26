/**
 * Avatar — round photo or coloured initials bubble.
 *
 * Shared by the candidates list, drawer header, notes and timeline. An explicit
 * `color` (candidate gender lookup, owner avatar_color) wins; otherwise the colour
 * is derived from the initials so the same person always gets the same colour.
 */
const COLORS = [
  'var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)',
  'var(--color-warning)', 'var(--color-danger)', '#8B5CF6', '#EC4899',
]

interface AvatarProps {
  initials?: string
  size?: number
  photo?: string | null
  color?: string | null
  soft?: boolean
}

export default function Avatar({ initials, size = 28, photo, color, soft = false }: AvatarProps) {
  const bg = color || COLORS[(initials ?? '?').charCodeAt(0) % COLORS.length]

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
