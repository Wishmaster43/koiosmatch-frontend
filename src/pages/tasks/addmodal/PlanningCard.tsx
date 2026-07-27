/**
 * PlanningCard — the "Planning" card of AddTaskModal: when it's due and how
 * urgent (due date/time, priority, status). Pure presentational (Danny 27-07
 * popup redesign: split out of AddTaskModal.tsx to keep the container under
 * the file-size cap).
 */
import type { TFunction } from 'i18next'
import { Field, TextField, DateField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2, pickerStyle, PICKER_MENU_W } from './fields'
import type { TaskForm } from '../AddTaskModal'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'

export default function PlanningCard({ t, form, set, priorities, statuses }: {
  t: TFunction
  form: TaskForm
  set: (k: keyof TaskForm, v: string) => void
  priorities: TaskLookupItem[]
  statuses: TaskLookupItem[]
}) {
  return (
    <div>
      <div style={cardHead}>{t('modal.cardPlanning')}</div>
      <div style={cardBox}>
        {/* TASK-DUE-TIME-1: date + optional time-of-day, paired half-row. */}
        <div style={row2}>
          <Field label={t('modal.due')}>
            <DateField value={form.due} onChange={v => set('due', v)} placeholder="dd-mm-jjjj" />
          </Field>
          <Field label={t('modal.dueTime')}>
            <TextField type="time" value={form.dueTime} onChange={v => set('dueTime', v)} />
          </Field>
        </div>
        {/* Priority/status — searchable tenant lookups (allowCreate=false). */}
        <div style={row2}>
          <Field label={t('modal.priority')}>
            <CreatableSelect value={form.priority || null} onChange={(v: string) => set('priority', v)} allowCreate={false}
              style={pickerStyle} menuWidth={PICKER_MENU_W}
              options={priorities.map(x => ({ value: x.value, label: x.label }))} />
          </Field>
          <Field label={t('modal.status')}>
            <CreatableSelect value={form.status || null} onChange={(v: string) => set('status', v)} allowCreate={false}
              style={pickerStyle} menuWidth={PICKER_MENU_W}
              options={statuses.map(x => ({ value: x.value, label: x.label }))} />
          </Field>
        </div>
      </div>
    </div>
  )
}
