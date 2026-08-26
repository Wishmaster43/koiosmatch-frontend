/**
 * SectionCard — bordered surface card with an optional title + action row.
 *
 * Replaces the dozens of inline `sectionBlock` copies in the candidate drawer.
 * Use the exported `sectionBlock` constant directly only when you need the
 * raw style (e.g. nested layouts). The heading itself is the shared
 * `GroupLabel` atom (§4 typography) — never a locally re-declared style.
 */
import type { CSSProperties, ReactNode } from 'react'
import { GroupLabel } from '@/components/ui/typography'

// eslint-disable-next-line react-refresh/only-export-components -- a style constant re-export alongside this file's component; HMR-nicety warning only
export const sectionBlock: CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10,
  padding: '6px 12px', background: 'var(--surface)',
}

interface SectionCardProps {
  title?: ReactNode
  action?: ReactNode
  children?: ReactNode
  style?: CSSProperties
}

// The card shell itself: title/action header row over the bordered surface, or just the surface when there's no title.
export default function SectionCard({ title, action, children, style }: SectionCardProps) {
  return (
    <div>
      {/* No title → the action alone must still sit RIGHT (space-between would
          park a single child at flex-start — Danny 20-07, '+ Nieuwe taak links'). */}
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: title ? 'space-between' : 'flex-end', marginBottom: 6 }}>
          {/* HUISSTIJL-1: identical 11/600/uppercase render, letterSpacing kept at
              this block's own 0.04em (atom default is 0.05em) via the style override. */}
          {title && <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{title}</GroupLabel>}
          {action}
        </div>
      )}
      <div style={{ ...sectionBlock, ...style }}>{children}</div>
    </div>
  )
}
