/**
 * TableScrollFrame — gives a long table a BOUNDED height instead of letting it
 * push the page down without limit (Danny 17-08 over het verbruikscherm: "hoe
 * lang wordt dit dan wel niet"). Every row stays in the DOM and stays reachable:
 * this frame never truncates to a top-N, because a shortened list that does not
 * say so reads as "this is all there is". It only scrolls, and the footer spells
 * out how big the list actually is so the reader knows without scrolling to find
 * out. Pair with DataTable's `stickyHeader` so the column headers stay in view.
 */
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  // Accessible name for the scroll region — required, because a scrollable box
  // is keyboard-focusable here (WCAG 2.1.1) and an unnamed focus stop is a trap
  // for a screen-reader user.
  label: string
  // Max visible height of the scroll area; a shorter table just shrinks to fit.
  maxHeight?: number
  // Honest size/total statement under the rows. Omitted ⇒ no footer bar.
  footer?: ReactNode
}

export default function TableScrollFrame({ children, label, maxHeight = 340, footer }: Props) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div role="region" aria-label={label} tabIndex={0}
        style={{ maxHeight, overflow: 'auto' }}>
        {children}
      </div>
      {footer != null && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}
