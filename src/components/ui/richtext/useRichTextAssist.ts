/**
 * useRichTextAssist — the state machine behind RichTextAssistBar AND (since
 * CMFE-KOIOS-CONSISTENCY-1, Danny 09-08) the note composer's assist section:
 * idle → loading → success/error, one mode at a time, and the result stays a
 * REVIEW-ONLY suggestion until the caller explicitly applies it. This is the
 * ONE implementation (§11) — notes/useNoteAssist.ts re-exports this hook
 * rather than keeping a second copy; both surfaces hit the exact same
 * endpoint with the exact same three-mode contract. Uses the shared
 * useAssistState (DRY-8 unit 3) for the state machine itself.
 *
 * KOIOS-GENERATE-1 (Danny 09-08): `runGenerate` adds a FOURTH action sharing this
 * same status/result/apply/discard state — it hits the differently-shaped POST
 * /ai/koios/generate (entity+id, not text+mode) but lands in the exact same
 * review-then-Overnemen preview, so the caller never needs a second UI branch.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAssistState } from '@/hooks/useAssistRequest'
import { assistRichText, generateEntityText } from './richTextAssistApi'
import type { GenerateEntity, RichTextAssistCombinedMode, RichTextAssistKnownItem, RichTextAssistMode, RichTextAssistResult } from './richTextAssistApi'

// The bar tracks which control is active/loading — the three text modes, the
// two combined modes (ASSIST-SIDEPANEEL-1), plus 'generate', which runs a
export type RichTextAssistActiveMode = RichTextAssistMode | RichTextAssistCombinedMode | 'generate'

// See the file's top doc above for the shared assist state machine; language is used to translate the assist result.
export function useRichTextAssist(language?: string) {
  const { t } = useTranslation('common')
  const { mode, status, result, errorMessage, tone, startLoading, succeed, fail, discard } = useAssistState<RichTextAssistResult, RichTextAssistActiveMode>({
    t,
    fallback: t('notesAssist.error'),
  })

  // Run one mode over the given html. Empty text is a silent no-op, mirroring
  // the button's own disabled state, so this never fires a guaranteed-422 call.
  // One request at a time — the buttons disable while loading, but the shared
  // hook's abort still guards a rapid double-invoke.
  const run = useCallback((m: RichTextAssistMode | RichTextAssistCombinedMode, html: string, knownItems?: RichTextAssistKnownItem[]) => {
    if (!html.trim()) return
    const signal = startLoading(m)
    assistRichText({ text: html, language, mode: m, knownItems }, signal)
      .then(res => succeed(res))
      .catch(err => fail(err))
  }, [language, startLoading, succeed, fail])

  // Generate a fresh suggestion FROM the entity's own data (KOIOS-GENERATE-1) —
  // no text/empty-field guard (unlike run() above): a blank profile is exactly
  // the case this is for. Same abort-and-replace + review-only landing as run().
  const runGenerate = useCallback((entity: GenerateEntity, id: string) => {
    const signal = startLoading('generate')
    generateEntityText({ entity, id }, signal)
      .then(res => succeed(res))
      .catch(err => fail(err))
  }, [startLoading, succeed, fail])

  return { mode, status, result, errorMessage, tone, run, runGenerate, discard }
}
