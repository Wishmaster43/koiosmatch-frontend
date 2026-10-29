/**
 * ProfileEmailConnect — regression tests: (1) the connected mailbox address
 * renders via the shared Mono atom (JetBrains Mono), not a hand-written
 * `fontFamily: 'monospace'`; (2) a failed GET /profile/email renders a real
 * error state with a retry, never the 'disconnected' provider chooser (§0
 * four UI states — a failed fetch must never render as a successful one).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileEmailConnect from './ProfileEmailConnect'
import api from '@/lib/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { provider?: string }) => opts?.provider ? `${key}:${opts.provider}` : key }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDateTime: (v: string) => `dt(${v})` }) }))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('ProfileEmailConnect · connected mailbox', () => {
  it('renders the connected email via the shared Mono atom, not a hand-written fontFamily', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'connected', provider: 'gmail', email: 'a@b.nl' } })
    render(<ProfileEmailConnect />)

    const emailEl = await screen.findByText('a@b.nl')
    expect(emailEl.style.fontFamily).toContain('JetBrains Mono')
  })
})

describe('ProfileEmailConnect · load error (§0 four UI states)', () => {
  it('shows a real error with a retry instead of the disconnected provider chooser', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 500 } })
    render(<ProfileEmailConnect />)

    expect(await screen.findByText('profile.email.loadError')).toBeInTheDocument()
    // The provider chooser (disconnected state) must not render on an error.
    expect(screen.queryByText('profile.email.connectWith:Office 365')).not.toBeInTheDocument()

    // Retry re-fires the GET (StrictMode-safe: assert an ADDITIONAL call, not a fixed total).
    const callsBeforeRetry = vi.mocked(api.get).mock.calls.length
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'disconnected' } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(callsBeforeRetry))
  })
})

describe('ProfileEmailConnect · OAuth callback (G-009)', () => {
  afterEach(() => { window.history.replaceState(null, '', '/') })

  it('shows the reason-aware error banner and strips the params', async () => {
    window.history.replaceState(null, '', '/#profile?email_oauth=error&context=personal&reason=browser_mismatch&request_id=9')
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'disconnected' } })
    render(<ProfileEmailConnect />)

    expect(await screen.findByText('profile.email.oauthReasonBrowserMismatch')).toBeInTheDocument()
    expect(window.location.hash).toBe('#profile')
  })

  it('falls back to the generic error for an unknown reason', async () => {
    window.history.replaceState(null, '', '/#profile?email_oauth=error&reason=weird')
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'disconnected' } })
    render(<ProfileEmailConnect />)
    expect(await screen.findByText('profile.email.oauthError')).toBeInTheDocument()
  })

  it('shows the success text and reloads the status when connected', async () => {
    window.history.replaceState(null, '', '/#profile?email_oauth=connected&context=personal&email=a%40b.nl')
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'connected', provider: 'gmail', email: 'a@b.nl' } })
    render(<ProfileEmailConnect />)
    expect(await screen.findByText('profile.email.oauthConnected')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(window.location.hash).toBe('#profile')
  })
})

describe('ProfileEmailConnect · mailbox health', () => {
  it('needs_reconnect renders the warning and a connect button that posts the provider', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'needs_reconnect', provider: 'gmail', email: 'a@b.nl' } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    render(<ProfileEmailConnect />)
    expect(await screen.findByText('profile.email.needsReconnect')).toBeInTheDocument()
    expect(screen.queryByText('profile.email.connected')).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'profile.email.connectWith:Gmail' }))
    expect(api.post).toHaveBeenCalledWith('/profile/email/connect', { provider: 'gmail' })
  })

  it('tenant_policy renders the info box with a connect-again button that POSTs the connect route', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'tenant_policy', provider: 'office' } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    render(<ProfileEmailConnect />)
    expect(await screen.findByText('profile.email.tenantPolicy')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'profile.email.connectWith:Office 365' }))
    expect(api.post).toHaveBeenCalledWith('/profile/email/connect', { provider: 'office' })
  })

  it('tenant_policy on an SMTP mailbox offers no OAuth button', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'tenant_policy', provider: 'smtp' } })
    render(<ProfileEmailConnect />)
    expect(await screen.findByText('profile.email.tenantPolicy')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ProfileEmailConnect · needs_reconnect detail (T-006)', () => {
  it('shows the translated reason and the formatted check time, never the ISO string', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'needs_reconnect', provider: 'gmail', status_reason: 'smtp_auth_refused', status_at: '2026-10-22T20:00:00Z' } })
    render(<ProfileEmailConnect />)
    expect(await screen.findByText('profile.email.reasonSmtpAuthRefused')).toBeInTheDocument()
    expect(screen.getByText('profile.email.statusAt')).toBeInTheDocument()
    expect(screen.queryByText(/2026-10-22T/)).not.toBeInTheDocument()
  })

  it('an SMTP mailbox gets no OAuth connect button, and disconnect posts to the disconnect route', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'needs_reconnect', provider: 'smtp' } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    render(<ProfileEmailConnect />)
    expect(await screen.findByText('profile.email.needsReconnectSmtp')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /profile\.email\.connectWith/ })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'profile.email.disconnect' }))
    expect(api.post).toHaveBeenCalledWith('/profile/email/disconnect')
  })

  it('a gmail mailbox re-links with its own provider and also offers disconnect', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'needs_reconnect', provider: 'gmail' } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    render(<ProfileEmailConnect />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'profile.email.connectWith:Gmail' }))
    expect(api.post).toHaveBeenCalledWith('/profile/email/connect', { provider: 'gmail' })
    expect(screen.getByRole('button', { name: 'profile.email.disconnect' })).toBeInTheDocument()
  })
})
