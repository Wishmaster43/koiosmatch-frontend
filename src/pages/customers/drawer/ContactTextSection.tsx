/**
 * ContactTextSection — CONTACT-DRILLDOWN-GATEN-1 punt 1 / CONTACT-TEKST-1: the
 * contact person's free-text block, canon block order (§3A DRILLDOWN-VOLGORDE-CANON)
 * — placed directly under the field card, above the Vestiging (location/department)
 * coupling. A THIN wrapper over the shared `EditableRichTextField` (own pencil →
 * RichTextEditor save/cancel, SafeHtml display, TEKST-POPOUT-1 second-screen icon)
 * — mirrors DepartmentDetail's identical `description` wiring 1:1, never a forked
 * editor. Saving goes through the caller's OWN onSave (useCustomerContacts.update),
 * never a second axios call path.
 */
import { useTranslation } from 'react-i18next'
import EditableRichTextField from './EditableRichTextField'
import { contactPopoutId } from '@/lib/secondScreen'
import type { Id } from '@/types/common'

// Thin wrapper over the shared rich-text field for the contact's free-text block; the popout icon needs customerId and stays hidden without it (see file header).
export default function ContactTextSection({ contactId, customerId, value, onSave }: {
  contactId: Id
  // Second-screen popout needs the owning customer too (nested PATCH route) — no
  // popout icon renders when this is null (legacy/edge data, mirrors the sibling
  // conversations/changelog gating in ContactDetail).
  customerId: Id | null
  value: string
  onSave: (html: string) => void
}) {
  const { t } = useTranslation('customers')

  return (
    <EditableRichTextField
      label={t('contacts.detail.freeText')}
      value={value}
      onSave={onSave}
      popout={customerId != null ? { entity: 'customer', id: contactPopoutId(customerId, contactId), field: 'contactText' } : undefined}
    />
  )
}
