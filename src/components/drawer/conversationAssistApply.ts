/**
 * conversationAssistApply — turns a conversation assist RESULT into the plain
 * DRAFT TEXT for the session composer's single-line input (G27). Mirrors
 * noteAssistApply.ts's shape, but the apply target is plain text, not HTML:
 * there is no rich editor here to escape into, so summarize collapses to one
 * line and actions join into one "; "-separated line instead of a <ul>.
 */
import type { ConversationAssistActionItem, ConversationAssistResult } from './conversationAssistApi'

// Collapse any internal newlines/whitespace — the composer is a single-line input.
function toSingleLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

// One "; "-joined line: title + type/due-date meta in parentheses, per item.
function actionsToDraftText(items: ConversationAssistActionItem[], typeLabel: (type: string) => string): string {
  return items.map(it => {
    const meta = [typeLabel(it.type), it.due_date].filter(Boolean).join(' · ')
    return meta ? `${it.title} (${meta})` : it.title
  }).join('; ')
}

/**
 * The composer draft text AFTER "Overnemen" — always REPLACES whatever was
 * already typed (unlike the note body, there is no existing thread reply to
 * append to). `typeLabel` translates an action-item's `type` enum into
 * display text — the caller owns i18n (this file stays pure/testable).
 */
export function formatAssistResultForDraft(result: ConversationAssistResult, typeLabel: (type: string) => string): string {
  return result.kind === 'text' ? toSingleLine(result.text) : actionsToDraftText(result.items, typeLabel)
}
