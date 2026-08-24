import { useTranslation } from 'react-i18next'
import ConversationsSection from '@/components/drawer/ConversationsSection'
import EmailTab from './EmailTab'
import { GroupLabel, Caption } from '@/components/ui/typography'
import type { Opportunity } from '@/types/opportunity'

/**
 * ConversationTab — the opportunity drawer's Conversatie tab (Danny 24-08:
 * "EMAIL MOET ZIJN CONVERSATIE!! EN JE MOET DIT KUNNEN STARTEN EN TERUG LEZEN").
 * Read-back works today via the contact-scoped conversations endpoint (mirrors
 * ContactConversationsSection.tsx exactly, same shared ConversationsSection).
 * Starting a conversation from an opportunity is a BACKEND gap (POST
 * /conversations/start only validates candidate_id, ConversationStartController.php:58;
 * MessageController:140 blocks contact-thread replies) — filed with CMBE separately,
 * so this tab never fakes a start affordance; the section header action stays empty,
 * exactly like the contact sub-tab does today. Below the WhatsApp thread panel the
 * existing e-mail log stays visible under its own section label, so nothing is lost.
 */
export default function ConversationTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')
  // Opportunity.php:212-214 → contact_id; mapOpportunity reads contactId at :85
  // and clientId (the linked customer) at :41. The threads URL needs BOTH ids —
  // a contact without a resolvable customer gets its own honest copy, never the
  // misleading "koppel een contactpersoon" line.
  const hasContact = Boolean(o.contactId)
  const hasCustomer = Boolean(o.clientId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {hasContact && hasCustomer ? (
        <ConversationsSection threadsUrl={`/customers/${o.clientId}/contacts/${o.contactId}/conversations`} />
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
