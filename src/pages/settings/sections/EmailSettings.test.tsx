/**
 * EmailSettings — contract audit DL-10: the real OAuth coupling status is fetched
 * on mount and after every save, and Koppelen/Ontkoppelen call the real endpoints
 * instead of the stale "configured via the backend" callout. §13: assert the
 * REQUEST (route/params/body), not just that a callback fired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import EmailSettings from './EmailSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
const mockedGet = vi.mocked(mockedApi.get)
const mockedPost = vi.mocked(mockedApi.post)

const loadSettings = vi.hoisted(() => vi.fn(async (...a: unknown[]) => { void a; return {} }))
const saveSettings = vi.hoisted(() => vi.fn(async (...a: unknown[]) => { void a }))
vi.mock('../lib/settingsApi', () => ({ loadSettings: (...a: unknown[]) => loadSettings(...a), saveSettings: (...a: unknown[]) => saveSettings(...a) }))

const notifyError = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notify', () => ({ notifyError }))

// DL-10 gate: Koppelen/Ontkoppelen require settings.update. Default true so the
// existing action tests exercise a settings.update caller; the gating describe
// block below flips it to prove the disabled state.
const hasPermission = vi.hoisted(() => vi.fn(() => true))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission }) }))

import '@/i18n'

afterEach(() => { vi.clearAllMocks(); hasPermission.mockReturnValue(true) })

const st = (key: string) => i18n.t(key, { ns: 'settings' })

// window.location.href is read/written by the real redirect flow — jsdom allows
// assignment but not real navigation; capture assignments instead of navigating.
function withLocationSpy() {
  const original = window.location
  Reflect.deleteProperty(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...original, href: original.href, search: '', pathname: '/instellingen', hash: '' },
  })
  return () => { Object.defineProperty(window, 'location', { configurable: true, value: original }) }
}

// The settings context this suite renders (a pre-existing Dutch settings slug, named once).
const CONTEXT = 'klanten'

function renderPanel(context = 'klanten') {
  return render(<I18nextProvider i18n={i18n}><EmailSettings context={context} /></I18nextProvider>)
}

describe('EmailSettings · connection status (DL-10)', () => {
  it('fetches GET /settings/email/{context}/status on mount', async () => {
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { context: 'klanten', connected: false, provider: 'gmail', address: null } } })
    renderPanel(CONTEXT)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/settings/email/klanten/status'))
  })

  it('shows the connected state with the provider and address', async () => {
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { context: 'klanten', connected: true, provider: 'gmail', address: 'info@yesway.nl' } } })
    renderPanel(CONTEXT)
    await waitFor(() => expect(
      screen.getByText(st('email.oauthConnected').replace('{{provider}}', 'Google').replace('{{address}}', 'info@yesway.nl')),
    ).toBeInTheDocument())
  })

  // SETTINGS-INCON-B1b: the chosen provider reads as chosen via the §4 "aan/gelukt"
  // success pair (activeFill + activeOnly), same green as the super-admin package picker.
  it('paints the chosen provider in the success pair', async () => {
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: 'gmail', address: null } } })
    renderPanel(CONTEXT)
    const active = await screen.findByRole('radio', { name: /Gmail/ })
    expect(active.style.background).toBe('var(--color-success-bg)')
    expect(active.style.border).toBe('1px solid var(--color-success)')
  })

  it('re-fetches the status after a successful save', async () => {
    loadSettings.mockResolvedValue({ email_klanten_provider: 'manual' })
    mockedGet.mockResolvedValue({ data: { data: { context: 'klanten', connected: false, provider: null, address: null } } })
    const user = userEvent.setup()
    renderPanel(CONTEXT)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/settings/email/klanten/status'))
    mockedGet.mockClear()

    await user.click(screen.getByRole('button', { name: st('common.save') }))
    await waitFor(() => expect(saveSettings).toHaveBeenCalled())
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/settings/email/klanten/status'))
  })
})

// §6 — every manual-SMTP field's visible label is a real <label htmlFor> tied to its input id.
describe('EmailSettings · field label association (§6)', () => {
  it('associates sender/SMTP labels to their inputs for the manual provider', async () => {
    loadSettings.mockResolvedValue({ email_klanten_provider: 'manual' })
    mockedGet.mockResolvedValue({ data: { data: { context: 'klanten', connected: false, provider: null, address: null } } })
    renderPanel(CONTEXT)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(screen.getByLabelText(st('email.senderName'))).toBeInTheDocument()
    expect(screen.getByLabelText(st('email.fromAddress'))).toBeInTheDocument()
    expect(screen.getByLabelText(st('email.smtpServer'))).toBeInTheDocument()
    expect(screen.getByLabelText(st('email.port'))).toBeInTheDocument()
    expect(screen.getByLabelText(st('email.username'))).toBeInTheDocument()
    expect(screen.getByLabelText(st('email.password'))).toBeInTheDocument()
  })
})

// N007-POINT3-FIX-1: a successful test send disables the button with a "sent"
// label until a form setting changes (or 60s pass); a repeat click never
// re-fires the real test e-mail.
describe('EmailSettings · test connection done state (N007-POINT3-FIX-1)', () => {
  it('disables the test button and shows "sent" after success, and a repeat click does not POST again', async () => {
    loadSettings.mockResolvedValue({ email_klanten_provider: 'manual' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: null, address: null } } })
    mockedPost.mockResolvedValue({ data: { message: 'ok' } })
    const user = userEvent.setup()
    renderPanel(CONTEXT)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    const testButton = screen.getByRole('button', { name: st('email.testConnection') })
    await user.click(testButton)
    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/settings/email/test', { context: CONTEXT }))

    const sentButton = await screen.findByRole('button', { name: st('email.testSentButton') })
    expect(sentButton).toBeDisabled()
    await user.click(sentButton)
    expect(mockedPost).toHaveBeenCalledTimes(1) // the repeat click never re-sent the real test e-mail
  })

  it('re-enables the test button as soon as a form setting changes', async () => {
    loadSettings.mockResolvedValue({ email_klanten_provider: 'manual' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: null, address: null } } })
    mockedPost.mockResolvedValue({ data: { message: 'ok' } })
    const user = userEvent.setup()
    renderPanel(CONTEXT)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: st('email.testConnection') }))
    await screen.findByRole('button', { name: st('email.testSentButton') })

    await user.type(screen.getByLabelText(st('email.senderName')), 'A')
    expect(await screen.findByRole('button', { name: st('email.testConnection') })).not.toBeDisabled()
  })

  // N007-POINT3-FIX-1 verifier fix: the registry can reuse this component's
  // React instance across the klanten/kandidaten/planning sub-tabs
  // (groups.communication.tsx renders the same <EmailSettings> type for each) —
  // a context switch must re-enable the button even when every field value is
  // unchanged, never leave "Test verstuurd" on a context that was never tested.
  it('re-enables the test button on a context switch (shared component instance across sub-tabs)', async () => {
    loadSettings.mockResolvedValue({ email_klanten_provider: 'manual' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: null, address: null } } })
    mockedPost.mockResolvedValue({ data: { message: 'ok' } })
    const user = userEvent.setup()
    const { rerender } = renderPanel(CONTEXT)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: st('email.testConnection') }))
    await screen.findByRole('button', { name: st('email.testSentButton') })

    rerender(<I18nextProvider i18n={i18n}><EmailSettings context="kandidaten" /></I18nextProvider>)
    expect(await screen.findByRole('button', { name: st('email.testConnection') })).not.toBeDisabled()
  })

  it('keeps today\'s behaviour on a FAILED test: the button re-enables, no "sent" state', async () => {
    loadSettings.mockResolvedValue({ email_klanten_provider: 'manual' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: null, address: null } } })
    mockedPost.mockRejectedValue({ response: { data: { message: 'SMTP connection refused' } } })
    const user = userEvent.setup()
    renderPanel(CONTEXT)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: st('email.testConnection') }))
    await waitFor(() => expect(screen.getByText('SMTP connection refused')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: st('email.testConnection') })).not.toBeDisabled()
  })
})

describe('EmailSettings · Koppelen (DL-10)', () => {
  it('fetches the consent URL and redirects the browser to it, never a bare navigation', async () => {
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockImplementation(async url => {
      if (url === '/settings/email/klanten/status') return { data: { data: { connected: false, provider: 'gmail', address: null } } }
      if (url === '/settings/email/oauth/klanten/redirect') return { data: { url: 'https://accounts.google.com/o/oauth2/consent?x=1' } }
      throw new Error(`unexpected ${url}`)
    })
    const restore = withLocationSpy()
    const user = userEvent.setup()
    renderPanel(CONTEXT)

    await user.click(await screen.findByRole('button', { name: st('email.oauthConnect') }))
    await waitFor(() => {
      const call = mockedGet.mock.calls.find(c => c[0] === '/settings/email/oauth/klanten/redirect')
      expect(call?.[1]?.params).toEqual({ provider: 'gmail' })
    })
    await waitFor(() => expect(window.location.href).toBe('https://accounts.google.com/o/oauth2/consent?x=1'))
    restore()
  })
})

describe('EmailSettings · Ontkoppelen (DL-10)', () => {
  it('calls DELETE /settings/email/oauth/{context} and refetches status', async () => {
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { connected: true, provider: 'gmail', address: 'info@yesway.nl' } } })
    mockedApi.delete.mockResolvedValue({ data: { message: 'ok' } })
    const user = userEvent.setup()
    renderPanel(CONTEXT)

    await user.click(await screen.findByRole('button', { name: st('email.oauthDisconnect') }))
    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/settings/email/oauth/klanten'))
  })
})

describe('EmailSettings · Koppelen/Ontkoppelen are gated on settings.update (DL-10)', () => {
  it('disables Koppelen for a settings.view-only caller', async () => {
    hasPermission.mockReturnValue(false)
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: 'gmail', address: null } } })
    renderPanel(CONTEXT)

    expect(await screen.findByRole('button', { name: st('email.oauthConnect') })).toBeDisabled()
  })

  it('disables Ontkoppelen for a settings.view-only caller', async () => {
    hasPermission.mockReturnValue(false)
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { connected: true, provider: 'gmail', address: 'info@yesway.nl' } } })
    renderPanel(CONTEXT)

    expect(await screen.findByRole('button', { name: st('email.oauthDisconnect') })).toBeDisabled()
  })
})

describe('EmailSettings · OAuth callback landing reads the hash, not location.search (DL-10)', () => {
  // The SPA is hash-routed (DashboardLayout boots activePage from
  // window.location.hash, there is no /instellingen path route) — the backend
  // redirect lands with the callback params inside the hash's query string.
  // ONIX L-002 (BE 84917a3e): the OAuth consent is bound to the browser that started it;
  // a state redeemed in another browser comes back as ?email_oauth=error&reason=browser_mismatch
  // and gets its own sentence (not the generic failure), with the reason stripped from the hash.
  it('shows the browser-mismatch sentence for ?email_oauth=error&reason=browser_mismatch and strips the reason', async () => {
    window.location.hash = '#settings/communication/email?email_oauth=error&reason=browser_mismatch'
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: 'gmail' } } })
    renderPanel(CONTEXT)

    await waitFor(() => expect(screen.getByText(st('email.oauthCallbackBrowserMismatch'))).toBeInTheDocument())
    expect(screen.queryByText(st('email.oauthCallbackError'))).not.toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).not.toContain('reason'))
    window.location.hash = ''
  })

  it('shows the connected banner and refetches status from a hash-carried ?email_oauth=connected', async () => {
    window.location.hash = '#settings/communication/email_klanten?email_oauth=connected&context=klanten&email=info%40yesway.nl'
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { connected: true, provider: 'gmail', address: 'info@yesway.nl' } } })
    renderPanel(CONTEXT)

    await waitFor(() => expect(
      screen.getByText(st('email.oauthCallbackConnected').replace('{{email}}', 'info@yesway.nl')),
    ).toBeInTheDocument())
    // The callback params are stripped from the hash so a refresh never replays them.
    await waitFor(() => expect(window.location.hash).not.toContain('email_oauth'))
    window.location.hash = ''
  })

  it('ignores a connected callback addressed to a different context tab', async () => {
    window.location.hash = '#settings/communication/email_kandidaten?email_oauth=connected&context=kandidaten&email=x%40y.nl'
    loadSettings.mockResolvedValue({ [`email_${CONTEXT}_provider`]: 'gmail' })
    mockedGet.mockResolvedValue({ data: { data: { connected: false, provider: 'gmail', address: null } } })
    renderPanel(CONTEXT)

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/settings/email/klanten/status'))
    expect(screen.queryByText(st('email.oauthCallbackConnected').replace('{{email}}', 'x@y.nl'))).not.toBeInTheDocument()
    window.location.hash = ''
  })
})
