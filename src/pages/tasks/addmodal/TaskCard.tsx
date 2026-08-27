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
import { FieldRow, TextField } from '@/components/forms/fields'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { cardHead, cardBox, row2 } from './fields'
import type { TaskForm } from '../AddTaskModal'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'

// Pure presentational task-type/title card (see the module doc above): all state lives in the parent form, this only reads and calls back.
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
          {/* Soort activiteit — the shared choice-chip row (Danny 27-08, consistency
              with the other create modals). Required field: picking switches, the
              active chip never clears on re-click (§3A: verplicht = geen wiskruis). */}
          <FieldRow label={t('modal.type')} required>
            <ChipMultiSelect
              options={types.map(x => ({ value: x.value, label: x.icon ? `${x.icon} ${x.label}` : x.label, color: x.color }))}
              values={form.type ? [form.type] : []}
              onToggle={(v: string) => { if (v !== form.type) set('type', v) }}
              selectAll={false}
              ariaLabel={t('modal.type')} />
          </FieldRow>
          <FieldRow label={t('modal.titleLabel')} required>
            <TextField value={form.title} onChange={v => set('title', v)} placeholder={t('modal.titlePlaceholder')} error={errors.title} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}
