import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiAgentAvatar from './AiAgentAvatar'

// Guards the vacancy table's AI-agent avatar: visible name, one accessible name
// on the wrapper, and a purely decorative (aria-hidden) Sparkle mark.
describe('AiAgentAvatar', () => {
  it('renders the agent name as visible text', () => {
    render(<AiAgentAvatar name="Kelly Yesway" />)
    expect(screen.getByText('Kelly Yesway')).toBeInTheDocument()
  })

  it('exposes the agent name as the wrapper accessible name', () => {
    const { container } = render(<AiAgentAvatar name="Kelly Yesway" />)
    expect(container.querySelector('[aria-label="Kelly Yesway"]')).toBeTruthy()
  })

  it('marks the decorative sparkle icon aria-hidden', () => {
    const { container } = render(<AiAgentAvatar name="Kelly Yesway" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders nothing when no agent is linked', () => {
    const { container } = render(<AiAgentAvatar name={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
