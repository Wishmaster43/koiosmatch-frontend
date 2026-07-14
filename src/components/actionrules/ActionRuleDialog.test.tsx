import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionRuleDialog from './ActionRuleDialog'

describe('ActionRuleDialog', () => {
  // Closed = no DOM at all (never a hidden-but-present modal trapping focus/clicks).
  it('renders nothing when closed', () => {
    const { container } = render(
      <ActionRuleDialog open={false} decision={{ effect: 'warn' }} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  // warn — both actions available; confirming/cancelling call the right prop.
  it('confirms and cancels a warn decision', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ActionRuleDialog open decision={{ effect: 'warn', message: 'Let op.' }} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByText('actionRules.ok'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByText('actionRules.cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  // block — nothing to proceed with, so the confirm button must not render.
  it('hides the confirm button for a block decision', () => {
    render(<ActionRuleDialog open decision={{ effect: 'block', message: 'Niet toegestaan.' }} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText('actionRules.ok')).not.toBeInTheDocument()
    expect(screen.getByText('actionRules.cancel')).toBeInTheDocument()
  })

  // Escape closes the dialog (a11y §6 keyboard operability).
  it('calls onCancel on Escape', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ActionRuleDialog open decision={{ effect: 'warn' }} onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
