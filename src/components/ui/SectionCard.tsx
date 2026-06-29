import type { CSSProperties, ReactNode } from 'react'

/**
 * SectionCard — bordered surface card with an optional title + action row.
 *
 * Replaces the dozens of inline `sectionBlock` / `sectionTitle` copies in the
 * candidate drawer. Use the exported `sectionBlock` / `sectionTitle` constants
 * directly only when you need the raw styles (e.g. nested layouts).
 */
export const sectionBlock: CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10,
  padding: '10px 14px', background: 'var(--surface)',
}
// Uniform section heading: grey, uppercase, sits OUTSIDE the block (above it).
export const sectionTitle: CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)',
}

interface SectionCardProps {
  title?: ReactNode
  action?: ReactNode
  children?: ReactNode
  style?: CSSProperties
}

export default function SectionCard({ title, action, children, style }: SectionCardProps) {
  return (
    <div>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          {title && <span style={sectionTitle}>{title}</span>}
          {action}
        </div>
      )}
      <div style={{ ...sectionBlock, ...style }}>{children}</div>
    </div>
  )
}
