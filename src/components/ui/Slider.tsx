import { useRef, useCallback } from 'react'
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Slider — a calm horizontal slider with a draggable ball (thumb) and three
 * anchor labels (left / center / right). Continuous 0..max. Pointer-draggable
 * AND keyboard-operable (arrow keys), role="slider" for screen readers.
 *
 * Two modes, one component:
 * - single: pass `value` + `onChange` (the original contract, unchanged).
 * - range:  pass `range` ([lower, upper]) + `onRangeChange` — two thumbs bounding
 *           a filled segment; a drag moves whichever thumb is nearest. Dragging a
 *           thumb PAST its neighbour hands control to that neighbour instead of
 *           clamping, so a collapsed ([v, v]) or crossed range always stays
 *           re-openable in either direction.
 *
 * labels: [leftLabel, centerLabel, rightLabel]
 */
interface SliderProps {
  value?: number
  /** Range mode: [lower, upper]. Providing it switches the slider to two thumbs. */
  range?: [number, number]
  max?: number
  step?: number
  onChange?: (value: number) => void
  onRangeChange?: (range: [number, number]) => void
  labels?: ReactNode[]
  color?: string
  ariaLabel?: string
  /** Range mode: one accessible name per thumb ([lower, upper]). */
  ariaLabels?: [string, string]
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function Slider({
  value = 50, range, max = 100, step = 1, onChange, onRangeChange,
  labels = [], color = 'var(--color-primary)', ariaLabel, ariaLabels,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  // Which thumb a pointer drag grabbed (range mode) — decided on pointer-down so
  // the rest of the drag keeps moving that same thumb, even past its neighbour.
  const activeThumb = useRef<0 | 1>(0)
  // A collapsed range (lower === upper) makes "closest thumb" meaningless — both
  // distances are identical by construction, so the down-click can't tell them
  // apart. Remember the down VALUE here; the first move resolves the tie by
  // DIRECTION instead (Danny 09-08, "verspringt"). Cleared once resolved.
  const pendingTieValue = useRef<number | null>(null)

  const [lower, upper] = range ?? [0, max]
  const pctOf = (v: number) => clamp((v / max) * 100, 0, 100)
  const pct = pctOf(value)

  // Translate a pointer x-position into a stepped value within [0, max].
  const valueFromClientX = useCallback((clientX: number): number | null => {
    const el = trackRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    return clamp(Math.round((ratio * max) / step) * step, 0, max)
  }, [max, step])

  // Single mode: the one thumb follows the pointer.
  const setFromClientX = useCallback((clientX: number) => {
    const next = valueFromClientX(clientX)
    if (next != null) onChange?.(next)
  }, [valueFromClientX, onChange])

  // Range mode: move ONE thumb. Dragging it PAST its neighbour hands control to
  // that neighbour instead of clamping at it — a range parked at equal values (or
  // dragged fully crossed) must stay able to open in either direction, never get
  // stuck (Danny 09-08: dragging the lower thumb past the upper one used to pin
  // both at the same value with no way back except a reset).
  const setRangeFromClientX = useCallback((clientX: number, thumb: 0 | 1) => {
    const next = valueFromClientX(clientX)
    if (next == null) return
    if (thumb === 0) {
      if (next > upper) { activeThumb.current = 1; onRangeChange?.([upper, next]); return }
      onRangeChange?.([next, upper])
    } else {
      if (next < lower) { activeThumb.current = 0; onRangeChange?.([next, lower]); return }
      onRangeChange?.([lower, next])
    }
  }, [valueFromClientX, onRangeChange, lower, upper])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (!range) { setFromClientX(e.clientX); return }
    const picked = valueFromClientX(e.clientX)
    if (lower === upper) {
      // Tie: distance-to-lower and distance-to-upper are IDENTICAL by construction
      // — picking "closest" always resolved to the same thumb. Defer to the first
      // move's direction instead (see pendingTieValue doc comment above).
      pendingTieValue.current = picked
      activeThumb.current = 0
    } else {
      pendingTieValue.current = null
      activeThumb.current = picked == null || Math.abs(picked - lower) <= Math.abs(picked - upper) ? 0 : 1
    }
    setRangeFromClientX(e.clientX, activeThumb.current)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return
    if (!range) { setFromClientX(e.clientX); return }
    // Resolve a pending tie by drag direction: which side of the down-point did
    // the pointer move to?
    if (pendingTieValue.current != null) {
      const next = valueFromClientX(e.clientX)
      if (next != null && next !== pendingTieValue.current) activeThumb.current = next > pendingTieValue.current ? 1 : 0
      pendingTieValue.current = null
    }
    setRangeFromClientX(e.clientX, activeThumb.current)
  }

  // Keyboard (single mode): arrow keys nudge by one step.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange?.(Math.max(0, value - step)); e.preventDefault() }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange?.(Math.min(max, value + step)); e.preventDefault() }
  }

  // Keyboard (range mode): arrow keys nudge ONE thumb, clamped by its neighbour.
  const onRangeKeyDown = (thumb: 0 | 1) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step
      : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : 0
    if (delta === 0) return
    e.preventDefault()
    onRangeChange?.(thumb === 0
      ? [clamp(lower + delta, 0, upper), upper]
      : [lower, clamp(upper + delta, lower, max)])
  }

  // One thumb look, shared by both modes.
  const thumbStyle = (leftPct: number): CSSProperties => ({
    position: 'absolute', left: `${leftPct}%`, transform: 'translateX(-50%)',
    width: 16, height: 16, borderRadius: '50%', background: color,
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)', cursor: 'grab', outline: 'none',
  })

  return (
    <div>
      <div ref={trackRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}>
        {/* Rail */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        {/* Filled portion — from the left in single mode, BETWEEN the thumbs in range mode */}
        <div style={{ position: 'absolute', left: range ? `${pctOf(lower)}%` : 0,
          width: range ? `${pctOf(upper) - pctOf(lower)}%` : `${pct}%`,
          height: 4, borderRadius: 99, background: color }} />
        {/* Tick marks (quarters) */}
        {[0, 25, 50, 75, 100].map(p => (
          <span key={p} style={{ position: 'absolute', left: `${p}%`, transform: 'translateX(-50%)', top: '50%', marginTop: -4,
            width: 1, height: 8, background: 'var(--border)' }} />
        ))}
        {/* Thumb(s) — one per bound in range mode, each independently keyboard-operable */}
        {range ? (
          <>
            <div role="slider" tabIndex={0} aria-label={ariaLabels?.[0]} aria-valuemin={0} aria-valuemax={upper}
              aria-valuenow={lower} onKeyDown={onRangeKeyDown(0)} style={thumbStyle(pctOf(lower))} />
            <div role="slider" tabIndex={0} aria-label={ariaLabels?.[1]} aria-valuemin={lower} aria-valuemax={max}
              aria-valuenow={upper} onKeyDown={onRangeKeyDown(1)} style={thumbStyle(pctOf(upper))} />
          </>
        ) : (
          <div role="slider" tabIndex={0} aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
            onKeyDown={onKeyDown} style={thumbStyle(pct)} />
        )}
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
