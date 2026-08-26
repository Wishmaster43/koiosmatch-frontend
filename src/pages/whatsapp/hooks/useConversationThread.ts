/**
 * useConversationThread — loads one thread's messages for the read-only drill-
 * down (GET /conversations/{id}/messages, MessageController::index). Without
 * `before` the server returns the newest window oldest→newest; "load older"
 * sends `before=<oldest loaded sent_at>` and gets an OLDER chunk newest→oldest,
 * which this hook reverses before prepending — same contract the candidate
 * drawer's ConversationsSection documents (measured against the same endpoint).
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { MessageRow } from '@/components/drawer/ConversationMessage'
import type { Id } from '@/types/common'

// Loads one WhatsApp thread's messages plus "load older" pagination (see file
// docblock above), reversing the server's newest→oldest older-chunk order to
// prepend it correctly.
export function useConversationThread(conversationId: Id | null) {
  const { t } = useTranslation('common')
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // Fresh thread on id change — the current messages must never leak into the next one.
  useEffect(() => {
    if (conversationId == null) return
    let alive = true
    setLoading(true); setError(false); setMessages([]); setHasOlder(false)
    api.get(`/conversations/${conversationId}/messages`)
      .then(r => {
        if (!alive) return
        const body = r.data as { has_older?: boolean }
        setMessages(unwrapList<MessageRow>(r).rows)
        setHasOlder(Boolean(body?.has_older))
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [conversationId])

  // Page further back: the server returns an OLDER chunk newest→oldest — reverse
  // it so the prepended messages read oldest→newest same as the rest of the list.
  const loadOlder = useCallback(() => {
    if (conversationId == null || messages.length === 0) return
    const oldest = messages[0]?.sent_at
    if (!oldest) return
    setLoadingOlder(true)
    api.get(`/conversations/${conversationId}/messages`, { params: { before: oldest } })
      .then(r => {
        const body = r.data as { has_older?: boolean }
        const older = unwrapList<MessageRow>(r).rows
        setMessages(prev => [...[...older].reverse(), ...prev])
        setHasOlder(Boolean(body?.has_older))
      })
      .catch(() => notifyError(t('actionFailed')))
      .finally(() => setLoadingOlder(false))
  }, [conversationId, messages, t])

  return { messages, loading, error, hasOlder, loadingOlder, loadOlder }
}
