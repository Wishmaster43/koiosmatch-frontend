/**
 * TenantSwitcher — the active-tenant card at the top of the sidebar; super admins
 * can search and switch tenant. Extracted from Sidebar.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import api, { unwrapList } from '@/lib/api'
import { ChevronDown, Loader2, Search } from 'lucide-react'

const tenantInitials = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??'

// `domains` can be strings or Laravel-tenancy domain objects {domain, ...}.
const tenantDomain = (tn) => {
  const d = tn?.domains?.[0]
  return (typeof d === 'string' ? d : d?.domain) ?? null
}

/**
 * TenantSwitcher — the active-bureau card top-left in the sidebar.
 *
 * Super admins get a type-to-search dropdown backed by the server:
 *   GET /tenants?search=<q>&per_page=25&page=<n> -> { data, meta }
 * so it scales to 100+ bureaus (no "load everything" list). Search is debounced
 * (~250ms) and more pages load on infinite-scroll. Picking a bureau calls
 * AuthContext.setActiveTenant -> persists active_tenant (X-Tenant header for all
 * following requests), re-fetches /auth/me, and the page remounts (App.jsx keys
 * on tenant id) so its data reloads.
 *
 * Regular users get a plain, non-clickable card (backend ignores X-Tenant for them).
 */
export default function TenantSwitcher({ expanded }) {
  const { t } = useTranslation('common')
  const { activeTenant, user, setActiveTenant, isSuperAdmin } = useAuth()

  const [open,      setOpen]      = useState(false)
  const [query,     setQuery]     = useState('')
  const [debounced, setDebounced] = useState('')
  const [results,   setResults]   = useState([])
  const [page,      setPage]      = useState(1)
  const [lastPage,  setLastPage]  = useState(1)
  const [loading,   setLoading]   = useState(false)
  const [switching, setSwitching] = useState(null)
  const ref = useRef(null)

  const tenant    = activeTenant ?? user?.tenant ?? null
  const canSwitch = isSuperAdmin()
  const initials  = tenantInitials(tenant?.name)

  // Debounce the search term (±250ms); reset to page 1 on a new term.
  useEffect(() => {
    const id = setTimeout(() => { setDebounced(query.trim()); setPage(1) }, 250)
    return () => clearTimeout(id)
  }, [query])

  // Fetch bureaus from the server when open / term / page changes.
  useEffect(() => {
    if (!open || !canSwitch) return
    const ctrl = new AbortController()
    setLoading(true)
    api.get('/tenants', { params: { search: debounced || undefined, per_page: 25, page }, signal: ctrl.signal })
      .then(res => {
        const { rows, lastPage: lp } = unwrapList(res)
        setResults(prev => (page === 1 ? rows : [...prev, ...rows]))
        setLastPage(lp)
      })
      .catch(err => { if (err.code !== 'ERR_CANCELED' && page === 1) setResults([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [open, canSwitch, debounced, page])

  // Close on outside click / Escape; reset state when closing.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const onScroll = (e) => {
    const el = e.currentTarget
    if (!loading && page < lastPage && el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
      setPage(p => p + 1)
    }
  }

  const pick = async (tn) => {
    if (tn.id === tenant?.id) { setOpen(false); return }
    setSwitching(tn.id)
    try { await setActiveTenant(tn) } finally { setSwitching(null); setOpen(false); setQuery('') }
  }

  // Collapsed rail: just the badge.
  if (!expanded) {
    return (
      <div className="flex justify-center flex-shrink-0 mt-3">
        <div className="flex items-center justify-center rounded"
          style={{ width: 28, height: 28, background: '#3B8FD4', fontSize: 9, color: 'white', fontWeight: 700 }}>
          {initials}
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative flex-shrink-0 mx-3 mt-3">
      <button
        onClick={() => canSwitch && setOpen(o => !o)}
        className="flex items-center w-full transition-colors rounded-lg"
        style={{ gap: 8, padding: '7px 9px', background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: canSwitch ? 'pointer' : 'default' }}
        onMouseEnter={e => canSwitch && (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
      >
        <div className="flex items-center justify-center flex-shrink-0 rounded"
          style={{ width: 22, height: 22, background: '#3B8FD4', fontSize: 8, color: 'white', fontWeight: 700 }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', lineHeight: 1.2 }} className="truncate">
            {tenant?.name ?? 'Selecteer bureau'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {canSwitch ? 'Super admin' : 'Flex staffing'}
          </div>
        </div>
        {canSwitch && (
          <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        )}
      </button>

      {open && canSwitch && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden bg-[var(--surface)] top-full rounded-xl"
          style={{ border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('nav.switchTenant', { defaultValue: 'Zoek bureau…' })}
                className="w-full"
                style={{ padding: '7px 8px 7px 28px', fontSize: 13, borderRadius: 7, border: '1px solid var(--border)', outline: 'none' }}
              />
            </div>
          </div>

          <div onScroll={onScroll} style={{ maxHeight: 300, overflowY: 'auto', padding: 4 }}>
            {results.map(tn => {
              const isActive = tenant?.id === tn.id
              return (
                <button key={tn.id} onClick={() => pick(tn)} disabled={switching != null}
                  className="flex items-center gap-3 w-full px-2 py-2 rounded-md transition-colors"
                  style={{ background: isActive ? 'var(--hover-bg)' : 'none', border: 'none', cursor: switching != null ? 'wait' : 'pointer' }}
                  onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'none')}
                >
                  <div className="flex items-center justify-center flex-shrink-0 rounded"
                    style={{ width: 24, height: 24, background: '#3B8FD4', fontSize: 9, color: 'white', fontWeight: 700 }}>
                    {tenantInitials(tn.name)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-[var(--text)] truncate">{tn.name ?? tn.id}</div>
                    {tenantDomain(tn) && <div className="text-xs text-[var(--text-muted)] truncate">{tenantDomain(tn)}</div>}
                  </div>
                  {switching === tn.id
                    ? <Loader2 size={13} className="flex-shrink-0 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    : isActive && <div className="flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: 'var(--color-primary)' }} />}
                </button>
              )
            })}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-3" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <Loader2 size={13} className="animate-spin" /> Laden…
              </div>
            )}
            {!loading && results.length === 0 && (
              <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Geen bureaus gevonden</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
