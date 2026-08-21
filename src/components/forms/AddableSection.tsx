/**
 * AddableSection — a titled card that lists items and can add, EDIT and remove them.
 *
 * Collapses the near-identical drawer sections (experience, education, certifications,
 * skills) and matches into one component. Each caller supplies the title, the
 * `fields`, an `onAdd` handler and a `renderItem`. Pass `onEdit(index, values)` and/or
 * `onRemove(index)` to enable the in-place pencil (→ prefilled form, save/cancel as
 * diskette/✕) and the trash button per item.
 *
 * layout="tags" wraps items in a flex-wrap row (chips); "list" stacks them.
 *
 * DRAG-SORT-1: `dragEnabled` + `onReorder` render the list through the shared
 * settings `DragList` (grip + keyboard move-up/down, KEYBOARD-REORDER-1) instead
 * of the plain map — reusing it rather than forking a second drag implementation
 * per the house rule. Both are optional/undefined by default, so every existing
 * caller (matches, vacancy required-skills, …) is byte-for-byte unaffected.
 */
import { useState } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Trash2 } from 'lucide-react'
import SectionCardJs from '../ui/SectionCard'
import AddFormJs from './AddForm'
import { AddButton as AddButtonJs } from './fields'
import { DragList } from '@/pages/settings/shared'

type AnyProps = Record<string, unknown>
// Still-untyped JS helpers — accept any props at the boundary.
const SectionCard = SectionCardJs as unknown as ComponentType<AnyProps>
const AddForm = AddFormJs as unknown as ComponentType<AnyProps>
const AddButton = AddButtonJs as unknown as ComponentType<AnyProps>

type RelItem = { id?: string | number; [k: string]: unknown }

interface AddableSectionProps {
  title: ReactNode
  items?: RelItem[]
  fields: unknown
  onAdd: (v: RelItem) => void
  onEdit?: (i: number, v: RelItem) => void
  onRemove?: (i: number) => void
  emptyText?: ReactNode
  renderItem: (item: RelItem, i: number, arr: RelItem[]) => ReactNode
  layout?: 'list' | 'tags'
  addLabel?: ReactNode
  // Transform the stored item into edit-form initial values (derive checkbox
  // state like noExpiry/current that isn't stored on the item itself).
  editInitial?: (item: RelItem) => RelItem
  // Opt-in override for the "+" trigger (candidates' DrawerAddButton reference
  // style, 2026-07 consistency sweep) — receives the same setAdding(true) the
  // default AddButton uses. Omit to keep the plain-link default for any other
  // future caller (AddableSection is candidates-only today, but this stays
  // additive/non-breaking rather than forking the component).
  renderAddButton?: (onClick: () => void) => ReactNode
  // Optional caller-computed render order: ORIGINAL indices into `items`, one
  // per row, in display order (e.g. from useRelationSort). Rows still render
  // through their REAL index for onEdit/onRemove — sorting is display-only and
  // never changes which row a save/delete request targets. Omit to render
  // `items` as received (today's default, unchanged).
  order?: number[]
  // Optional control shown beside the "+" button — e.g. the shared sort header.
  headerExtra?: ReactNode
  // DRAG-SORT-1: render rows through the shared DragList (grip + keyboard
  // move-up/down) instead of the plain map. Only meaningful together with
  // `onReorder` — omit/false renders exactly as before.
  dragEnabled?: boolean
  // Called with the FULL item list in its new order once a drag or a keyboard
  // move completes. The caller (BackgroundTab) owns the actual persistence
  // (optimistic PUT .../reorder + revert) — this component only reports the
  // gesture, mirroring how onAdd/onEdit/onRemove already work.
  onReorder?: (nextItems: RelItem[]) => void
}

