/**
 * Sidebar — the left navigation rail.
 * Renders the brand, a TenantSwitcher (super admins can change tenant), and the
 * nav items that set the active page. Collapses to icons when `expanded` is false.
 *
 * TenantSwitcher below = the tenant dropdown shown at the top of the sidebar.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api, { unwrapList } from '../../lib/api'
import { canAccessPage } from '../../lib/access'
import {
  LayoutDashboard, Users, Building2,
  MessageCircle, Settings, ChevronDown, Brain, BarChart3, TrendingUp, Bot,
  FileText, Briefcase, CalendarDays, Search, Loader2,
} from 'lucide-react'

// Resolve a nav item's label from i18n by id (dots → underscores to stay flat).
const navLabel = (t, id) => t(`nav.${id.replace(/\./g, '_')}`)

const tenantInitials = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??'

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
function TenantSwitcher({ expanded }) {
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
        style={{ gap: 8, padding: '7px 9px', background: '#F8F9FF', border: '1px solid #EBEBF5', cursor: canSwitch ? 'pointer' : 'default' }}
        onMouseEnter={e => canSwitch && (e.currentTarget.style.background = '#F0F0FF')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FF')}
      >
        <div className="flex items-center justify-center flex-shrink-0 rounded"
          style={{ width: 22, height: 22, background: '#3B8FD4', fontSize: 8, color: 'white', fontWeight: 700 }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div style={{ fontSize: 11, fontWeight: 500, color: '#374151', lineHeight: 1.2 }} className="truncate">
            {tenant?.name ?? 'Selecteer bureau'}
          </div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>
            {canSwitch ? 'Super admin' : 'Flex staffing'}
          </div>
        </div>
        {canSwitch && (
          <ChevronDown size={12} style={{ color: '#9CA3AF', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        )}
      </button>

      {open && canSwitch && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden bg-white top-full rounded-xl"
          style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('nav.switchTenant', { defaultValue: 'Zoek bureau…' })}
                className="w-full"
                style={{ padding: '7px 8px 7px 28px', fontSize: 13, borderRadius: 7, border: '1px solid #E5E7EB', outline: 'none' }}
              />
            </div>
          </div>

          <div onScroll={onScroll} style={{ maxHeight: 300, overflowY: 'auto', padding: 4 }}>
            {results.map(tn => {
              const isActive = tenant?.id === tn.id
              return (
                <button key={tn.id} onClick={() => pick(tn)} disabled={switching != null}
                  className="flex items-center gap-3 w-full px-2 py-2 rounded-md transition-colors"
                  style={{ background: isActive ? '#F8F9FF' : 'none', border: 'none', cursor: switching != null ? 'wait' : 'pointer' }}
                  onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'none')}
                >
                  <div className="flex items-center justify-center flex-shrink-0 rounded"
                    style={{ width: 24, height: 24, background: '#3B8FD4', fontSize: 9, color: 'white', fontWeight: 700 }}>
                    {tenantInitials(tn.name)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-gray-700 truncate">{tn.name ?? tn.id}</div>
                    {tn.domains?.[0] && <div className="text-xs text-gray-400 truncate">{tn.domains[0]}</div>}
                  </div>
                  {switching === tn.id
                    ? <Loader2 size={13} className="flex-shrink-0 animate-spin" style={{ color: '#9CA3AF' }} />
                    : isActive && <div className="flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: 'var(--color-primary)' }} />}
                </button>
              )
            })}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-3" style={{ fontSize: 12, color: '#9CA3AF' }}>
                <Loader2 size={13} className="animate-spin" /> Laden…
              </div>
            )}
            {!loading && results.length === 0 && (
              <div style={{ padding: '12px 10px', fontSize: 12, color: '#9CA3AF' }}>Geen bureaus gevonden</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Regular top-level pages. Gated entries (see lib/access.js) are filtered by
// accessible_pages below. AI Agents + Workflows are NOT here — they are modules
// shown in their own group (MODULE_NAV_ITEMS) and only for users who may access them.
const NAV_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'candidates',     label: 'Kandidaten',    icon: Users },
  { id: 'applications',   label: 'Sollicitaties', icon: FileText },
  { id: 'vacancies',      label: 'Vacatures',     icon: Briefcase },
  { id: 'customers', label: 'Klanten', icon: Building2 },
]

// Module pages — shown in a separate "Modules" nav group. All are gated by
// accessible_pages (super admin enables them per tenant via the Modules settings tab).
const MODULE_NAV_ITEMS = [
  {
    id: 'shiftmanager', label: 'Shiftmanager', icon: BarChart3,
    children: [
      // Rapporten
      { id: 'shiftmanager.candidates',  label: 'Kandidaten-SM' },
      { id: 'shiftmanager.customers',   label: 'Klanten-SM' },
      { id: 'shiftmanager.locations',   label: 'Locaties-SM' },
      { id: 'shiftmanager.departments', label: 'Afdelingen-SM' },
      { id: 'shiftmanager.contacts',    label: 'Contactpersonen-SM' },
      { id: 'shiftmanager.details',     label: 'Details-SM' },
      // Tabellen
      { id: 'shiftmanager.customers-table',   label: 'Klanten' },
      { id: 'shiftmanager.locations-table',   label: 'Locaties' },
      { id: 'shiftmanager.departments-table', label: 'Afdelingen' },
      { id: 'shiftmanager.contacts-table',    label: 'Contactpersonen' },
    ],
  },
  {
    id: 'helloflex', label: 'HelloFlex', icon: TrendingUp,
    children: [
      { id: 'helloflex.dashboard', label: 'Dashboard-HF' },
    ],
  },
  { id: 'planning',  label: 'Planning',       icon: CalendarDays },
  { id: 'aiagents',  label: 'AI & Workflows', icon: Brain },
  { id: 'whatsapp',  label: 'WhatsApp',       icon: MessageCircle },
]

function SubNavItem({ item, active, onNavigate }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={() => onNavigate(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center w-full rounded-lg mb-0.5 border-none cursor-pointer font-sans transition-all duration-150"
      style={{
        gap: 8, padding: '6px 10px',
        background: active ? 'var(--color-primary-bg)' : hovered ? 'var(--sidebar-hover)' : 'transparent',
        color:      active ? 'var(--color-primary)'    : hovered ? 'var(--sidebar-text)'   : 'var(--sidebar-muted)',
      }}
    >
      <div className="flex-shrink-0 rounded-full"
        style={{ width: 4, height: 4, marginLeft: 2,
          background: active ? 'var(--color-primary)' : 'currentColor' }} />
      <span style={{ fontSize: 12, fontWeight: active ? 500 : 400 }}>{item.label}</span>
    </button>
  )
}

function NavItem({ item, activePage, expanded, openItems, toggleOpen, onNavigate }) {
  const [hovered, setHovered] = useState(false)

  const hasChildren = !!item.children?.length
  const mainPage    = activePage?.split('.')[0]
  const isActive    = !hasChildren && mainPage === item.id
  const isOpen      = openItems.includes(item.id)
  const Icon        = item.icon

  const handleClick = () => {
    if (hasChildren) { toggleOpen(item.id); onNavigate(item.id) }
    else onNavigate(item.id)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        title={!expanded ? item.label : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center w-full rounded-lg mb-0.5 border-none cursor-pointer font-sans transition-all duration-150"
        style={{
          gap:            expanded ? 9 : 0,
          padding:        expanded ? '7px 10px' : '7px',
          justifyContent: expanded ? 'flex-start' : 'center',
          background: isActive ? 'var(--color-primary-bg)' : hovered ? 'var(--sidebar-hover)' : 'transparent',
          color:      isActive ? 'var(--color-primary)'    : hovered ? 'var(--sidebar-text)'   : 'var(--sidebar-muted)',
        }}
      >
        {Icon && <Icon size={15} style={{ flexShrink: 0 }} />}

        {expanded && (
          <>
            <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, flex: 1, textAlign: 'left' }}>
              {item.label}
            </span>
            {item.soon && (
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', padding: '2px 5px',
                background: '#F3F4F6', color: '#9CA3AF', borderRadius: 4, flexShrink: 0,
              }}>
                binnenkort
              </span>
            )}
            {hasChildren ? (
              <ChevronDown size={13} style={{
                flexShrink: 0, opacity: 0.5,
                transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }} />
            ) : (
              !item.soon && isActive && (
                <span className="rounded-full"
                  style={{ width: 5, height: 5, background: 'var(--color-primary)', flexShrink: 0 }} />
              )
            )}
          </>
        )}
      </button>

      {hasChildren && isOpen && expanded && (
        <div className="mb-1" style={{ paddingLeft: 10 }}>
          {item.children.map(child => (
            <SubNavItem key={child.id} item={child}
              active={activePage === child.id} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ expanded, activePage, setActivePage, koiosOpen, onToggleKoios }) {
  const { t } = useTranslation('common')
  const [openItems, setOpenItems] = useState([])
  const auth = useAuth()

  const toggleOpen = (id) =>
    setOpenItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  // Show only the pages/modules this user may access, driven by accessible_pages.
  // For items with children (e.g. Details), also filter each child by canAccessPage.
  // Labels are resolved from i18n (common.nav.*) by id at the same time.
  const visibleNavItems = NAV_ITEMS
    .filter(item => canAccessPage(item.id, auth))
    .map(item => {
      if (!item.children) return { ...item, label: navLabel(t, item.id) }
      return { ...item, label: navLabel(t, item.id),
        children: item.children.filter(child => canAccessPage(child.id, auth)).map(c => ({ ...c, label: navLabel(t, c.id) })) }
    })
  const visibleModuleItems = MODULE_NAV_ITEMS
    .filter(item => canAccessPage(item.id, auth))
    .map(item => {
      if (!item.children) return { ...item, label: navLabel(t, item.id) }
      return { ...item, label: navLabel(t, item.id),
        children: item.children.filter(child => canAccessPage(child.id, auth)).map(c => ({ ...c, label: navLabel(t, c.id) })) }
    })
  const showSettings       = canAccessPage('settings', auth)

  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200"
      style={{ width: expanded ? 220 : 56, background: 'var(--sidebar-bg)',
               borderRight: '1px solid var(--sidebar-border)' }}>

      {/* Brand */}
      <div className="flex items-center justify-center flex-shrink-0"
        style={{
          padding:      '14px 0 13px',
          borderBottom: '1px solid var(--sidebar-border)',
          minHeight: 56,
        }}>
        <div className="flex items-center" style={{ gap: 9, paddingLeft: expanded ? 14 : 0, paddingRight: expanded ? 10 : 0, width: '100%', justifyContent: expanded ? 'flex-start' : 'center' }}>
          {expanded
            ? <img src="/KoiosMatch.png" alt="KoiosMatch" style={{ height: 28, width: 'auto' }} />
            : <img src="/favicon.png" alt="KoiosMatch" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          }
        </div>
      </div>

      <TenantSwitcher expanded={expanded} />

      {/* Nav — only the items this user may access */}
      <div className="flex-1 overflow-auto" style={{ padding: '10px 6px' }}>
        {visibleNavItems.map(item => (
          <NavItem key={item.id} item={item} activePage={activePage}
            expanded={expanded} openItems={openItems}
            toggleOpen={toggleOpen} onNavigate={setActivePage} />
        ))}

        {/* Modules — separate group, only for users who may access them (super admins) */}
        {visibleModuleItems.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {expanded && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', letterSpacing: '0.08em',
                            textTransform: 'uppercase', padding: '0 10px 4px' }}>
                {t('nav.modulesGroup')}
              </div>
            )}
            {visibleModuleItems.map(item => (
              <NavItem key={item.id} item={item} activePage={activePage}
                expanded={expanded} openItems={openItems}
                toggleOpen={toggleOpen} onNavigate={setActivePage} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom — Koios toggle + Settings */}
      <div style={{ padding: '6px 6px 10px', borderTop: '1px solid var(--sidebar-border)' }}>
        {/* Koios AI knop */}
        <button
          onClick={onToggleKoios}
          title="Koios AI"
          className="flex items-center w-full rounded-lg mb-1 border-none cursor-pointer font-sans transition-all duration-150"
          style={{
            gap:            expanded ? 9 : 0,
            padding:        expanded ? '7px 10px' : '7px',
            justifyContent: expanded ? 'flex-start' : 'center',
            background: koiosOpen
              ? 'linear-gradient(135deg, var(--color-primary), #8B5CF6)'
              : 'linear-gradient(135deg, var(--color-primary)20, #8B5CF620)',
            color: '#fff',
          }}
        >
          <div className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 18, height: 18, background: koiosOpen ? 'rgba(255,255,255,0.25)' : 'var(--color-primary)' }}>
            <Bot size={11} color="white" />
          </div>
          {expanded && (
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left',
              color: koiosOpen ? '#fff' : 'var(--color-primary)' }}>
              Koios
            </span>
          )}
          {expanded && !koiosOpen && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px',
              background: 'var(--color-primary)', color: '#fff', borderRadius: 99, letterSpacing: '0.04em' }}>
              AI
            </span>
          )}
        </button>

        {showSettings && (
          <NavItem item={{ id: 'settings', label: t('nav.settings'), icon: Settings }}
            activePage={activePage} expanded={expanded}
            openItems={openItems} toggleOpen={toggleOpen} onNavigate={setActivePage} />
        )}
      </div>
    </div>
  )
}