/**
 * EmbeddedSignupCard — the coexistence wizard's seams (K-160, §13): the
 * config gate (no dead button while not ready), the happy path through a
 * mocked Meta SDK + the session-info postMessage (facebook.com origins only),
 * the exact exchange body, the calm popup-closed return, and the history sync.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmbeddedSignupCard from './EmbeddedSignupCard'
import { loadFacebookSdk } from './facebookSdk'
import api from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
// The SDK seam — never a real script injection in jsdom.
vi.mock('./facebookSdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./facebookSdk')>()
  return { ...actual, loadFacebookSdk: vi.fn() }
})
// Raw key passthrough (assertions target stable keys, not locale copy).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))

const READY = { data: { data: { ready: true, app_id: 'app-1', config_id: 'cfg-1', graph_version: 'v25.0' } } }
const NOT_READY = { data: { data: { ready: false, app_id: null, config_id: null, graph_version: 'v25.0' } } }

// Dispatch the session-info message the ES popup posts mid-flow.
const postSessionInfo = (origin = 'https://www.facebook.com', waba = 'WABA-1', phone: string | null = 'PHONE-1') => {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      origin,
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', data: { waba_id: waba, phone_number_id: phone } }),
    }))
  })
}

describe('EmbeddedSignupCard', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.post).mockReset(); vi.mocked(loadFacebookSdk).mockReset() })

  it('renders the honest waiting state without a start button while the platform is not ready', async () => {
    vi.mocked(api.get).mockResolvedValue(NOT_READY)
    render(<EmbeddedSignupCard canManage />)
    expect(await screen.findByText('whatsapp.embedded.notReady')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /whatsapp\.embedded\.start/ })).toBeNull()
  })

  it('exchanges the code with the session-info ids from a facebook.com message', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValue(READY)
    // Real order: start opens the popup, the popup posts session-info MID-flow,
    // then the login callback returns the code — so the fake login parks its
    // callback until the test has dispatched the message.
    let loginCb: ((r: { authResponse?: { code?: string } }) => void) | null = null
    vi.mocked(loadFacebookSdk).mockResolvedValue({
      init: vi.fn(),
      login: (cb: (r: { authResponse?: { code?: string } }) => void) => { loginCb = cb },
    })
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'conn-1', waba_id: 'WABA-1', provider: 'embedded' } } })

    render(<EmbeddedSignupCard canManage onLinked={vi.fn()} />)
    await screen.findByRole('button', { name: /whatsapp\.embedded\.start/ })
    await user.click(screen.getByRole('button', { name: /whatsapp\.embedded\.start/ }))
    await waitFor(() => expect(loginCb).not.toBeNull())
    postSessionInfo()
    act(() => { loginCb?.({ authResponse: { code: 'c0de' } }) })

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/whatsapp/embedded-signup/exchange',
      { code: 'c0de', waba_id: 'WABA-1', phone_number_id: 'PHONE-1' },
    ))
    expect(await screen.findByText(/whatsapp\.embedded\.linked/)).toBeInTheDocument()
  })

  it('ignores session-info from a non-facebook origin (calm popup-closed return, no exchange)', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValue(READY)
    let loginCb: ((r: { authResponse?: { code?: string } }) => void) | null = null
    vi.mocked(loadFacebookSdk).mockResolvedValue({
      init: vi.fn(),
      login: (cb: (r: { authResponse?: { code?: string } }) => void) => { loginCb = cb },
    })

    render(<EmbeddedSignupCard canManage />)
    await screen.findByRole('button', { name: /whatsapp\.embedded\.start/ })
    await user.click(screen.getByRole('button', { name: /whatsapp\.embedded\.start/ }))
    postSessionInfo('https://evil.example')
    act(() => { loginCb?.({ authResponse: { code: 'c0de' } }) })

    // Foreign-origin session info is ignored → no waba id → calm error state,
    // and crucially NO exchange call carrying an unverified id.
    await waitFor(() => expect(screen.getByText('whatsapp.embedded.exchangeFailed')).toBeInTheDocument())
    expect(api.post).not.toHaveBeenCalled()
  })

  it('offers the history sync after linking and posts the phone number id', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValue(READY)
    let loginCb: ((r: { authResponse?: { code?: string } }) => void) | null = null
    vi.mocked(loadFacebookSdk).mockResolvedValue({
      init: vi.fn(),
      login: (cb: (r: { authResponse?: { code?: string } }) => void) => { loginCb = cb },
    })
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { data: { id: 'conn-1', waba_id: 'WABA-1', provider: 'embedded' } } })
      .mockResolvedValueOnce({ data: { data: { history_requested: true, contacts_requested: false } } })

    render(<EmbeddedSignupCard canManage />)
    await screen.findByRole('button', { name: /whatsapp\.embedded\.start/ })
    await user.click(screen.getByRole('button', { name: /whatsapp\.embedded\.start/ }))
    await waitFor(() => expect(loginCb).not.toBeNull())
    postSessionInfo()
    act(() => { loginCb?.({ authResponse: { code: 'c0de' } }) })
    await user.click(await screen.findByRole('button', { name: /whatsapp\.embedded\.syncStart/ }))

    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith(
      '/whatsapp/conn-1/request-history-sync',
      { phone_number_id: 'PHONE-1' },
    ))
    expect(await screen.findByText(/whatsapp\.embedded\.syncDone/)).toBeInTheDocument()
  })
})
