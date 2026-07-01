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

  it('shows Detach and fires onDetach when permitted', async () => {
    const user = userEvent.setup()
    const props = { ...baseProps(), canManage: true }
    render(<ApplicationsBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.detach'))
    expect(props.onDetach).toHaveBeenCalledTimes(1)
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
