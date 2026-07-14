/**
 * DepartmentsPage building blocks — the avatar colour helper, the square
 * initial-avatar and the active/inactive status badge. Dumb presentational
 * pieces shared by the table and the drawer. The status value is tenant data.
 */
// Deterministic avatar colour — shared util (single source), imported + re-exported for the table/drawer.
import { avatarColor as ac } from '@/lib/avatarColor'
export { ac }

// The one soft-chip primitive (§4) — same tint formula as DepartmentsTable's StatusPill,
// so the drawer's status badge never drifts from the table's.
import SoftChip from '@/components/ui/SoftChip'

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

// Status → soft-chip colour (mirrors DepartmentsTable's STATUS_COLORS exactly).
const STATUS_COLORS: Record<string, string> = { actief: 'var(--color-success)', inactief: 'var(--color-warning)' }

// Active/inactive soft-chip pill; the status value itself is tenant data.
export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <SoftChip label={status} color={STATUS_COLORS[status.toLowerCase()]} round />
}
