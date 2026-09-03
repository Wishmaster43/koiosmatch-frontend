/**
 * activatableCardProps — keyboard operability for click-to-open cards (WCAG 2.2 AA, §6;
 * audit a11y-2). A kanban card is a div with onClick and draggable; without these props
 * it is invisible to the keyboard. Spread the result on the card's root element: it makes
 * the card focusable, names it, and lets Enter/Space trigger the same activation as a
 * click. The visible focus ring comes from the global :focus-visible rule on [tabindex].
 */
import type { KeyboardEvent } from 'react'

export function activatableCardProps(onActivate: () => void, label: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    // Enter and Space activate like a click; other keys pass through untouched.
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() }
    },
  }
}
