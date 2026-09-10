import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppointmentEditModal from './AppointmentEditModal'

// Deep-path stub of the shared modal (CLAUDE.md §2 TESTLES: never the barrel).
interface StubModalProps { candidateId?: string; mode?: string; onClose: () => void; onCreated: () => void }
vi.mock('@/pages/candidates/drawer/PlanIntakeModal', () => ({
  default: ({ candidateId, mode, onClose, onCreated }: StubModalProps) => (
    <div data-testid="plan-intake-modal" data-candidate={candidateId} data-mode={mode}>
      <button onClick={onClose}>close</button>
      <button onClick={onCreated}>save</button>
    </div>
  ),
}))

describe('AppointmentEditModal', () => {
  it('renders nothing while no row is being edited', () => {
    const { container } = render(<AppointmentEditModal editing={null} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the shared modal prefilled with the editing row and mode=appointment', () => {
    render(<AppointmentEditModal editing={{ candidateId: 'c1', appt: { id: 'a1' } }} onClose={vi.fn()} onSaved={vi.fn()} />)
    const modal = screen.getByTestId('plan-intake-modal')
    expect(modal).toHaveAttribute('data-candidate', 'c1')
    expect(modal).toHaveAttribute('data-mode', 'appointment')
  })

  it('wires onClose/onSaved straight through to the modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<AppointmentEditModal editing={{ candidateId: 'c1', appt: { id: 'a1' } }} onClose={onClose} onSaved={onSaved} />)

    await user.click(screen.getByText('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByText('save'))
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
