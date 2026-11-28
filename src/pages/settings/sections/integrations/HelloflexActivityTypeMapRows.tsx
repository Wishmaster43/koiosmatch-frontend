/**
 * HelloflexActivityTypeMapRows (HF-ACTIVITY-ROWS-CARD-FE-1) - the row editor of the HelloFlex activity type map: one row per
 * HelloFlex activity type id (digits) with the Koios note type it files as (a single-pick SearchSelect over the bureau's note
 * types, with the shared clear button), a remove button per row and the one add button (DrawerAddButton, §3A: an add action
 * is a button). Pure rendering: the rows and every change go through the card's hook.
 */
import { Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { Caption } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import type { LookupOption } from '@/types/common'
import type { TypeMapRow } from './useHelloflexActivitySettings'

const K = 'integrations.helloflexActivity'
// One grid for the header and every row: type id, note type picker, remove button.
const ROW_GRID = { display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, alignItems: 'center' } as const

interface Props {
  rows: TypeMapRow[]
  // The pickable Koios note types and the label resolver of a stored slug.
  noteTypes: LookupOption[]
  labelOf: (value?: string | null) => string
  onChange: (id: number, patch: Partial<Omit<TypeMapRow, 'id'>>) => void
  onRemove: (id: number) => void
  onAdd: () => void
  // The id of the block's notice while one shows: every row's input points at it (A11Y-CLICKABLE-1).
  describedBy?: string
  t: (key: string, options?: Record<string, unknown>) => string
}

// The header line, the rows and the add button; an empty map says so instead of rendering nothing.
export default function HelloflexActivityTypeMapRows({ rows, noteTypes, labelOf, onChange, onRemove, onAdd, describedBy, t }: Props) {
  const options = noteTypes.map(nt => ({ value: nt.value, label: nt.label }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.length === 0 ? (
        <Caption as="p">{t(`${K}.typeMapEmpty`)}</Caption>
      ) : (
        <div style={ROW_GRID} aria-hidden="true">
          <Caption>{t(`${K}.hfTypeId`)}</Caption>
          <Caption>{t(`${K}.noteType`)}</Caption>
          <span />
        </div>
      )}
      {rows.map((row, index) => {
        // Accessible names carry the row number (and the picker its value), so rows never share one name.
        const n = index + 1
        const noteTypeText = row.noteType ? labelOf(row.noteType) : t(`${K}.noteTypePlaceholder`)
        return (
          <div key={row.id} style={ROW_GRID}>
            <div>
              <label htmlFor={`hf-activity-type-id-${row.id}`} className="sr-only">{t('integrations.helloflexActivity.hfTypeIdRow', { n })}</label>
              <input id={`hf-activity-type-id-${row.id}`} value={row.typeId} onChange={e => onChange(row.id, { typeId: e.target.value })}
                inputMode="numeric" pattern="[0-9]*" maxLength={12} style={fieldInputStyle}
                aria-invalid={describedBy ? true : undefined} aria-describedby={describedBy} />
            </div>
            {/* Single-pick field role: closeOnToggle, no select-all, the shared clear X (DROPDOWN-CLEAR-1) resets the row's note type. */}
            <SearchSelect id={`hf-activity-note-type-${row.id}`} triggerAriaLabel={`${t('integrations.helloflexActivity.noteTypeRow', { n })}: ${noteTypeText}`}
              triggerLabel={noteTypeText}
              options={options} selected={row.noteType ? [row.noteType] : []} selectAll={false} closeOnToggle
              onToggle={v => onChange(row.id, { noteType: v === row.noteType ? '' : v })}
              onClear={() => onChange(row.id, { noteType: '' })} />
            <Button variant="dangerSoft" iconOnly aria-label={t('integrations.helloflexActivity.removeRowN', { n })} title={t('integrations.helloflexActivity.removeRowN', { n })} onClick={() => onRemove(row.id)}>
              <Trash2 size={11} />
            </Button>
          </div>
        )
      })}
      <div>
        <DrawerAddButton label={t(`${K}.addRow`)} onClick={onAdd} />
      </div>
    </div>
  )
}
