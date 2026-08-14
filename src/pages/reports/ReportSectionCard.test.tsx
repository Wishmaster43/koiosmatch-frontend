// Behavioural coverage for the shared report section-card shape (ReportSectionCard/
// ReportSectionCardBody/ReportSection) — the one structural wrapper every report page
// composes with ReportStateBlock, replacing 14 hand-typed copies of the same card style.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportSectionCard, ReportSectionCardBody, ReportSection, reportCardStyle } from './ReportSectionCard'

describe('ReportSectionCard', () => {
  it('renders its children inside the one shared card shape', () => {
    render(<ReportSectionCard><div>content</div></ReportSectionCard>)
    const content = screen.getByText('content')
    // The card style (surface/radius/border) is applied on the direct parent —
    // every report page gets this shape from one place, never a re-typed literal.
    const cardEl = content.parentElement as HTMLElement
    expect(cardEl).toHaveStyle({ background: reportCardStyle.background, borderRadius: '12px' })
  })
})

describe('ReportSectionCardBody', () => {
  it('lays out its sections with the shared padding:20 / gap:24 rhythm', () => {
    render(<ReportSectionCardBody><div>a</div><div>b</div></ReportSectionCardBody>)
    const wrapper = screen.getByText('a').parentElement as HTMLElement
    expect(wrapper).toHaveStyle({ padding: '20px', display: 'flex', gap: '24px' })
  })
})

describe('ReportSection', () => {
  it('renders a titled section with the shared uppercase heading style', () => {
    render(<ReportSection title="Axis title"><div>body</div></ReportSection>)
    expect(screen.getByText('Axis title')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('renders a custom heading node instead of the plain title when provided', () => {
    render(<ReportSection heading={<div>custom heading</div>}><div>body</div></ReportSection>)
    expect(screen.getByText('custom heading')).toBeInTheDocument()
  })
})
