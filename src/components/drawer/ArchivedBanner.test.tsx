/**
 * ArchivedBanner — the shared per-record archived state (extracted for matches/
 * opportunities so a 3rd/4th near-identical copy of Vacancy/ApplicationArchivedBanner
 * wasn't created). Pins: the message renders, the restore button only appears when
 * onRestore is passed, and clicking it calls back with the id.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ArchivedBanner from './ArchivedBanner'

describe('ArchivedBanner', () => {
  it('renders the message and omits the restore button when onRestore is absent', () => {
    render(<ArchivedBanner id="m1" message="Archived since 12-07-2026" restoreLabel="Restore" />)
    expect(screen.getByText('Archived since 12-07-2026')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onRestore with the id when the restore button is clicked', () => {
    const onRestore = vi.fn()
    render(<ArchivedBanner id="m1" message="Archived" onRestore={onRestore} restoreLabel="Restore" />)
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(onRestore).toHaveBeenCalledWith('m1')
  })
})
