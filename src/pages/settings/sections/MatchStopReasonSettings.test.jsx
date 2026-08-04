/**
 * MatchStopReasonSettings (MATCH-TERMINATE-1) — smoke test: renders the shared
 * StatusListEditor against /match-stop-reasons and asserts the create request.
 * Mirrors ContractTypesSettings.test.jsx — same shared component, same contract.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { MatchStopReasonSettings } from './MatchSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture reason's tenant-picked colour, not a style rule.
const reason = (over = {}) => ({ id: 'msr1', name: 'Candidate declined', color: '#D4573B', ...over })

afterEach(() => vi.clearAllMocks())

describe('MatchStopReasonSettings', () => {
  it('renders the seeded stop reasons', async () => {
    api.get.mockResolvedValue({ data: [reason()] })
    render(<MatchStopReasonSettings />)

    await screen.findByText('Candidate declined')
  })

  it('saves a new stop reason on add', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: { id: 'msr2', name: 'Customer cancelled' } })
    const user = userEvent.setup()
    render(<MatchStopReasonSettings />)

    await user.click(await screen.findByRole('button', { name: st('matches.stopReasonAdd') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Customer cancelled')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    // Assert the REQUEST (§13) — not just that a callback fired.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/match-stop-reasons',
      expect.objectContaining({ name: 'Customer cancelled', label: 'Customer cancelled' })))
  })
})
