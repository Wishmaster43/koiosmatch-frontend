/**
 * SafeHtml — render user-authored rich text WITHOUT opening an XSS hole.
 *
 * Notes are written in the Tiptap editor and stored as HTML. Rendering that HTML
 * straight through `dangerouslySetInnerHTML` would let a crafted note (or a
 * tampered API response) inject <script>/onerror/etc. — or, ONIX M-002, paint a
 * fake login form over the app with <form>/<input>/<style>/class. lib/sanitizeHtml
 * (the editor's own allow-list) strips everything that is not our formatting
 * markup before it ever touches the DOM.
 */
import type { CSSProperties } from 'react'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

interface SafeHtmlProps {
  html?: string | null
  style?: CSSProperties
  className?: string
}

// Renders rich-text HTML after the allow-list sanitiser (§7: the one sanctioned dangerouslySetInnerHTML use, see the module doc comment above).
export default function SafeHtml({ html, style, className }: SafeHtmlProps) {
  const clean = sanitizeHtml(html)
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: clean }} />
}
