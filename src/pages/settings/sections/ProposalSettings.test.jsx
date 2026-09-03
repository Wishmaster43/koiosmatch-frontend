/**
 * ProposalSettings — VOORSTEL-AFZENDER-FE-1 default sender. §13: assert the REQUEST
 * (POST /settings with the bare proposal_default_sender_user_id key), the stale
 * warning once the users list has loaded, and the read-only face without settings.update.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ProposalSettings from './ProposalSettings'

const st = (key) => i18n.t(key, { ns: 'settings' })

const mockSettings = vi.hoisted(() => vi.fn(() => ({})))
const apiPost = vi.hoisted(() => vi.fn(async () => ({ data: {} })))
const mockUseAuth = vi.hoisted(() => vi.fn(() => ({ hasPermission: () => true })))
const notifyError = vi.hoisted(() => vi.fn(() => {}))
const usersFixture = vi.hoisted(() => ({ data: [{ id: 'u1', name: 'Danny' }, { id: 'u2', name: 'Sara Demo' }] }))

vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { ...actual.default, post: apiPost, get: vi.fn() } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/notify', () => ({ notifyError }))
vi.mock('@/lib/queries', () => ({ useUsers: () => usersFixture }))

afterEach(() => vi.clearAllMocks())

describe('ProposalSettings · default sender', () => {
  it('posts the bare proposal_default_sender_user_id key when a user is picked', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<ProposalSettings />)
    await user.click(screen.getByRole('button', { name: st('proposal.defaultSenderSelf') }))
    await user.click(await screen.findByRole('button', { name: 'Sara Demo' }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', { proposal_default_sender_user_id: 'u2' }))
  })

  it('clears back to the proposer by posting an empty value', async () => {
    mockSettings.mockReturnValue({ proposal_default_sender_user_id: 'u2' })
    const user = userEvent.setup()
    render(<ProposalSettings />)
    // CreatableSelect names its clear cross t('clearField', { field }) — the one real clear affordance.
    await user.click(screen.getByRole('button', { name: i18n.t('clearField', { ns: 'common', field: st('proposal.defaultSenderTitle') }) }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', { proposal_default_sender_user_id: '' }))
  })

  it('warns when the stored default no longer resolves to a user', () => {
    mockSettings.mockReturnValue({ proposal_default_sender_user_id: 'gone-uuid' })
    render(<ProposalSettings />)
    expect(screen.getByText(st('proposal.defaultSenderStale'))).toBeInTheDocument()
  })

  it('shows no warning for a resolvable default', () => {
    mockSettings.mockReturnValue({ proposal_default_sender_user_id: 'u1' })
    render(<ProposalSettings />)
    expect(screen.queryByText(st('proposal.defaultSenderStale'))).toBeNull()
  })

  it('renders the current default as plain text without settings.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    mockSettings.mockReturnValue({ proposal_default_sender_user_id: 'u2' })
    render(<ProposalSettings />)
    expect(screen.getByText('Sara Demo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sara Demo' })).toBeNull()
  })
})
