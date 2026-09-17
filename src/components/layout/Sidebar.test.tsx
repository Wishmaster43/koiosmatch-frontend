import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from './Sidebar'
import i18n from '@/i18n'

// Minimal AuthContext stub: no tenant/permissions restrictions, so every base
// nav item (candidates included) stays visible regardless of gating logic.
// KOIOS-CARDS-MODULE-GATE-1: the tenant's module list is per test — the Koios gate tests flip it.
let tenantModules: string[] | undefined
let superAdmin = false
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    activeTenant: tenantModules ? { id: 't1', modules: tenantModules } : null,
    user: null, isSuperAdmin: () => superAdmin, setActiveTenant: vi.fn(),
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
