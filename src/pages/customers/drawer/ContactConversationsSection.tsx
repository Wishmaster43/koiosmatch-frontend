/**
 * ContactConversationsSection — the contact drill-down's Conversaties sub-tab
 * (GESPREK-CONTACT-1). Thin wrapper around the shared
 * components/drawer/ConversationsSection, pointed at the contact-scoped list
 * endpoint (CustomerContactController::conversations) instead of the
 * candidate-scoped one. The shared component owns all four UI states
 * (loading/error/empty/success) and the accordion/messages behaviour — this
 * file only builds the URL.
 *
 * CONTACT-CONVERSATION-START (K-190, koiosmatch-api commit 01cd7285): starting a
 * NEW thread with a contact is no longer a backend gap — POST /conversations/start
 * accepts customer_contact_id as a strict XOR alternative to candidate_id
 * (postConversationsStart, src/types/api-generated.ts operation postConversationsStart (CONTACT-CONVERSATION-START strict-XOR block)). The header
 * "Conversatie starten" trigger mirrors CommunicationTab.tsx's candidate one:
 * disabled without a mobile number (a cold-start template needs a real recipient),
 * and hidden entirely for a recruiter without `customers.view` — a contact thread
 * carries customer PII on top of the general `page.whatsapp` gate (§8), so a user
 * who cannot see this customer's contacts must not get a start affordance for one.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import ConversationsSection from '@/components/drawer/ConversationsSection'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { StartConversationModal } from '@/pages/candidates/shared'
import { useAuth } from '@/context/AuthContext'
import type { Id } from '@/types/common'

// See the file's top doc above; a thin wrapper pointing the shared ConversationsSection at the contact-scoped endpoint.
export default function ContactConversationsSection({ customerId, contactId, mobile }: {
  customerId: Id
  contactId: Id
  // The contact's mobile number — the start trigger is disabled without one,
  // mirroring CommunicationTab's candidate variant (§3, honest affordances).
  mobile?: string | null
}) {
  const { t } = useTranslation('candidates')
  const auth = useAuth()
  // PII gate: a contact thread is customer data on top of page.whatsapp (§8) — the
  // affordance stays hidden without customers.view, never just disabled.
  const canViewCustomer = (auth?.hasPermission ?? (() => false))('customers.view')
  const [showStartModal, setShowStartModal] = useState(false)
  // Bumped on a successful start so the thread list re-fetches from the server.
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      {showStartModal && (
        <StartConversationModal subject={{ kind: 'customer_contact', id: contactId }}
          onClose={() => setShowStartModal(false)} onStarted={() => setRefreshKey(k => k + 1)} />
      )}
      {/* Nested contact route — mirrors the ChangelogTab endpoint shape used
          elsewhere on ContactDetail; already dossier-scoped so it needs no extra
          page.whatsapp gate (ConversationResource docblock, koiosmatch-api). */}
      <ConversationsSection key={refreshKey} threadsUrl={`/customers/${customerId}/contacts/${contactId}/conversations`}
        headerAction={canViewCustomer ? (
          <DrawerAddButton onClick={() => setShowStartModal(true)} icon={MessageCircle}
            label={t('conversations.start')} disabled={!mobile}
            title={mobile ? t('conversations.start') : t('conversations.startNoMobileContact')} />
        ) : undefined} />
    </>
  )
}
