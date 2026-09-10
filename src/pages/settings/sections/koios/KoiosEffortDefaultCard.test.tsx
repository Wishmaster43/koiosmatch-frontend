/**
 * KoiosEffortDefaultCard — X-8 tests. §13: assert the REQUEST (exact key/value),
 * not only that a save function fired. Renders the stored effort level
 * (default 'high'), gates on settings.update, and shows server 422 messages inline.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosEffortDefaultCard from './KoiosEffortDefaultCard'

const st = (key: string) => i18n.t(key, { ns: 'koios' })

// vi.hoisted: mock factories run before these declarations otherwise (TDZ).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
const apiPost = vi.hoisted(() => vi.fn(async () => ({ data: {} })))
const mockUseAuth = vi.hoisted(() => vi.fn((): { hasPermission: (p: string) => boolean } => ({ hasPermission: () => true })))
const notifyError = vi.hoisted(() => vi.fn(() => {}))

// The REAL shared writer runs; only the wire (api.post) is mocked so the test
// asserts the request the backend receives (§13), not a function argument.
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...(actual.default as object), post: apiPost, get: vi.fn() } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/notify', () => ({ notifyError }))

afterEach(() => vi.clearAllMocks())

describe('KoiosEffortDefaultCard — reads the tenant default', () => {
  it('shows the seeded high default when nothing is stored', () => {
    mockSettings.mockReturnValue({})
    render(<KoiosEffortDefaultCard />)
    const button = screen.getByRole('button', { name: /Hoog|Laag|Gemiddeld|Extra hoog|Maximaal/ })
    expect(button).toHaveTextContent(st('effort.high'))
  })

  it('reads a stored effort level', () => {
    mockSettings.mockReturnValue({ 'koios_default_effort': 'xhigh' })
    render(<KoiosEffortDefaultCard />)
    const button = screen.getByRole('button', { name: /Hoog|Laag|Gemiddeld|Extra hoog|Maximaal/ })
    expect(button).toHaveTextContent(st('effort.xhigh'))
  })
})

describe('KoiosEffortDefaultCard — saves', () => {
  it('posts koios_default_effort when selecting a level', async () => {
    mockSettings.mockReturnValue({})
    render(<KoiosEffortDefaultCard />)

    // Open the dropdown and select a different level.
    fireEvent.click(screen.getByRole('button', { name: /Hoog|Laag|Gemiddeld|Extra hoog|Maximaal/ }))

    // Find and click the "medium" option.
    const mediumOption = screen.getByText(st('effort.medium'))
    fireEvent.click(mediumOption)

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', { 'koios_default_effort': 'medium' }))
  })

  it('notifies and shows the extracted error on a 422 failed save', async () => {
    mockSettings.mockReturnValue({})
    apiPost.mockRejectedValueOnce({ response: { data: { errors: { 'koios_default_effort': ['Effort level exceeds package ceiling.'] } } } })
    render(<KoiosEffortDefaultCard />)

    fireEvent.click(screen.getByRole('button', { name: /Hoog|Laag|Gemiddeld|Extra hoog|Maximaal/ }))
    const maxOption = screen.getByText(st('effort.max'))
    fireEvent.click(maxOption)

    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    // The extracted error message should be shown inline.
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    // This card's own error shape (rule B, DRY round 10): a 12px status div.
    expect(screen.getByRole('status')).toHaveStyle({ fontSize: '12px' })
  })
})

describe('KoiosEffortDefaultCard — gated on settings.update', () => {
  it('renders the effort as plain text (no dropdown) without settings.update — never a swallowed click', () => {
    mockSettings.mockReturnValue({ 'koios_default_effort': 'high' })
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<KoiosEffortDefaultCard />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(st('effort.high'))).toBeInTheDocument()
    expect(screen.getByText(st('effortDefault.noPermission'))).toBeInTheDocument()
  })
})
