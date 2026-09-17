import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubEntityDuplicateNotice from './SubEntityDuplicateNotice'

// The notice atom is mocked flat: this test proves the WIRING to the guard, the atom has its own suite.
vi.mock('@/components/forms/DuplicateNotice', () => ({
  default: ({ keyPrefix, match, canRestore, onOpen, onRestore, onDismiss }: {
    keyPrefix: string; match: { id: string }; canRestore: boolean; onOpen: () => void; onRestore: () => void; onDismiss: () => void
  }) => (
    <div data-testid="notice" data-prefix={keyPrefix} data-id={match.id} data-restore={String(canRestore)}>
      <button onClick={onOpen}>open</button><button onClick={onRestore}>restore</button><button onClick={onDismiss}>dismiss</button>
    </div>
  ),
}))

const guard = (notice: { id: string; name: string; archived?: boolean } | null) => ({
  notice, dismiss: vi.fn(), clearOnEdit: vi.fn(), openExisting: vi.fn(), restore: vi.fn(), restoring: false, canRestore: notice?.archived === true,
})

describe('SubEntityDuplicateNotice', () => {
  it('renders nothing while the guard holds no match', () => {
    render(<SubEntityDuplicateNotice keyPrefix="locations" dup={guard(null)} />)
    expect(screen.queryByTestId('notice')).toBeNull()
  })

  it('wires open, restore and dismiss to the guard with the matched id', () => {
    const dup = guard({ id: 'loc-7', name: 'Depot', archived: true })
    render(<SubEntityDuplicateNotice keyPrefix="locations" dup={dup} />)
    const notice = screen.getByTestId('notice')
    expect(notice.dataset.prefix).toBe('locations')
    expect(notice.dataset.restore).toBe('true')
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('restore'))
    fireEvent.click(screen.getByText('dismiss'))
    expect(dup.openExisting).toHaveBeenCalledWith('loc-7')
    expect(dup.restore).toHaveBeenCalledWith('loc-7')
    expect(dup.dismiss).toHaveBeenCalledTimes(1)
  })
})
