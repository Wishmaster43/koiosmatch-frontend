/**
 * ProfileEmailConnect — regression tests: (1) the connected mailbox address
 * renders via the shared Mono atom (JetBrains Mono), not a hand-written
 * `fontFamily: 'monospace'`; (2) a failed GET /profile/email renders a real
 * error state with a retry, never the 'disconnected' provider chooser (§0
 * four UI states — a failed fetch must never render as a successful one).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileEmailConnect from './ProfileEmailConnect'
import api from '@/lib/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { provider?: string }) => opts?.provider ? `${key}:${opts.provider}` : key }),
}))
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
