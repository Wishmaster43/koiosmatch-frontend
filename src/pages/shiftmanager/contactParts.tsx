/**
 * ContactsPage building blocks — the avatar colour helper and the round
 * initial-avatar for a contact. Dumb presentational pieces shared by the table
 * and the drawer.
 */
// Deterministic avatar colour — shared util (single source), imported + re-exported for the table/drawer.
import { avatarColor as ac } from '@/lib/avatarColor'
export { ac }

// Two-letter initials — shared util (single source), re-exported for the table.
import { initialsOf } from '@/lib/initials'
export { initialsOf }

// Round initial-avatar coloured from the name.
export function ContactAvatar({ name, size = 30 }: { name?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: ac(name), display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.36), fontWeight: 700, color: 'var(--surface)' }}>
      {initialsOf(name)}
    </div>
  )
}
