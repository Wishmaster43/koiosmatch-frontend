import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Users } from 'lucide-react'
import SubNavButton from './SubNavButton'

// SubNavButton is the shared settings master-detail sub-nav row (ExportSettings, ImportEntityNav).
describe('SubNavButton', () => {
  it('renders the label and fires onClick', () => {
    const onClick = vi.fn()
    render(<SubNavButton icon={Users} label="Candidates" active={false} onClick={onClick} />)
    fireEvent.click(screen.getByText('Candidates'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('sets aria-current only when both active and ariaCurrent are requested', () => {
    render(<SubNavButton icon={Users} label="Candidates" active onClick={() => {}} ariaCurrent />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true')
  })

  it('omits aria-current by default', () => {
    render(<SubNavButton icon={Users} label="Candidates" active onClick={() => {}} />)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current')
  })
})
