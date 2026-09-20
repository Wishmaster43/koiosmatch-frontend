/**
 * waMarkup — WA-COMPOSER-1: renders WhatsApp's own plain-text markup
 * (*bold*, _italic_, ~strikethrough~) as React elements. The API stores raw
 * text; this never parses HTML and never uses dangerouslySetInnerHTML (§7) —
 * it is a small regex-driven span splitter over one line at a time.
 */
import type { ReactNode } from 'react'

// One marker → the element it renders as. Order matters: matched left to right.
const MARKERS: { char: string; render: (children: ReactNode, key: string) => ReactNode }[] = [
  { char: '*', render: (c, k) => <strong key={k}>{c}</strong> },
  { char: '_', render: (c, k) => <em key={k}>{c}</em> },
  { char: '~', render: (c, k) => <s key={k}>{c}</s> },
]

// Renders one line's worth of markup: finds the first marker that has a matching
// closing marker later on the SAME line, wraps the span between them, and
// recurses on both sides so multiple non-nested spans all render. An unmatched
// or empty marker pair (e.g. a lone `*` or `snake_case`'s `_`) is left literal.
function renderLine(line: string, keyPrefix: string): ReactNode[] {
  for (const { char, render } of MARKERS) {
    const start = line.indexOf(char)
    if (start === -1) continue
    const end = line.indexOf(char, start + 1)
    // Require a non-empty span so `**` (empty) stays literal rather than vanishing.
    if (end === -1 || end === start + 1) continue
    const before = line.slice(0, start)
    const inner = line.slice(start + 1, end)
    const after = line.slice(end + 1)
    return [
      ...renderLine(before, `${keyPrefix}-b`),
      render(renderLine(inner, `${keyPrefix}-i`), `${keyPrefix}-m`),
      ...renderLine(after, `${keyPrefix}-a`),
    ]
  }
  return line ? [line] : []
}

// Public entry: splits on newlines (a span never crosses a line, per the brief)
// and joins the lines back with <br/> so callers can still render plain text
// with `whiteSpace: 'pre-wrap'` if they prefer — either works, this returns nodes.
export function renderWaMarkup(text: string): ReactNode[] {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`br-${i}`} />)
    out.push(...renderLine(line, `l${i}`))
  })
  return out
}
