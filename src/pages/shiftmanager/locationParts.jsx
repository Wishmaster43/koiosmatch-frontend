/**
 * LocationsPage building blocks — the avatar colour helper, the square avatar
 * and the active/inactive status badge. Dumb presentational pieces shared by the
 * table and the drawer.
 */
import { useTranslation } from 'react-i18next'

const AVATAR_COLORS = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6']

// Deterministic avatar colour from the first character of the label.
export function ac(s) { return AVATAR_COLORS[(s || '?').charCodeAt(0) % AVATAR_COLORS.length] }

// Square initial-avatar.
export function Avatar({ label, size = 32 }) {
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
export function StatusBadge({ status }) {
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
