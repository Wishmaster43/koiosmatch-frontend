/**
 * noteAssistApi — thin re-export of the shared rich-text assist API (§11 one
 * source, CMFE-KOIOS-CONSISTENCY-1 Danny 09-08). The note composer and the
 * shared RichTextAssistBar hit the exact same POST /ai/koios/notes/assist
 * contract now (all three modes) — this file keeps the note domain's existing
 * `AssistMode` / `AssistActionType` / `AssistActionItem` / `AssistResult` /
 * `assistNote` / `ACTION_TYPE_LABEL_NL` names stable for its own importers
 * (NoteAssistSection, noteAssistApply, their tests) without a second
 * implementation living behind them.
 */
export { assistRichText as assistNote, ACTION_TYPE_LABEL_NL } from '@/components/ui/richtext/richTextAssistApi'
export type {
  RichTextAssistMode as AssistMode,
  RichTextAssistCombinedMode as AssistCombinedMode,
  RichTextAssistActionType as AssistActionType,
  RichTextAssistActionItem as AssistActionItem,
  RichTextAssistKnownItem as AssistKnownItem,
  RichTextAssistResult as AssistResult,
} from '@/components/ui/richtext/richTextAssistApi'
