/**
 * useKoiosChat — owns the Koios conversation state and the single synchronous
 * chat call, so KoiosPanel stays presentational.
 *
 * A message is one of:
 *   { role: 'user', content }
 *   { role: 'assistant', kind: 'welcome' }                         — intro bubble
 *   { role: 'assistant', answer, steps[], usage, model, stopReason } — a real reply
 *   { role: 'assistant', kind: 'error' | 'forbidden' }             — call failed
 *
 * stopReason ∈ end_turn | refusal | max_steps | not_configured. The panel maps
 * these to calm notices (a missing API key is `not_configured`, never an error).
 */
import { useCallback, useState } from 'react'
import { sendChat } from './koiosApi'

const welcomeMessage = () => ({ role: 'assistant', kind: 'welcome' })

export function useKoiosChat() {
  const [messages, setMessages] = useState([welcomeMessage()])
  const [loading, setLoading]   = useState(false)
  // Optional model override picked from settings; null = backend's active model.
  const [model, setModel]       = useState(null)

  // Send a turn: optimistic user bubble, then map the reply into an assistant one.
  const send = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)
    try {
      const data = await sendChat(trimmed, model)
      setMessages((prev) => [...prev, {
        role:       'assistant',
        answer:     data?.answer ?? '',
        steps:      Array.isArray(data?.steps) ? data.steps : [],
        usage:      data?.usage ?? null,
        model:      data?.model ?? null,
        stopReason: data?.stop_reason ?? 'end_turn',
      }])
    } catch (e) {
      // 403 = no module/permission → "no access"; anything else → calm retry notice.
      const kind = e?.response?.status === 403 ? 'forbidden' : 'error'
      setMessages((prev) => [...prev, { role: 'assistant', kind }])
    } finally {
      setLoading(false)
    }
  }, [loading, model])

  // Start over with just the welcome bubble.
  const reset = useCallback(() => setMessages([welcomeMessage()]), [])

  return { messages, loading, model, setModel, send, reset }
}
