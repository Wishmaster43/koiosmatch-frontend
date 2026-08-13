/**
 * MatchFilterBar — the matches toolbar filter row (B12). Mirrors the
 * candidate-side "P8-more-filters" recipe (VacancySearchFilters): a PRIMARY row
 * with the 2-3 most-used filters (stage + owner — label lives INSIDE the
 * trigger button, no separate field label beside it), plus a "More filters"
 * popover (the shared DrawerFilterMenu) for the rest (client). A secondary
 * filter that IS active still shows as a removable soft-chip beside the
 * trigger — never hidden-but-active. Purely presentational (§3): every value
 * and setter arrives as a prop, no API calls, no business logic.
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'

export interface FilterOption { value: string; label: string }

interface MatchFilterBarProps {
  stageOptions: FilterOption[]
  stage: string[]
  onStageChange: (next: string[]) => void
  ownerOptions: FilterOption[]
  owner: string[]
  onOwnerChange: (next: string[]) => void
  clientOptions: FilterOption[]
  client: string[]
  onClientChange: (next: string[]) => void
}

// Removable soft-chip (§4 convention) for the ACTIVE secondary (client) filter
// parked in the "More filters" popover — mirrors VacancySearchFilters exactly.
function SecondaryFilterChip({ label, ariaLabel, onRemove }: { label: string; ariaLabel: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 6px 4px 9px',
      fontSize: 11.5, fontWeight: 600, borderRadius: 999,
      color: 'var(--color-primary-text)',
      background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
    }}>
      {label}
      <button type="button" onClick={onRemove} aria-label={ariaLabel}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15,
          background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
        <X size={11} />
      </button>
    </span>
  )
}

export default function MatchFilterBar({
  stageOptions, stage, onStageChange,
  ownerOptions, owner, onOwnerChange,
  clientOptions, client, onClientChange,
}: MatchFilterBarProps) {
  const { t } = useTranslation('matches')

  // Add/remove one value from a multi-select filter list.
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value]

  // Trigger text carries the label (canon: no separate label beside the control).
  const triggerText = (selected: string[], label: string) =>
    selected.length > 0 ? t('common:filters.selectedCount', { count: selected.length }) : t('common:filters.choose', { label: label.toLowerCase() })

  const clientActive = client.length > 0
  const clientChipLabel = clientActive
    ? `${t('filters.client')}: ${t('common:filters.selectedCount', { count: client.length })}`
    : ''

  // The one secondary filter (client), as a DrawerFilterMenu row config.
  const moreFilters: DrawerFilterConfig[] = [{
    type: 'multi', key: 'client', label: t('filters.client'),
    selected: client, options: clientOptions, onToggle: v => onClientChange(toggle(client, v)),
    searchPlaceholder: t('common:filters.choose', { label: t('filters.client').toLowerCase() }),
    noResultsLabel: t('common:filters.selectedCount', { count: 0 }),
  }]

  return (
    // Canon toolbar spacing (§4): minHeight 36, gap 10, center, no background/divider.
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36 }}>
      <SearchSelect
        options={stageOptions} selected={stage} onToggle={v => onStageChange(toggle(stage, v))}
        triggerLabel={triggerText(stage, t('filters.stage'))}
      />
      <SearchSelect
        options={ownerOptions} selected={owner} onToggle={v => onOwnerChange(toggle(owner, v))}
        triggerLabel={triggerText(owner, t('filters.owner'))}
      />
      <DrawerFilterMenu filters={moreFilters} label={t('filters.moreFilters')}
        title={t('filters.moreFiltersTitle')} clearAllLabel={t('common:filters.clearAll')} />
      {clientActive && (
        <SecondaryFilterChip label={clientChipLabel}
          ariaLabel={t('filters.removeFilter', { label: t('filters.client') })}
          onRemove={() => onClientChange([])} />
      )}
    </div>
  )
}
