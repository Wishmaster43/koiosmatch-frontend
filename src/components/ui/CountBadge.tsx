/**
 * CountBadge — the ONE inverted count badge beside a filter trigger or panel
 * header. Herhaal-audit r4 found THREE hand-painted copies disagreeing on the
 * pair: two used raw --color-primary/--color-on-accent (outside the trio), one
 * inverted onto --button-ink with a DARK ink (2.52:1 — WCAG fail). The inverse
 * of the button trio swaps fill and ink: bg = --button-ink, text = --button-fill
 * — never a third token as ink.
 */
import type { CSSProperties } from 'react'

// The one inverted count badge (button-trio colours swapped); callers decide whether to render it at all for a zero count.
export default function CountBadge({ count, style }: { count: number; style?: CSSProperties }) {
  return (
    <span style={{ background: 'var(--button-ink)', color: 'var(--button-fill)',
      borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0, ...style }}>
      {count}
    </span>
  )
}
