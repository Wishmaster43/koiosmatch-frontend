/**
 * TaskCard — the "Taak" card of AddTaskModal: what the task IS (type + title).
 * Pure presentational: form values in, `set()`/`errors` callbacks out (Danny
 * 27-07 popup redesign: split out of AddTaskModal.tsx to keep the container
 * under the file-size cap).
 *
 * PUNT 14 (Danny 08-08): the free-text description moved OUT of this card into
 * its own `DescriptionCard`, rendered last — it used to sit here, above every
 * short field. Order change only; the field itself is unchanged.
 */
import type { TFunction } from 'i18next'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2, pickerStyle, PICKER_MENU_W } from './fields'
import type { TaskForm } from '../AddTaskModal'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'

export default function TaskCard({ t, form, errors, set, types }: {
  t: TFunction
  form: TaskForm
  errors: Record<string, boolean>
  set: (k: keyof TaskForm, v: string) => void
  types: TaskLookupItem[]
}) {
  return (
    <div>
      <div style={cardHead}>{t('modal.cardTask')}</div>
      <div style={cardBox}>
        <div style={row2}>
          {/* Soort activiteit — the TYPE lookup (searchable, allowCreate=false: a
              tenant-managed value, never a free-text create). */}
          <Field label={t('modal.type')} required>
            <CreatableSelect value={form.type || null} onChange={(v: string) => set('type', v)} allowCreate={false}
              placeholder={t('modal.typePlaceholder')} menuWidth={PICKER_MENU_W}
              style={errors.type ? { ...pickerStyle, borderColor: 'var(--color-danger)' } : pickerStyle}
              options={types.map(x => ({ value: x.value, label: x.label }))} />
          </Field>
          <Field label={t('modal.titleLabel')} required>
            <TextField value={form.title} onChange={v => set('title', v)} placeholder={t('modal.titlePlaceholder')} error={errors.title} />
          </Field>
        </div>
      </div>
    </div>
  )
}
