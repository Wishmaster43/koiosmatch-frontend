/**
 * SetPasswordForm.test — query read, CSRF prime before POST, full body, outcome mapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18next from 'i18next'
import nlAuth from '@/i18n/locales/nl/auth.json'

const calls: string[] = []
const postMock = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...a: unknown[]) => { calls.push('post'); return postMock(...a) } },
  primeCsrf: () => { calls.push('prime'); return Promise.resolve() },
}))
const setNotice = vi.fn()
vi.mock('@/lib/authNotice', () => ({ setAuthNotice: (k: string) => setNotice(k) }))

// Signed-in switch for the AuthContext hook.
let authUser: unknown = null
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authUser }) }))

import SetPasswordForm from './SetPasswordForm'

// Probe that exposes the current location search.
const LocProbe = () => <span data-testid="loc">{useLocation().search}</span>

const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({
  lng: 'nl', fallbackLng: 'nl', resources: { nl: { auth: nlAuth } },
  defaultNS: 'auth', interpolation: { escapeValue: false },
})

const texts = { title: 'TITLE', subtitle: 'SUB', submit: 'GO', invalid: 'DEAD' }
const renderForm = (url: string, requestNewLink = false) => render(
  <I18nextProvider i18n={i18n}>
    <MemoryRouter initialEntries={[url]}>
      <LocProbe />
      <Routes>
        <Route path="/login" element={<div>LOGIN-PAGE</div>} />
        <Route path="/x" element={<SetPasswordForm endpoint="/auth/password/reset" invalidCode="reset_token_invalid"
          noticeKind="password_reset" texts={texts} requestNewLink={requestNewLink} />} />
      </Routes>
    </MemoryRouter>
  </I18nextProvider>,
)
const URL_OK = '/x?token=tok123&email=a%40b.nl'
const fill = (pw: string, again: string) => {
  fireEvent.change(screen.getByLabelText(nlAuth.setPassword.password), { target: { value: pw } })
  fireEvent.change(screen.getByLabelText(nlAuth.setPassword.confirm), { target: { value: again } })
}
const go = () => screen.getByRole('button', { name: 'GO' })

describe('SetPasswordForm', () => {
  beforeEach(() => { calls.length = 0; postMock.mockReset(); setNotice.mockReset(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
  afterEach(() => vi.useRealTimers())

  it('primes CSRF, posts all four fields, sets the notice and goes to /login', async () => {
    postMock.mockResolvedValueOnce({ status: 200, data: { message: 'ok' } })
    renderForm(URL_OK)
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(calls).toEqual(['prime', 'post'])
    expect(postMock).toHaveBeenCalledWith('/auth/password/reset', {
      email: 'a@b.nl', token: 'tok123', password: 'longenough', password_confirmation: 'longenough',
    })
    expect(setNotice).toHaveBeenCalledWith('password_reset')
    expect(screen.getByText('LOGIN-PAGE')).toBeTruthy()
  })

  it('shows the invalid state without a request when the token is missing', () => {
    renderForm('/x?email=a%40b.nl', true)
    expect(screen.getByText('DEAD')).toBeTruthy()
    expect(screen.queryByLabelText(nlAuth.setPassword.password)).toBeNull()
    expect(screen.getByText(nlAuth.reset.requestNew).closest('a')?.getAttribute('href')).toBe('/forgot-password')
    expect(postMock).not.toHaveBeenCalled()
  })

  it('offers no new-link link when requestNewLink is off', () => {
    renderForm('/x', false)
    expect(screen.queryByText(nlAuth.reset.requestNew)).toBeNull()
  })

  it('keeps the button disabled for short or mismatching passwords and shows the mismatch after touch', () => {
    renderForm(URL_OK)
    fill('short', 'short')
    expect((go() as HTMLButtonElement).disabled).toBe(true)
    fill('longenough', 'different1')
    expect((go() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.blur(screen.getByLabelText(nlAuth.setPassword.confirm))
    expect(screen.getByText(nlAuth.setPassword.mismatch)).toBeTruthy()
    fill('longenough', 'longenough')
    expect((go() as HTMLButtonElement).disabled).toBe(false)
  })

  it('maps the coded 422 to the invalid state', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 422, data: { code: 'reset_token_invalid', message: 'x' } } })
    renderForm(URL_OK)
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(screen.getByText('DEAD')).toBeTruthy()
  })

  it('maps a password error bag to the weak text, never the bag text', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 422, data: { errors: { password: ['The password is too weak.'] } } } })
    renderForm(URL_OK)
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(screen.getByText(nlAuth.setPassword.weak.replace('{{min}}', '8'))).toBeTruthy()
    expect(screen.queryByText('The password is too weak.')).toBeNull()
  })

  it('shows a live countdown on 429 and disables the button', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 429, data: { message: 'x', retry_after: 4 } } })
    renderForm(URL_OK)
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(screen.getByText(nlAuth.setPassword.throttled.replace('{{seconds}}', '4'))).toBeTruthy()
    expect((go() as HTMLButtonElement).disabled).toBe(true)
  })
})

// Lane 08 regressions: signed-in success, URL strip, FieldNotice alert, min-length copy, 422 field bags.
describe('SetPasswordForm hardening', () => {
  beforeEach(() => { calls.length = 0; postMock.mockReset(); setNotice.mockReset(); sessionStorage.clear(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
  afterEach(() => { vi.useRealTimers(); authUser = null })

  it('strips token and email from the URL yet still posts them', async () => {
    postMock.mockResolvedValueOnce({ status: 200, data: {} })
    renderForm(URL_OK)
    expect(screen.getByTestId('loc').textContent).toBe('')
    expect(screen.getByLabelText(nlAuth.setPassword.password)).toBeTruthy()
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(postMock).toHaveBeenCalledWith('/auth/password/reset', {
      email: 'a@b.nl', token: 'tok123', password: 'longenough', password_confirmation: 'longenough',
    })
  })

  it('shows the success callout in place for a signed-in visitor and sets no notice', async () => {
    authUser = { id: 1 }
    postMock.mockResolvedValueOnce({ status: 200, data: {} })
    renderForm(URL_OK)
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(screen.getByText(nlAuth.setPassword.doneSignedIn)).toBeTruthy()
    expect(screen.queryByText(nlAuth.login.passwordResetDone)).toBeNull()
    expect(sessionStorage.getItem('km_auth_notice')).toBeNull()
    expect(setNotice).not.toHaveBeenCalled()
    expect(screen.queryByText('LOGIN-PAGE')).toBeNull()
  })

  it('announces the mismatch as an alert', () => {
    renderForm(URL_OK)
    fill('longenough', 'different1')
    fireEvent.blur(screen.getByLabelText(nlAuth.setPassword.confirm))
    expect(screen.getByRole('alert').textContent).toBe(nlAuth.setPassword.mismatch)
  })

  it('interpolates MIN_LENGTH into the hint and the weak banner', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 422, data: { errors: { password: ['x'] } } } })
    renderForm(URL_OK)
    expect(screen.getByText(nlAuth.setPassword.minHint.replace('{{min}}', '8'))).toBeTruthy()
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(screen.getByText(nlAuth.setPassword.weak.replace('{{min}}', '8'))).toBeTruthy()
  })

  it.each(['email', 'token'])('maps a 422 errors.%s bag to the invalid-link state', async (field) => {
    postMock.mockRejectedValueOnce({ response: { status: 422, data: { errors: { [field]: ['invalid'] } } } })
    renderForm(URL_OK)
    fill('longenough', 'longenough')
    await act(async () => { fireEvent.click(go()) })
    expect(screen.getByText('DEAD')).toBeTruthy()
    expect(screen.queryByLabelText(nlAuth.setPassword.password)).toBeNull()
  })
})
