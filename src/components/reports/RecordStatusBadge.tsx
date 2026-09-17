/**
 * RecordStatusBadge — the coloured Shiftmanager record-status pill (actief / nietactief /
 * extern / intake / verwijderd) used by the report drill-down drawers. KPIDRILL-CHROME-1 put
 * the tint on the shared StatusPill; CLONE-BY-CONSTRUCTION-1 puts the status→colour map here
 * once instead of a copy per drawer.
 */
import { useTranslation } from 'react-i18next'
import StatusPill from '@/components/ui/StatusPill'
import { SM_STATUS, normalizeSmStatus } from '@/lib/smStatus'

// One semantic colour per normalised status; unknown statuses render the neutral pill.
const STATUS_COLORS: Record<string, string> = {
  [SM_STATUS.ACTIVE]: 'var(--color-success)',
  [SM_STATUS.INACTIVE]: 'var(--color-warning)',
  [SM_STATUS.EXTERNAL]: 'var(--color-secondary)',
  [SM_STATUS.INTAKE]: 'var(--color-violet)',
  [SM_STATUS.DELETED]: 'var(--color-danger)',
}

// Translated label from the normalised key, the raw status as fallback, "unknown" without one.
export default function RecordStatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  const key = normalizeSmStatus(status)
  const label = status ? t(`candidates.status.${key}`, { defaultValue: status }) : t('candidates.unknown')
  return <StatusPill label={label} color={STATUS_COLORS[key]} />
}
