/**
 * EscalationSettings (§13: assert the REAL /settings request) — 11-escalatie
 * (3b) + the atomic-pair dead-state fix (13-08): covers the empty/off
 * default (four UI states), the exact contract keys on a full pair, that an
 * empty days field forces the target back to '' on save (never an orphan
 * target reaching the backend), and that a signal with days set but no
 * target is BLOCKED client-side with an inline hint instead of being sent
 * half-configured.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import EscalationSettings from './EscalationSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Network-backed hooks mocked directly (mirrors RolesSettings.test.tsx) so this
// test needs no real QueryClientProvider.
vi.mock('@/lib/queries', () => ({
  useUsers: () => ({ data: [{ id: 'u-1', name: 'Jan Jansen' }] }),
}))
vi.mock('@/pages/users/hooks/useAssignableRoles', () => ({
  useAssignableRoles: () => ({ roles: [{ id: 'r-1', name: 'recruiter' }], loading: false }),
}))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  ;vi.mocked(api.get).mockResolvedValue({ data: {} })
  ;vi.mocked(api.post).mockResolvedValue({ data: {} })
})

describe('EscalationSettings', () => {
  it('loads honest empty/off state for every signal (no days, no target)', async () => {
    render(<EscalationSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))

    const daysInput = await screen.findByLabelText(t('escalation.afterDaysLabel'), { selector: '#escalate-days-task_overdue' })
    expect(daysInput).toHaveValue(null)
    expect(screen.getAllByText(t('escalation.targetPlaceholder'))).toHaveLength(4)
  })

  it('pair set: POSTs the exact contract keys for the chosen signal on save (user target)', async () => {
    const user = userEvent.setup()
    render(<EscalationSettings />)
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    const input = document.getElementById('escalate-days-task_overdue') as HTMLInputElement
    await user.type(input, '5')
    await user.tab()

    // Pick the user target for task_overdue: the first (index 0) target trigger button.
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[0])
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
    render(<EscalationSettings />)
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    // Set up a full pair on candidate_status_stale (index 1) first.
    const daysInput = document.getElementById('escalate-days-candidate_status_stale') as HTMLInputElement
    await user.type(daysInput, '3')
    await user.tab()
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[1])
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
    render(<EscalationSettings />)
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    // Set days on conversation_unanswered (index 2) but never pick a target.
    const daysInput = document.getElementById('escalate-days-conversation_unanswered') as HTMLInputElement
    await user.type(daysInput, '7')
    await user.tab()

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    // The half-pair never reaches the backend.
    expect(api.post).not.toHaveBeenCalled()
    expect(await screen.findByText(t('escalation.missingTargetHint'))).toBeInTheDocument()

    // Picking a target now clears the block and lets the save through.
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[2])
    await user.click(await screen.findByText(t('escalation.targetUserOption', { name: 'Jan Jansen' })))
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(body.conversation_unanswered_escalate_after_days).toBe('7')
    expect(body.conversation_unanswered_escalate_to).toBe('u-1')
  })

  it('clamps the day count into the backend range (DAYS_MAX 90)', async () => {
    const user = userEvent.setup()
    render(<EscalationSettings />)
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })
    const daysInput = document.getElementById('escalate-days-task_overdue') as HTMLInputElement
    await user.type(daysInput, '999')
    await user.tab()
    expect(daysInput).toHaveValue(90)
  })

  it('POSTs a role name (not a uuid) when a role target is chosen', async () => {
    const user = userEvent.setup()
    render(<EscalationSettings />)
    await screen.findAllByRole('button', { name: t('escalation.targetLabel') })

    const daysInput = document.getElementById('escalate-days-candidate_status_stale') as HTMLInputElement
    await user.type(daysInput, '3')
    await user.tab()
    const triggers = screen.getAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[1]) // candidate_status_stale row
    await user.click(await screen.findByText(t('escalation.targetRoleOption', { name: 'recruiter' })))

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(body.candidate_status_stale_escalate_to).toBe('recruiter')
  })

  it('labels which target option is a user and which is a role', async () => {
    const user = userEvent.setup()
    render(<EscalationSettings />)
    const triggers = await screen.findAllByRole('button', { name: t('escalation.targetLabel') })
    await user.click(triggers[0])

    expect(await screen.findByText(t('escalation.targetUserOption', { name: 'Jan Jansen' }))).toBeInTheDocument()
    expect(screen.getByText(t('escalation.targetRoleOption', { name: 'recruiter' }))).toBeInTheDocument()
  })
})
