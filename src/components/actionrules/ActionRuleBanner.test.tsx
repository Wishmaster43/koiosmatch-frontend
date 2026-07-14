import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActionRuleBanner from './ActionRuleBanner'

describe('ActionRuleBanner', () => {
  // No decision at all — dormant, renders nothing.
  it('renders nothing when there is no decision', () => {
    const { container } = render(<ActionRuleBanner decision={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  // allow is silent — nothing to warn/block the user about.
  it('renders nothing for an "allow" decision', () => {
    const { container } = render(<ActionRuleBanner decision={{ effect: 'allow' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  // warn — shows the server's own message verbatim, tinted (not just colour: icon + title too).
  it('renders a warn banner with the server message', () => {
    render(<ActionRuleBanner decision={{ effect: 'warn', popup_code: 'P3', message: 'Kandidaat is tijdelijk niet beschikbaar.' }} />)
    const banner = screen.getByTestId('action-rule-banner')
    expect(banner).toHaveAttribute('data-effect', 'warn')
    expect(screen.getByText('Kandidaat is tijdelijk niet beschikbaar.')).toBeInTheDocument()
    expect(screen.getByText('actionRules.warnTitle')).toBeInTheDocument()
  })

  // block — distinct title key from warn, same verbatim message contract.
  it('renders a block banner with its own title', () => {
    render(<ActionRuleBanner decision={{ effect: 'block', popup_code: 'P8', message: 'Geen toestemming voor WhatsApp.' }} />)
    const banner = screen.getByTestId('action-rule-banner')
    expect(banner).toHaveAttribute('data-effect', 'block')
    expect(screen.getByText('actionRules.blockTitle')).toBeInTheDocument()
    expect(screen.getByText('Geen toestemming voor WhatsApp.')).toBeInTheDocument()
  })

  // A decision without a message still renders the banner shell (title + icon).
  it('renders without crashing when the message is absent', () => {
    render(<ActionRuleBanner decision={{ effect: 'warn' }} />)
    expect(screen.getByTestId('action-rule-banner')).toBeInTheDocument()
  })
})
