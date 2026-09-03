/**
 * FacebookLeadsSettings (FB-LEADS-1) — asserts the REAL settings request: a secret
 * (app secret / access token) is only sent when the user actually typed a new
 * value (never overwriting a stored secret with an empty string), the plain keys
 * (verify token / dataset id) always round-trip, and the masked "already set"
 * badge shows instead of the real value (§13 — a mutation test proves the seam).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import FacebookLeadsSettings from './FacebookLeadsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  mockUseAuth.mockReturnValue({ activeTenant: { id: 'tenant-123' } })
  api.post.mockResolvedValue({ data: {} })
})

afterEach(() => vi.clearAllMocks())

describe('FacebookLeadsSettings — loading the stored values', () => {
  it('shows the masked "already set" badge for secrets, never the real value', async () => {
    api.get.mockResolvedValue({ data: {
      facebook_verify_token: '••••••••',
      facebook_dataset_id: '1234567890',
      facebook_app_secret: '••••••••',
      facebook_access_token: '••••••••',
    } })
    render(<FacebookLeadsSettings />)

    // AUDIT 03-09 (settings-coherence-1): the verify token is secret-class too — three badges, no plaintext.
    expect(await screen.findByDisplayValue('1234567890')).toBeInTheDocument()
    expect(screen.getAllByText(t('facebookLeads.secretSet'))).toHaveLength(3)
    // The masked placeholder value itself never leaks into an input.
    expect(screen.queryByDisplayValue('••••••••')).not.toBeInTheDocument()
  })

  it('renders this tenant\'s own webhook URL for copying into the Facebook app', async () => {
    api.get.mockResolvedValue({ data: {} })
    render(<FacebookLeadsSettings />)

    expect(await screen.findByText(/\/facebook\/webhook\/tenant-123/)).toBeInTheDocument()
  })
})

describe('FacebookLeadsSettings — saving', () => {
  it('POSTs the plain keys, omitting untouched secrets (never overwrites with empty)', async () => {
    api.get.mockResolvedValue({ data: { facebook_verify_token: '••••••••', facebook_app_secret: '••••••••', facebook_dataset_id: 'ds-1' } })
    render(<FacebookLeadsSettings />)
    await screen.findByDisplayValue('ds-1')

    await userEvent.click(screen.getByRole('button', { name: t('common.save') }))

    // The masked verify token is never echoed back: only the plain dataset id travels.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', { facebook_dataset_id: 'ds-1' }))
  })

  it('sends a newly typed verify token like any other secret', async () => {
    api.get.mockResolvedValue({ data: { facebook_verify_token: '••••••••' } })
    render(<FacebookLeadsSettings />)
    await screen.findAllByText(t('facebookLeads.secretSet'))

    await userEvent.type(screen.getByLabelText(new RegExp(t('facebookLeads.verifyToken'))), 'fresh-verify-token')
    await userEvent.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', expect.objectContaining({ facebook_verify_token: 'fresh-verify-token' })))
  })

  it('sends a newly typed secret, then clears the field back to the masked state', async () => {
    api.get.mockResolvedValue({ data: {} })
    render(<FacebookLeadsSettings />)
    // Not yet set, so the label carries no badge — a plain accessible name.
    const secretInput = await screen.findByLabelText(t('facebookLeads.appSecret'))

    await userEvent.type(secretInput, 'new-app-secret')
    await userEvent.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', expect.objectContaining({
      facebook_app_secret: 'new-app-secret',
    })))
    // The field clears and the "already set" badge takes over — the plaintext never lingers on screen.
    await waitFor(() => expect(secretInput).toHaveValue(''))
    expect(await screen.findAllByText(t('facebookLeads.secretSet'))).toHaveLength(1)
  })
})
