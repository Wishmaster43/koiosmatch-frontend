/**
 * useConversationAssist — state machine for the conversation composer's Koios
 * AI assist affordance (G27 / K2-CONV-ASSIST-1). Mirrors useNoteAssist's shape
 * (idle → loading → success/error, never auto-applies) but runs over the
 * thread's OWN stored messages via `id` — no text is sent from the client.
 * Uses the shared useAssistState (DRY-8 unit 3) for the state machine itself.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAssistState } from '@/hooks/useAssistRequest'
import { assistConversation } from './conversationAssistApi'
import type { ConversationAssistMode, ConversationAssistResult } from './conversationAssistApi'
import type { Id } from '@/types/common'


// See the file's top doc above for the state machine this hook drives; language is used to translate the assist result.
export function useConversationAssist(language?: string) {
  const { t } = useTranslation('candidates')
  const { t: tCommon } = useTranslation('common')
  const { mode, status, result, errorMessage, tone, startLoading, succeed, fail, discard } = useAssistState<ConversationAssistResult, ConversationAssistMode>({
    t: tCommon,
    fallback: t('conversations.assist.error'),
  })

  // Run one mode over the given conversation id. One request at a time — the
  // buttons are disabled while loading, so this never actually overlaps in
  // practice, but the shared hook's abort still guards a rapid double-click.
  const run = useCallback((m: ConversationAssistMode, id: Id) => {
    const signal = startLoading(m)
    assistConversation({ id, mode: m, language }, signal)
      .then(res => succeed(res))
      .catch(err => fail(err))
  }, [language, startLoading, succeed, fail])

  return { mode, status, result, errorMessage, tone, run, discard }
}
