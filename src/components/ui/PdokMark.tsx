import type { SVGProps } from 'react'

/**
 * PdokMark — an own-design vector mark for the PDOK geocode workflow module
 * (mirrors ShiftManagerMark: the raster PDOK logo pixelates at node size, so the
 * builder gets a crisp inline SVG instead; the real logo stays on the drill-down
 * Koppelingen card). Design: PDOK-navy rounded tile, a white map pin, and a
 * Dutch-orange centre — "adres → punt op de kaart" in one glyph. Props mirror the
 * lucide icon contract (`size`, `color`) so it drops in anywhere an icon fits.
 */
const PDOK_NAVY = '#1E3A5F'
const NL_ORANGE = '#FF7700'

type PdokMarkProps = { size?: number; color?: string; pin?: string; dot?: string; title?: string } & SVGProps<SVGSVGElement>

export default function PdokMark({ size = 24, color = PDOK_NAVY, pin = '#FFFFFF', dot = NL_ORANGE, title = 'PDOK', ...rest }: PdokMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none"
      role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <title>{title}</title>
      {/* Tile — rounded square in PDOK navy */}
      <rect x="4" y="4" width="88" height="88" rx="20" fill={color} />
      {/* Graticule hint — two faint map lines behind the pin's foot */}
      <path d="M18 72 H78 M24 80 H72" stroke={pin} strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
      {/* Map pin — classic teardrop, centred */}
      <path d="M48 16 C62.9 16 74 27.4 74 41.5 C74 58.5 48 76 48 76 C48 76 22 58.5 22 41.5 C22 27.4 33.1 16 48 16 Z" fill={pin} />
      {/* Dutch-orange centre — the geocoded point */}
      <circle cx="48" cy="41.5" r="10.5" fill={dot} />
    </svg>
  )
}
