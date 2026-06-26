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
  padding: '14px 16px', background: 'var(--surface)',
}
export const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }

interface SectionCardProps {
  title?: ReactNode
  action?: ReactNode
  children?: ReactNode
  style?: CSSProperties
}

export default function SectionCard({ title, action, children, style }: SectionCardProps) {
  return (
    <div style={{ ...sectionBlock, ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {title && <span style={sectionTitle}>{title}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
