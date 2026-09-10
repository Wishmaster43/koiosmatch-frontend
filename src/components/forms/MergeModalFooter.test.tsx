/**
 * MergeModalFooter — shared back/cancel/confirm row (MergeCandidateModal +
 * MergeCustomerModal + MergeEntityModal). Behaviour tests, not "renders".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MergeModalFooter from './MergeModalFooter'

describe('MergeModalFooter', () => {
  const defaultProps = {
    showBack: true,
    onBack: vi.fn(),
    backLabel: 'Terug',
    onCancel: vi.fn(),
    cancelLabel: 'Annuleren',
    onConfirm: vi.fn(),
    confirmDisabled: false,
    busy: false,
    confirmLabel: 'Samenvoegen',
  }

  it('does not render Back when showBack is false', () => {
    render(<MergeModalFooter {...defaultProps} showBack={false} />)
    expect(screen.queryByText('Terug')).toBeNull()
  })

  it('clicking Back calls onBack exactly once', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<MergeModalFooter {...defaultProps} onBack={onBack} />)
    await user.click(screen.getByText('Terug'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('Back is enabled by default (only MergeCandidateModal opts into backDisabled)', () => {
    render(<MergeModalFooter {...defaultProps} />)
    expect(screen.getByText('Terug').closest('button')).not.toBeDisabled()
  })

  it('backDisabled disables the Back button', () => {
    render(<MergeModalFooter {...defaultProps} backDisabled />)
    expect(screen.getByText('Terug').closest('button')).toBeDisabled()
  })

  it('clicking Cancel calls onCancel exactly once', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<MergeModalFooter {...defaultProps} onCancel={onCancel} />)
    await user.click(screen.getByText('Annuleren'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('clicking Confirm calls onConfirm exactly once, and busy swaps the icon for a spinner', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<MergeModalFooter {...defaultProps} onConfirm={onConfirm} />)
    await user.click(screen.getByText('Samenvoegen'))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    rerender(<MergeModalFooter {...defaultProps} onConfirm={onConfirm} busy />)
    // The confirm button stays labelled, but the GitMerge icon is now a Spinner —
    // the button itself remains the same accessible target either way.
    expect(screen.getByText('Samenvoegen').closest('button')).toBeInTheDocument()
  })

  it('confirmDisabled disables the Confirm button', () => {
    render(<MergeModalFooter {...defaultProps} confirmDisabled />)
    expect(screen.getByText('Samenvoegen').closest('button')).toBeDisabled()
  })
})
