/**
 * ContactConversationsSection — the contact drill-down's Conversaties sub-tab
 * (GESPREK-CONTACT-1). Thin wrapper around the shared
 * components/drawer/ConversationsSection, pointed at the contact-scoped list
 * endpoint (CustomerContactController::conversations) instead of the
 * candidate-scoped one. The shared component owns all four UI states
 * (loading/error/empty/success) and the accordion/messages behaviour — this
 * file only builds the URL.
 */
import ConversationsSection from '@/components/drawer/ConversationsSection'
import type { Id } from '@/types/common'

export default function ContactConversationsSection({ customerId, contactId }: {
  customerId: Id
  contactId: Id
}) {
  // Nested contact route — mirrors the ChangelogTab endpoint shape used elsewhere on ContactDetail.
  return <ConversationsSection threadsUrl={`/customers/${customerId}/contacts/${contactId}/conversations`} />
}
