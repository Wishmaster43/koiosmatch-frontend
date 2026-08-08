/**
 * AvailabilityEditor — G34 regression: the day-part picker in the "add" row is now
 * the house `CreatableSelect` (allowCreate={false}), never a native <select>. Proves
 * the same add() payload as before (value/options unchanged, no request shape change)
 * through the new click-to-open interaction.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AvailabilityEditor from './AvailabilityEditor'
import { useCandidateAvailability } from '../hooks/useCandidatePlanning'

vi.mock('../hooks/useCandidatePlanning', () => ({ useCandidateAvailability: vi.fn() }))

describe('AvailabilityEditor · day-part picker is the house CreatableSelect, not a native <select>', () => {
  it('renders no native <select> in the add row', async () => {
    vi.mocked(useCandidateAvailability).mockReturnValue({ entries: [], loading: false, error: false, add: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<AvailabilityEditor candidateId="cand-1" />)
    await user.click(screen.getByRole('button', { name: 'planning.addAvailability' }))
    expect(container.querySelector('select')).toBeNull()
  })

  it('picking a day part and submitting calls add() with the SAME payload shape as before', async () => {
    const add = vi.fn()
    vi.mocked(useCandidateAvailability).mockReturnValue({ entries: [], loading: false, error: false, add, remove: vi.fn() })
    const user = userEvent.setup()
    render(<AvailabilityEditor candidateId="cand-1" />)
    await user.click(screen.getByRole('button', { name: 'planning.addAvailability' }))

    await user.type(screen.getByLabelText('planning.date'), '2026-08-20')
    // The trigger's accessible name is "<field label> <current value>" (CreatableSelect
    // prefixes the aria-labelledby'd field name so the value is never swallowed by it).
    await user.click(screen.getByRole('button', { name: 'planning.dayPart planning.part_day' }))
    await user.click(await screen.findByRole('button', { name: 'planning.part_morning' }))
    await user.click(screen.getByRole('button', { name: 'planning.statusAvailable' }))
    await user.click(screen.getByRole('button', { name: 'common:add' }))

    expect(add).toHaveBeenCalledWith({ date: '2026-08-20', part: 'morning', status: 'available', reason: undefined })
  })
})
