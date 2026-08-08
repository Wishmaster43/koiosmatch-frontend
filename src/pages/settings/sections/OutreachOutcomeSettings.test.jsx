/**
 * OutreachOutcomeSettings (OUTREACH-2) — smoke test: renders the shared
 * StatusListEditor against /outreach-outcomes and asserts the create request.
 * Mirrors ContractTypesSettings.test.jsx — same shared component, same contract.
 *
 * LOOKUP-GAP-1(d) verification 08-08: OutreachOutcomeController extends
 * SlugLookupController, whose store() validates `value` as REQUIRED — the
 * create test also asserts the slugged `value` lands in the POST body, guarding
 * the `withValueSlug` opt-in that makes the button real.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { OutreachOutcomeSettings } from './OutreachSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture outcome's tenant-picked colour, not a style rule.
const outcome = (over = {}) => ({ id: 'oo1', name: 'Interested', color: '#3BAF6E', ...over })

afterEach(() => vi.clearAllMocks())

describe('OutreachOutcomeSettings', () => {
  it('renders the seeded outcomes', async () => {
    api.get.mockResolvedValue({ data: [outcome()] })
    render(<OutreachOutcomeSettings />)

    await screen.findByText('Interested')
  })

  it('saves a new outcome on add', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: { id: 'oo2', name: 'Not interested' } })
    const user = userEvent.setup()
    render(<OutreachOutcomeSettings />)

    await user.click(await screen.findByRole('button', { name: st('outreach.outcomeAdd') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Not interested')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    // Assert the REQUEST (§13) — not just that a callback fired. `value` is the
    // slug SlugLookupController::store() requires; missing it would 422 in real life.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/outreach-outcomes',
      expect.objectContaining({ name: 'Not interested', label: 'Not interested', value: 'not_interested' })))
  })
})
