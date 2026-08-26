/**
 * useContactMomentConfirm (B15-flow) — after the user clicks a mailto: link in the
 * candidate drawer, offer a small non-blocking confirmation: "Sent the e-mail?
 * Register as contact moment." Confirming POSTs the contact moment; the server's
 * response is the ONLY source of the new stamp — this hook never assumes
 * "email + now" locally (the stamp must stay monotonic: a later real contact-
 * moment write elsewhere must never be clobbered by an optimistic local guess).
 *
 * Contract: POST /candidates/{id}/contact-moments { channel } → 201
 *   { last_contact_at, last_contact_type }
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

export type ContactChannel = 'email' | 'phone' | 'mobile'

interface ContactMomentResponse {
  last_contact_at: string | null
  last_contact_type: string | null
}

// Non-blocking confirm-after-click flow for a mailto/tel link; the server's response is the only source of the new contact-moment stamp, never a local guess (see file header).
export function useContactMomentConfirm(
  candidateId: string | number | undefined,
  onStamped?: (stamp: ContactMomentResponse) => void,
) {
  const { t } = useTranslation('candidates')
  // The channel awaiting confirmation, or null when no banner is shown.
  const [pending, setPending] = useState<ContactChannel | null>(null)
  const [saving, setSaving] = useState(false)

  // A mailto/tel click opens the confirmation — never fires the request itself.
  const prompt = useCallback((channel: ContactChannel) => setPending(channel), [])
  const dismiss = useCallback(() => setPending(null), [])

  // Confirms the moment actually happened — writes it, then hands the SERVER's
  // stamp (never a local guess) up to the caller so the drawer shows the real value.
  const confirm = useCallback(async () => {
    if (!candidateId || !pending) return
    setSaving(true)
    try {
      const res = await api.post(`/candidates/${candidateId}/contact-moments`, { channel: pending })
      const data = (res.data?.data ?? res.data) as ContactMomentResponse
      onStamped?.(data)
      setPending(null)
    } catch {
      notifyError(t('common:actionFailed'))
    } finally {
      setSaving(false)
    }
  }, [candidateId, pending, onStamped])

  return { pending, saving, prompt, dismiss, confirm }
}
