/**
 * CollapsedCard — the collapsed-by-default card shell for SECONDARY create-modal
 * sections (Danny 03-08 A+D decision: "+ Nieuwe locatie" scrolled because six
 * cards stacked in ONE column inside the wide 1060px frame left half the width
 * idle — the fix is two-column sections + secondary cards collapsed by default,
 * mirrors the QuickViewToggle lesson: ONE shared implementation, never a
 * per-modal re-styling). Renders the `cardHead` heading row as a real, keyboard-
 * operable `<button>` (aria-expanded) with a chevron and a small filled/empty
 * indicator dot (solid, not a soft-tint chip — mirrors the phase-pill dot
 * convention in AddCustomerModal, a presence indicator rather than a §4 chip);
 * the body only mounts while open, so a collapsed section costs no layout or
 * interactive footprint. Opening is client-side, uncontrolled state
 * (`defaultOpen`) — pure presentational, no business logic. The body wrapper
 * carries NO `cardBox` styling of its own — `children` owns its own box (mirrors
 * every other titled-card section in these modals, and matters concretely for a
 * child like SubEntityImportCard that already applies its own cardBox WITH a
 * dynamic drag-over override; double-wrapping would nest two borders/paddings).
 *
 * CONVENTION (not runtime-enforced): a REQUIRED field must NEVER live inside a
 * CollapsedCard — a recruiter must never have to expand a section to satisfy
 * validation. Only secondary/optional content belongs here.
 */
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cardHead } from './modalCards'

export interface CollapsedCardProps {
  /** Heading shown in the always-visible header row — already translated by the caller. */
  title: ReactNode
  /** Whether this section currently carries a value — drives the indicator dot's tint. */
  filled: boolean
  /** Starts open when true (still a real, collapsible toggle — just not collapsed on first render). */
  defaultOpen?: boolean
  children: ReactNode
}

export default function CollapsedCard({ title, filled, defaultOpen = false, children }: CollapsedCardProps) {
  // Uncontrolled open/closed state — this card owns it, no parent wiring needed.
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div>
      {/* The whole heading row IS the toggle — real button, aria-expanded carries
          the state to assistive tech (no extra text needed beyond the title). */}
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={contentId}
        style={{ ...cardHead, display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <ChevronRight size={12} aria-hidden="true"
          style={{ flexShrink: 0, transition: 'transform var(--motion-fast)', transform: open ? 'rotate(90deg)' : 'none' }} />
        {/* Presence dot — solid, not a soft-tint chip (§4 governs chips/pills that
            carry TEXT; this is a bare status dot, same idiom as the phase pills'
            own solid colour dot). Muted/empty when nothing was entered yet. */}
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: filled ? 'var(--color-primary)' : 'var(--text-muted)', opacity: filled ? 1 : 0.5 }} />
        <span>{title}</span>
      </button>
      {/* Body only mounts while open — a collapsed section renders nothing else.
          No cardBox here on purpose (see file header): children bring their own box. */}
      {open && <div id={contentId}>{children}</div>}
    </div>
  )
}
