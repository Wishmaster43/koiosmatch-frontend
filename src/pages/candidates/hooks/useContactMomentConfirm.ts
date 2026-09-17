/**
 * useContactMomentConfirm (candidate wiring, B15-flow) — thin entity binding
 * over the shared src/hooks/useContactMomentConfirm.ts machinery (§16
 * CLONE-BY-CONSTRUCTION-1: this used to duplicate the whole flow).
 *
 * Contract: POST /candidates/{id}/contact-moments { channel } → 201
 *   { last_contact_at, last_contact_type }
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useContactMomentConfirm as useSharedContactMomentConfirm } from '@/hooks/useContactMomentConfirm'
import type { ContactChannel } from '@/components/drawer/ContactMomentConfirmBanner'

export type { ContactChannel }

interface ContactMomentResponse {
  last_contact_at: string | null
  last_contact_type: string | null
}

// Non-blocking confirm-after-click flow for a mailto/tel link on a candidate;
// the server's response is the only source of the new contact-moment stamp.
export function useContactMomentConfirm(
  candidateId: string | number | undefined,
  onStamped?: (stamp: ContactMomentResponse) => void,
) {
  const { t } = useTranslation('candidates')
  const buildPath = useCallback((id: string | number) => `/candidates/${id}/contact-moments`, [])
  return useSharedContactMomentConfirm(candidateId, buildPath, t('common:actionFailed'), onStamped)
}
