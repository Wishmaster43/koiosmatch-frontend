/**
 * CandidateLookupsSettings — funnel-stage singleton `is_default` flip
 * (LOOKUP-DEFAULT-1, api 4c25677). Only the funnel_types block carries the
 * DefaultToggle; contract forms / statuses / phases must not render it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { FunnelStagesSettings, ContractFormsSettings } from './CandidateLookupsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const stage = (over = {}) => ({ id: 'f1', value: 'applied', label: 'Gesolliciteerd', color: '#3B8FD4', is_default: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('CandidateLookupsSettings — funnel stage default singleton', () => {
  it('shows the DefaultToggle on funnel stages, with the seeded default disabled', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    render(<FunnelStagesSettings />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).toBeDisabled()
    expect(screen.getByRole('button', { name: st('common.setDefault') })).not.toBeDisabled()
  })

  it('promoting a funnel stage PUTs is_default:true and clears the previous default optimistically', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Aangenomen')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/funnel-types/f2', expect.objectContaining({ is_default: true })))
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
  })

  it('does not render the DefaultToggle on the contract-forms (candidate_types) block', async () => {
    api.get.mockResolvedValue({ data: {
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' }],
    } })
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    expect(screen.queryByRole('button', { name: st('common.default') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('common.setDefault') })).not.toBeInTheDocument()
  })
})
