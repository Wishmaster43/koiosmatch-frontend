// CanonFieldRow — asserts the two alignment modes and that a caller labelStyle
// merges onto, never replaces, the canon label style (both adopters rely on this).
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CanonFieldRow } from './CanonFieldRow'

describe('CanonFieldRow', () => {
  it('centers the label by default (single-line value)', () => {
    render(<CanonFieldRow label="Status">value</CanonFieldRow>)
    const label = screen.getByText('Status')
    expect(label.parentElement).toHaveStyle({ alignItems: 'center' })
  })

  it('top-aligns the label with a marginTop when align="flex-start" (wrapping value)', () => {
    render(<CanonFieldRow label="Notes" align="flex-start">a long wrapping value</CanonFieldRow>)
    const label = screen.getByText('Notes')
    expect(label.parentElement).toHaveStyle({ alignItems: 'flex-start' })
    expect(label).toHaveStyle({ marginTop: '2px' })
  })

  it('merges a caller labelStyle onto the canon label style, never replacing it', () => {
    render(
      <CanonFieldRow label="Type" labelStyle={{ display: 'flex', gap: 4 }}>value</CanonFieldRow>,
    )
    const label = screen.getByText('Type')
    // Canon label identity (fontSize/width from CANON_LABEL_STYLE) survives...
    expect(label).toHaveStyle({ fontSize: '11px', width: '120px' })
    // ...alongside the caller's own extra style.
    expect(label).toHaveStyle({ display: 'flex', gap: '4px' })
  })
})
