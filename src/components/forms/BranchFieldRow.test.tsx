/**
 * BranchFieldRow — shared "Vestiging" field row (OpportunityGeneralCard + PlacementCard).
 * Behaviour tests: picking an option and clearing both call onBranchChange with
 * the exact expected value.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BranchFieldRow from './BranchFieldRow'

const OPTIONS = [{ value: 'b1', label: 'Amsterdam' }, { value: 'b2', label: 'Rotterdam' }]

describe('BranchFieldRow', () => {
  const defaultProps = {
    label: 'Vestiging',
    branchId: '',
    onBranchChange: vi.fn(),
    branchOptions: OPTIONS,
    clearLabel: 'Vestiging',
    placeholder: 'Selecteer',
  }

  it('renders the field label', () => {
    render(<BranchFieldRow {...defaultProps} />)
    expect(screen.getByText('Vestiging')).toBeInTheDocument()
  })

  // The trigger's accessible name is the FIELD LABEL (via FieldRow's
  // aria-labelledby), not the placeholder text — measured against the real
  // CreatableSelect render.
  it('picking an option calls onBranchChange with that option\'s value', async () => {
    const onBranchChange = vi.fn()
    const user = userEvent.setup()
    render(<BranchFieldRow {...defaultProps} onBranchChange={onBranchChange} />)
    await user.click(screen.getByRole('button', { name: 'Vestiging' }))
    await user.click(screen.getByRole('button', { name: 'Rotterdam' }))
    expect(onBranchChange).toHaveBeenCalledWith('b2')
  })

  // No i18n resources are loaded in this suite, so react-i18next falls back to
  // the raw key ('clearField') — the same convention CreatableSelect.test.tsx documents.
  it('clearing a picked branch calls onBranchChange with an empty string', async () => {
    const onBranchChange = vi.fn()
    const user = userEvent.setup()
    render(<BranchFieldRow {...defaultProps} branchId="b1" onBranchChange={onBranchChange} />)
    await user.click(screen.getByRole('button', { name: 'clearField' }))
    expect(onBranchChange).toHaveBeenCalledWith('')
  })
})
