import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OutreachBulkBar from './OutreachBulkBar'

// i18n is not initialised in tests, so t() returns the key and we assert on keys.
const baseProps = () => ({
  count: 2, onClear: vi.fn(), onSetStatus: vi.fn(), onArchive: vi.fn(),
  statuses: [{ value: 'open', label: 'Open', color: 'var(--color-info)' }],
})

describe('OutreachBulkBar', () => {
  // The status node is a mutation: absent without the update right.
  it('hides the status node without canEdit but keeps Archive on its own gate', async () => {
    const user = userEvent.setup()
    render(<OutreachBulkBar {...baseProps()} canArchive />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.queryByText('bulk.changeStatus')).toBeNull()
    expect(screen.getByText('bulk.archive')).toBeInTheDocument()
  })

  it('shows the status node and passes the picked value with canEdit', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<OutreachBulkBar {...props} canEdit />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeStatus'))
    await user.click(screen.getByText('Open'))
    expect(props.onSetStatus).toHaveBeenCalledWith('open')
  })
})
