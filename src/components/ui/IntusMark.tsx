/**
 * IntusMark — the Intus brand mark: two interlocking rounded-square links on the
 * diagonal, one navy and one orange. Two-tone, so it ignores the `color` prop the
 * canvas passes (it renders its own brand colours); `size`/`title` still follow
 * the lucide icon contract so it can drop in as a module `Icon`.
 *
 * Note: hand-traced approximation — swap the two <rect> links for the official
 * vector when available.
 */
/* eslint-disable no-restricted-syntax -- DATA: Intus brand-mark colours, must match their logo exactly, not a themeable UI colour */
const INTUS_NAVY   = '#0E3A53'
const INTUS_ORANGE = '#F18A00'
/* eslint-enable no-restricted-syntax */

// Props mirror the lucide icon contract (color is intentionally omitted: two-tone).
interface IntusMarkProps {
  size?: number | string
  title?: string
}

export default function IntusMark({ size = 24, title = 'Intus' }: IntusMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none"
      role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      {/* Two thick rounded-square links, each rotated to a diamond and offset so
          they interlock — navy on the left, orange on the right */}
      <rect x="20" y="28" width="40" height="40" rx="12" fill="none"
        stroke={INTUS_NAVY} strokeWidth="13" transform="rotate(45 40 48)" />
      <rect x="36" y="28" width="40" height="40" rx="12" fill="none"
        stroke={INTUS_ORANGE} strokeWidth="13" transform="rotate(45 56 48)" />
    </svg>
  )
}
