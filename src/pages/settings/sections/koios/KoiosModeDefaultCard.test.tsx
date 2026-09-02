/**
 * KoiosModeDefaultCard — KOIOS-MODE-DEFAULT tests. §13: assert the REQUEST
 * (exact key/value), not only that a save function fired. Renders the current
 * values from the shared /settings blob ('1'/'0' -> boolean per the backend's
 * own contract for these two keys), and gates on settings.update.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosModeDefaultCard from './KoiosModeDefaultCard'

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

describe('KoiosModeDefaultCard — reads the tenant default', () => {
  it('shows the seeded wizard/off default when nothing is stored', () => {
    mockSettings.mockReturnValue({})
    render(<KoiosModeDefaultCard />)
    expect(screen.getByRole('radio', { name: st('modeDefault.wizard') })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('reads a stored auto/on default, coercing the backend\'s \'1\' string to true', () => {
    mockSettings.mockReturnValue({ 'koios.mode_default': 'auto', 'koios.auto_messages_default': '1' })
    render(<KoiosModeDefaultCard />)
    expect(screen.getByRole('radio', { name: st('modeDefault.auto') })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})

describe('KoiosModeDefaultCard — saves', () => {
  it('posts koios.mode_default when switching to auto', async () => {
    mockSettings.mockReturnValue({})
    render(<KoiosModeDefaultCard />)

    fireEvent.click(screen.getByRole('radio', { name: st('modeDefault.auto') }))

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', { 'koios.mode_default': 'auto' }))
  })

  it('posts koios.auto_messages_default when the toggle is switched on', async () => {
    mockSettings.mockReturnValue({})
    render(<KoiosModeDefaultCard />)

    fireEvent.click(screen.getByRole('switch'))

    // Booleans travel as the backend's own '1'/'0' convention (equal to the read-back).
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', { 'koios.auto_messages_default': '1' }))
  })

  it('notifies and shows the extracted error on a failed save', async () => {
    mockSettings.mockReturnValue({})
    apiPost.mockRejectedValueOnce({ response: { data: { errors: { 'koios.mode_default': ['Ongeldige waarde.'] } } } })
    render(<KoiosModeDefaultCard />)

    fireEvent.click(screen.getByRole('radio', { name: st('modeDefault.auto') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalled())
  })
})

describe('KoiosModeDefaultCard — gated on settings.update', () => {
  it('renders the mode as plain text (no chooser) without settings.update — never a swallowed click', () => {
    mockSettings.mockReturnValue({ 'koios.mode_default': 'auto' })
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<KoiosModeDefaultCard />)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByText(st('modeDefault.auto'))).toBeInTheDocument()
    expect(screen.getByText(st('modeDefault.noPermission'))).toBeInTheDocument()
  })

  it('disables the toggle and shows the no-permission notice without it', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    mockSettings.mockReturnValue({})
    render(<KoiosModeDefaultCard />)

    expect(screen.getByRole('switch')).toBeDisabled()
    expect(screen.getByText(st('modeDefault.noPermission'))).toBeInTheDocument()
  })
})
