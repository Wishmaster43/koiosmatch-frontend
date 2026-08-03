/**
 * LinkCard — the "Koppelingen" card of AddTaskModal: what the task relates to
 * (the candidate/customer/contact link pickers). Pure presentational (Danny
 * 27-07 popup redesign: split out of AddTaskModal.tsx to keep the container
 * under the file-size cap). The assignee picker + read-only creator line
 * moved to their own AssignmentCard/"Toewijzing" (Danny's four-card layout
 * mirroring +Match's Relaties/Contract/Financieel split) — a linked RECORD
 * and WHO owns the task are different concerns.
 */
import type { TFunction } from 'i18next'
import { Field } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2, pickerStyle, PICKER_MENU_W } from './fields'
import type { TaskForm } from '../AddTaskModal'

interface Opt { value: string; label: string }

export default function LinkCard({ t, form, set, candidates, customers, contacts, lockCustomerId, lockCustomerName }: {
  t: TFunction
  form: TaskForm
  set: (k: keyof TaskForm, v: string) => void
  candidates: Opt[]; customers: Opt[]; contacts: Opt[]
  // Set from a customer drawer trigger: the customer field renders read-only
  // instead of a picker (mirrors AddVacancyModal's lockCustomerId).
  lockCustomerId?: string; lockCustomerName?: string
}) {
  return (
    <div>
      <div style={cardHead}>{t('modal.cardLink')}</div>
      <div style={cardBox}>
        {/* Gekoppeld record — candidate/customer/contact, each a searchable
            relational picker (allowCreate=false: a real id, never free-text). */}
        <div style={row2}>
          <Field label={t('modal.candidate')}>
            <CreatableSelect value={form.candidateId || null} onChange={(v: string) => set('candidateId', v)} allowCreate={false}
              placeholder={t('modal.candidatePlaceholder')} style={pickerStyle} menuWidth={PICKER_MENU_W} options={candidates} />
          </Field>
          <Field label={t('modal.customer')}>
            {lockCustomerId
              ? (
                // Read-only: the drawer this modal was opened from already fixes
                // the customer — never a fake picker the recruiter could repoint.
                <div style={{ ...pickerStyle, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)' }}>
                  {lockCustomerName ?? ''}
                </div>
              )
              : (
                <CreatableSelect value={form.customerId || null} onChange={(v: string) => set('customerId', v)} allowCreate={false}
                  placeholder={t('modal.customerPlaceholder')} style={pickerStyle} menuWidth={PICKER_MENU_W} options={customers} />
              )}
          </Field>
        </div>
        <Field label={t('modal.contact')}>
          <CreatableSelect value={form.contactId || null} onChange={(v: string) => set('contactId', v)} allowCreate={false}
            placeholder={t('modal.contactPlaceholder')} style={pickerStyle} menuWidth={PICKER_MENU_W} options={contacts} />
        </Field>
      </div>
    </div>
  )
}
