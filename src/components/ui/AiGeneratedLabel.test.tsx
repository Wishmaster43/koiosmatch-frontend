import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiGeneratedLabel from './AiGeneratedLabel'

// i18next is uninitialised in tests, but AiGeneratedLabel supplies a Dutch
// defaultValue for both keys — that fallback is what real users would see
// until the keys land in every locale (§5), so we assert on it directly
// rather than the raw key (mirrors common:koios.column's own defaultValue).
describe('AiGeneratedLabel', () => {
  it('renders the Koios AI mark and the visible "AI-gegenereerd" text — icon+text, never colour-only (§6)', () => {
    render(<AiGeneratedLabel />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByText('AI-gegenereerd')).toBeInTheDocument()
  })

  it('carries the explanatory hint as a real tooltip, not just an icon', () => {
    render(<AiGeneratedLabel />)
    expect(screen.getAllByTitle('Door Koios AI gegenereerd — controleer voor gebruik.').length).toBeGreaterThan(0)
  })

  it('scales the icon with the one size prop', () => {
    render(<AiGeneratedLabel size={14} />)
    const img = screen.getByRole('img')
    expect(img).toHaveStyle({ width: '17px', height: '17px' })
  })
})
