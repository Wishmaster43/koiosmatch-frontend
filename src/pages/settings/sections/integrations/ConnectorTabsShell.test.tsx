/**
 * ConnectorTabsShell — renders the tab bar and the children, and reports tab clicks.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConnectorTabsShell from './ConnectorTabsShell'

describe('ConnectorTabsShell', () => {
  // Tabs and content render, and clicking a tab hands its id to onChange.
  it('renders tabs and children and reports a tab click', async () => {
    const onChange = vi.fn()
    render(<ConnectorTabsShell tabs={[{ id: 'a', label: 'Tab A' }, { id: 'b', label: 'Tab B' }]} active="a" onChange={onChange}><p>body</p></ConnectorTabsShell>)
    expect(screen.getByText('body')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Tab B'))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
