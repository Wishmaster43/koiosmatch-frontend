/**
 * CandidateCustomRequiredFields — the phase toggles flip OPTIMISTICALLY (Danny 09-09,
 * TOGGLE-SWEEP: "een toggle reageert snel, anders een opslaan-knop"): the switch is on
 * before the PATCH resolves, the PATCH carries the definition's required_phases, and a
 * refused PATCH reverts the switch with the server's reason.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateCustomRequiredFields from './CandidateCustomRequiredFields'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
const { patch, invalidate } = vi.hoisted(() => ({ patch: vi.fn(), invalidate: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { patch } }))
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({
    allFields: [{ id: 'f1', label: 'Rijbewijs', active: true, required_always: false, required_for: [] }],
    loading: false, invalidate,
  }),
}))

const phases = [{ value: 'lead', label: 'Lead' }]

beforeEach(() => vi.clearAllMocks())

describe('CandidateCustomRequiredFields · optimistic phase toggle', () => {
  it('flips the switch before the PATCH resolves and sends required_phases on the definition', async () => {
    const user = userEvent.setup()
    let resolvePatch: (v: unknown) => void = () => {}
    patch.mockReturnValue(new Promise(res => { resolvePatch = res }))
    render(<CandidateCustomRequiredFields phases={phases} />)

    const sw = screen.getByRole('switch', { name: 'Rijbewijs — Lead' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await user.click(sw)
    // Optimistic: on while the request is still in flight.
    expect(screen.getByRole('switch', { name: 'Rijbewijs — Lead' })).toHaveAttribute('aria-checked', 'true')
    expect(patch).toHaveBeenCalledWith('/custom-fields/f1', { required_phases: ['lead'] })
    resolvePatch({ data: {} })
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })

  it('reverts the switch and shows the server reason when the PATCH is refused', async () => {
    const user = userEvent.setup()
    patch.mockRejectedValue({ response: { status: 422, data: { message: 'Fase bestaat niet.' } } })
    render(<CandidateCustomRequiredFields phases={phases} />)

    await user.click(screen.getByRole('switch', { name: 'Rijbewijs — Lead' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Fase bestaat niet.'))
    expect(screen.getByRole('switch', { name: 'Rijbewijs — Lead' })).toHaveAttribute('aria-checked', 'false')
  })
})
