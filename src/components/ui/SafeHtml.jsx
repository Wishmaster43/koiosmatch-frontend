/**
 * SafeHtml — render user-authored rich text WITHOUT opening an XSS hole.
 *
 * Notes are written in the Tiptap editor and stored as HTML. Rendering that HTML
 * straight through `dangerouslySetInnerHTML` would let a crafted note (or a
 * tampered API response) inject <script>/onerror/etc. DOMPurify strips anything
 * that is not safe formatting markup before it ever touches the DOM.
 */
import DOMPurify from 'dompurify'

export default function SafeHtml({ html, style, className }) {
  const clean = DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } })
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: clean }} />
}