export default function AddableSection({
  title, items = [], fields, onAdd, onEdit, onRemove, emptyText, renderItem, layout = 'list', addLabel, editInitial, renderAddButton, order, headerExtra,
  dragEnabled = false, onReorder,
}: AddableSectionProps) {
  const { t } = useTranslation('common')
  const [adding,     setAdding]     = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  const ctrlBtn: CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none' }
  const isTags = layout === 'tags'

  const controls = (i: number) => (
    <div style={{ display: 'flex', gap: 3, ...(isTags
      ? { marginLeft: 2 }
      : { position: 'absolute', top: 8, right: 0 }) }}>
      {onEdit && (
        <button onClick={() => setEditingIdx(i)} title={t('edit', { defaultValue: 'Bewerken' })}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- pre-existing bespoke 24x24 icon control (ctrlBtn), out of this ink/tint task's scope
          style={{ ...ctrlBtn, background: 'var(--bg)', color: 'var(--text-muted)' }}><Edit2 size={11} /></button>
      )}
      {onRemove && (
        // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on
        // its own pastel, AA fail (Opus r3.5).
        <button onClick={() => onRemove(i)} title={t('remove', { defaultValue: 'Verwijderen' })}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- pre-existing bespoke 24x24 icon control (ctrlBtn), out of this ink/tint task's scope
          style={{ ...ctrlBtn, background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }}><Trash2 size={11} /></button>
      )}
    </div>
  )

  const renderRow = (item: RelItem, i: number, arr: RelItem[]): ReactNode =>
    editingIdx === i ? (
      <AddForm key={`edit-${item.id ?? i}`} fields={fields} initial={editInitial ? editInitial(item) : item}
        onSave={(v: RelItem) => { onEdit?.(i, v); setEditingIdx(null) }} onCancel={() => setEditingIdx(null)} />
    ) : (onEdit || onRemove) ? (
      <div key={item.id ?? i} style={{ position: 'relative', display: isTags ? 'inline-flex' : 'block', alignItems: 'center' }}>
        {renderItem(item, i, arr)}
        {controls(i)}
      </div>
    ) : renderItem(item, i, arr)

  // Display order: caller-supplied (sorted) index list, or received order.
  const displayIdx = order ?? items.map((_, i) => i)

  return (
    <SectionCard
      title={title}
      action={!adding && (
        // marginLeft: auto pushes the row fully right even when `title` is null
        // (SectionCard's row would otherwise sit it at flex-start).
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {headerExtra}
          {renderAddButton ? renderAddButton(() => setAdding(true)) : <AddButton onClick={() => setAdding(true)} label={addLabel} />}
        </div>
      )}
    >
      {adding && (
        <AddForm fields={fields} onSave={(v: RelItem) => { onAdd(v); setAdding(false) }} onCancel={() => setAdding(false)} />
      )}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText ?? t('empty')}</div>
      )}
      {isTags ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{displayIdx.map(i => renderRow(items[i], i, items))}</div>
      ) : dragEnabled && onReorder ? (
        // DRAG-SORT-1: `bare` — this row already renders its own padding/border
        // (each Tab's renderItem), so DragList contributes only the grip + the
        // keyboard move-up/down pair, never a second divider.
        <DragList
          items={displayIdx.map(i => items[i])}
          bare
          // Reordering mid add/edit would move a row out from under an open form —
          // pause the affordance for that one beat rather than let it fire.
          sortable={editingIdx === null && !adding}
          onReorder={(next: RelItem[]) => onReorder(next)}
          // flex:1/minWidth:0 — DragList's row is a flex container (grip column +
          // this content); without stretching, the row wrapper's `position:
          // absolute, right:0` edit/remove controls (in `controls()` above) would
          // land at the CONTENT's edge, not the actual row's right edge.
          renderItem={(item: RelItem, displayPos: number) => (
            <div style={{ flex: 1, minWidth: 0 }}>{renderRow(item, displayIdx[displayPos], items)}</div>
          )}
        />
      ) : (
        displayIdx.map(i => renderRow(items[i], i, items))
      )}
    </SectionCard>
  )
}
