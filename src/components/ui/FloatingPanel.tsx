/**
 * FloatingPanel (POPUP-SLEEP-1, Danny GO 06-08 "alle popups sleepbaar") — the ONE
 * shared draggable/resizable dialog shell every popup migrates onto. Keeps the
 * exact house modal semantics (overlay, backdrop-click closes, useFocusTrap for
 * Esc/tab/focus-restore, token colours) and adds: drag by header, SE-corner
 * resize, per-window position/size memory, double-click-header reset, and
 * bring-to-front stacking via the shared zIndexScale. Mounted only while `open`
 * (useFocusTrap needs a fresh mount — house rule, mirrors ConfirmDialog).
 *
 * MODELESS MODE (`overlay={false}`, Danny punt 19): a record-history/reference
 * popup exists exactly SO you can read the screen underneath while it stays open —
 * a dimming backdrop would defeat that. Modeless renders the same window without
 * the scrim and lets pointer events pass through everywhere except the panel; the
 * caller keeps its own outside-click rule. Escape/tab behaviour is unchanged.
 */
import { type CSSProperties, type ReactNode, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useDraggablePanel } from '@/hooks/useDraggablePanel'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { nextFloatingZ } from '@/lib/zIndexScale'

export interface FloatingPanelProps {
  open: boolean
  onClose: () => void
  /** Accessible name; falls back to `title`. */
  ariaLabel?: string
  /** Simple header text — or pass a bespoke `header` node instead. */
  title?: string
  /** Bespoke header content (rendered INSIDE the drag handle, before the X). */
  header?: ReactNode
  children: ReactNode
  /** Panel width before any user resize (defaults follow the old modal sizes). */
  width?: number | string
  maxWidth?: string
  /** Remember position/size under this key (omit = always opens centered). */
  persistKey?: string
  resizable?: boolean
  /** Stack above the normal modal band (e.g. a dialog opened from a dialog). */
  zIndex?: number
  /** Extra style on the panel body wrapper (padding etc.). */
  bodyStyle?: CSSProperties
  /** Hide the built-in close X (when the bespoke header has its own). */
  hideClose?: boolean
  /**
   * true (default): the body wrapper scrolls. false: the children own their layout
   * (flex column) — for migrated modals with their own scroll area + pinned footer.
   */
  scrollBody?: boolean
  /**
   * NOTITIE-POPOUT-1 F5: when supplied, renders one extra header icon button that
   * opens this panel's content as a REAL second browser window (Trap B — a
   * draggable in-window panel can never reach a second monitor). Omitted (every
   * panel today) → no button at all, zero behaviour change. The panel itself never
   * decides WHAT opens; the caller wires the actual `window.open` (see lib/secondScreen.ts).
   */
  onPopOut?: () => void
  /**
   * false = modeless: no dim scrim, the page underneath stays visible AND clickable
   * (the point of a draggable reference window). Default true = the classic modal.
   */
  overlay?: boolean
}

