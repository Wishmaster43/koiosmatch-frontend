/**
 * DropdownPopover — the shared portal shell every house picker (CreatableSelect,
 * SelectMenu, SearchSelect) renders its menu through (DRY round 11, UIATOMS):
 * `createPortal` into `document.body` (escaping every overflow ancestor — see
 * useDropdownPlacement's own doc comment), carrying the `DROPDOWN_PORTAL_ATTR`
 * marker so a host with its own outside-click-close can recognise a click
 * inside the portal. The caller still builds its OWN `style` object and
 * `children` verbatim — measured this round, the three menu shells genuinely
 * differ (radius, max-width/alignment, sticky vs separately scrolling list) —
 * so this component only removes the repeated portal/attribute boilerplate,
 * never the shell itself (DRY round 11 rule B: a shared unit carries the
 * consumers' differences as props).
 *
 * PERF (r11 v2 fix): this component does NOT gate on `open` itself — the
 * caller wraps it in `{open && <DropdownPopover …>…</DropdownPopover>}`
 * exactly like the `{open && createPortal(...)}` it replaces, so a CLOSED
 * picker never even builds its option-list children (measured +8% on closed
 * pickers when this component short-circuited internally instead).
 */
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { DROPDOWN_PORTAL_ATTR } from '@/lib/useDropdownPlacement'

interface DropdownPopoverProps {
  menuRef: RefObject<HTMLDivElement | null>
  style: CSSProperties
  // SelectMenu's checklist carries its id on the portal root itself (the
  // trigger's aria-controls points at it); CreatableSelect/SearchSelect leave
  // this unset and put an id on an inner list element instead.
  id?: string
  children: ReactNode
}

// Renders the picker's own menu content through the shared portal shell — the
// caller only mounts this while open (see the PERF note above).
export default function DropdownPopover({ menuRef, style, id, children }: DropdownPopoverProps) {
  return createPortal(
    <div ref={menuRef} id={id} {...{ [DROPDOWN_PORTAL_ATTR]: '' }} style={style}>
      {children}
    </div>,
    document.body,
  )
}
