/**
 * TenantSwitcher — the tenant card top-left in the topbar.
 *
 * Super admins (user without a tenant_id / is_super_admin) get a dropdown to
 * switch the active bureau; on pick we persist the choice (localStorage via
 * AuthContext.setActiveTenant), set the X-Tenant header for all following
 * requests (api.js interceptor reads active_tenant) and re-fetch /auth/me. The
 * active page remounts (keyed on tenant id in App.jsx) so its data reloads.
 *
 * Regular users are pinned to their own bureau — they see a static card, no
 * switcher (the backend ignores X-Tenant for them anyway).
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

function TenantBadge({ tenant }) {
  if (tenant?.logo_url) {
    return <img src={tenant.logo_url} alt="" style={{ height: 22, borderRadius: 4 }} />
  }
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 rounded-md"
      style={{ width: 22, height: 22, background: 'var(--color-primary)', fontSize: 11, color: 'white', fontWeight: 700 }}
    >
      {(tenant?.name ?? 'K').charAt(0).toUpperCase()}
    </div>
  )
}

export default function TenantSwitcher() {
  const { tenants, activeTenant, setActiveTenant, isSuperAdmin, user } = useAuth()
  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState('')
  const [switching, setSwitching] = useState(null) // tenant id being switched to
  const ref = useRef(null)

  const tenant     = activeTenant ?? user?.tenant ?? { name: 'KoiosMatch', logo_url: null }
  // Only super admins with more than one bureau get a switcher.
  const canSwitch  = isSuperAdmin() && Array.isArray(tenants) && tenants.length > 1

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const pick = async (t) => {
    if (t.id === tenant?.id) { setOpen(false); return }
    setSwitching(t.id)
    try { await setActiveTenant(t) } finally { setSwitching(null); setOpen(false); setQuery('') }
  }

  const filtered = (tenants ?? []).filter(t =>
    !query || (t.name ?? '').toLowerCase().includes(query.trim().toLowerCase()),
  )

  // Non-switchers: static card (regular users, or a super admin with one bureau).
  if (!canSwitch) {
    return (
      <div className="flex items-center flex-shrink-0 gap-2">
        <TenantBadge tenant={tenant} />
        <span className="font-semibold text-gray-900" style={{ fontSize: 13 }}>{tenant?.name ?? 'KoiosMatch'}</span>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Bureau wisselen"
        className="flex items-center gap-2 rounded-lg transition-colors"
        style={{
          padding: '4px 8px', border: '1px solid transparent', background: open ? 'var(--hover-bg)' : 'transparent',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--hover-bg)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <TenantBadge tenant={tenant} />
        <span className="font-semibold text-gray-900" style={{ fontSize: 13 }}>{tenant?.name ?? 'KoiosMatch'}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
            width: 280, maxHeight: 360, display: 'flex', flexDirection: 'column',
            background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid var(--border, #F3F4F6)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Zoek bureau…"
                style={{
                  width: '100%', padding: '7px 8px 7px 28px', fontSize: 13, borderRadius: 7,
                  border: '1px solid #E5E7EB', outline: 'none',
                }}
              />
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: 4 }}>
            {filtered.length === 0 && (
              <div style={{ padding: '12px 10px', fontSize: 12, color: '#9CA3AF' }}>Geen bureaus gevonden</div>
            )}
            {filtered.map(t => {
              const active = t.id === tenant?.id
              return (
                <button
                  key={t.id}
                  onClick={() => pick(t)}
                  disabled={switching != null}
                  className="flex items-center w-full gap-2 rounded-md transition-colors"
                  style={{
                    padding: '8px 8px', fontSize: 13, textAlign: 'left', border: 'none',
                    background: active ? 'var(--color-primary-bg)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--text, #111827)',
                    cursor: switching != null ? 'wait' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover-bg, #F9FAFB)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <TenantBadge tenant={t} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: active ? 600 : 500 }}>
                    {t.name ?? t.id}
                  </span>
                  {active && <Check size={14} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
