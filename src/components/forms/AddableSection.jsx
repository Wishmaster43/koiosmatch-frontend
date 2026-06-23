/**
 * AddableSection — a titled card that lists items and can add, EDIT and remove them.
 *
 * Collapses the near-identical drawer sections (experience, education, certifications,
 * skills) and placements into one component. Each caller supplies the title, the
 * `fields`, an `onAdd` handler and a `renderItem`. Pass `onEdit(index, values)` and/or
 * `onRemove(index)` to enable the in-place pencil (→ prefilled form, save/cancel as
 * diskette/✕) and the trash button per item.
 *
 * layout="tags" wraps items in a flex-wrap row (chips); "list" stacks them.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Trash2 } from 'lucide-react'
import SectionCard from '../ui/SectionCard'
import AddForm from './AddForm'
import { AddButton } from './fields'

export default function AddableSection({
  title, items = [], fields, onAdd, onEdit, onRemove, emptyText, renderItem, layout = 'list', addLabel,
}) {
  const { t } = useTranslation('common')
  const [adding,     setAdding]     = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)

  const ctrlBtn = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none' }
  const isTags = layout === 'tags'

  const controls = (i) => (
    <div style={{ display: 'flex', gap: 3, ...(isTags
      ? { marginLeft: 2 }
      : { position: 'absolute', top: 8, right: 0 }) }}>
      {onEdit && (
        <button onClick={() => setEditingIdx(i)} title={t('edit', { defaultValue: 'Bewerken' })}
          style={{ ...ctrlBtn, background: 'var(--bg)', color: 'var(--text-muted)' }}><Edit2 size={11} /></button>
      )}
      {onRemove && (
        <button onClick={() => onRemove(i)} title={t('remove', { defaultValue: 'Verwijderen' })}
          style={{ ...ctrlBtn, background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><Trash2 size={11} /></button>
      )}
    </div>
  )

  const renderRow = (item, i, arr) =>
    editingIdx === i ? (
      <AddForm key={`edit-${item.id ?? i}`} fields={fields} initial={item}
        onSave={v => { onEdit?.(i, v); setEditingIdx(null) }} onCancel={() => setEditingIdx(null)} />
    ) : (onEdit || onRemove) ? (
      <div key={item.id ?? i} style={{ position: 'relative', display: isTags ? 'inline-flex' : 'block', alignItems: 'center' }}>
        {renderItem(item, i, arr)}
        {controls(i)}
      </div>
    ) : renderItem(item, i, arr)

  return (
    <SectionCard
      title={title}
      action={!adding && <AddButton onClick={() => setAdding(true)} label={addLabel} />}
    >
      {adding && (
        <AddForm fields={fields} onSave={v => { onAdd(v); setAdding(false) }} onCancel={() => setAdding(false)} />
      )}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText ?? t('empty')}</div>
      )}
      {isTags
        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{items.map(renderRow)}</div>
        : items.map(renderRow)}
    </SectionCard>
  )
}
