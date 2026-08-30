/**
 * useTenantSearch — server-side tenant search (GET /tenants?search=), shared by
 * every super-admin tenant picker. Mirrors TenantSwitcher's own /tenants contract
 * (that switcher keeps its richer debounced/paginated copy on purpose).
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'

interface TenantOption { id: string; name: string }

// Public shape: mapped {value,label} options + a search setter (no loading flag:
// no consumer renders one, and dead surface is dead code — §11).
export function useTenantSearch(): {
  options: Array<{ value: string; label: string }>
  onSearch: (q: string) => void
} {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<TenantOption[]>([])

  // Debounce-free server search with an abort guard against stale responses.
  useEffect(() => {
    const q = query.trim()
    const ctrl = new AbortController()
    api.get('/tenants', { params: { search: q || undefined, per_page: 25 }, signal: ctrl.signal })
      .then((res) => setRows(unwrapList<TenantOption>(res).rows))
      .catch(() => { if (!ctrl.signal.aborted) setRows([]) })
    return () => ctrl.abort()
  }, [query])

  return { options: rows.map((o) => ({ value: String(o.id), label: o.name })), onSearch: setQuery }
}
