/**
 * EscalationSettings (§13: assert the REAL /settings request) — 11-escalatie
 * (3b) + the atomic-pair dead-state fix (13-08) + X-6 signal catalogue:
 * covers the empty/off default (four UI states), the exact contract keys on
 * a full pair, that an empty days field forces the target back to '' on save
 * (never an orphan target reaching the backend), and that a signal with days
 * set but no target is BLOCKED client-side with an inline hint instead of
 * being sent half-configured. Tests the 15 signals from the catalogue endpoint
 * and the 4-signal fallback when the endpoint fails.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import EscalationSettings from './EscalationSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Network-backed hooks mocked directly (mirrors RolesSettings.test.tsx) so this
// test needs no real QueryClientProvider.
vi.mock('@/lib/queries', () => ({
  useUsers: () => ({ data: [{ id: 'u-1', name: 'Jan Jansen' }] }),
}))
vi.mock('@/pages/users/hooks/useAssignableRoles', () => ({
  useAssignableRoles: () => ({ roles: [{ id: 'r-1', name: 'recruiter' }], loading: false }),
}))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// The 15 canonical signal keys from the backend catalogue (SignalCatalog::KEYS).
const ALL_SIGNALS = [
  'customer_match_ending',
  'conversation_unanswered',
  'document_expiring',
  'certification_expiring',
  'match_expiring',
  'candidate_phase_stale',
  'missing_cv',
  'candidate_status_stale',
  'task_overdue',
  'candidate_availability_upcoming',
  'candidate_availability_overdue',
  'candidate_leave_ending_soon',
  'candidate_leave_overdue',
  'candidate_unavailable_ending_soon',
  'candidate_unavailable_overdue',
]

const renderPage = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) =>
  render(<QueryClientProvider client={queryClient}><EscalationSettings /></QueryClientProvider>)

beforeEach(() => {
  vi.clearAllMocks()
  // By default, mock the signal-catalog endpoint to return all 15 signals.
  ;vi.mocked(api.get).mockImplementation((url) => {
    if (url === '/settings/signal-catalog') {
      return Promise.resolve({ data: { signals: ALL_SIGNALS } })
    }
    // Other endpoints (like /settings) return empty data.
    return Promise.resolve({ data: {} })
  })
  ;vi.mocked(api.post).mockResolvedValue({ data: {} })
  // By default, mock full permissions
  vi.mocked(useAuth).mockReturnValue({ hasPermission: (perm: string) => perm === 'settings.update' } as unknown as ReturnType<typeof useAuth>)
})

describe('EscalationSettings', () => {
  it('renders all 15 signals from the catalogue endpoint', async () => {
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings/signal-catalog'))

    // All 15 signals should render.
    const daysInputs = await screen.findAllByLabelText(t('escalation.afterDaysLabel'), { selector: 'input' })
    expect(daysInputs).toHaveLength(15)
  })

  it('falls back to the 4 seed signals when the catalogue endpoint fails', async () => {
    // Mock the catalogue endpoint to fail.
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/settings/signal-catalog') {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({ data: {} })
    })

    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings/signal-catalog'))

    // Fallback: only the 4 seed signals render.
    const daysInputs = await screen.findAllByLabelText(t('escalation.afterDaysLabel'), { selector: 'input' })
    expect(daysInputs).toHaveLength(4)
  })

  it('loads honest empty/off state for every signal (no days, no target)', async () => {
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))

    const daysInput = await screen.findByLabelText(t('escalation.afterDaysLabel'), { selector: '#escalate-days-task_overdue' })
    expect(daysInput).toHaveValue(null)
    expect(screen.getAllByText(t('escalation.targetPlaceholder'))).toHaveLength(15)
  })

  it('pair set: POSTs the exact contract keys for the chosen signal on save (user target)', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    // task_overdue is at index 8 in the ALL_SIGNALS catalogue.
    const input = document.getElementById('escalate-days-task_overdue') as HTMLInputElement
    await user.type(input, '5')
    await user.tab()

    // Pick the user target for task_overdue (index 8 in the signal list).
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[8])
    await user.click(await screen.findByText(t('escalation.targetUserOption', { name: 'Jan Jansen' })))

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(body.task_overdue_escalate_after_days).toBe('5')
    expect(body.task_overdue_escalate_to).toBe('u-1')
    // Untouched signals stay off (both halves empty).
    expect(body.candidate_status_stale_escalate_after_days).toBe('')
    expect(body.candidate_status_stale_escalate_to).toBe('')
  })

  it('pair cleared: days emptied after a target was picked forces the target back to \'\' on save (dead-state fix)', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    // Set up a full pair on candidate_status_stale (index 7 in the signal list).
    const daysInput = document.getElementById('escalate-days-candidate_status_stale') as HTMLInputElement
    await user.type(daysInput, '3')
    await user.tab()
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[7])
    await user.click(await screen.findByText(t('escalation.targetRoleOption', { name: 'recruiter' })))

    // Now clear the days field back to off — the picker's stale selection must
    // not silently persist as an orphan target (that is the exact backend
    // dead-state bug: an empty-string days value still clears the ?->value
    // null-check while a leftover target makes it "configured").
    await user.clear(daysInput)
    await user.tab()

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(body.candidate_status_stale_escalate_after_days).toBe('')
    expect(body.candidate_status_stale_escalate_to).toBe('')
  })

  it('days-without-target: blocks the save for that signal and shows the inline hint, without calling the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    // Set days on conversation_unanswered (index 1 in the signal list) but never pick a target.
    const daysInput = document.getElementById('escalate-days-conversation_unanswered') as HTMLInputElement
    await user.type(daysInput, '7')
    await user.tab()

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    // The half-pair never reaches the backend.
    expect(api.post).not.toHaveBeenCalled()
    expect(await screen.findByText(t('escalation.missingTargetHint'))).toBeInTheDocument()

    // Picking a target now clears the block and lets the save through.
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[1])
    await user.click(await screen.findByText(t('escalation.targetUserOption', { name: 'Jan Jansen' })))
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(body.conversation_unanswered_escalate_after_days).toBe('7')
    expect(body.conversation_unanswered_escalate_to).toBe('u-1')
  })

  it('clamps the day count into the backend range (DAYS_MAX 90)', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })
    const daysInput = document.getElementById('escalate-days-task_overdue') as HTMLInputElement
    await user.type(daysInput, '999')
    await user.tab()
    expect(daysInput).toHaveValue(90)
  })

  it('POSTs a role name (not a uuid) when a role target is chosen', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    const daysInput = document.getElementById('escalate-days-candidate_status_stale') as HTMLInputElement
    await user.type(daysInput, '3')
    await user.tab()
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[7]) // candidate_status_stale row (index 7 in signal list)
    await user.click(await screen.findByText(t('escalation.targetRoleOption', { name: 'recruiter' })))

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(body.candidate_status_stale_escalate_to).toBe('recruiter')
  })

  it('labels which target option is a user and which is a role', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    const triggers = await screen.findAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[0])

    expect(await screen.findByText(t('escalation.targetUserOption', { name: 'Jan Jansen' }))).toBeInTheDocument()
    expect(screen.getByText(t('escalation.targetRoleOption', { name: 'recruiter' }))).toBeInTheDocument()
  })
})

describe('EscalationSettings — permission gate (G2-schema-canedit)', () => {
  it('disables all inputs and hides Save when user lacks settings.update', async () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    renderPage()

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings/signal-catalog'))
    await waitFor(() => expect(screen.queryByRole('button', { name: t('common.save') })).not.toBeInTheDocument())

    // All day inputs should be disabled
    const daysInputs = await screen.findAllByLabelText(t('escalation.afterDaysLabel'), { selector: 'input' })
    daysInputs.forEach(input => expect(input).toBeDisabled())

    // All target triggers should be disabled
    const targetButtons = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    targetButtons.forEach(btn => expect(btn).toBeDisabled())
  })
})
