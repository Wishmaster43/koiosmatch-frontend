/**
 * WhatsAppConnectionForm.test — WA-VESTIGING-FE-1 seam coverage (§13: assert the
 * REQUEST body, never only that a callback fired). Covers both modes: CREATE
 * (POST /whatsapp, CONSIST-2 — blank optionals omitted) and EDIT (PATCH
 * /whatsapp/{id} — blank secrets omitted/"unchanged", but scope/label/provider
 * always explicit so switching back to "everyone" really clears the old value).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import WhatsAppConnectionForm from './WhatsAppConnectionForm'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

// Partial mock: fake the HTTP verbs, keep the real unwrap (it reads res.data.data).
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

// react-query-backed lookups, mocked directly (no QueryClientProvider needed) —
// mirrors AddCustomerModal.test.tsx's useLocations convention.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Yesway Zorg' }, { value: 'loc-2', label: 'Yesway Werk' }],
}))
// The users barrel is a public-surface module (§2) — mocked FLAT with exactly
// what this component uses, never importOriginal on the barrel itself.
vi.mock('@/pages/users/shared', () => ({
  useAssignableRoles: () => ({ roles: [{ id: 'r1', name: 'recruiter' }, { id: 'r2', name: 'backoffice' }], loading: false }),
  // Flat barrel mock (§2 TESTLES) — identity passthrough is enough here.
  roleLabel: (_t: unknown, name: string) => name,
}))

const noop = () => {}

const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/whatsapp\.wabaId/), '10229012934')
  await user.type(screen.getByLabelText(/whatsapp\.accessToken/), 'EAAG-secret-token')
}

const EXISTING: WhatsappConnectionRow = {
  id: 'conn-1', waba_id: '10229012934', label: 'Oud label',
  location_id: null, role_name: null, is_default: false, has_verify_token: false, provider: 'meta',
}

describe('WhatsAppConnectionForm · WA-VESTIGING-FE-1 · create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'conn-1', status: 'inactive' } } })
  })

  it('POSTs /whatsapp with only the required fields, omitting every blank optional (CONSIST-2)', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={noop} onCancel={noop} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp', {
      waba_id: '10229012934', access_token: 'EAAG-secret-token', provider: 'meta',
    }))
    const [, body] = vi.mocked(api.post).mock.calls.find(c => c[0] === '/whatsapp') as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('app_secret')
    expect(body).not.toHaveProperty('webhook_verify_token')
    expect(body).not.toHaveProperty('label')
    expect(body).not.toHaveProperty('location_id')
    expect(body).not.toHaveProperty('role_name')
  })

  it('sends the optional secrets and label when filled', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={noop} onCancel={noop} />)
    await fillRequired(user)
    await user.type(screen.getByLabelText(/whatsapp\.appSecret/), 'app-geheim')
    await user.type(screen.getByLabelText(/whatsapp\.verifyToken/), 'verify-me')
    await user.type(screen.getByLabelText(/whatsapp\.labelField/), 'Yesway Zorg')
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp', expect.objectContaining({
      app_secret: 'app-geheim', webhook_verify_token: 'verify-me', label: 'Yesway Zorg',
    })))
  })

  it('scope = one branch sends location_id and no role_name', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={noop} onCancel={noop} />)
    await fillRequired(user)
    await user.click(screen.getByRole('radio', { name: /scopeLocation/ }))
    await user.click(screen.getByRole('button', { name: /scopeLocation/ }))
    await user.click(screen.getByRole('button', { name: 'Yesway Zorg' }))
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp', expect.objectContaining({ location_id: 'loc-1' })))
    const [, body] = vi.mocked(api.post).mock.calls.find(c => c[0] === '/whatsapp') as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('role_name')
  })

  it('scope = one role sends role_name and no location_id', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={noop} onCancel={noop} />)
    await fillRequired(user)
    // Card-size options compose label+description into one accessible name —
    // no word boundary after the label key, so match on the key itself.
    await user.click(screen.getByRole('radio', { name: /scopeRole/ }))
    await user.click(screen.getByRole('button', { name: /scopeRole/ }))
    await user.click(screen.getByRole('button', { name: 'recruiter' }))
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp', expect.objectContaining({ role_name: 'recruiter' })))
    const [, body] = vi.mocked(api.post).mock.calls.find(c => c[0] === '/whatsapp') as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('location_id')
  })

  it('never fires a request while a required field is empty', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={noop} onCancel={noop} />)
    await user.type(screen.getByLabelText(/whatsapp\.wabaId/), '10229012934')
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByText('whatsapp.addConnectionRequired')).toBeInTheDocument()
  })

  it('blocks submit when a scope value is chosen but no branch/role is picked', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={noop} onCancel={noop} />)
    await fillRequired(user)
    await user.click(screen.getByRole('radio', { name: /scopeLocation/ }))
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByText('whatsapp.scopeRequired')).toBeInTheDocument()
  })

  it('verifies the token straight after create (POST check-status) and then calls onSaved', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={onSaved} onCancel={noop} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp/conn-1/check-status'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('shows the server error and re-enables the button on a failed create', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 422, data: { message: 'WABA bestaat al.' } } })
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={null} onSaved={onSaved} onCancel={noop} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'whatsapp.addConnection' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('WABA bestaat al.')
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'whatsapp.addConnection' })).toBeEnabled()
  })

  it('masks both secrets as password inputs', () => {
    render(<WhatsAppConnectionForm connection={null} onSaved={noop} onCancel={noop} />)
    expect(screen.getByLabelText(/whatsapp\.accessToken/)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/whatsapp\.appSecret/)).toHaveAttribute('type', 'password')
  })
})

describe('WhatsAppConnectionForm · WA-VESTIGING-FE-1 · edit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { ...EXISTING } } })
  })

  it('waba_id renders read-only — the update route never accepts it (§3 no fake affordance)', () => {
    render(<WhatsAppConnectionForm connection={EXISTING} onSaved={noop} onCancel={noop} />)
    expect(screen.queryByLabelText(/whatsapp\.wabaId/)).not.toBeInTheDocument()
    expect(screen.getByText('10229012934')).toBeInTheDocument()
  })

  it('PATCHes with provider/label/location_id/role_name explicit, omitting untouched secrets', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={EXISTING} onSaved={noop} onCancel={noop} />)
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/whatsapp/conn-1', {
      provider: 'meta', label: 'Oud label', location_id: null, role_name: null,
    }))
    const [, body] = vi.mocked(api.patch).mock.calls[0] as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('access_token')
    expect(body).not.toHaveProperty('app_secret')
    expect(body).not.toHaveProperty('webhook_verify_token')
  })

  it('sends a rotated access token and re-verifies it via check-status', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={EXISTING} onSaved={noop} onCancel={noop} />)
    await user.type(screen.getByLabelText(/whatsapp\.accessToken/), 'EAAG-nieuw-token')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/whatsapp/conn-1',
      expect.objectContaining({ access_token: 'EAAG-nieuw-token' })))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp/conn-1/check-status'))
  })

  it('switching an existing branch-scoped token back to "everyone" clears both scope fields', async () => {
    const scoped: WhatsappConnectionRow = { ...EXISTING, location_id: 'loc-1', role_name: null }
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={scoped} onSaved={noop} onCancel={noop} />)
    await user.click(screen.getByRole('radio', { name: /scopeEveryone/ }))
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/whatsapp/conn-1',
      expect.objectContaining({ location_id: null, role_name: null })))
  })

  it('calls onCancel without saving', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<WhatsAppConnectionForm connection={EXISTING} onSaved={noop} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'common.cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(api.patch).not.toHaveBeenCalled()
  })
})
