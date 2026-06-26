import type { SVGProps } from 'react'

/**
 * HelloFlexMark — the teal "diamond" mark used for the HelloFlex (HF) workflow
 * modules in the builder: a rounded square on its point with the HF monogram,
 * echoing the HelloFlex brand container. Inline SVG so it scales crisply and
 * tints via props; the contract mirrors lucide-react icons (`size`, `color`) so
 * it can drop in anywhere an icon component is expected — including a module's
 * `Icon`. `color` paints the diamond, `cut` the monogram.
 *
 * Note: simplified brand mark (the full wordmark is illegible at icon sizes) —
 * swap the SVG body for the official vector when available.
 */
const HF_TEAL = '#3E7C8C'

// Props mirror the lucide icon contract so the mark is interchangeable with one.
type HelloFlexMarkProps = { size?: number; color?: string; cut?: string; title?: string } & SVGProps<SVGSVGElement>

export default function HelloFlexMark({ size = 24, color = HF_TEAL, cut = '#FFFFFF', title = 'HelloFlex', ...rest }: HelloFlexMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none"
      role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <title>{title}</title>
      {/* Rounded diamond — the HelloFlex container, a rounded square on its point */}
      <rect x="17" y="17" width="62" height="62" rx="15" fill={color} transform="rotate(45 48 48)" />
      {/* HF monogram — legible stand-in for the wordmark at small sizes */}
      <text x="48" y="49" textAnchor="middle" dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="30" fill={cut}>HF</text>
    </svg>
  )
}
