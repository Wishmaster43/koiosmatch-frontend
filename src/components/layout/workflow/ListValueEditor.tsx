/**
 * ListValueEditor — the removable-chip + type-to-add editor for a list-shaped
 * filter value (the `in`/`not_in` condition operators). Extracted from
 * FilterValueControl (ADDENDUM 3, FILTER-MAPPING-1) so that file stays under
 * the ~250-line target once the mapping/lookup affordances land on top of it.
 * Byte-identical default behaviour: `renderAdd`/`describeItem`/`children` are
 * all opt-in, so a caller that passes none of them gets exactly the old inline
 * chip editor.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { Caption } from '@/components/ui/typography'

export interface ListValueEditorProps {
  items: string[]
  onCommit: (next: string[]) => void
  ariaLabel: string
  // Replaces the default free-text "type to add" input — used when the field
  // has a known vocabulary (a searchable lookup select) instead of free typing.
  // Still receives the editor's own `addItem` so a caller that renders its own
  // picker UI reuses the same add/dedupe logic.
  renderAdd?: (addItem: (value: string) => void) => ReactNode
  // Renders an item's chip text — used to show a mapping token as "N. module ·
  // field" instead of the raw `{{N.field}}`. Returning null keeps the raw item.
  describeItem?: (item: string) => string | null
  // Extra controls rendered after the add input (the mapping "{ }" button).
  children?: ReactNode
}

// Removable chips + a type-to-add (or supplied) input for a list-shaped value.
// The engine reads a comma string and an array alike (FilterEvaluator::toList);
// the caller's `onCommit` decides which FORM it writes back (GET-shape == PUT-shape).
export default function ListValueEditor({ items, onCommit, ariaLabel, renderAdd, describeItem, children }: ListValueEditorProps) {
  const { t } = useTranslation('workflows')

  const addItem = (raw: string) => {
    const v = raw.trim()
    if (v && !items.includes(v)) onCommit([...items, v])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {items.map((item, i) => {
          const mapped = describeItem?.(item) ?? null
          return (
            // CHIP-TINT-1 via the shared SoftChip atom — never a hand-rolled tint span.
            <SoftChip key={item + i} round color="var(--color-primary)" title={mapped ? t('canvas.mappedValue') : undefined} label={
              <>
                {mapped ?? item}
                <Button variant="ghost" size="sm" iconOnly aria-label={t('canvas.removeValue')}
                  onClick={() => onCommit(items.filter((_, j) => j !== i))}>
                  <X size={10} />
                </Button>
              </>
            } />
          )
        })}
        {/* The add control and the mapping button share one non-wrapping cell, so
            the "{ }" never drops to its own line under the chips (screen check 02-10). */}
        <div style={{ display: 'flex', flex: 1, minWidth: 140, gap: 4, alignItems: 'center' }}>
        {renderAdd ? renderAdd(addItem) : (
          <input aria-label={ariaLabel} placeholder={t('fields.valuePlaceholder')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addItem((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
            onBlur={e => { addItem(e.target.value); e.target.value = '' }}
            style={{ flex: 1, minWidth: 80, padding: '4px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
        )}
        {children}
        </div>
      </div>
      <Caption>{t('canvas.listValuesHint')}</Caption>
    </div>
  )
}
