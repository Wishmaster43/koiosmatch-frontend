/**
 * WaWebBranchPicker — the "which branches does this WhatsApp Web number serve" block
 * (WA-WEB-BRANCHES-1, CMBE ae235dea: `location_ids[]`, min 1). The house
 * ChipMultiSelect (CHIP-TINT-1 choice chips + its select-all / clear-all row, which is
 * the multi-select's DROPDOWN-CLEAR-1 clear) over the tenant's branches, plus the
 * honest "at least one" hint while the set is empty — the server 422s an empty set.
 * Presentational: used by the add form AND the per-device editor, never re-styled.
 */
import { useTranslation } from 'react-i18next'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { Caption } from '@/components/ui/typography'
import type { LocationOption } from '@/lib/useLocations'

export default function WaWebBranchPicker({ options, values, onToggle, ariaLabel }: {
  options: LocationOption[]
  values: string[]
  onToggle: (value: string) => void
  ariaLabel: string
}) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ChipMultiSelect ariaLabel={ariaLabel} values={values} onToggle={onToggle}
        options={options.map(l => ({ value: String(l.value), label: l.label }))}
        emptyText={t('whatsappWeb.noLocationsAvailable')} />
      {options.length > 0 && values.length === 0 && (
        <div role="status"><Caption>{t('whatsappWeb.locationsRequired')}</Caption></div>
      )}
    </div>
  )
}
