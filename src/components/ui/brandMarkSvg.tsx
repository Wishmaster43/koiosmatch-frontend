/**
 * brandMarkSvg — the shared outer `<svg>` shell every external-system brand
 * mark (HelloFlexMark, ShiftManagerMark, …) wraps its own geometry in: same
 * viewBox, same icon-compatible props (size/role/aria-label/title). Only the
 * mark's own shapes differ per brand, so those stay in each file.
 */
import type { ReactNode, SVGProps } from 'react'

// Props mirror the lucide icon contract so a brand mark is interchangeable with one.
export type BrandMarkProps = { size?: number; color?: string; cut?: string; title?: string } & SVGProps<SVGSVGElement>

export function BrandMarkSvg({ size = 24, title, children, ...rest }: {
  size?: number
  title: string
  children: ReactNode
} & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none"
      role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <title>{title}</title>
      {children}
    </svg>
  )
}
