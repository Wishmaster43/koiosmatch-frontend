/**
 * useContactMomentConfirm (customer-contact wiring, LAATSTE-CONTACT-SCOPE-1) —
 * thin entity binding over the shared src/hooks/useContactMomentConfirm.ts
 * machinery (§16 CLONE-BY-CONSTRUCTION-1: this used to duplicate the whole flow).
 *
 * Contract (CONTRACT-CHANGELOG LAATSTE-CONTACT-SCOPE-1): POST
 *   /customer-contacts/{id}/contact-moments { channel } → 201
 *   { last_contact_at, last_contact_type }.
 * The channel resolves against the CONTACT-scoped vocabulary only — an
 * inactive or candidate-only channel is a 422 on `channel`; the server's own
 * message is shown and nothing is stamped (M2 hand-closing, 17-09).
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useContactMomentConfirm as useSharedContactMomentConfirm } from '@/hooks/useContactMomentConfirm'
import type { ContactChannel } from '@/components/drawer/ContactMomentConfirmBanner'
import type { Id } from '@/types/common'

export type { ContactChannel }

interface ContactMomentResponse {
  last_contact_at: string | null
  last_contact_type: string | null
}

// Non-blocking confirm-after-click flow for a contact person's mailto link;
// the server's response is the only source of the new stamp, never a local guess.
export function useContactMomentConfirm(
  contactId: Id | undefined,
  onStamped?: (stamp: ContactMomentResponse) => void,
) {
  const { t } = useTranslation('customers')
  const buildPath = useCallback((id: Id) => `/customer-contacts/${id}/contact-moments`, [])
  return useSharedContactMomentConfirm(contactId, buildPath, t('common:actionFailed'), onStamped)
}
