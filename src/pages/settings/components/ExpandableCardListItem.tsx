/**
 * ExpandableCardListItem — Shared expandable card wrapper for settings list items
 * (match templates, vacancy content blocks, generation profiles). Composes card +
 * header with chevron toggle + body (open-only) + footer. Differences
 * (linked-count badge, kind caption) are passed as ReactNode slots.
 */
import { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Button from '@/components/ui/Button'

export interface ExpandableCardListItemProps {
  item: { id: string }
  isOpen: boolean
  onToggleOpen: () => void
  headerContent: ReactNode
  children: ReactNode
  footer: ReactNode
  ariaLabel: string
}

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
  marginBottom: 8,
}

/**
 * Expandable list item card with header (title + optional badge + chevron) and
 * edit form body (rendered only when open). Footer (EditorRowFooter or
 * AddFormFooter) is always present but only rendered inside the open body.
 */
export default function ExpandableCardListItem({
  item,
  isOpen,
  onToggleOpen,
  headerContent,
  children,
  footer,
  ariaLabel,
}: ExpandableCardListItemProps) {
  return (
    <div key={item.id} style={cardStyle}>
      {/* Header: title + badge + toggle button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{headerContent}</div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onToggleOpen}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>

      {/* Body: form fields (rendered only when open) */}
      {isOpen && (
        <div
          style={{
            marginTop: 14,
            borderTop: '1px solid var(--border)',
            paddingTop: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {children}
          {footer}
        </div>
      )}
    </div>
  )
}
