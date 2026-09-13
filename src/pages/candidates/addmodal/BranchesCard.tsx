/**
 * BranchesCard — the "Vestigingen" card (Danny r2): chips with ×, add via the
 * searchable SearchSelect. Pure presentational: the selected id list + its
 * setter live in the container.
 *
 * Trigger mirrors the drill-down's BranchSection (Danny addendum, kandidaten-
 * ronde-2): the reference-style DrawerAddButton, right-aligned, OUTSIDE the card
 * next to the "Vestigingen" heading — not the old dashed ghost button inside it.
 * Behaviour (SearchSelect + chips-with-×) is unchanged, only the trigger moved.
 *
 * No longer full-width (Danny 05-08): sits RIGHT of ProfileTextCard on the same
 * row — the parent grid auto-places this card into the column ProfileTextCard
 * doesn't occupy (§AddCandidateModal, shared `modalColumns` convention).
 */
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import type { Id } from '@/types/common'
import { cardBox } from './fields'
import RemovableChip from '@/components/forms/RemovableChip'
import CardHeaderWithAddTrigger from '@/components/forms/CardHeaderWithAddTrigger'

interface BranchesCardProps {
  branchIds: string[]
  setBranchIds: Dispatch<SetStateAction<string[]>>
  locations: Array<{ value: Id; label: string }>
}

// Add-candidate modal card: multi-select branch/location picker for the new candidate.
export default function BranchesCard({ branchIds, setBranchIds, locations }: BranchesCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    // No gridColumn span (Danny 05-08): a plain grid cell so this card sits
    // side by side with ProfileTextCard instead of stacking full-width below it.
    <div>
      {/* Header row: card title left, "+ Vestiging" trigger right (drill-down parity). */}
      <CardHeaderWithAddTrigger title={t('modal.fields.branches')}>
        <SearchSelect triggerLabel={t('modal.fields.branchesAdd')}
          options={locations.map(o => ({ value: String(o.value), label: o.label }))}
          selected={branchIds}
          onToggle={(id: string) => setBranchIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          menuAlign="right" renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={t('modal.fields.branchesAdd')} />} />
      </CardHeaderWithAddTrigger>
      <div style={cardBox}>
        {branchIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {branchIds.map(id => (
              <RemovableChip key={id} onRemove={() => setBranchIds(p => p.filter(x => x !== id))}>
                {locations.find(o => String(o.value) === id)?.label ?? id}
              </RemovableChip>
            ))}
          </div>
        )}
        {branchIds.length === 0 && locations.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{t('modal.fields.branchesAutoHint')}</p>
        )}
      </div>
    </div>
  )
}
