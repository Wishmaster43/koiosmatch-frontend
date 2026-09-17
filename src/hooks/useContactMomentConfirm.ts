/**
 * useContactMomentConfirm (shared, LAATSTE-CONTACT-SCOPE-1) — the B15-flow
 * confirm-after-mailto machinery shared by the candidate and customer-contact
 * drawers (CLONE-BY-CONSTRUCTION-1: the two entity hooks were a structural
 * clone save for the endpoint path and the i18n fallback). Confirming POSTs
 * the contact moment; the server's response is the ONLY source of the new
 * stamp — never a local "email + now" guess (the stamp must stay monotonic).
 * A 422 (inactive/wrongly-scoped channel) shows the SERVER's own message via
 * extractApiError and nothing is stamped.
 */
import { useState, useCallback } from 'react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { ContactChannel } from '@/components/drawer/ContactMomentConfirmBanner'
import type { Id } from '@/types/common'

export type { ContactChannel }

interface ContactMomentResponse {
  last_contact_at: string | null
  last_contact_type: string | null
}

// Entity-agnostic confirm flow: caller supplies the endpoint path (built from the
// entity's own route prefix) and a fallback message for the non-422 error case.
export function useContactMomentConfirm(
  entityId: Id | undefined,
  buildPath: (id: Id) => string,
  fallbackMessage: string,
  onStamped?: (stamp: ContactMomentResponse) => void,
) {
  // The channel awaiting confirmation, or null when no banner is shown.
  const [pending, setPending] = useState<ContactChannel | null>(null)
  const [saving, setSaving] = useState(false)

  // A mailto/tel click opens the confirmation — never fires the request itself.
  const prompt = useCallback((channel: ContactChannel) => setPending(channel), [])
  const dismiss = useCallback(() => setPending(null), [])

  // Confirms the moment actually happened — writes it, then hands the SERVER's
  // stamp (never a local guess) up to the caller so the drawer shows the real value.
  const confirm = useCallback(async () => {
    if (!entityId || !pending) return
    setSaving(true)
    try {
      const res = await api.post(buildPath(entityId), { channel: pending })
      const data = (res.data?.data ?? res.data) as ContactMomentResponse
      onStamped?.(data)
      setPending(null)
    } catch (err) {
      // A 422 (inactive/wrongly-scoped channel) shows the SERVER's own message —
      // nothing is stamped (M2 hand-closing).
      notifyError(extractApiError(err, fallbackMessage))
    } finally {
      setSaving(false)
    }
  }, [entityId, pending, buildPath, fallbackMessage, onStamped])

  return { pending, saving, prompt, dismiss, confirm }
}
