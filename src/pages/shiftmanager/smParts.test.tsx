/**
 * smParts.test — SmInitialBubble renders the first letter of the label
 * uppercased at the given size/radius, and falls back to "?" when unlabelled.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SmInitialBubble } from './smParts'

describe('SmInitialBubble', () => {
  it('renders the uppercased first letter at the given size/radius', () => {
    const { container } = render(<SmInitialBubble label="finance" size={30} radius={8} />)
    expect(screen.getByText('F')).toBeInTheDocument()
    const bubble = container.firstElementChild as HTMLElement
    expect(bubble.style.width).toBe('30px')
    expect(bubble.style.height).toBe('30px')
    expect(bubble.style.borderRadius).toBe('8px')
  })

  it('falls back to "?" when there is no label', () => {
    render(<SmInitialBubble size={32} radius={8} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
