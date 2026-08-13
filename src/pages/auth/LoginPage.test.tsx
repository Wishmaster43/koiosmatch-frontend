/**
 * LoginPage.test — regression coverage for LOGIN-THROTTLE-1 (Danny 13-08): a 429
 * with retry_after must render a LIVE counting-down notice (not the raw, static,
 * Dutch-only server string) and re-enable the submit button at zero. Loads the
 * real NL auth namespace so the countdown NUMBER is asserted through the actual
 * interpolation, not a raw i18n key.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import nlAuth from '@/i18n/locales/nl/auth.json'
import LoginPage from './LoginPage'

// The login seam is mocked at the AuthContext boundary — the test drives the
// exact axios-shaped rejection the backend produces for a throttled login.
const loginMock = vi.fn()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, verifyMfa: vi.fn() }),
}))

// Real NL strings so `login.throttled` interpolates a visible seconds value.
const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({
  lng: 'nl', fallbackLng: 'nl',
  resources: { nl: { auth: nlAuth } },
  defaultNS: 'auth', interpolation: { escapeValue: false },
})

const renderLogin = () => render(
  <I18nextProvider i18n={i18n}>
    <MemoryRouter><LoginPage /></MemoryRouter>
  </I18nextProvider>,
)

// Fill both required fields and submit the form.
const submit = () => {
  fireEvent.change(screen.getByLabelText(nlAuth.login.email), { target: { value: 'danny@yesway.nl' } })
  fireEvent.change(screen.getByLabelText(nlAuth.login.password), { target: { value: 'geheim' } })
  fireEvent.click(screen.getByRole('button', { name: nlAuth.login.signIn }))
}

describe('LoginPage · 429 throttle countdown', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
  afterEach(() => { vi.useRealTimers(); loginMock.mockReset() })

  it('renders a live countdown from retry_after and re-enables the button at 0', async () => {
    loginMock.mockRejectedValueOnce({ response: { status: 429, data: { message: 'Te veel loginpogingen.', retry_after: 3 } } })
    renderLogin()
    await act(async () => { submit() })

    // The translated notice shows the seconds — never the raw server message.
    expect(screen.getByRole('status').textContent).toContain('3 s')
    expect(screen.queryByText('Te veel loginpogingen.')).toBeNull()
    expect(screen.getByRole('button', { name: nlAuth.login.signIn })).toBeDisabled()

    // One second later the promise in the text has moved along with reality.
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getByRole('status').textContent).toContain('2 s')

    // At zero the notice clears and the button is usable again. Each tick
    // schedules its successor only after React's flush, so advance per second —
    // exactly like the real clock.
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: nlAuth.login.signIn })).toBeEnabled()
  })

  it('keeps the ordinary error path for non-429 failures', async () => {
    loginMock.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Onjuiste gegevens.' } } })
    renderLogin()
    await act(async () => { submit() })
    // Server message shown as before; no countdown, button immediately usable.
    expect(screen.getByText('Onjuiste gegevens.')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: nlAuth.login.signIn })).toBeEnabled()
  })
})
