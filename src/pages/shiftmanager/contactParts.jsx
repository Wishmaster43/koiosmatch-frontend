/**
 * ContactsPage building blocks — the avatar colour helper and the round
 * initial-avatar for a contact. Dumb presentational pieces shared by the table
 * and the drawer.
 */
const COLORS = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6']

// Deterministic avatar colour from the first character of the label.
export function ac(s) { return COLORS[(s || '?').charCodeAt(0) % COLORS.length] }

// Two-letter initials from a full name.
export const initialsOf = name => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

// Round initial-avatar coloured from the name.
export function ContactAvatar({ name, size = 30 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: ac(name), display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.36), fontWeight: 700, color: 'var(--surface)' }}>
      {initialsOf(name)}
    </div>
  )
}
