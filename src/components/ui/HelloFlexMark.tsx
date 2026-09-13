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
import { BrandMarkSvg, type BrandMarkProps } from './brandMarkSvg'

// eslint-disable-next-line no-restricted-syntax -- DATA: HelloFlex brand-mark colour, must match their logo exactly, not a themeable UI colour
const HF_TEAL = '#3E7C8C'

// eslint-disable-next-line no-restricted-syntax -- DATA: fixed white monogram, must read against the solid brand-colour fill in any theme, not a themeable UI colour
export default function HelloFlexMark({ size = 24, color = HF_TEAL, cut = '#FFFFFF', title = 'HelloFlex', ...rest }: BrandMarkProps) {
  return (
    <BrandMarkSvg size={size} title={title} {...rest}>
      {/* Rounded diamond — the HelloFlex container, a rounded square on its point */}
      <rect x="17" y="17" width="62" height="62" rx="15" fill={color} transform="rotate(45 48 48)" />
      {/* HF monogram — legible stand-in for the wordmark at small sizes */}
      <text x="48" y="49" textAnchor="middle" dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="30" fill={cut}>HF</text>
    </BrandMarkSvg>
  )
}
