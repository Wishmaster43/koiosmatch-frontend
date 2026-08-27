/**
 * koiosMarkdown — converts the assistant's basic markdown (bold, numbered and
 * bulleted lists, line breaks) to safe HTML for the chat bubble. Deliberately
 * minimal (no headings/links/tables): Koios replies are short chat prose, not
 * rich documents, and this is rendered through SafeHtml's DOMPurify pass (§7)
 * so there is no dangerouslySetInnerHTML without sanitization anywhere in the
 * chain. HTML-escape FIRST, then apply markdown, so raw user/model text can
 * never smuggle a tag through before sanitization even runs.
 */

// Escapes the five HTML-special characters so markdown syntax is applied to plain text only.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Wraps consecutive bullet/numbered lines into one <ul>/<ol>, leaving other lines untouched.
function wrapLists(lines: string[]): string[] {
  const out: string[] = []
  let listItems: string[] = []
  let listTag: 'ul' | 'ol' | null = null

  const flush = () => {
    if (listTag && listItems.length > 0) out.push(`<${listTag}>${listItems.join('')}</${listTag}>`)
    listItems = []
    listTag = null
  }

  for (const line of lines) {
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol'
      if (listTag && listTag !== tag) flush()
      listTag = tag
      listItems.push(`<li>${(bullet ?? numbered)![1]}</li>`)
    } else {
      flush()
      out.push(line)
    }
  }
  flush()
  return out
}

// Converts the assistant's basic markdown to sanitizer-ready HTML: bold, bulleted/numbered lists, line breaks.
export function koiosMarkdownToHtml(text: string): string {
  const escaped = escapeHtml(text)
  // Bold after escaping — ** delimiters survive escaping untouched.
  const bolded = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const lines = wrapLists(bolded.split('\n'))
  // A <ul>/<ol> block already carries its own layout; only plain lines get a <br/> between them.
  return lines
    .map((line, i) => {
      const isList = /^<(ul|ol)>/.test(line)
      const prevIsList = i > 0 && /^<(ul|ol)>/.test(lines[i - 1])
      if (isList || i === 0 || prevIsList) return line
      return `<br/>${line}`
    })
    .join('')
}
