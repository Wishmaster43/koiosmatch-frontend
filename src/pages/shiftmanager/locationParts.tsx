/**
 * LocationsPage building blocks — the avatar colour helper, the square avatar
 * and the active/inactive status badge. Dumb presentational pieces shared by the
 * table and the drawer.
 */
import { useTranslation } from 'react-i18next'

// Deterministic avatar colour — shared util (single source), imported + re-exported for the table/drawer.
import { avatarColor as ac } from '@/lib/avatarColor'
export { ac }

// The one soft-chip primitive (§4) — same tint formula as LocationsTable's StatusPill,
// so the drawer's status badge never drifts from the table's.
import SoftChip from '@/components/ui/SoftChip'
import { SmInitialBubble } from './smParts'

// Square initial-avatar (shared body lives in SmInitialBubble — DRY round 11, SHIFTMANAGER).
export function Avatar({ label, size = 32 }: { label?: string; size?: number }) {
  return <SmInitialBubble label={label} size={size} radius={8} />
}

// Status → soft-chip colour (mirrors LocationsTable's STATUS_COLORS exactly).
const STATUS_COLORS: Record<string, string> = {
  actief: 'var(--color-success)', active: 'var(--color-success)', inactief: 'var(--color-warning)',
}

// Active/inactive soft-chip pill; the status value itself is tenant data, only the
// empty fallback label is translated.
export function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('shiftmanager')
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>{t('locationsPage.statusUnknown')}</span>
  return <SoftChip label={status} color={STATUS_COLORS[status.toLowerCase()]} round />
}
