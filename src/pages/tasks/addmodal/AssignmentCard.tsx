/**
 * AssignmentCard — the "Toewijzing" card of AddTaskModal: who is doing the
 * task (the assignee picker, defaulting to the logged-in user when they are
 * an assignable tenant user — see AddTaskModal's `meIsAssignable` guard) and
 * who created it (read-only). Split out of the former combined LinkCard
 * (Danny: "+ Nieuwe taak" brought in line with +Match's calm four-card layout
 * — Taak · Planning · Koppelingen · Toewijzing) so "what it links to" and
 * "who owns it" read as two distinct concerns, mirroring +Match's Contract/
 * Financieel split. Pure presentational: form values in, `set()` out.
 */
import type { TFunction } from 'i18next'
import { Field } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, pickerStyle, PICKER_MENU_W } from './fields'
import type { TaskForm } from '../AddTaskModal'

interface Opt { value: string; label: string }

export default function AssignmentCard({ t, form, set, assigneeOpts, ownerName }: {
  t: TFunction
  form: TaskForm
  set: (k: keyof TaskForm, v: string) => void
  assigneeOpts: Opt[]
  // The logged-in creator's display name — read-only, no picker (mirrors "Aangemaakt door").
  ownerName: string
}) {
  return (
    <div>
      <div style={cardHead}>{t('modal.cardAssignment')}</div>
      <div style={cardBox}>
        {/* Uitvoerder — proposes the logged-in user when assignable (AddTaskModal's
            meIsAssignable guard); the empty-value option ("Bureau (niemand)") is a
            real list entry here, not a placeholder fallback. */}
        <Field label={t('modal.assignee')}>
          <CreatableSelect value={form.assigneeId} onChange={(v: string) => set('assigneeId', v)} allowCreate={false}
            style={pickerStyle} menuWidth={PICKER_MENU_W} options={assigneeOpts} />
        </Field>
        {/* Read-only creator — no picker, mirrors the old Details panel line. */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('modal.owner')}</div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{ownerName || '—'}</div>
        </div>
      </div>
    </div>
  )
}
