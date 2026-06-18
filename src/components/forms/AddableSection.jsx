/**
 * AddableSection — a titled card that lists items and can add new ones inline.
 *
 * Collapses the five near-identical drawer tabs (experience, education, languages,
 * certifications, skills) and placements into one component. Each caller supplies
 * the title, the add-form `fields`, an `onAdd` handler and a `renderItem`.
 *
 * layout="tags" wraps items in a flex-wrap row (chips); "list" stacks them.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '../ui/SectionCard'
import AddForm from './AddForm'
import { AddButton } from './fields'

export default function AddableSection({
  title, items = [], fields, onAdd, emptyText, renderItem, layout = 'list', addLabel,
}) {
  const { t } = useTranslation('common')
  const [adding, setAdding] = useState(false)

  return (
    <SectionCard
      title={title}
      action={!adding && <AddButton onClick={() => setAdding(true)} label={addLabel} />}
    >
      {adding && (
        <AddForm
          fields={fields}
          onSave={v => { onAdd(v); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText ?? t('empty')}</div>
      )}
      {layout === 'tags'
        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{items.map(renderItem)}</div>
        : items.map(renderItem)}
    </SectionCard>
  )
}
