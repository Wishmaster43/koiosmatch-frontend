/**
 * useConversationAssist — state machine for the conversation composer's Koios
 * AI assist affordance (G27 / K2-CONV-ASSIST-1). Mirrors useNoteAssist's shape
 * (idle → loading → success/error, never auto-applies) but runs over the
 * thread's OWN stored messages via `id` — no text is sent from the client.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorKey, extractApiError } from '@/lib/extractApiError'
import { assistConversation } from './conversationAssistApi'
import type { ConversationAssistMode, ConversationAssistResult } from './conversationAssistApi'
import type { Id } from '@/types/common'

export type ConversationAssistTone = 'warning' | 'danger'
export type ConversationAssistStatus = 'idle' | 'loading' | 'success' | 'error'

// Expected/handled outcomes (budget exhausted, no usable actions, AI temporarily
// unconfigured) read as a calm notice; anything else (network/500) is a real
// failure — mirrors useNoteAssist's/useRichTextAssist's warning/danger split.
const CALM_STATUSES = [402, 422, 503]

// One failure → { message, tone }, adopted from useRichTextAssist (§11 one source):
// a known backend error CODE (koios_credit_exhausted/koios_unavailable) always wins
// with the shared, translated line — even on a 402/503 whose body carries no code
// yet, extractApiError's server-message/fallback path still applies untouched.
function describeFailure(
  err: unknown,
  tCommon: (key: string) => string,
  fallback: string,
): { message: string; tone: ConversationAssistTone } {
  const key = apiErrorKey(err)
  if (key) return { message: tCommon(key), tone: 'warning' }
  const httpStatus = (err as { response?: { status?: number } })?.response?.status
  return { message: extractApiError(err, fallback), tone: CALM_STATUSES.includes(httpStatus ?? 0) ? 'warning' : 'danger' }
}

export function useConversationAssist(language?: string) {
  const { t } = useTranslation('candidates')
  const { t: tCommon } = useTranslation('common')
  const [mode, setMode] = useState<ConversationAssistMode | null>(null)
  const [status, setStatus] = useState<ConversationAssistStatus>('idle')
  const [result, setResult] = useState<ConversationAssistResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [tone, setTone] = useState<ConversationAssistTone>('danger')

  // Alive guard (§9): a click can outlive the thread being collapsed/reopened —
  // never set state after unmount. Re-armed in SETUP, not only cleanup —
  // StrictMode runs setup→cleanup→setup in dev, a cleanup-only ref would stay false forever.
  const aliveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false; abortRef.current?.abort() }
  }, [])

  // Run one mode over the given conversation id. One request at a time — the
  // buttons are disabled while loading, so this never actually overlaps in
  // practice, but the abort still guards a rapid double-click.
  const run = useCallback((m: ConversationAssistMode, id: Id) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setMode(m); setStatus('loading'); setResult(null); setErrorMessage('')
    assistConversation({ id, mode: m, language }, controller.signal)
      .then(res => { if (aliveRef.current) { setResult(res); setStatus('success') } })
      .catch(err => {
        if (!aliveRef.current || err?.code === 'ERR_CANCELED') return
        const { message, tone: failTone } = describeFailure(err, tCommon, t('conversations.assist.error'))
        setTone(failTone)
        // The key ships in all five locale bundles, so it carries no defaultValue
        // of its own (§5: one source per label — never a second, drifting truth).
        setErrorMessage(message)
        setStatus('error')
      })
  }, [language, t, tCommon])

  // Discard the suggestion (or a stale error) — the section stays mounted so
  // the recruiter can try another mode right away; the composer draft is
  // left EXACTLY as it was (discard never touches it).
  const discard = useCallback(() => { setMode(null); setStatus('idle'); setResult(null); setErrorMessage('') }, [])

  return { mode, status, result, errorMessage, tone, run, discard }
}
