/**
 * OpenCageMark — a neutral lucide Compass icon for the OpenCage geocode workflow
 * module (GEO-OPENCAGE-ICON-1). Danny 07-09: neutral icon (no branded logo),
 * "address → point on the map" semantics via the compass/location glyph.
 * Props mirror the lucide icon contract (`size`, `color`) so it drops in anywhere
 * an icon fits.
 */
import { Compass } from 'lucide-react'
import type { LucideProps } from 'lucide-react'

interface OpenCageMarkProps extends Omit<LucideProps, 'ref'> {
  title?: string
}

// OpenCage geocoding mark: lucide Compass, colour-themeable via the icon's own contract.
export default function OpenCageMark({ size = 24, color = 'currentColor', title = 'OpenCage', ...rest }: OpenCageMarkProps) {
  return (
    <span role="img" aria-label={title} title={title} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Compass size={size} color={color} {...rest} />
    </span>
  )
}
