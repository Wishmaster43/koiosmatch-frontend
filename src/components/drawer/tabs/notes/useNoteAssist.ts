/**
 * useNoteAssist — thin re-export of the shared useRichTextAssist hook (§11 one
 * source, CMFE-KOIOS-CONSISTENCY-1 Danny 09-08). Kept as its own module only so
 * NoteAssistSection's existing import stays stable; the state machine itself
 * now lives in components/ui/richtext (identical improve/summarize/actions
 * contract for every rich-text field, not a note-only copy).
 */
export { useRichTextAssist as useNoteAssist } from '@/components/ui/richtext/useRichTextAssist'
