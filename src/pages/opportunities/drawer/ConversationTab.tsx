import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import ConversationsSection from '@/components/drawer/ConversationsSection'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { StartConversationModal } from '@/pages/candidates/shared'
import { useAuth } from '@/context/AuthContext'
import EmailTab from './EmailTab'
import { GroupLabel, Caption } from '@/components/ui/typography'
import type { Opportunity } from '@/types/opportunity'

/**
 * ConversationTab — the opportunity drawer's Conversatie tab (Danny 24-08:
 * "EMAIL MOET ZIJN CONVERSATIE!! EN JE MOET DIT KUNNEN STARTEN EN TERUG LEZEN").
 * Read-back works via the contact-scoped conversations endpoint (mirrors
 * ContactConversationsSection.tsx exactly, same shared ConversationsSection).
 *
 * CONTACT-CONVERSATION-START (K-190, koiosmatch-api commit 01cd7285): starting a
 * conversation is no longer a backend gap — POST /conversations/start accepts
 * customer_contact_id as a strict XOR alternative to candidate_id
 * (postConversationsStart, src/types/api-generated.ts operation postConversationsStart (CONTACT-CONVERSATION-START strict-XOR block)), so the header
 * now carries a real start trigger, gated on customers.view (§8 — a contact thread
 * is customer PII). The opportunity's contact carries no mobile number in this
 * dossier's own data (Opportunity type has no contactMobile field) — the trigger
 * therefore stays enabled whenever a contact+customer are known and lets the
 * server's own 422 ("no mobile") surface honestly if that turns out false, rather
 * than adding a second fetch just to pre-check it here. Below the WhatsApp thread
 * panel the existing e-mail log stays visible under its own section label.
 */
export default function ConversationTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')
  const auth = useAuth()
  // PII gate: a contact thread carries customer data on top of page.whatsapp (§8).
  const canViewCustomer = (auth?.hasPermission ?? (() => false))('customers.view')
  const [showStartModal, setShowStartModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  // Opportunity.php:212-214 → contact_id; mapOpportunity reads contactId at :85
  // and clientId (the linked customer) at :41. The threads URL needs BOTH ids —
  // a contact without a resolvable customer gets its own honest copy, never the
  // misleading "koppel een contactpersoon" line.
  const hasContact = Boolean(o.contactId)
  const hasCustomer = Boolean(o.clientId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {hasContact && hasCustomer ? (
        <>
          {showStartModal && o.contactId != null && (
            <StartConversationModal subject={{ kind: 'customer_contact', id: o.contactId }}
              onClose={() => setShowStartModal(false)} onStarted={() => setRefreshKey(k => k + 1)} />
          )}
          <ConversationsSection key={refreshKey} threadsUrl={`/customers/${o.clientId}/contacts/${o.contactId}/conversations`}
            headerAction={canViewCustomer ? (
              <DrawerAddButton onClick={() => setShowStartModal(true)} icon={MessageCircle} label={t('conversations.start')} />
            ) : undefined} />
        </>
      ) : (
        <Caption as="div" style={{ fontStyle: 'italic' }}>
          {t(hasContact ? 'conversation.noCustomer' : 'conversation.noContact')}
        </Caption>
      )}
      {/* Same card idiom as the conversations block above — one container era. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
        <GroupLabel style={{ marginBottom: 8 }}>{t('conversation.emailSectionLabel')}</GroupLabel>
        <EmailTab opportunity={o} />
      </div>
    </div>
  )
}
