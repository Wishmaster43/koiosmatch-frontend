/**
 * ProposeFieldRows — the label-LEFT rows of the propose modal (recipient, sender,
 * subject) on the shared form kit, so the modal reads like every other popup.
 */
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'
import { FieldRow, TextField } from '@/components/forms/fields'
import { CANON_LABEL_WIDTH } from '@/components/drawer/fieldRowCanon'
import { contactOptionLabel } from '@/lib/contactLabel'
import type { useProposeForm } from './useProposeForm'

type Form = ReturnType<typeof useProposeForm>

// Hint line under a row, indented to the field column (label width + the row gap).
function RowHint({ children }: { children: React.ReactNode }) {
  return <div style={{ marginLeft: CANON_LABEL_WIDTH + 10, marginTop: 4 }}>{children}</div>
}

// Recipient and sender as label-left rows; all pickers stay searchable and clearable.
export default function ProposeFieldRows({ form }: { form: Form }) {
  const { t } = useTranslation(['applications', 'common'])
  // The shared "Name, Function" label distinguishes same-named contacts on the customer.
  const contactOptions = form.contacts.map(c => ({ value: c.id, label: contactOptionLabel(c) }))
  // VOORSTEL-AFZENDER-FE-1: tenant users as the sender picker's options.
  const senderOptions = (form.users ?? []).map((u: { id: string; name: string }) => ({ value: u.id, label: u.name }))
  // Only pass a value the picker can resolve to a label, else the trigger would print the raw uuid.
  const senderDisplayValue = senderOptions.some(o => o.value === form.senderUserId) ? form.senderUserId : ''

  return (
    <>
      {/* Recipient: searchable contact picker (no free entry); loading, error and empty are explicit. */}
      <div>
        <FieldRow label={t('propose.recipient')}>
          {form.contactsLoading ? (
            <Caption as="div">{t('propose.loading')}</Caption>
          ) : form.contactsError ? (
            // D8: an honest error state, never read as "this customer has no contacts".
            <ErrorBanner variant="subtle">{t('propose.contactsError')}</ErrorBanner>
          ) : contactOptions.length === 0 && !form.recipient ? (
            <Caption as="div">{t('propose.noContacts')}</Caption>
          ) : (
            <CreatableSelect allowCreate={false} value={form.recipientContactId || null}
              onChange={form.setRecipientContactId} options={contactOptions}
              placeholder={t('propose.recipientPlaceholder')} />
          )}
        </FieldRow>
        {form.recipient && !form.recipient.email && (
          <RowHint>
            <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-warning-text)' }}>
              <TriangleAlert size={12} /> {t('propose.recipientMissingEmail')}
            </Caption>
          </RowHint>
        )}
      </div>

      {/* Sender: which tenant user the e-mail goes out in the name of; empty = the recruiter. */}
      <div>
        <FieldRow label={t('propose.onBehalfOf')}>
          {form.usersLoading ? (
            <Caption as="div">{t('propose.loading')}</Caption>
          ) : (
            <CreatableSelect allowCreate={false} value={senderDisplayValue || null}
              onChange={form.setSenderUserId} options={senderOptions}
              placeholder={t('propose.onBehalfOfSelf')} clearable clearLabel={t('propose.onBehalfOf')} />
          )}
        </FieldRow>
        <RowHint><Caption as="div">{t('propose.onBehalfOfHint')}</Caption></RowHint>
      </div>
    </>
  )
}

// Subject: single-line label-left row, rendered inside the message section.
export function ProposeSubjectRow({ form }: { form: Form }) {
  const { t } = useTranslation(['applications'])
  return (
    <FieldRow label={t('propose.subject')}>
      <TextField value={form.subject} onChange={form.setSubject} />
    </FieldRow>
  )
}
