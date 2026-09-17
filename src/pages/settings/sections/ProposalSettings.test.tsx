/**
 * ProposalSettings — VOORSTEL-AFZENDER-FE-1 default sender. §13: assert the REQUEST
 * (POST /settings with the bare proposal_default_sender_user_id key), the stale
 * warning once the users list has loaded, and the read-only face without settings.update.
 * Also covers the pre-existing template/phase/variant/notice coverage (§13: request,
 * never only a callback), which 83ed8613 dropped while adding the sender feature.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ProposalSettings from './ProposalSettings'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

const mockSettings = vi.hoisted(() => vi.fn(() => ({})))
const apiPost = vi.hoisted(() => vi.fn(async () => ({ data: {} })))
const mockUseAuth = vi.hoisted(() => vi.fn((): { hasPermission: () => boolean } => ({ hasPermission: () => true })))
const notifyError = vi.hoisted(() => vi.fn(() => {}))
// Default tenant users list — mutated in place by individual tests below (the
// "still loading" / "loaded, no match" stale-guard cases) and restored by
// afterEach so test order can never leak state between them.
const usersFixture = vi.hoisted(() => ({
  data: [{ id: 'u1', name: 'Danny' }, { id: 'u2', name: 'Sara Demo' }],
  isSuccess: true,
  isPlaceholderData: false,
}))

vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, post: apiPost, get: vi.fn() } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/notify', () => ({ notifyError }))
vi.mock('@/lib/queries', () => ({ useUserOptions: () => usersFixture }))

afterEach(() => {
  vi.clearAllMocks()
  usersFixture.data = [{ id: 'u1', name: 'Danny' }, { id: 'u2', name: 'Sara Demo' }]
  usersFixture.isSuccess = true
  usersFixture.isPlaceholderData = false
})

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

  // The REAL pending shape of useUsers(): placeholderData [] makes query-core report
  // status 'success' while the GET is still in flight (isPlaceholderData true). The
  // guard must not fire in that window, or a real uuid flashes as "not found" on load.
  it('does not warn while the users query is still pending (placeholder data, isSuccess true)', () => {
    usersFixture.data = []
    usersFixture.isSuccess = true
    usersFixture.isPlaceholderData = true
    mockSettings.mockReturnValue({ proposal_default_sender_user_id: 'u2' })
    render(<ProposalSettings />)
    expect(screen.queryByText(st('proposal.defaultSenderStale'))).toBeNull()
  })

  it('warns once the users query has succeeded and the default is missing from it', () => {
    usersFixture.data = [{ id: 'u9', name: 'X' }]
    usersFixture.isSuccess = true
    mockSettings.mockReturnValue({ proposal_default_sender_user_id: 'u2' })
    render(<ProposalSettings />)
    expect(screen.getByText(st('proposal.defaultSenderStale'))).toBeInTheDocument()
  })
})

// §13: assert the REQUEST (route + body) via api.post, never only that a
// callback fired. Restores coverage 83ed8613 dropped when it rewrote this file
// for the sender feature, adapted to the current component (SegmentedControl
// radios instead of bare radio inputs, the shared Toggle switch).
const STORED = {
  subject_template: 'Voorstel: {candidate} voor {vacancy}',
  body_template: '<p>Hallo {contact},</p>',
  sets_phase: false,
  default_cv_variant: 'proposal',
}

describe('ProposalSettings · template, phase, variant, notice', () => {
  it('renders the stored subject/body/variant', () => {
    mockSettings.mockReturnValue({ application_proposal: JSON.stringify(STORED) })
    render(<ProposalSettings />)
    expect(screen.getByDisplayValue(STORED.subject_template)).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getAllByRole('radio')[0]).toBeChecked() // proposal
  })

  it('toggling sets_phase POSTs the merged JSON blob immediately', async () => {
    mockSettings.mockReturnValue({ application_proposal: JSON.stringify(STORED) })
    const user = userEvent.setup()
    render(<ProposalSettings />)
    await user.click(screen.getByRole('switch'))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', {
      application_proposal: JSON.stringify({ ...STORED, sets_phase: true }),
    }))
  })

  it('picking the full CV variant POSTs the merged JSON blob', async () => {
    mockSettings.mockReturnValue({ application_proposal: JSON.stringify(STORED) })
    const user = userEvent.setup()
    render(<ProposalSettings />)
    await user.click(screen.getAllByRole('radio')[1]) // full
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', {
      application_proposal: JSON.stringify({ ...STORED, default_cv_variant: 'full' }),
    }))
  })

  // SETTINGS-INCON-B1b: the chosen variant reads as chosen via the §4 "aan/gelukt"
  // success pair (activeFill + activeOnly), same green as the super-admin package picker.
  it('paints the chosen CV variant in the success pair', () => {
    mockSettings.mockReturnValue({ application_proposal: JSON.stringify(STORED) })
    render(<ProposalSettings />)
    const radios = screen.getAllByRole('radio')
    expect(radios[0].style.background).toBe('var(--color-success-bg)') // proposal (stored)
    expect(radios[0].style.border).toBe('1px solid var(--color-success)')
    expect(radios[1].style.background).toBe('var(--surface)') // full (inactive)
  })

  it('saving the template POSTs the edited subject/body', async () => {
    mockSettings.mockReturnValue({ application_proposal: JSON.stringify(STORED) })
    const user = userEvent.setup()
    render(<ProposalSettings />)
    await user.clear(screen.getByLabelText(st('proposal.subjectLabel')))
    // Avoid `{...}` in the typed string — user-event's `type` reserves braces for
    // special-key syntax; the token-substitution behaviour itself is not this test's concern.
    await user.type(screen.getByLabelText(st('proposal.subjectLabel')), 'Nieuw onderwerp')
    await user.click(screen.getByRole('button', { name: st('common.save') }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/settings', {
      application_proposal: JSON.stringify({ ...STORED, subject_template: 'Nieuw onderwerp' }),
    }))
  })

  it('shows the honest "not sent yet" notice', () => {
    mockSettings.mockReturnValue({})
    render(<ProposalSettings />)
    expect(screen.getByText(st('proposal.notSentYet'))).toBeInTheDocument()
  })
})
