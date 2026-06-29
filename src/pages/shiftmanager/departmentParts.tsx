/**
 * DepartmentsPage building blocks — the avatar colour helper, the square
 * initial-avatar and the active/inactive status badge. Dumb presentational
 * pieces shared by the table and the drawer. The status value is tenant data.
 */
// Deterministic avatar colour — shared util (single source), imported + re-exported for the table/drawer.
import { avatarColor as ac } from '@/lib/avatarColor'
export { ac }

// Square initial-avatar.
export function Avatar({ label, size = 30, radius = 8 }: { label?: string; size?: number; radius?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: ac(label), display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--surface)', fontSize: size * 0.34, fontWeight: 700 }}>
      {(label || '?').charAt(0).toUpperCase()}
    </div>
  )
}

// Active/inactive pill; the status value itself is tenant data.
export function StatusBadge({ status }: { status?: string }) {
  const active = status?.toLowerCase() === 'actief'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999,
      background: active ? 'var(--color-success-bg)' : 'var(--border)',
      color:      active ? 'var(--color-success)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}
