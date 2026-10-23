/**
 * ForgotPasswordPage.test — the page always shows its own "sent" text, primes CSRF
 * before the POST, sends exactly { email }, and maps 422/429 to its own texts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18next from 'i18next'
import nlAuth from '@/i18n/locales/nl/auth.json'

const calls: string[] = []
const postMock = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...a: unknown[]) => { calls.push('post'); return postMock(...a) } },
  primeCsrf: () => { calls.push('prime'); return Promise.resolve() },
}))

import ForgotPasswordPage from './ForgotPasswordPage'

const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({
  lng: 'nl', fallbackLng: 'nl', resources: { nl: { auth: nlAuth } },
  defaultNS: 'auth', interpolation: { escapeValue: false },
})

const renderPage = () => render(
  <I18nextProvider i18n={i18n}><MemoryRouter><ForgotPasswordPage /></MemoryRouter></I18nextProvider>,
)
const submit = () => {
  fireEvent.change(screen.getByLabelText(nlAuth.login.email), { target: { value: 'a@b.nl' } })
  fireEvent.click(screen.getByRole('button', { name: nlAuth.forgot.submit }))
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => { calls.length = 0; postMock.mockReset(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
  afterEach(() => vi.useRealTimers())

  it('primes CSRF before the POST and sends exactly { email }; shows own text, not the server text', async () => {
    postMock.mockResolvedValueOnce({ status: 202, data: { message: 'We sent a link' } })
    renderPage()
    await act(async () => { submit() })
    expect(calls).toEqual(['prime', 'post'])
    expect(postMock).toHaveBeenCalledWith('/auth/password/forgot', { email: 'a@b.nl' })
    expect(screen.getByText(nlAuth.forgot.sent)).toBeTruthy()
    expect(screen.queryByText('We sent a link')).toBeNull()
  })

  it('maps a 422 to the field text, never the server text', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 422, data: { message: 'The email field is invalid.' } } })
    renderPage()
    await act(async () => { submit() })
    expect(screen.getByText(nlAuth.forgot.invalidEmail)).toBeTruthy()
    expect(screen.queryByText('The email field is invalid.')).toBeNull()
  })

  it('shows a live countdown on 429 and disables the button', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 429, data: { message: 'x', retry_after: 4 } } })
    renderPage()
    await act(async () => { submit() })
    expect(screen.getByRole('status').textContent).toContain('4 s')
    expect(screen.getByRole('button', { name: nlAuth.forgot.submit })).toBeDisabled()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getByRole('status').textContent).toContain('3 s')
  })

  it('shows the generic error on other failures', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 500, data: {} } })
    renderPage()
    await act(async () => { submit() })
    expect(screen.getByText(nlAuth.forgot.failed)).toBeTruthy()
  })

  it('sends one request on a double submit and links back to /login', async () => {
    postMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    fireEvent.change(screen.getByLabelText(nlAuth.login.email), { target: { value: 'a@b.nl' } })
    const form = screen.getByLabelText(nlAuth.login.email).closest('form')!
    await act(async () => { fireEvent.submit(form); fireEvent.submit(form) })
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: nlAuth.forgot.backToLogin }).getAttribute('href')).toBe('/login')
  })
})
