// Behaviour test for the shared settings-form Row: label/content render, and
// `last` drops the bottom divider (the whole reason it exists as a prop).
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SettingsFormRow from './settingsFormRow'

describe('SettingsFormRow', () => {
  it('renders the label and children', () => {
    render(<SettingsFormRow label="Company name">content</SettingsFormRow>)
    expect(screen.getByText('Company name')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('drops the bottom divider when last', () => {
    const { container } = render(<SettingsFormRow label="Company name" last>content</SettingsFormRow>)
    const row = container.firstElementChild as HTMLElement
    expect(row.style.borderBottomStyle).toBe('none')
  })

  it('keeps the bottom divider by default', () => {
    const { container } = render(<SettingsFormRow label="Company name">content</SettingsFormRow>)
    const row = container.firstElementChild as HTMLElement
    // jsdom's CSSOM cannot parse the `border-bottom` shorthand when it contains a
    // var(...) token, so borderBottomStyle stays empty — assert the raw value instead.
    expect(row.style.borderBottom).toBe('1px solid var(--hover-bg)')
  })
})
