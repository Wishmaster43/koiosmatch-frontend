/**
 * SubEntityArchiveDialogs — behaviour asserted against the two real consumers
 * (DepartmentDetail/LocationDetail): the confirm `dialog` node always renders,
 * the counts dialog opens exactly when blockedCounts is set, and its archive
 * escape closes the dialog then calls archiveNow (ARCHIVE-SUBENTITY-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubEntityArchiveDialogs from './SubEntityArchiveDialogs'

// Capture the props InUseCountsDialog receives — a real render pulls in
// FloatingPanel/portal machinery this unit test does not need to prove.
const dialogProps = vi.fn()
vi.mock('./InUseCountsDialog', () => ({
  default: (props: Record<string, unknown>) => { dialogProps(props); return <div data-testid="in-use-dialog" /> },
}))

describe('SubEntityArchiveDialogs', () => {
  it('renders the confirm dialog node and passes open=false with no blocked counts', () => {
    render(<SubEntityArchiveDialogs dialog={<div data-testid="confirm" />} blockedCounts={null}
      setBlockedCounts={vi.fn()} archiveNow={vi.fn()} archiving={false} />)

    expect(screen.getByTestId('confirm')).toBeInTheDocument()
    expect(dialogProps).toHaveBeenCalledWith(expect.objectContaining({ open: false, counts: {} }))
  })

  it('opens the counts dialog with the blocked counts and archives + closes on the escape', () => {
    const setBlockedCounts = vi.fn()
    const archiveNow = vi.fn().mockResolvedValue(undefined)
    render(<SubEntityArchiveDialogs dialog={null} blockedCounts={{ vacancies: 2 }}
      setBlockedCounts={setBlockedCounts} archiveNow={archiveNow} archiving={false} />)

    expect(dialogProps).toHaveBeenCalledWith(expect.objectContaining({ open: true, counts: { vacancies: 2 } }))
    // Fire the captured onArchive callback exactly like a real InUseCountsDialog click would.
    const { onArchive } = dialogProps.mock.calls[dialogProps.mock.calls.length - 1][0] as { onArchive: () => void }
    onArchive()
    expect(setBlockedCounts).toHaveBeenCalledWith(null)
    expect(archiveNow).toHaveBeenCalled()
  })
})
