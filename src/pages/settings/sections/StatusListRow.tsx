// Extracted from StatusListEditor (SIZE-SPLIT-B, zero behaviour change): one
// row's content inside the shared DragList — swatch/icon/badges/actions.
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { Caption, BodyText, monoStyle } from '@/components/ui/typography'
import { ColorSwatch, ColorBadge, DefaultToggle } from '../components/SettingsControls'
import IconPickerControl from './IconPickerControl'
import { FALLBACK_SWATCH } from './statusListEditorTypes'
import type { StatusListItem, ExtraFieldDef, FlagFieldDef, NumberFieldDef, DefaultFieldDef, IconPickerDef } from './statusListEditorTypes'

export default function StatusListRow({
  item, items, showRank, withColor, resolvedIconPicker, rowPrefix, flagList, numberField, extraField, singletons,
  busyDefaultKey, deleting, labelOf, commitRank, updateColor, updateIcon, setDefault, openEdit, remove, inUse,
}: {
  item: StatusListItem; items: StatusListItem[]; showRank: boolean; withColor: boolean
  resolvedIconPicker: IconPickerDef | null; rowPrefix: ((item: StatusListItem) => React.ReactNode) | null
  flagList: FlagFieldDef[]; numberField: NumberFieldDef | null; extraField: ExtraFieldDef | null; singletons: DefaultFieldDef[]
  busyDefaultKey: string | null; deleting: string | number | null
  labelOf: (i: StatusListItem) => string
  commitRank: (item: StatusListItem, raw: string) => void
  updateColor: (item: StatusListItem, color: string) => void
  updateIcon: (item: StatusListItem, icon: string) => void
  setDefault: (field: DefaultFieldDef, item: StatusListItem) => void
  openEdit: (item: StatusListItem) => void
  remove: (item: StatusListItem) => void
  inUse: (item: StatusListItem) => boolean
}) {
  const { t } = useTranslation('settings')
  return (
    <>
      {/* Priority rank = position (top = 1 = sent first). Editable: type a number to move
          it there. key resets the uncommitted value after a reorder; Save persists (like drag). */}
      {showRank && (
        <input type="number" min={1} max={items.length}
          key={`rank-${item.id}-${items.findIndex(x => x.id === item.id)}`}
          defaultValue={items.findIndex(x => x.id === item.id) + 1}
          onMouseDown={e => e.stopPropagation()}
          onBlur={e => commitRank(item, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          aria-label={t('statusList.priorityRank', { defaultValue: 'Prioriteit (1 = eerst verstuurd)' })}
          title={t('statusList.priorityRank', { defaultValue: 'Prioriteit (1 = eerst verstuurd)' })}
          style={{ width: 40, height: 24, textAlign: 'center', padding: 0,
                   fontSize: 11, fontWeight: 700, ...monoStyle,
                   color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)',
                   borderRadius: 6, flexShrink: 0, outline: 'none' }} />
      )}
      {withColor && <ColorSwatch color={item.color ?? FALLBACK_SWATCH} onChange={(c: string) => updateColor(item, c)} />}
      {/* Curated icon picker IN the row, next to the colour (Danny 23-07). withIcon=true
          without an explicit iconPicker prop now ALSO renders the picker, fed by the
          generic curated set — the old free-text lucide-key input is retired (it
          silently accepted wrong keys). */}
      {resolvedIconPicker && (
        <IconPickerControl icons={resolvedIconPicker.icons} resolve={resolvedIconPicker.resolve} value={item.icon}
          color={item.color ?? FALLBACK_SWATCH} label={labelOf(item)} onPick={(icon: string) => updateIcon(item, icon)} />
      )}
      {/* Bespoke row adornment (NATION-FLAG-1: a flag emoji) — before the name,
          same slot a colour swatch would otherwise occupy. */}
      {rowPrefix && rowPrefix(item)}
      {withColor
        ? <ColorBadge label={labelOf(item)} color={item.color ?? FALLBACK_SWATCH} />
        : <BodyText as="span">{labelOf(item)}</BodyText>}
      {/* One badge per active flag (flagFields) — independent booleans, no singleton rule. */}
      {flagList.map(f => item[f.key] && (
        <span key={f.key} style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary-text)',
                       background: 'var(--color-primary-bg)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
          {f.label}
        </span>
      ))}
      {numberField && item[numberField.key] != null && (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
          {item[numberField.key] as React.ReactNode}{numberField.suffix ? ` ${numberField.suffix}` : ''}
        </span>
      )}
      {extraField && !extraField.hideRowBadge && item[extraField.key] && (
        <Caption style={{ background: 'var(--border)', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
          {extraField.options.find(o => o.value === item[extraField.key])?.label ?? (item[extraField.key] as React.ReactNode)}
        </Caption>
      )}
      {/* One independent pill per singleton (defaultFields) — each has its own
          tinted marker + tooltip + undo (SECOND SINGLETON, 04-08). */}
      {singletons.map((field) => {
        const key = field.field ?? field.key ?? ''
        const active = Boolean(item[key])
        const label = field.labelKey ? t(field.labelKey) : undefined
        return (
          <DefaultToggle key={key} active={active} busy={busyDefaultKey === `${key}:${item.id}`}
            onClick={() => setDefault(field, item)}
            activeLabel={label ?? t('common.default')} inactiveLabel={label ?? t('common.setDefault')}
            title={active ? t('statusList.clearDefault') : undefined} />
        )
      })}
      <div style={{ flex: 1 }} />
      <Button variant="secondary" iconOnly onClick={() => openEdit(item)} title={t('statusList.edit')} aria-label={t('statusList.edit')}>
        <Pencil size={11} />
      </Button>
      {/* Delete is disabled when the item is still referenced by existing data.
          Accessible name stays the plain "delete" verb even while disabled —
          title carries the in-use reason as a tooltip, aria-label never goes
          undefined (VAC-CLEAR-style regression: name must survive both states). */}
      <Button variant="dangerSoft" iconOnly onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
        title={inUse(item) ? t('statusList.inUse') : undefined} aria-label={t('common:delete')}>
        {deleting === item.id ? <Spinner size={11} /> : <Trash2 size={11} />}
      </Button>
    </>
  )
}
