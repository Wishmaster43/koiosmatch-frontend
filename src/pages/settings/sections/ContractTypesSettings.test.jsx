/**
 * ContractTypesSettings (7.1, MATCH-CONTRACT-DURATION-1) — smoke test: renders
 * the shared StatusListEditor against /contract-types with the numberField
 * (default_duration_days) and asserts the create request carries the entered
 * duration. Mirrors AppointmentLocationSettings.test.jsx — same shared
 * component, same contract.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { ContractTypesSettings } from './MatchSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const type = (over = {}) => ({ id: 'ct1', name: 'Fase 1-2', color: '#3B8FD4', default_duration_days: 30, ...over })

afterEach(() => vi.clearAllMocks())

describe('ContractTypesSettings', () => {
  it('renders the seeded contract types with their duration badge', async () => {
    api.get.mockResolvedValue({ data: [type()] })
    render(<ContractTypesSettings />)

    await screen.findByText('Fase 1-2')
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('saves the entered duration when adding a new contract type', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: { id: 'ct2', name: 'ZZP Flex', default_duration_days: 90 } })
    const user = userEvent.setup()
    render(<ContractTypesSettings />)

    await user.click(await screen.findByRole('button', { name: st('matches.contractTypeAdd') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'ZZP Flex')
    await user.type(screen.getByDisplayValue(''), '90')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    // Assert the REQUEST (§13) — not just that a callback fired.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/contract-types',
      expect.objectContaining({ name: 'ZZP Flex', default_duration_days: 90 })))
  })
})
