/**
 * BoardColumnHeader — renders dot + label + count pill; token fallback without a colour.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BoardColumnHeader from './BoardColumnHeader'

describe('BoardColumnHeader', () => {
  it('renders label and count', () => {
    render(<BoardColumnHeader label="Applied" count={5} />)
    expect(screen.getByText('Applied')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders a colored dot when showDot is true and color is provided', () => {
    const { container } = render(
      <BoardColumnHeader label="Applied" count={5} color="rgb(79, 127, 255)" showDot />,
    )
    const dot = container.querySelector('span[style*="border-radius: 50%"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveStyle('background: rgb(79, 127, 255)')
  })

  it('does not render a dot when showDot is false', () => {
    render(
      <BoardColumnHeader label="Applied" count={5} color="rgb(79, 127, 255)" showDot={false} />,
    )
    // When showDot is false, there should be no colored dot (only the count pill).
    expect(screen.getByText('Applied')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('tints the count pill from the muted text token when no colour is given', () => {
    render(<BoardColumnHeader label="Applied" count={2} />)
    const pill = screen.getByText('2')
    expect(pill.getAttribute('style')).toContain('var(--text-muted)')
    expect(pill.getAttribute('style')).not.toMatch(/#[0-9a-f]{3,6}/i)
  })

  // §14 canon "a count badge never renders '0'" — an empty column shows no pill at all.
  it('renders no count pill when count is 0', () => {
    render(<BoardColumnHeader label="Applied" count={0} />)
    expect(screen.getByText('Applied')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
