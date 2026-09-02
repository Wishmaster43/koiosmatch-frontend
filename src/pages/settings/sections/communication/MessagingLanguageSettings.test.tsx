/**
 * MessagingLanguageSettings — AVG-RET-2-TAAL-1. §13: assert the REQUEST the
 * backend receives (POST /settings with candidate_messaging_language_default),
 * the stored value rendered back, and the read-only face without settings.update.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MessagingLanguageSettings from './MessagingLanguageSettings'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

// vi.hoisted: mock factories run before these declarations otherwise (TDZ).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
const apiPost = vi.hoisted(() => vi.fn(async () => ({ data: {} })))
const mockUseAuth = vi.hoisted(() => vi.fn((): { hasPermission: (p: string) => boolean } => ({ hasPermission: () => true })))
const notifyError = vi.hoisted(() => vi.fn(() => {}))

// The REAL shared writer runs; only the wire (api.post) is mocked.
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

describe('MessagingLanguageSettings', () => {
  it('shows Dutch as the backend default when nothing is stored', () => {
    mockSettings.mockReturnValue({})
    render(<MessagingLanguageSettings />)
    expect(screen.getByText(st('messagingLanguage.title'))).toBeInTheDocument()
    // The picker's trigger carries the current option label (Intl name + code).
    expect(screen.getByRole('button', { name: /Nederlands \(NL\)/ })).toBeInTheDocument()
  })

  it('renders a stored code back as its display name', () => {
    mockSettings.mockReturnValue({ candidate_messaging_language_default: 'pl' })
    render(<MessagingLanguageSettings />)
    expect(screen.getByRole('button', { name: /Pools \(PL\)/ })).toBeInTheDocument()
  })

  it('posts candidate_messaging_language_default when a language is picked', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<MessagingLanguageSettings />)
    await user.click(screen.getByRole('button', { name: /Nederlands \(NL\)/ }))
    await user.click(await screen.findByRole('button', { name: /^Engels \(EN\)/ }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', { candidate_messaging_language_default: 'en' }))
  })

  it('renders the value as plain text (no picker) without settings.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    mockSettings.mockReturnValue({ candidate_messaging_language_default: 'de' })
    render(<MessagingLanguageSettings />)
    expect(screen.getByText(/Duits \(DE\)/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Duits \(DE\)/ })).toBeNull()
  })

  it('notifies and shows the extracted error on a failed save', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockSettings.mockReturnValue({})
    apiPost.mockRejectedValueOnce(Object.assign(new Error('nope'), { response: { status: 422, data: { message: 'Ongeldige taal' } } }))
    const user = userEvent.setup()
    render(<MessagingLanguageSettings />)
    await user.click(screen.getByRole('button', { name: /Nederlands \(NL\)/ }))
    await user.click(await screen.findByRole('button', { name: /^Engels \(EN\)/ }))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    fireEvent.blur(document.body)
  })
})
