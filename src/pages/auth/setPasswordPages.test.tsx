/**
 * setPasswordPages.test — each page wires its own endpoint, invalid code and notice kind.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18next from 'i18next'
import nlAuth from '@/i18n/locales/nl/auth.json'

const postMock = vi.fn()
vi.mock('@/lib/api', () => ({ default: { post: (...a: unknown[]) => postMock(...a) }, primeCsrf: () => Promise.resolve() }))
const setNotice = vi.fn()
vi.mock('@/lib/authNotice', () => ({ setAuthNotice: (k: string) => setNotice(k) }))

import ResetPasswordPage from './ResetPasswordPage'
import AcceptInvitePage from './AcceptInvitePage'

const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({
  lng: 'nl', fallbackLng: 'nl', resources: { nl: { auth: nlAuth } },
  defaultNS: 'auth', interpolation: { escapeValue: false },
})
const Q = '?token=tk&email=u%40x.nl'
const mount = (el: React.ReactElement, q = Q) => render(
  <I18nextProvider i18n={i18n}><MemoryRouter initialEntries={['/p' + q]}>{el}</MemoryRouter></I18nextProvider>,
)
const submitWith = async (label: string) => {
  fireEvent.change(screen.getByLabelText(nlAuth.setPassword.password), { target: { value: 'longenough' } })
  fireEvent.change(screen.getByLabelText(nlAuth.setPassword.confirm), { target: { value: 'longenough' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })) })
}

describe('set-password pages', () => {
  beforeEach(() => { postMock.mockReset(); setNotice.mockReset(); postMock.mockResolvedValue({ status: 200, data: {} }) })

  it('ResetPasswordPage posts to the reset endpoint with the password_reset notice', async () => {
    mount(<ResetPasswordPage />)
    expect(screen.getByText(nlAuth.reset.subtitle.replace('{{email}}', 'u@x.nl'))).toBeTruthy()
    await submitWith(nlAuth.reset.submit)
    expect(postMock.mock.calls[0][0]).toBe('/auth/password/reset')
    expect(setNotice).toHaveBeenCalledWith('password_reset')
  })

  it('ResetPasswordPage offers a new link when the link is dead', () => {
    mount(<ResetPasswordPage />, '')
    expect(screen.getByText(nlAuth.reset.requestNew)).toBeTruthy()
  })

  it('AcceptInvitePage posts to the invite endpoint with the invite_accepted notice and offers no new link', async () => {
    mount(<AcceptInvitePage />)
    await submitWith(nlAuth.invite.submit)
    expect(postMock.mock.calls[0][0]).toBe('/auth/invite/accept')
    expect(setNotice).toHaveBeenCalledWith('invite_accepted')
  })

  it('AcceptInvitePage shows the invitation subtitle with the address from the query string', () => {
    mount(<AcceptInvitePage />)
    expect(screen.getByText(nlAuth.invite.subtitle.replace('{{email}}', 'u@x.nl'))).toBeTruthy()
  })

  it('a crafted ?email= sentence lands in the invalid-link state, never in the subtitle', () => {
    mount(<ResetPasswordPage />, '?token=tk&email=Call+me+now')
    expect(screen.getByText(nlAuth.reset.requestNew)).toBeTruthy()
    expect(screen.queryByText(/Call me now/)).toBeNull()
  })

  it('AcceptInvitePage dead link shows the invitation text without a new-link link', () => {
    mount(<AcceptInvitePage />, '')
    expect(screen.getByText(nlAuth.invite.invalid)).toBeTruthy()
    expect(screen.queryByText(nlAuth.reset.requestNew)).toBeNull()
  })

  it('ResetPasswordPage maps the reset_token_invalid code to the invalid text', async () => {
    postMock.mockRejectedValue({ response: { status: 422, data: { code: 'reset_token_invalid' } } })
    mount(<ResetPasswordPage />)
    await submitWith(nlAuth.reset.submit)
    expect(screen.getByText(nlAuth.reset.invalid)).toBeTruthy()
  })

  it('AcceptInvitePage maps the invite_invalid code to the invalid text', async () => {
    postMock.mockRejectedValue({ response: { status: 422, data: { code: 'invite_invalid' } } })
    mount(<AcceptInvitePage />)
    await submitWith(nlAuth.invite.submit)
    expect(screen.getByText(nlAuth.invite.invalid)).toBeTruthy()
  })
})
