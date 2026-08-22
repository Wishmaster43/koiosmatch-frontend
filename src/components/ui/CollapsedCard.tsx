/**
 * CollapsedCard — the collapsed-by-default card shell for a SECONDARY section
 * whose full content is optional to look at. Born for create-modal sections
 * (Danny 03-08 A+D decision: "+ Nieuwe locatie" scrolled because six cards
 * stacked in ONE column inside the wide 1060px frame left half the width idle —
 * the fix is two-column sections + secondary cards collapsed by default,
 * mirrors the QuickViewToggle lesson: ONE shared implementation, never a
 * per-modal re-styling); adopted 22-08 by a DRAWER TAB section too
 * (MatchScoreSection — "Match score moet je kunnen openklappen en
 * dichtklappen, standaard dichtgeklapt") once the same collapsed-by-default
 * need showed up outside a modal. Renders the `cardHead` heading row as a
 * real, keyboard-operable `<button>` (aria-expanded) with a chevron and a
 * small filled/empty indicator dot (solid, not a soft-tint chip — mirrors the
 * phase-pill dot convention in AddCustomerModal, a presence indicator rather
 * than a §4 chip); the body only mounts while open, so a collapsed section
 * costs no layout or interactive footprint. Opening is client-side,
 * uncontrolled state (`defaultOpen`) — pure presentational, no business logic.
 * The body wrapper carries NO `cardBox` styling of its own — `children` owns
 * its own box (mirrors every other titled-card section in these modals, and
 * matters concretely for a child like SubEntityImportCard that already
 * applies its own cardBox WITH a dynamic drag-over override; double-wrapping
 * would nest two borders/paddings).
 *
 * `action` (optional): header-row content that must stay reachable regardless
 * of open/closed state (e.g. MatchScoreSection's quick score-override pencil +
 * recalculate trigger — moved verbatim from the retired strip cell, §3 no lost
 * affordance). Rendered as a SIBLING of the toggle button, never nested inside
 * it — a native `<button>` cannot contain another interactive `<button>`
 * (invalid HTML). Mirrors FilterGroupBlock's own header row convention
 * (components/reports/filter/FilterGroupBlock.tsx): a flex:1 disclosure toggle
 * button plus a sibling action after it.
 *
 * CONVENTION (not runtime-enforced): a REQUIRED field must NEVER live inside a
 * CollapsedCard — a recruiter must never have to expand a section to satisfy
 * validation. Only secondary/optional content belongs here.
 *
 * CONTROLLED MODE (added for KoiosRadar, Danny 22-08 "moet sluitbaar zijn"):
 * pass BOTH `open` and `onOpenChange` to let the caller own the open/closed
 * state — e.g. so it can PERSIST the choice (localStorage) instead of losing it
 * on every remount. Omitting both keeps the original uncontrolled contract
 * (this card owns its own state, seeded once by `defaultOpen`) — every existing
 * adopter is unaffected.
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
  /** Starts open when true (still a real, collapsible toggle — just not collapsed on first render). Ignored once `open` is passed (controlled mode). */
  defaultOpen?: boolean
  /** Controlled open state — pass together with `onOpenChange` to own the toggle from the caller. */
  open?: boolean
  /** Fires the NEXT open value on every toggle (controlled mode only — has no effect otherwise). */
  onOpenChange?: (open: boolean) => void
  /** Header-row actions, always visible — a sibling of the toggle button, never nested in it. */
  action?: ReactNode
  children: ReactNode
}

export default function CollapsedCard({ title, filled, defaultOpen = false, open: openProp, onOpenChange, action, children }: CollapsedCardProps) {
  // Uncontrolled open/closed state — only used when the caller does not pass
  // `open` itself (the original contract, unchanged for every existing adopter).
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  // Uncontrolled: flip our own state. Controlled: only report the next value —
  // the caller decides whether/how to apply it (e.g. after persisting it).
  const toggle = () => {
    const next = !open
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const contentId = useId()

  return (
    <div>
      {/* Heading row: the toggle button carries the marginBottom that used to sit
          on the button itself, so an `action` sibling lines up on the same
          baseline instead of trailing 3px lower. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: cardHead.marginBottom }}>
        {/* The whole label IS the toggle — real button, aria-expanded carries
            the state to assistive tech (no extra text needed beyond the title).
            Accordion disclosure header — flex-grows over variable chevron+dot+
            title content, so it needs custom flex:1/padding:0/textAlign:left
            that Button's fixed sm/md footprint does not model (structural role,
            mirrors FilterGroupBlock's own disclosure-header exemption,
            components/reports/filter/FilterGroupBlock.tsx). Block form: the
            style spans several lines and the presence dot below carries its
            own reasoned ternary fill in the same block. */}
        {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
        {/* aria-controls only while the body exists — a collapsed card renders no
            content element, and a dangling id reference is an a11y smell (§6). */}
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={open ? contentId : undefined}
          style={{ ...cardHead, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
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
        {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
        {action}
      </div>
      {/* Body only mounts while open — a collapsed section renders nothing else.
          No cardBox here on purpose (see file header): children bring their own box. */}
      {open && <div id={contentId}>{children}</div>}
    </div>
  )
}
