/**
 * AddWhatsAppConnectionForm.test — WA-CONN-FORM-1 seam coverage (§13: assert the
 * REQUEST — method/route/body — never just a fired callback). The 13-08 incident
 * wiped every whatsapp_connection and this form is the only UI way back in, so
 * the exact POST body and the create → check-status → onCreated sequence are the
 * things worth pinning.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import AddWhatsAppConnectionForm from './AddWhatsAppConnectionForm'

// Partial mock: fake the HTTP verbs, keep the real unwrap (it reads res.data.data).
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

const noop = () => {}

// Fill the two required fields (labels are raw i18n keys — no i18n bootstrapped here).
const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/whatsapp\.wabaId/), '10229012934')
  await user.type(screen.getByLabelText(/whatsapp\.accessToken/), 'EAAG-secret-token')
}

describe('AddWhatsAppConnectionForm · WA-CONN-FORM-1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'conn-1', status: 'inactive' } } })
  })

  it('POSTs /whatsapp with the required fields, omitting empty optionals (CONSIST-2)', async () => {
    const user = userEvent.setup()
    render(<AddWhatsAppConnectionForm onCreated={noop} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /addConnectionSubmit/ }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp', {
      waba_id: '10229012934',
      access_token: 'EAAG-secret-token',
      provider: 'meta',
    }))
    const [, body] = vi.mocked(api.post).mock.calls.find(c => c[0] === '/whatsapp') as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('app_secret')
    expect(body).not.toHaveProperty('webhook_verify_token')
  })

  it('sends the optional secrets when filled, and the picked provider', async () => {
    const user = userEvent.setup()
    render(<AddWhatsAppConnectionForm onCreated={noop} />)
    await fillRequired(user)
    await user.type(screen.getByLabelText(/whatsapp\.appSecret/), 'app-geheim')
    await user.type(screen.getByLabelText(/whatsapp\.verifyToken/), 'verify-me')
    await user.click(screen.getByRole('button', { name: /addConnectionSubmit/ }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp', expect.objectContaining({
      app_secret: 'app-geheim',
      webhook_verify_token: 'verify-me',
    })))
  })

  it('verifies the token straight after create (POST check-status) and then reloads the parent', async () => {
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<AddWhatsAppConnectionForm onCreated={onCreated} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /addConnectionSubmit/ }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp/conn-1/check-status'))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
  })

  it('still reloads when the immediate status check fails (row exists, card takes over)', async () => {
    const onCreated = vi.fn()
    vi.mocked(api.post).mockImplementation((url: string) =>
      url === '/whatsapp'
        ? Promise.resolve({ data: { data: { id: 'conn-1' } } })
        : Promise.reject(new Error('token invalid')))
    const user = userEvent.setup()
    render(<AddWhatsAppConnectionForm onCreated={onCreated} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /addConnectionSubmit/ }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
  })

  it('never fires a request while a required field is empty', async () => {
    const user = userEvent.setup()
    render(<AddWhatsAppConnectionForm onCreated={noop} />)
    await user.type(screen.getByLabelText(/whatsapp\.wabaId/), '10229012934')
    await user.click(screen.getByRole('button', { name: /addConnectionSubmit/ }))
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByText('whatsapp.addConnectionRequired')).toBeInTheDocument()
  })

  it('shows the server error and re-enables the button on a failed create', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 422, data: { message: 'WABA bestaat al.' } } })
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<AddWhatsAppConnectionForm onCreated={onCreated} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /addConnectionSubmit/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('WABA bestaat al.')
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /addConnectionSubmit/ })).toBeEnabled()
  })

  it('masks both secrets as password inputs', () => {
    render(<AddWhatsAppConnectionForm onCreated={noop} />)
    expect(screen.getByLabelText(/whatsapp\.accessToken/)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/whatsapp\.appSecret/)).toHaveAttribute('type', 'password')
  })
})
