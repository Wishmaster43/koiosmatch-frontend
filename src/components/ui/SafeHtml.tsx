import type { CSSProperties } from 'react'
import DOMPurify from 'dompurify'

/**
 * SafeHtml — render user-authored rich text WITHOUT opening an XSS hole.
 *
 * Notes are written in the Tiptap editor and stored as HTML. Rendering that HTML
 * straight through `dangerouslySetInnerHTML` would let a crafted note (or a
 * tampered API response) inject <script>/onerror/etc. DOMPurify strips anything
 * that is not safe formatting markup before it ever touches the DOM.
 */
interface SafeHtmlProps {
  html?: string | null
  style?: CSSProperties
  className?: string
}

export default function SafeHtml({ html, style, className }: SafeHtmlProps) {
  const clean = DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } })
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: clean }} />
}
