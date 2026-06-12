import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Zap, Users, Building2, MapPin, Layers,
  MessageCircle, Table2, Settings, ChevronDown,
} from 'lucide-react'

function TenantSwitcher({ expanded }) {
  const { activeTenant, tenants, setActiveTenant, isSuperAdmin } = useAuth()
  const [open, setOpen] = useState(false)

  const initials = activeTenant?.name
    ? activeTenant.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??'

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
    <div className="relative flex-shrink-0 mx-3 mt-3">
      <button
        onClick={() => isSuperAdmin() && setOpen(o => !o)}
        className="flex items-center w-full transition-colors rounded-lg"
        style={{
          gap: 8, padding: '7px 9px',
          background: '#F8F9FF', border: '1px solid #EBEBF5',
          cursor: isSuperAdmin() ? 'pointer' : 'default',
        }}
        onMouseEnter={e => isSuperAdmin() && (e.currentTarget.style.background = '#F0F0FF')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FF')}
      >
        <div className="flex items-center justify-center flex-shrink-0 rounded"
          style={{ width: 22, height: 22, background: '#3B8FD4', fontSize: 8, color: 'white', fontWeight: 700 }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div style={{ fontSize: 11, fontWeight: 500, color: '#374151', lineHeight: 1.2 }} className="truncate">
            {activeTenant?.name ?? 'Selecteer tenant'}
          </div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>
            {isSuperAdmin() ? 'Super admin' : 'Flex staffing'}
          </div>
        </div>
        {isSuperAdmin() && tenants.length > 1 && (
          <ChevronDown size={12} style={{ color: '#9CA3AF', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        )}
      </button>

      {open && isSuperAdmin() && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden bg-white top-full rounded-xl"
          style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400">Wissel van tenant</p>
          </div>
          {tenants.map(tenant => {
            const ini = tenant.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            const isActive = activeTenant?.id === tenant.id
            return (
              <button key={tenant.id}
                onClick={() => { setActiveTenant(tenant); setOpen(false) }}
                className="flex items-center gap-3 w-full px-3 py-2.5 transition-colors"
                style={{ background: isActive ? '#F8F9FF' : 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'none')}
              >
                <div className="flex items-center justify-center flex-shrink-0 rounded"
                  style={{ width: 24, height: 24, background: '#3B8FD4', fontSize: 9, color: 'white', fontWeight: 700 }}>
                  {ini}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-gray-700 truncate">{tenant.name}</div>
                  <div className="text-xs text-gray-400">{tenant.id}</div>
                </div>
                {isActive && (
                  <div className="flex-shrink-0 rounded-full"
                    style={{ width: 6, height: 6, background: 'var(--color-primary)' }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'aiagents',   label: 'AI Agents',  icon: Zap },
  { id: 'workflows',   label: 'Workflows',  icon: Zap },
//  { id: 'apiconnections',   label: 'API Connections',  icon: Zap },
  { id: 'candidates',  label: 'Kandidaten', icon: Users },
  { id: 'customers',   label: 'Klanten',    icon: Building2 },
  { id: 'locations',   label: 'Locaties',   icon: MapPin },
  { id: 'departments', label: 'Afdelingen', icon: Layers },
  { id: 'whatsapp',    label: 'WhatsApp',   icon: MessageCircle },
  {
    id: 'details', label: 'Details', icon: Table2,
    children: [
      { id: 'details.candidates',  label: 'Kandidaten' },
      { id: 'details.customers',   label: 'Klanten' },
      { id: 'details.locations',   label: 'Locaties' },
      { id: 'details.departments', label: 'Afdelingen' },
      { id: 'details.contacts',    label: 'Contactpersonen' },
      { id: 'details.orders',      label: 'Diensten' },
      { id: 'details.runs',        label: 'Uitvoeringen' },
      { id: 'details.messages',    label: 'Berichten' },
    ],
  },
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
    if (hasChildren) toggleOpen(item.id)
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
            {hasChildren ? (
              <ChevronDown size={13} style={{
                flexShrink: 0, opacity: 0.5,
                transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }} />
            ) : (
              isActive && (
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

export default function Sidebar({ expanded, activePage, setActivePage, onTheme }) {
  const [openItems, setOpenItems] = useState([])

  const toggleOpen = (id) =>
    setOpenItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

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
          <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
            style={{ width: 28, height: 28, background: 'var(--color-primary)' }}>
            <Zap size={14} color="white" />
          </div>
          {expanded && (
            <span className="font-mono font-semibold tracking-wide"
              style={{ fontSize: 13, color: 'var(--sidebar-text)' }}>
              koios Connect
            </span>
          )}
        </div>
      </div>

      <TenantSwitcher expanded={expanded} />

      {/* Nav */}
      <div className="flex-1 overflow-auto" style={{ padding: '10px 6px' }}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.id} item={item} activePage={activePage}
            expanded={expanded} openItems={openItems}
            toggleOpen={toggleOpen} onNavigate={setActivePage} />
        ))}
      </div>

      {/* Bottom */}
      <div style={{ padding: '6px 6px 10px', borderTop: '1px solid var(--sidebar-border)' }}>
        <NavItem item={{ id: 'settings', label: 'Instellingen', icon: Settings }}
          activePage={activePage} expanded={expanded}
          openItems={openItems} toggleOpen={toggleOpen} onNavigate={setActivePage} />
      </div>
    </div>
  )
}