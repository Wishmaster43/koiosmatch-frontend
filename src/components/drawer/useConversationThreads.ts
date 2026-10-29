/**
 * useConversationThreads — the thread list, the one-open accordion and each open
 * thread's lazily loaded messages for ConversationsSection (ONIX-RECHECK #15).
 * Every load carries an alive guard so a fast scope switch never lets a stale
 * response win (§9); a failed load is an error state, never an empty one (§3).
 */
import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'
import type { MessageRow } from './ConversationMessage'
import type { ConversationRow } from './conversationRows'

export interface ConversationThreads {
  rows: ConversationRow[]
  setRows: Dispatch<SetStateAction<ConversationRow[]>>
  loading: boolean
  error: boolean
  openId: Id | null
  toggle: (id: Id) => void
  messages: Record<string, MessageRow[]>
  setMessages: Dispatch<SetStateAction<Record<string, MessageRow[]>>>
  msgLoading: boolean
  msgError: Record<string, boolean>
  retryMessages: (id: Id) => void
  refreshRows: () => void
  reloadThread: (id: Id) => void
}

// Load this dossier's threads (+ the open thread's messages) for the caller's list route.
export function useConversationThreads(threadsUrl: string, threadsParams?: Record<string, unknown>): ConversationThreads {
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Which thread is expanded, and its lazily-loaded messages keyed by conversation id.
  const [openId, setOpenId] = useState<Id | null>(null)
  const [messages, setMessages] = useState<Record<string, MessageRow[]>>({})
  const [msgLoading, setMsgLoading] = useState(false)
  // Per-thread message-load failure, distinct from the empty-array "genuinely no
  // messages yet" state (§8 D8: a swallowed fetch error must never render as empty).
  const [msgError, setMsgError] = useState<Record<string, boolean>>({})

  // Serialize the caller's params so a fresh object literal each render doesn't
  // retrigger the fetch — only the actual VALUES (e.g. candidate_id) matter.
  const paramsKey = JSON.stringify(threadsParams ?? {})

  // Load this dossier's threads; a 404/422 (filter not built) reads as empty, not broken.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    setOpenId(null); setMessages({})
    api.get(threadsUrl, { params: threadsParams })
      .then(r => { if (alive) setRows(unwrapList<ConversationRow>(r).rows) })
      .catch(e => { if (!alive) return; if ([404, 422].includes(e?.response?.status)) setRows([]); else setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- threadsParams itself is intentionally excluded: paramsKey (its serialized value) is the real dependency, so an inline object literal from the caller never retriggers a spurious refetch
  }, [threadsUrl, paramsKey])

  // Auto-expand: a single thread opens immediately; with several, the first (most recent/
  // active) does. Never leaves a closed accordion the recruiter has to click through first.
  useEffect(() => {
    if (rows.length > 0) setOpenId(prev => (prev !== null ? prev : rows[0].id))
  }, [rows])

  // Flip a thread open/closed — the accordion keeps at most one thread expanded at a time.
  const toggle = useCallback((id: Id) => {
    setOpenId(prev => (prev === id ? null : id))
  }, [])

  // Bumped by the retry button so the load effect re-runs for a thread whose
  // messages are still unset after a failed fetch (openId alone wouldn't change).
  const [msgRetryNonce, setMsgRetryNonce] = useState(0)
  const retryMessages = useCallback((id: Id) => {
    setMsgError(e => ({ ...e, [String(id)]: false }))
    setMsgRetryNonce(n => n + 1)
  }, [])

  // Fetch a thread's messages once it becomes the open one (auto-expand triggers this on mount too).
  useEffect(() => {
    if (openId === null || messages[String(openId)]) return
    let alive = true
    setMsgLoading(true); setMsgError(e => ({ ...e, [String(openId)]: false }))
    api.get(`/conversations/${openId}/messages`)
      .then(r => { if (alive) setMessages(m => ({ ...m, [String(openId)]: unwrapList<MessageRow>(r).rows })) })
      .catch(() => { if (alive) setMsgError(e => ({ ...e, [String(openId)]: true })) })
      .finally(() => { if (alive) setMsgLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages read only to skip a duplicate fetch, not a re-trigger; msgRetryNonce IS the re-trigger for a manual retry
  }, [openId, msgRetryNonce])

  // Re-read the list so last_message_at/is_active come from the server, never a local bump.
  const refreshRows = useCallback(() => {
    api.get(threadsUrl, { params: threadsParams })
      .then(rr => setRows(unwrapList<ConversationRow>(rr).rows))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same paramsKey rationale as the load effect above
  }, [threadsUrl, paramsKey])

  // After a template send the SERVER wrote the outbound row — pull the thread and the list back in.
  const reloadThread = useCallback((id: Id) => {
    api.get(`/conversations/${id}/messages`)
      .then(r => setMessages(m => ({ ...m, [String(id)]: unwrapList<MessageRow>(r).rows })))
      .catch(() => {})
    refreshRows()
  }, [refreshRows])

  return { rows, setRows, loading, error, openId, toggle, messages, setMessages, msgLoading, msgError, retryMessages, refreshRows, reloadThread }
}
