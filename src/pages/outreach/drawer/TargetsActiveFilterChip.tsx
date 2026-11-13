/**
 * TargetsActiveFilterChip — the chip showing the Stats-tab donut filter that is
 * narrowing the call list, moved verbatim out of TargetsTab (SIZE-TRIGGER-1).
 */
import { useTranslation } from 'react-i18next'
import { FilterX } from 'lucide-react'
import type { TargetFilter } from './targetFilter'

// G31 — active Stats-tab filter chip: visible on this tab too, since the
// filter narrows THIS list while the click that set it lives elsewhere.
export default function TargetsActiveFilterChip({ filter, filterLabel, onClearFilter }: {
  filter: NonNullable<TargetFilter>
  filterLabel: string
  onClearFilter?: () => void
}) {
  const { t } = useTranslation('outreach')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', fontSize: 11,
      borderRadius: 7, color: 'var(--color-primary-text)', background: 'var(--color-primary-bg)',
      border: '1px solid var(--color-primary)', width: 'fit-content' }}>
      <span>{t('drawer.stats.filteredBy', { axis: filterLabel, value: filter.value })}</span>
      {/* eslint-disable huisstijlLegacy/no-restricted-syntax -- tiny inline remove-X inside a compact filter chip; Button's fixed iconOnly footprint (28px) would overflow this pill, mirrors DocumentsTab.tsx's compact row-icon buttons */}
      <button onClick={onClearFilter} title={t('insights.clearFilter')} aria-label={t('insights.clearFilter')}
        style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
        <FilterX size={12} />
      </button>
      {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
    </div>
  )
}
