import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from './Sidebar'
import i18n from '@/i18n'

// Minimal AuthContext stub: no tenant/permissions restrictions, so every base
// nav item (candidates included) stays visible regardless of gating logic.
// KOIOS-CARDS-MODULE-GATE-1: the tenant's module list is per test — the Koios gate tests flip it.
let tenantModules: string[] | undefined
let superAdmin = false
// KOIOS-NAV-SUPERADMIN-1: the user's permission list is per test too (undefined = no user);
// hasPermission mirrors the real context: super admins and the "*" wildcard grant everything.
let userPerms: string[] | undefined
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    activeTenant: tenantModules ? { id: 't1', modules: tenantModules } : null,
    user: userPerms ? { id: 'u1', permissions: userPerms, is_super_admin: superAdmin } : null,
    isSuperAdmin: () => superAdmin, setActiveTenant: vi.fn(),
    hasPermission: (name: string) => superAdmin || (userPerms ?? []).includes('*') || (userPerms ?? []).includes(name),
  }),
}))

const baseProps = {
  expanded: true,
  activePage: 'candidates',
  setActivePage: vi.fn(),
  koiosOpen: false,
  onToggleKoios: vi.fn(),
}

// SIDEBAR-I18N-1 (L1): every nav label must resolve through i18n, not render the
// raw Dutch registry string — the smoke suite clicks nav items by their Dutch
// label under the default nl language, so nl must keep working too.
describe('Sidebar — nav label i18n', () => {
  // Non-nl bundles load lazily through the i18n backend, so the switch must be awaited.
  it('reads Candidates (not Kandidaten) when the language is English', async () => {
    await i18n.changeLanguage('en')
    render(<Sidebar {...baseProps} />)
    expect(screen.getByText('Candidates')).toBeInTheDocument()
    expect(screen.queryByText('Kandidaten')).toBeNull()
  })

  it('still reads Kandidaten under the default nl language', async () => {
    await i18n.changeLanguage('nl')
    render(<Sidebar {...baseProps} />)
    expect(screen.getByText('Kandidaten')).toBeInTheDocument()
  })
})

// KOIOS-CARDS-MODULE-GATE-1: the Koios toggle follows the tenant's koios_ai module strictly —
// no super-admin bypass, so a super admin parked on a Core tenant gets no toggle (and no 403 panel).
describe('Sidebar — Koios toggle follows the tenant koios_ai module', () => {
  it('shows the toggle when the tenant has koios_ai', () => {
    tenantModules = ['ats', 'koios_ai']; superAdmin = false
    render(<Sidebar {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Koios AI' })).toBeInTheDocument()
  })

  it('hides the toggle for a super admin on a tenant without koios_ai', () => {
    tenantModules = ['ats', 'koios_assist']; superAdmin = true
    render(<Sidebar {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Koios AI' })).toBeNull()
  })
})

// KOIOS-NAV-SUPERADMIN-1 (Danny 21-09): /auth/me hands a super admin `permissions: ["*"]`;
// the toggle must not vanish for the one user who may do everything, while an explicit
// list without koios.use still hides it (least privilege on display).
describe('Sidebar — Koios toggle and the permission half', () => {
  it('shows the toggle for a super admin whose payload carries the "*" wildcard', () => {
    tenantModules = ['ats', 'koios_ai']; superAdmin = true; userPerms = ['*']
    render(<Sidebar {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Koios AI' })).toBeInTheDocument()
    userPerms = undefined
  })

  it('shows the toggle for a regular user whose explicit list carries koios.use', () => {
    tenantModules = ['ats', 'koios_ai']; superAdmin = false; userPerms = ['candidates.view', 'koios.use']
    render(<Sidebar {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Koios AI' })).toBeInTheDocument()
    userPerms = undefined
  })

  it('hides the toggle for a regular user whose explicit list lacks koios.use', () => {
    tenantModules = ['ats', 'koios_ai']; superAdmin = false; userPerms = ['candidates.view']
    render(<Sidebar {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Koios AI' })).toBeNull()
    userPerms = undefined
  })
})
