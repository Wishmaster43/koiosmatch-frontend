import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConsentStateCaption from './ConsentStateCaption'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `D(${v})` }) }))

// Raw-key i18n in tests: assert the key and the interpolated date option.
describe('ConsentStateCaption', () => {
  it('granted with a date', () => {
    render(<ConsentStateCaption state="granted" at="2026-01-01" />)
    expect(screen.getByText('consentState.grantedAt')).toBeTruthy()
  })
  it('refused with and without date', () => {
    const { rerender } = render(<ConsentStateCaption state="refused" at="2026-01-01" />)
    expect(screen.getByText('consentState.refusedAt')).toBeTruthy()
    rerender(<ConsentStateCaption state="refused" />)
    expect(screen.getByText('consentState.refused')).toBeTruthy()
  })
  it('not asked and unconfirmed', () => {
    const { rerender } = render(<ConsentStateCaption state="not_asked" />)
    expect(screen.getByText('consentState.notAsked')).toBeTruthy()
    rerender(<ConsentStateCaption state="unconfirmed" />)
    expect(screen.getByText('consentState.unconfirmed')).toBeTruthy()
  })
  it('null renders nothing', () => {
    const { container } = render(<ConsentStateCaption state={null} />)
    expect(container.textContent).toBe('')
  })
})
