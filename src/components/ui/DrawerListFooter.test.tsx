import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DrawerListFooter } from './DrawerListFooter'

// The shared shown-of-count + close footer (EntityListDrawer, ShiftsDrillDownDrawer).
describe('DrawerListFooter', () => {
  it('renders the summary text and the close label', () => {
    render(<DrawerListFooter summary="Showing 3 of 10" onClose={() => {}} closeLabel="Close" />)
    expect(screen.getByText('Showing 3 of 10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<DrawerListFooter summary="x" onClose={onClose} closeLabel="Close" />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
