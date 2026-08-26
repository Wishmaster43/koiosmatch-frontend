/**
 * KoiosResizeHandle — the panel's drag-to-resize edge. Purely presentational:
 * all width/clamp/persistence logic lives in useKoiosPanelWidth, this
 * component only renders the WAI-ARIA "separator" semantics (role, orientation,
 * current/min/max value) and wires the pointer + keyboard handlers it receives
 * as props — a mouse-only CSS `resize` handle (RichTextEditor's `resizable`
 * prop) cannot expose any of that, which is why this is a small dedicated
 * component rather than that pattern reused as-is.
 */
import type { KeyboardEvent, PointerEvent } from 'react'
import type { TFn } from '@/types/koios'

interface KoiosResizeHandleProps {
  width: number
  minWidth: number
  maxWidth: number
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  t: TFn
}

// Purely presentational drag/keyboard resize edge — renders the WAI-ARIA
// separator semantics and wires the handlers; all logic lives in useKoiosPanelWidth.
export default function KoiosResizeHandle({ width, minWidth, maxWidth, onPointerDown, onKeyDown, t }: KoiosResizeHandleProps) {
  return (
    <div
      className="km-koios-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('koios.resizeHandle')}
      aria-valuenow={Math.round(width)}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute', top: 0, bottom: 0, right: -3, width: 6,
        cursor: 'col-resize', touchAction: 'none', background: 'transparent',
      }}
    />
  )
}
