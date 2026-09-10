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
 *
 * `send(text, context?)` — `context` is the @-mentioned records attached to this
 * turn (KOIOS-CTX-1); optional and additive, see koiosApi for the wire contract.
 *
 * `pendingAction` (KOIOS-AGENT-PLAN §6) rides along on an assistant message when
 * the backend proposes a guarded write instead of executing it — dormant/undefined
 * until that half ships; KoiosPanel only renders the confirmation card when present.
 */
import { useCallback, useState } from 'react'
import { sendChat } from './koiosApi'
import { apiErrorKey } from '@/lib/extractApiError'
import type { KoiosChatMessage, KoiosContextRef } from '@/types/koios'
import type { KoiosEffort } from './koiosTypes'
import './koiosTypes' // module augmentation: KoiosChatMessage.pendingAction, KoiosStep.refs
import type { KoiosChatTurn } from './koiosTypes'

// KOIOS-MEMORY-1 (Danny 10-09, verbatim: "Koios AI heeft geen geschiedenis het lijkt wel
// of elke bericht hij niet meer snapt wat het vorige bericht was"): measured, the chat
// endpoint received only the new message, so "kan je hem een bericht sturen?" had no
// "hem". Two carriers now: the last turns as text (history, read by the BE once its
// half lands) and the records the previous answer named, sent as context so the
// follow-up resolves against them today. Bounded for data minimisation (§9).
export const KOIOS_HISTORY_TURNS = 8
export const KOIOS_CONTEXT_MAX = 5

// The last turns as [{ role, content }] — user text and assistant answers only, never a
// welcome/error bubble, never tool steps.
export function historyOf(messages: KoiosChatMessage[]): KoiosChatTurn[] {
  const turns: KoiosChatTurn[] = []
  for (const m of messages) {
    if (m.role === 'user' && m.content) turns.push({ role: 'user', content: m.content })
    else if (m.role === 'assistant' && m.answer) turns.push({ role: 'assistant', content: m.answer })
  }
  return turns.slice(-KOIOS_HISTORY_TURNS)
}

// The records the most recent answer referenced (deduped by type:id), the anchor for
// a follow-up like "hem"; an answer that listed more than the context cap names too
// many to guess from, so it carries none and the user picks one.
export function carriedRefsOf(messages: KoiosChatMessage[]): KoiosContextRef[] {
  const last = [...messages].reverse().find(m => m.role === 'assistant' && Array.isArray(m.steps))
  if (!last) return []
  const seen = new Set<string>()
  const refs: KoiosContextRef[] = []
  for (const step of last.steps ?? []) {
    for (const ref of step.refs ?? []) {
      const key = `${ref.type}:${ref.id}`
      if (seen.has(key)) continue
      seen.add(key)
      refs.push(ref)
    }
  }
  return refs.length > KOIOS_CONTEXT_MAX ? [] : refs
}

// Explicit @-mentions first, then the carried records, capped to what the endpoint accepts.
function mergeContext(explicit: KoiosContextRef[] | undefined, carried: KoiosContextRef[]): KoiosContextRef[] | undefined {
  const merged: KoiosContextRef[] = [...(explicit ?? [])]
  const seen = new Set(merged.map(r => `${r.type}:${r.id}`))
  for (const ref of carried) {
    if (merged.length >= KOIOS_CONTEXT_MAX) break
    const key = `${ref.type}:${ref.id}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(ref)
  }
  return merged.length ? merged : explicit
}

const welcomeMessage = (): KoiosChatMessage => ({ role: 'assistant', kind: 'welcome' })

// Owns the conversation state (messages, loading, model/flavor/effort overrides) and the single synchronous send(); KoiosPanel stays presentational.
export function useKoiosChat() {
  const [messages, setMessages] = useState<KoiosChatMessage[]>([welcomeMessage()])
  const [loading, setLoading]   = useState(false)
  // Optional model override picked from settings; null = backend's active model.
  const [model, setModel]       = useState<string | null>(null)
  // Optional flavor and effort overrides; null = backend's tenant defaults.
  const [flavor, setFlavor]     = useState<string | null>(null)
  const [effort, setEffort]     = useState<KoiosEffort | null>(null)
  // VOICE-MODE-1: conversation-mode toggle — sent to the backend as
  // `voice_mode: true` only while on (see koiosApi.sendChat).
  const [voiceMode, setVoiceMode] = useState(false)

  // Send a turn: optimistic user bubble, then map the reply into an assistant one.
  const send = useCallback(async (text: string, context?: KoiosContextRef[]) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    // Snapshot the thread BEFORE the optimistic bubble: the history is what came before.
    const history = historyOf(messages)
    const mergedContext = mergeContext(context, carriedRefsOf(messages))
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)
    try {
      const data = await sendChat(trimmed, model, mergedContext, flavor, effort, voiceMode, history.length ? history : undefined)
      setMessages((prev) => [...prev, {
        role:       'assistant',
        answer:     data?.answer ?? '',
        steps:      Array.isArray(data?.steps) ? data.steps : [],
        usage:      data?.usage ?? null,
        model:      data?.model ?? null,
        stopReason: data?.stop_reason ?? 'end_turn',
        // KOIOS-CHAT-SIGNALS-FE-1: carries budget.reason so the panel can pick the
        // daily ("tomorrow") vs monthly ("next month") notice on budget_exceeded.
        budget: data?.budget ?? null,
        pendingAction: data?.pending_action ?? null,
        // KOIOS-FEEDBACK-FE-1: the feedback thumbs key on this id — tolerant
        // passthrough, absent on older backends and the thumbs simply stay hidden.
        prompt_log_id: typeof data?.prompt_log_id === 'string' ? data.prompt_log_id : undefined,
      }])
    } catch (e) {
      // A known backend error code (credit exhausted, outage) gets its own translated
      // notice via apiErrorKey; 403 = no module/permission; anything else → generic retry.
      const status = (e as { response?: { status?: number } })?.response?.status
      const errorKey = apiErrorKey(e)
      const kind = status === 403 ? 'forbidden' : errorKey ? 'knownError' : 'error'
      setMessages((prev) => [...prev, { role: 'assistant', kind, errorKey: errorKey ?? undefined }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, model, flavor, effort, voiceMode])

  // Start over with just the welcome bubble.
  const reset = useCallback(() => setMessages([welcomeMessage()]), [])

  return {
    messages, loading, model, setModel, flavor, setFlavor, effort, setEffort,
    voiceMode, setVoiceMode, send, reset,
  }
}
