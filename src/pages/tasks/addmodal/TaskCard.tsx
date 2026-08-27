/**
 * TaskCard — the "Taak" card of AddTaskModal: what the task IS (title only).
 * Pure presentational: form values in, `set()`/`errors` callbacks out (Danny
 * 27-07 popup redesign: split out of AddTaskModal.tsx to keep the container
 * under the file-size cap).
 *
 * TITELBALK-PILLS (Danny 27-08): the Soort activiteit chip row moved OUT of
 * this card into the modal's title bar (AddTaskModal.tsx header, shared
 * `TitleBarPills` atom) — this card now only holds the title field.
 *
 * PUNT 14 (Danny 08-08): the free-text description moved OUT of this card into
 * its own `DescriptionCard`, rendered last — it used to sit here, above every
 * short field. Order change only; the field itself is unchanged.
 */
import type { TFunction } from 'i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import { cardHead, cardBox } from './fields'
import type { TaskForm } from '../AddTaskModal'

// Pure presentational task-title card (see the module doc above): all state lives in the parent form, this only reads and calls back.
export default function TaskCard({ t, form, errors, set }: {
  t: TFunction
  form: TaskForm
  errors: Record<string, boolean>
  set: (k: keyof TaskForm, v: string) => void
}) {
  return (
    <div>
      <div style={cardHead}>{t('modal.cardTask')}</div>
      <div style={cardBox}>
        <FieldRow label={t('modal.titleLabel')} required>
          <TextField value={form.title} onChange={v => set('title', v)} placeholder={t('modal.titlePlaceholder')} error={errors.title} />
        </FieldRow>
      </div>
    </div>
  )
}
