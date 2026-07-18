import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationsBulkBar from './ApplicationsBulkBar'

// i18n is not initialised in tests → t() returns the key, so we drive/assert on keys.
const baseProps = () => ({
  count: 3, onClear: vi.fn(), onSetPhase: vi.fn(), onDetach: vi.fn(),
  phases: [{ value: 'applied', label: 'Applied' }, { value: 'hired', label: 'Hired' }],
})

describe('ApplicationsBulkBar', () => {
  it('shows the selected count', () => {
    render(<ApplicationsBulkBar {...baseProps()} />)
    expect(screen.getByText('bulk.selected')).toBeInTheDocument()
  })

  it('hides Detach unless the user may manage', async () => {
    const user = userEvent.setup()
    render(<ApplicationsBulkBar {...baseProps()} canManage={false} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.getByText('bulk.changePhase')).toBeInTheDocument()
    expect(screen.queryByText('bulk.detach')).toBeNull()
  })

  it('shows Detach as a reason input (not a plain click) and threads the typed reason through onDetach', async () => {
    // Heraudit-R2 finding 1: the old test only asserted onDetach fired on a plain
    // click — that passed even though bulkDetach's DELETE carried no `reason`
    // body and 422'd on the real API (S15 requires one). This exercises the input
    // node end-to-end: type a reason, submit, assert the EXACT string reaches onDetach.
    const user = userEvent.setup()
    const props = { ...baseProps(), canManage: true }
    render(<ApplicationsBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.detach'))
    const textarea = screen.getByPlaceholderText('bulk.detachReasonPlaceholder')
    await user.type(textarea, 'No longer relevant')
    await user.click(screen.getByText('bulk.detachConfirm'))
    expect(props.onDetach).toHaveBeenCalledTimes(1)
    expect(props.onDetach).toHaveBeenCalledWith('No longer relevant')
  })

  it('never submits an empty reason for detach', async () => {
    const user = userEvent.setup()
    const props = { ...baseProps(), canManage: true }
    render(<ApplicationsBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.detach'))
    expect(screen.getByText('bulk.detachConfirm')).toBeDisabled()
    expect(props.onDetach).not.toHaveBeenCalled()
  })

  it('passes the chosen funnel phase value through', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ApplicationsBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changePhase'))
    await user.click(screen.getByText('Hired'))
    expect(props.onSetPhase).toHaveBeenCalledWith('hired')
  })

  it('clears the selection', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ApplicationsBulkBar {...props} />)
    await user.click(screen.getByText('bulk.deselect'))
    expect(props.onClear).toHaveBeenCalledTimes(1)
  })
})
