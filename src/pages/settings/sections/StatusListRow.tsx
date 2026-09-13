// Extracted from StatusListEditor (SIZE-SPLIT-B, zero behaviour change): one
// row's content inside the shared DragList — swatch/icon/badges/actions.
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { Caption, BodyText, monoStyle } from '@/components/ui/typography'
import { DefaultToggle } from '../components/SettingsControls'
import LookupValueMark from './LookupValueMark'
import { FALLBACK_SWATCH } from './statusListEditorTypes'
import type { StatusListItem, ExtraFieldDef, FlagFieldDef, NumberFieldDef, DefaultFieldDef, IconPickerDef } from './statusListEditorTypes'

export default function StatusListRow({
  item, items, showRank, withColor, resolvedIconPicker, rowPrefix, flagList, numberField, extraField, singletons,
  busyDefaultKey, deleting, labelOf, commitRank, updateColor, updateIcon, setDefault, openEdit, remove, inUse, readOnly = false,
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
  // A read-only list (system values a screen depends on) keeps colour/icon and
  // drag-reorder, but the pencil/delete render disabled — never hidden (Danny 13-09).
  readOnly?: boolean
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
      {/* rowPrefix is evaluated PER ITEM (LOOKUP-ICONS-FE-2, 13-09) — a row whose
          prefix returns nothing (e.g. a language without a country_code) still
          gets the value mark; only a row that actually renders its own adornment
          (a flag) suppresses it, so the "one glyph per row" rule holds per row,
          not per family. */}
      {(() => {
        const prefixNode = rowPrefix ? rowPrefix(item) : null
        return (
          <>
            {/* LOOKUP-ONE-ELEMENT-1 (Danny 10-09 23:20): one coloured mark per value — an
                icon in its own colour, or the colour fill itself — never a swatch dot next
                to a separate icon box, and never a coloured label chip alongside it. A row
                with its own adornment (the nationality flag) carries no mark at all — one
                glyph per row (Danny 09-09: "Een vlag en een icon overkill"). */}
            {(withColor || resolvedIconPicker) && !prefixNode && (
              <LookupValueMark
                color={item.color ?? FALLBACK_SWATCH} icon={item.icon} withColor={withColor}
                icons={resolvedIconPicker?.icons ?? null} resolve={resolvedIconPicker?.resolve}
                label={labelOf(item)}
                onPickColor={(c: string) => updateColor(item, c)} onPickIcon={(icon: string) => updateIcon(item, icon)}
              />
            )}
            {/* Bespoke row adornment (NATION-FLAG-1: a flag emoji) — before the name,
                same slot the value mark would otherwise occupy. */}
            {prefixNode}
          </>
        )
      })()}
      <BodyText as="span">{labelOf(item)}</BodyText>
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
      {/* readOnly (Danny 13-09, rows 45/46): pencil renders DISABLED, never hidden —
          title/aria-description carry the reason; aria-label stays the plain verb. */}
      <Button variant="secondary" iconOnly disabled={readOnly} onClick={() => openEdit(item)}
        title={readOnly ? t('statusList.systemValueLocked') : t('statusList.edit')} aria-label={t('statusList.edit')}
        aria-description={readOnly ? t('statusList.systemValueLocked') : undefined}>
        <Pencil size={11} />
      </Button>
      {/* Delete is disabled when the item is still referenced by existing data, OR
          when the list is readOnly — always PRESENT (never hidden, Danny 13-09).
          Accessible name stays the plain "delete" verb even while disabled —
          title carries the reason as a tooltip, aria-label never goes undefined
          (VAC-CLEAR-style regression: name must survive both states). */}
      <Button variant="dangerSoft" iconOnly onClick={() => remove(item)} disabled={readOnly || deleting === item.id || inUse(item)}
        title={readOnly ? t('statusList.systemValueLocked') : (inUse(item) ? t('statusList.inUse') : undefined)}
        aria-label={t('common:delete')} aria-description={readOnly ? t('statusList.systemValueLocked') : undefined}>
        {deleting === item.id ? <Spinner size={11} /> : <Trash2 size={11} />}
      </Button>
    </>
  )
}
