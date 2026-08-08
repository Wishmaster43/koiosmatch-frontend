/**
 * noteAssistApply — thin re-export of the shared rich-text apply transforms
 * (§11 one source, CMFE-KOIOS-CONSISTENCY-1 Danny 09-08). The escaper,
 * actions→HTML list and per-mode replace/append logic now live in
 * components/ui/richtext/richTextAssistApply — this module only keeps the
 * note domain's existing `applyAssistResult` / `escapeHtml` names stable for
 * its own importers (NoteAssistSection and this file's own test).
 */
export { applyRichTextAssist as applyAssistResult, escapeHtml } from '@/components/ui/richtext/richTextAssistApply'
