/**
 * noteAssistApply — turns an assist RESULT into the note body's next HTML value
 * (NOTE-ASSIST-1). The model replies with plain prose (improve/summarize) or a
 * structured item list (actions) — never HTML — so this is the one place that
 * escapes it into safe markup before it ever reaches the TipTap editor (never
 * inserted as raw/unsanitized HTML, §7).
 */
import type { AssistActionItem, AssistMode, AssistResult } from './noteAssistApi'

// Escape the handful of characters that would otherwise be parsed as markup.
// Exported (§11 one source): the dictation mic (NOTITIE-VOICE-1) reuses this to
// safely insert recognized speech into the note's HTML body — never a second
// hand-copied escaper.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Plain prose → one <p> per non-empty line/paragraph.
function textToHtml(text: string): string {
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`).join('')
}

// Action items → a bullet list: title (bold) + type/due-date meta, one <li> each.
function actionsToHtml(items: AssistActionItem[], typeLabel: (type: string) => string): string {
  const rows = items.map(it => {
    const meta = [typeLabel(it.type), it.due_date].filter(Boolean).join(' · ')
    return `<li><strong>${escapeHtml(it.title)}</strong>${meta ? ` (${escapeHtml(meta)})` : ''}</li>`
  }).join('')
  return `<ul>${rows}</ul>`
}

/**
 * The note body AFTER "Overnemen": improve REPLACES the whole body (a rewrite of
 * the same text, per mode); summarize/actions APPEND below the existing body —
 * never a silent overwrite of what the recruiter already wrote (Danny's explicit
 * "nooit auto-overschrijven"). `typeLabel` translates an action-item's `type`
 * enum into display text — the caller owns i18n (this file stays pure/testable).
 */
export function applyAssistResult(currentBody: string, mode: AssistMode, result: AssistResult, typeLabel: (type: string) => string): string {
  if (result.kind === 'text') {
    const html = textToHtml(result.text)
    return mode === 'improve' ? html : `${currentBody}${html}`
  }
  return `${currentBody}${actionsToHtml(result.items, typeLabel)}`
}
