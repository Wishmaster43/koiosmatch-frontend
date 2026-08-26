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
import { useTranslation } from 'react-i18next'

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
const STATUS_COLORS: Record<string, string> = { active: 'var(--color-success)', inactive: 'var(--color-warning)' }

// Active/inactive soft-chip pill; the raw slug is stable English (useSmDepartments),
// translated here — an unrecognised value falls back to the raw slug itself.
export function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('shiftmanager')
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const key = status.toLowerCase()
  return <SoftChip label={t(`departmentsPage.status.${key}`, { defaultValue: status })} color={STATUS_COLORS[key]} round />
}
