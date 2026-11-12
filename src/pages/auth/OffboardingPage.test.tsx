/** OffboardingPage — title, dated/undated body, sign-out is the only action. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OffboardingPage from './OffboardingPage'
import { useAuth } from '@/context/AuthContext'

// Key echo that also prints the interpolated date so the formatting is visible.
vi.mock('react-i18next', async () => ({
  ...(await vi.importActual<object>('react-i18next')),
  useTranslation: () => ({ t: (key: string, o?: { date?: string }) => (o?.date ? `${key}|${o.date}` : key), i18n: { language: 'nl' } }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))

const logout = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({ logout } as unknown as ReturnType<typeof useAuth>)
})

describe('OffboardingPage', () => {
  it('shows the title and the body with the DD-MM-YYYY date, never ISO', () => {
    render(<OffboardingPage dueAt="2026-12-07T12:00:00+00:00" />)
    expect(screen.getByText('offboarding.title')).toBeInTheDocument()
    expect(screen.getByText('offboarding.body|07-12-2026')).toBeInTheDocument()
  })

  it('falls back to the dateless body when no due date is known', () => {
    render(<OffboardingPage dueAt={null} />)
    expect(screen.getByText('offboarding.bodyNoDate')).toBeInTheDocument()
  })

  it('signs out through the only button', async () => {
    render(<OffboardingPage dueAt={null} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('button', { name: /offboarding.signOut/ }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('offers a super admin a bureau switch that drops the pinned bureau and reloads', async () => {
    vi.mocked(useAuth).mockReturnValue({ logout, isSuperAdmin: () => true } as unknown as ReturnType<typeof useAuth>)
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } })
    localStorage.setItem('active_tenant', 'demo')
    render(<OffboardingPage dueAt={null} />)
    await userEvent.click(screen.getByRole('button', { name: /offboarding\.switchBureau/ }))
    expect(localStorage.getItem('active_tenant')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/')
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })

  it('shows no bureau switch to a regular user', () => {
    render(<OffboardingPage dueAt={null} />)
    expect(screen.queryByRole('button', { name: /offboarding\.switchBureau/ })).toBeNull()
  })

  it('renders nothing without an auth context', () => {
    vi.mocked(useAuth).mockReturnValue(null as unknown as ReturnType<typeof useAuth>)
    const { container } = render(<OffboardingPage dueAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
