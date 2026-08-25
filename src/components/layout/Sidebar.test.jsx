import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from './Sidebar'
import i18n from '@/i18n'

// Minimal AuthContext stub: no tenant/permissions restrictions, so every base
// nav item (candidates included) stays visible regardless of gating logic.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeTenant: null, user: null, isSuperAdmin: () => false, setActiveTenant: vi.fn() }),
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
  it('reads Candidates (not Kandidaten) when the language is English', () => {
    i18n.changeLanguage('en')
    render(<Sidebar {...baseProps} />)
    expect(screen.getByText('Candidates')).toBeInTheDocument()
    expect(screen.queryByText('Kandidaten')).toBeNull()
  })

  it('still reads Kandidaten under the default nl language', () => {
    i18n.changeLanguage('nl')
    render(<Sidebar {...baseProps} />)
    expect(screen.getByText('Kandidaten')).toBeInTheDocument()
  })
})