function Panel({ onClose, ariaLabel, title, header, children, width, maxWidth, persistKey, resizable, zIndex, bodyStyle, hideClose, scrollBody = true, onPopOut, overlay = true }: Omit<FloatingPanelProps, 'open'>) {
  const { t } = useTranslation('common')
  const panelTrapRef = useFocusTrap<HTMLDivElement>(onClose)
  const { panelRef, placement, dragging, onDragPointerDown, onResizePointerDown, onDragHandleDoubleClick } = useDraggablePanel(persistKey, resizable !== false)
  // See the ref comment below: stable merged ref, or the trap re-arms per render.
  const mergedPanelRef = useCallback((node: HTMLDivElement | null) => {
    panelTrapRef.current = node
    panelRef.current = node
    // eslint-disable-next-line react-hooks/exhaustive-deps -- both targets are stable ref objects
  }, [])
  const reducedMotion = usePrefersReducedMotion()
  // Claim a fresh slot in the floating band once per mount; pointerdown re-claims
  // so the last-touched window wins (multi-window ready, harmless for one).
  const [z, setZ] = useState(() => zIndex ?? nextFloatingZ())

  // Before any drag: CSS-centered exactly like every modal today. After: absolute.
  const positioned: CSSProperties = placement
    ? { position: 'fixed', left: placement.x, top: placement.y, ...(placement.w ? { width: placement.w } : { width }), ...(placement.h ? { height: placement.h } : {}) }
    : { position: 'relative', width }

  return (
    // HUISSTIJL-1: `z` is a dynamic bring-to-front counter for stacking MULTIPLE open
    // floating panels among each other (internal ordering, not a static role) — kept
    // as-is; its base band lives in lib/zIndexScale.ts, out of scope for this batch.
    <div style={{ position: 'fixed', inset: 0, zIndex: z, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      // Modeless: no scrim and clicks fall through to the page behind it.
      background: overlay ? 'rgba(0,0,0,0.45)' : 'none',
      pointerEvents: overlay ? undefined : 'none' }}
      onMouseDown={e => { if (overlay && e.target === e.currentTarget) onClose() }}>
      <div
        // Two refs on one node: the focus trap + the drag geometry. The merged
        // callback MUST be render-stable (useCallback []): an inline function is a
        // new identity every render, so React detaches (null) and re-attaches the
        // ref each render — which, now that useFocusTrap arms/disarms on node
        // attachment, would tear the trap down on every keystroke (the K11b bug in
        // a new coat). Stable identity = ref calls only on real mount/unmount.
        ref={mergedPanelRef}
        role="dialog" aria-modal={overlay ? true : undefined} aria-label={ariaLabel ?? title ?? 'dialog'} tabIndex={-1}
        onPointerDown={() => { if (!zIndex) setZ(nextFloatingZ()) }}
        style={{ ...positioned, maxWidth: maxWidth ?? 'min(94vw, 1100px)', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column', background: 'var(--surface)',
          borderRadius: 14, border: '1px solid var(--border)', pointerEvents: 'auto',
          // The window lifts while it is being dragged; that lift never animates
          // during the drag itself, and never at all under prefers-reduced-motion (§6).
          // HUISSTIJL-1: dragging state is a deliberate deeper lift (drag-ghost-style),
          // not a static role — kept; the resting shadow is the dialog's shadow-modal tier.
          boxShadow: dragging ? '0 28px 70px rgba(0,0,0,0.32)' : 'var(--shadow-modal)',
          transition: dragging || reducedMotion ? 'none' : 'box-shadow var(--motion-fast)',
          overflow: 'hidden' }}>
        {/* Drag handle: the whole header row (never the body — selecting text there
            must keep working). Double-click = reset to center. */}
        <div data-drag-handle onPointerDown={onDragPointerDown} onDoubleClick={onDragHandleDoubleClick}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            cursor: 'move', userSelect: 'none', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {header ?? <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{title}</div>}
          {header && <div style={{ flex: 1 }} />}
          {/* Pop-out to a second browser window (NOTITIE-POPOUT-1 F5) — sits before the
              close X, same 26x26 bordered icon-button footprint as the other header buttons. */}
          {onPopOut && (
            <button onClick={onPopOut} type="button" aria-label={t('openSecondScreen')} title={t('openSecondScreen')}
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
              <ExternalLink size={13} />
            </button>
          )}
          {!hideClose && (
            <button onClick={onClose} aria-label={t('close')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'inline-flex', padding: 4, borderRadius: 6 }}>
              <X size={16} />
            </button>
          )}
        </div>
        {/* Body scrolls inside the panel so a resized-small window never clips chrome —
            unless the children bring their own scroll area + pinned footer. */}
        <div style={scrollBody
          ? { overflow: 'auto', flex: 1, ...bodyStyle }
          : { display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0, ...bodyStyle }}>
          {children}
        </div>
        {resizable !== false && (
          // SE resize grip — same pointer pattern as the drag handle.
          <div onPointerDown={onResizePointerDown} aria-hidden
            style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16,
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 50%, var(--border) 50%)' }} />
        )}
      </div>
    </div>
  )
}

export default function FloatingPanel(props: FloatingPanelProps) {
  if (!props.open) return null
  // Strip `open` — Panel mounts fresh per open (house rule for useFocusTrap).
  const rest = { ...props }
  delete (rest as Partial<FloatingPanelProps>).open
  return <Panel {...rest} />
}
