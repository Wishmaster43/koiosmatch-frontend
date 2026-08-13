/**
 * MatchFilterBar — B12 regression coverage. Pins: (1) the primary triggers show
 * the label INSIDE the button (no separate field label, canon: label lives in
 * the trigger); (2) picking a stage value calls onStageChange with the toggled
 * set; (3) an active client filter (chosen via "More filters") renders as a
 * removable secondary chip, and clicking its × clears just that one filter.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import '@/i18n'
import MatchFilterBar from './MatchFilterBar'

const baseProps = {
  stageOptions: [{ value: 'proposed', label: 'Proposed' }],
  stage: [] as string[],
  onStageChange: vi.fn(),
  ownerOptions: [{ value: 'u1', label: 'Jane' }],
  owner: [] as string[],
  onOwnerChange: vi.fn(),
  clientOptions: [{ value: 'c1', label: 'Acme' }],
  client: [] as string[],
  onClientChange: vi.fn(),
}

describe('MatchFilterBar', () => {
  it('shows the field label inside the primary triggers, no separate label', () => {
    render(<MatchFilterBar {...baseProps} />)
    // Default test locale is nl (src/i18n/index.ts) — "Fase"/"Eigenaar" prompt
    // lives INSIDE the trigger button itself, no separate label beside it.
    expect(screen.getByText(/fase/i)).toBeInTheDocument()
    expect(screen.getByText(/eigenaar/i)).toBeInTheDocument()
  })

  it('picking a stage value calls onStageChange with the toggled set', async () => {
    const onStageChange = vi.fn()
    render(<MatchFilterBar {...baseProps} onStageChange={onStageChange} />)
    await userEvent.click(screen.getByText(/fase/i))
    await userEvent.click(await screen.findByText('Proposed'))
    expect(onStageChange).toHaveBeenCalledWith(['proposed'])
  })

  it('an active client filter renders as a removable chip, and × clears it', async () => {
    const onClientChange = vi.fn()
    render(<MatchFilterBar {...baseProps} client={['c1']} onClientChange={onClientChange} />)
    const chip = screen.getByText(/Klant/i).closest('span')
    expect(chip).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /verwijderen/i }))
    expect(onClientChange).toHaveBeenCalledWith([])
  })
})
