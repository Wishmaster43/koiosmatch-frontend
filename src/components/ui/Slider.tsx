import { useRef, useCallback } from 'react'
import type { ReactNode, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Slider — a calm horizontal slider with a draggable ball (thumb) and three
 * anchor labels (left / center / right). Continuous 0..max. Pointer-draggable
 * AND keyboard-operable (arrow keys), role="slider" for screen readers.
 *
 * labels: [leftLabel, centerLabel, rightLabel]
 */
interface SliderProps {
  value?: number
  max?: number
  step?: number
  onChange?: (value: number) => void
  labels?: ReactNode[]
  color?: string
  ariaLabel?: string
}

export default function Slider({ value = 50, max = 100, step = 1, onChange, labels = [], color = 'var(--color-primary)', ariaLabel }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pct = Math.max(0, Math.min(100, (value / max) * 100))

  // Translate a pointer x-position into a stepped value within [0, max].
  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const stepped = Math.round((ratio * max) / step) * step
    onChange?.(Math.max(0, Math.min(max, stepped)))
  }, [max, step, onChange])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); setFromClientX(e.clientX) }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (e.buttons === 1) setFromClientX(e.clientX) }

  // Keyboard: arrow keys nudge by one step.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange?.(Math.max(0, value - step)); e.preventDefault() }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange?.(Math.min(max, value + step)); e.preventDefault() }
  }

  return (
    <div>
      <div ref={trackRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}>
        {/* Rail */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        {/* Filled portion */}
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 99, background: color }} />
        {/* Tick marks (quarters) */}
        {[0, 25, 50, 75, 100].map(p => (
          <span key={p} style={{ position: 'absolute', left: `${p}%`, transform: 'translateX(-50%)', top: '50%', marginTop: -4,
            width: 1, height: 8, background: 'var(--border)' }} />
        ))}
        {/* Thumb (ball) */}
        <div role="slider" tabIndex={0} aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} onKeyDown={onKeyDown}
          style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', width: 16, height: 16, borderRadius: '50%',
            background: color, boxShadow: '0 1px 4px rgba(0,0,0,0.25)', cursor: 'grab', outline: 'none' }} />
      </div>

      {/* Anchor labels (left / center / right) */}
      {labels.length === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>{labels[0]}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{labels[1]}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{labels[2]}</span>
        </div>
      )}
    </div>
  )
}
