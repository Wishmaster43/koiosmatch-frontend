import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'

/**
 * HeaderSearch — one shared, dumb page-header search box: controlled internally,
 * debounced, and calls `onSearch` with the trimmed query so each page wires it to
 * its own server-side `?q=`. No data fetching lives here (shared/dumb UI, §2). It
 * mirrors the existing search look so search feels identical on every entity page.
 */
interface HeaderSearchProps {
  onSearch: (query: string) => void
  placeholder?: string
  ariaLabel?: string
  defaultValue?: string
  debounceMs?: number
  autoFocus?: boolean
  width?: number | string
}

export default function HeaderSearch({
  onSearch, placeholder, ariaLabel, defaultValue = '',
  debounceMs = 300, autoFocus = false, width = 260,
}: HeaderSearchProps) {
  const { t } = useTranslation('common')
  const [value, setValue] = useState(defaultValue)

  // Keep the latest onSearch in a ref so a re-created parent callback doesn't restart the debounce.
  const onSearchRef = useRef(onSearch)
  useEffect(() => { onSearchRef.current = onSearch }, [onSearch])

  // Debounce the input → fire onSearch with the trimmed query.
  useEffect(() => {
    const id = setTimeout(() => onSearchRef.current(value.trim()), debounceMs)
    return () => clearTimeout(id)
  }, [value, debounceMs])

  const ph = placeholder ?? t('search')

  return (
    <div role="search" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', width,
      background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7, boxSizing: 'border-box' }}>
      <Search size={13} color="var(--text-muted)" aria-hidden />
      <input value={value} autoFocus={autoFocus} placeholder={ph} aria-label={ariaLabel ?? ph}
        onChange={e => setValue(e.target.value)}
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
      {value && (
        <button type="button" onClick={() => setValue('')} aria-label={t('clear')}
          style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
          <X size={13} />
        </button>
      )}
    </div>
  )
}
