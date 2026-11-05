import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiGeneratedLabel from './AiGeneratedLabel'

// i18next is uninitialised in tests, so t() echoes the key (KEY-ECHO-TEST-1).
describe('AiGeneratedLabel', () => {
  it('renders the Koios AI mark and the visible aiGenerated text — icon+text, never colour-only (§6)', () => {
    render(<AiGeneratedLabel />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByText('aiGenerated')).toBeInTheDocument()
  })

  it('carries the explanatory hint as a real tooltip, not just an icon', () => {
    render(<AiGeneratedLabel />)
    expect(screen.getAllByTitle('aiGeneratedHint').length).toBeGreaterThan(0)
  })

  it('scales the icon with the one size prop', () => {
    render(<AiGeneratedLabel size={14} />)
    const img = screen.getByRole('img')
    expect(img).toHaveInlineStyle({ width: '17px', height: '17px' })
  })
})
