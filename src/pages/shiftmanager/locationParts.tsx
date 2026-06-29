/**
 * LocationsPage building blocks — the avatar colour helper, the square avatar
 * and the active/inactive status badge. Dumb presentational pieces shared by the
 * table and the drawer.
 */
import { useTranslation } from 'react-i18next'

// Deterministic avatar colour — shared util (single source), imported + re-exported for the table/drawer.
import { avatarColor as ac } from '@/lib/avatarColor'
export { ac }

// Square initial-avatar.
export function Avatar({ label, size = 32 }: { label?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: ac(label), display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--surface)', fontSize: size * 0.34, fontWeight: 700 }}>
      {(label || '?').charAt(0).toUpperCase()}
    </div>
  )
}

// Active/inactive pill; the status value itself is tenant data, only the empty
// fallback label is translated.
export function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('shiftmanager')
  const active = status?.toLowerCase() === 'actief' || status?.toLowerCase() === 'active'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999,
      background: active ? 'var(--color-success-bg)' : 'var(--border)',
      color:      active ? 'var(--color-success)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {status || t('locationsPage.statusUnknown')}
    </span>
  )
}
