/**
 * richTextAssistApply — the pure text↔HTML transforms behind the Koios
 * affordances that ride on EVERY rich-text field (RichTextAssistBar) AND,
 * since CMFE-KOIOS-CONSISTENCY-1 (Danny 09-08), the note composer
 * (notes/noteAssistApply.ts re-exports from here, §11 one source — a second
 * copy of any of these functions is a finding, not progress).
 *
 * The model NEVER returns HTML — it returns plain prose, or a structured
 * action-item list — so this is the one place that escapes it into safe
 * markup before it reaches the TipTap editor (never inserted as raw/unsanitised
 * HTML, §7). The same escaper handles dictated speech, which is equally
 * untrusted input.
 */
import type { RichTextAssistActionItem, RichTextAssistMode, RichTextAssistResult } from './richTextAssistApi'

// Escape the handful of characters that would otherwise be parsed as markup.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Plain prose → one <p> per non-empty line/paragraph.
export function textToHtml(text: string): string {
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`).join('')
}

// Does the field carry any real prose yet? Tag-stripped, so '<p></p>' reads as
// empty — the honest gate for "there is nothing to improve/summarise".
export function hasPlainText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

// Action items → a bullet list: title (bold) + type/due-date meta, one <li> each.
function actionsToHtml(items: RichTextAssistActionItem[], typeLabel: (type: string) => string): string {
  const rows = items.map(it => {
    const meta = [typeLabel(it.type), it.due_date].filter(Boolean).join(' · ')
    return `<li><strong>${escapeHtml(it.title)}</strong>${meta ? ` (${escapeHtml(meta)})` : ''}</li>`
  }).join('')
  return `<ul>${rows}</ul>`
}

/**
 * The field's value AFTER "Overnemen": 'improve' REPLACES the whole value (it
 * is a rewrite of that same text), 'summarize'/'actions'/'generate' APPEND
 * below it — never a silent overwrite of what the user already wrote (Danny's
 * explicit "nooit auto-overschrijven"; 'generate' especially, since it is not
 * even a rewrite OF the current text). `typeLabel` translates an action-item's
 * `type` enum into display text — the caller owns i18n (this file stays
 * pure/testable).
 */
export function applyRichTextAssist(currentHtml: string, mode: RichTextAssistMode | 'generate', result: RichTextAssistResult, typeLabel: (type: string) => string): string {
  if (result.kind === 'text') {
    const html = textToHtml(result.text)
    return mode === 'improve' ? html : `${currentHtml}${html}`
  }
  return `${currentHtml}${actionsToHtml(result.items, typeLabel)}`
}

/**
 * Append one recognised dictation chunk to the field's HTML. Dictated sentences
 * CONTINUE the last paragraph instead of each starting a new one (Danny 08-08:
 * dictation used to read as a column of fragments); a still-empty field starts
 * its first paragraph. Byte-for-byte the note composer's original behaviour —
 * moved here so every field dictates identically.
 */
export function appendDictatedText(currentHtml: string, chunk: string): string {
  const safe = escapeHtml(chunk)
  if (!currentHtml || currentHtml === '<p></p>') return `<p>${safe}</p>`
  return currentHtml.endsWith('</p>')
    ? `${currentHtml.slice(0, -4)} ${safe}</p>`
    : `${currentHtml}<p>${safe}</p>`
}
