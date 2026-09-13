/**
 * DrawerPanelShell — the shared backdrop + role="dialog" panel wrapper behind
 * every right-hand drawer (RightDrawer, DrillDownDrawer, …). Fixes only the DOM
 * shape (backdrop first so the panel stacks on top within the same rung, plus
 * the dialog a11y attributes/focus-trap ref) — each caller keeps its own header,
 * width and body content as children.
 */
import type { ReactNode, RefObject, CSSProperties } from 'react'
import DrawerBackdrop from './DrawerBackdrop'

export default function DrawerPanelShell({ panelRef, ariaLabel, className, style, onClose, children }: {
  panelRef: RefObject<HTMLDivElement | null>
  ariaLabel?: string
  className: string
  style: CSSProperties
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      {/* Backdrop + panel both live on the drawer rung; the panel renders after
          the backdrop, so DOM order stacks it on top within the rung. */}
      <DrawerBackdrop onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1}
        className={className} style={style}>
        {children}
      </div>
    </>
  )
}
