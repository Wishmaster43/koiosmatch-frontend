import type { SVGProps } from 'react'

/**
 * ShiftManagerMark — the red hexagon mark used for the native ShiftManager (SM)
 * workflow modules in the builder. Inline SVG so it scales crisply and tints via
 * props; the contract mirrors lucide-react icons (`size`, `color`) so it can drop
 * in anywhere an icon component is expected — including a module's `Icon`.
 * `color` paints the hexagon, `cut` the interlocking glyph.
 *
 * Note: hand-traced approximation of the mark — swap the two <path> definitions
 * for the official vector when available; nothing else needs to change.
 */
// eslint-disable-next-line no-restricted-syntax -- DATA: ShiftManager brand-mark colour, must match their logo exactly, not a themeable UI colour
const SM_RED = '#E11D2A'

// Props mirror the lucide icon contract so the mark is interchangeable with one.
type ShiftManagerMarkProps = { size?: number; color?: string; cut?: string; title?: string } & SVGProps<SVGSVGElement>

// eslint-disable-next-line no-restricted-syntax -- DATA: fixed white glyph, must read against the solid brand-colour hexagon in any theme, not a themeable UI colour
export default function ShiftManagerMark({ size = 24, color = SM_RED, cut = '#FFFFFF', title = 'ShiftManager', ...rest }: ShiftManagerMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none"
      role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <title>{title}</title>
      {/* Hexagon body — flat-top, centred in the 96×96 box */}
      <path d="M92 48 L70 9.9 L26 9.9 L4 48 L26 86.1 L70 86.1 Z" fill={color} />
      {/* Interlocking glyph — one hook (a top bar + diagonal leg) plus its 180°
          rotation, so the two hooks lock into each other like the brand mark */}
      <g fill={cut}>
        <path d="M20 21 L52 21 L60 58 L46 58 L40 33 L20 33 Z" />
        <path d="M20 21 L52 21 L60 58 L46 58 L40 33 L20 33 Z" transform="rotate(180 48 48)" />
      </g>
    </svg>
  )
}
