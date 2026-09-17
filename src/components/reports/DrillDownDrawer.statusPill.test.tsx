/**
 * DrillDownDrawer — the per-candidate status badge renders via the shared
 * token-tinted StatusPill, never a hand-rolled solid fill with hex shades
 * (D9 audit finding; mirrors KpiDrillDownDrawer's own StatusBadge).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import DrillDownDrawer from './DrillDownDrawer'
import type { ReportCandidate } from '@/types/reports'

const candidate: ReportCandidate = { id: 'c1', firstname: 'Jan', lastname: 'Jansen', status: 'actief' }

describe('DrillDownDrawer — status pill', () => {
  it('renders the status label using only design-system tokens, no hex colour', () => {
    render(<DrillDownDrawer title="Test" candidates={[candidate]} onClose={() => {}} />)
    const pill = screen.getByText('Actief')
    expect(pill).toBeInTheDocument()
    // The pill's own colour (walk up to the styled chip span) must never carry a raw hex value.
    const styled = pill.closest('span')
    expect(styled?.getAttribute('style') ?? '').not.toMatch(/#[0-9A-Fa-f]{3,6}/)
  })
})
