/**
 * sanitizeHtml — the ONE allow-list for user-authored rich text (ONIX M-002, FE half; the
 * BE applies the same element list on every HTML-capable write path, M002-INTAKE-1).
 * Our editor (RichTextEditor: Tiptap StarterKit + TextAlign) can only produce these
 * elements, so anything else in stored HTML is legacy noise or an attack: a <form> styled
 * as a login screen, a <style> block that covers the app, a class that borrows our own
 * CSS, a data-* hook. The list IS the editor's output — paragraphs, headings, inline
 * marks, code, quotes, lists, links, line and horizontal rules — and `style` survives
 * ONLY as text-align with the four values the TextAlign extension writes. The renderer
 * (SafeHtml) and the editor's raw-HTML source mode both run through this function, so
 * what a user can type and what a screen can show never drift apart. A removed element
 * keeps its text (DOMPurify KEEP_CONTENT), so legacy <div>/<span>/<table> prose still
 * reads, only its chrome goes.
 */
import DOMPurify from 'dompurify'

// Exactly the elements Tiptap StarterKit + TextAlign emit (plus the b/i/strike legacy
// spellings of the same marks, which older stored notes may carry).
export const ALLOWED_HTML_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 's', 'strike', 'u', 'code', 'pre',
  'blockquote', 'ul', 'ol', 'li', 'a', 'br', 'hr',
] as const

// href/target/rel for links, style for text-align — nothing else (no class, no id, no data-*).
export const ALLOWED_HTML_ATTRS = ['href', 'style', 'target', 'rel'] as const

// A link may only point at a web page or a mail address; relative, javascript:, data: and
// every other scheme is dropped (the href goes, the link text stays).
const SAFE_HREF = /^(?:https?:|mailto:)/i

// The four alignments TextAlign writes — the only CSS a note may carry.
const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify'])

// Keeps the text-align declaration out of a style attribute, drops everything else in it
// (position/background/opacity are exactly how a note covers the app); null = no style left.
function textAlignOnly(style: string): string | null {
  for (const decl of style.split(';')) {
    const [prop, ...rest] = decl.split(':')
    if (prop && prop.trim().toLowerCase() === 'text-align') {
      const value = rest.join(':').trim().toLowerCase()
      if (TEXT_ALIGN_VALUES.has(value)) return `text-align: ${value}`
    }
  }
  return null
}

// DOMPurify hooks are instance-global; install them once, before the first sanitize.
let hooksInstalled = false
function installHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') {
      const kept = textAlignOnly(data.attrValue)
      if (kept) data.attrValue = kept
      else data.keepAttr = false
    } else if (data.attrName === 'target' && data.attrValue !== '_blank') {
      data.keepAttr = false
    }
  })
  // Every surviving link opens safely (§7 rel="noopener noreferrer") and only to a safe scheme.
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName !== 'A') return
    const href = node.getAttribute('href')
    if (href && !SAFE_HREF.test(href.trim())) node.removeAttribute('href')
    if (node.hasAttribute('href')) node.setAttribute('rel', 'noopener noreferrer')
    else { node.removeAttribute('rel'); node.removeAttribute('target') }
  })
}

// Sanitises one HTML string to the allow-list above; null/undefined render as empty.
export function sanitizeHtml(html: string | null | undefined): string {
  installHooks()
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: [...ALLOWED_HTML_TAGS],
    ALLOWED_ATTR: [...ALLOWED_HTML_ATTRS],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SAFE_HREF,
    // DOMPurify runs every non-URI-safe attribute VALUE through ALLOWED_URI_REGEXP; target
    // and rel carry keywords, not URLs, so they are declared URI-safe (the hooks above
    // still pin them to _blank / noopener noreferrer).
    ADD_URI_SAFE_ATTR: ['target', 'rel'],
  })
}
