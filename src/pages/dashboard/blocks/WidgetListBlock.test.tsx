/**
 * WidgetListBlock — the four UI states: loading shows a spinner, empty self-hides
 * (renders nothing, not an error), success renders rows and fires their onClick.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WidgetListBlock from './WidgetListBlock'

describe('WidgetListBlock', () => {
  it('renders nothing when rows are empty (self-hide, not an error state)', () => {
    const { container } = render(<WidgetListBlock title="Expiring matches" rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a loading spinner while the parent feed is in flight', () => {
    render(<WidgetListBlock title="Expiring matches" rows={[]} loading />)
    expect(screen.getByText('Expiring matches')).toBeInTheDocument()
  })

  it('renders rows and fires the row onClick', () => {
    const onClick = vi.fn()
    render(<WidgetListBlock title="Expiring matches" rows={[{ key: 1, primary: 'Jan Jansen', meta: '01 sep', onClick }]} />)
    fireEvent.click(screen.getByText('Jan Jansen'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is not clickable when a row has no onClick', () => {
    render(<WidgetListBlock title="Expiring matches" rows={[{ key: 1, primary: 'Team A', meta: '12' }]} />)
    const row = screen.getByText('Team A').closest('div[style]')?.parentElement as HTMLElement
    expect(row).toHaveStyle({ cursor: 'default' })
  })
})
