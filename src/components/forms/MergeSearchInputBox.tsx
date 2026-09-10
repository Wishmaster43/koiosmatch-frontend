import type { CSSProperties } from 'react'
import { Search } from 'lucide-react'

interface Props {
  query: string
  onQueryChange: (v: string) => void
  /** Translated placeholder, also used as the input's aria-label. */
  placeholder: string
  /** Canon field style (fieldMetrics) with the caller's own left inset for the icon. */
  inputStyle: CSSProperties
}

/**
 * MergeSearchInputBox — the shared "find a duplicate" search input (a leading
 * Search icon + an autofocus text input) (clone: MergeCustomerModal +
 * MergeEntityModal — MergeCandidateModal already reads the shared SearchSelect
 * in server-search mode instead, so it does not adopt this).
 */
export default function MergeSearchInputBox({ query, onQueryChange, placeholder, inputStyle }: Props) {
  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      <input autoFocus value={query} onChange={e => onQueryChange(e.target.value)}
        placeholder={placeholder} aria-label={placeholder} style={inputStyle} />
    </div>
  )
}
