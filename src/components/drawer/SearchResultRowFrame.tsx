// Extracted from VacancySearchResultRow and CandidateSearchTab's inline row:
// the div[role=button] frame with selection styling and keyboard/mouse handlers.
import type { ReactNode, CSSProperties } from 'react'

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 8,
  cursor: 'pointer',
}

// The shared row container with selection and keyboard affordances — children
// render the row's content (title, meta, score) which differs per entity type.
export default function SearchResultRowFrame({
  isSelected,
  onSelect,
  children,
}: {
  isSelected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        ...rowStyle,
        width: '100%',
        background: isSelected ? 'var(--color-primary-bg)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg)'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </div>
  )
}
