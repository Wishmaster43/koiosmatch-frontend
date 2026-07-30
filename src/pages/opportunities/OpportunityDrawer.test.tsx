/**
 * OpportunityDrawer — the title-row reference number chip (NUMMER-3): the API now
 * sends OpportunityResource::reference_number on every row (measured), so the
 * drawer shows it as a copy chip right after the title, before the phase badge —
 * same anatomy as the customer contact/location drawers (§3A). The shared
 * ReferenceNumberChip renders nothing when the value is empty.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text.
import '@/i18n'
import OpportunityDrawer from './OpportunityDrawer'
import { mapOpportunity } from './data/mapOpportunity'

// Heavy tab bodies are out of scope for this title-row test — stub them out.
vi.mock('./drawer/DetailsTab', () => ({ default: () => null }))
vi.mock('./drawer/KlantTab', () => ({ default: () => null }))
vi.mock('./drawer/NotesTab', () => ({ default: () => null }))
vi.mock('./drawer/TasksTab', () => ({ default: () => null }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))

const noop = () => {}

describe('OpportunityDrawer — reference number chip', () => {
  it('shows the copy chip when reference_number is present', () => {
    const o = mapOpportunity({ id: 'o1', title: 'Deal A', reference_number: 'D-42' })
    render(<OpportunityDrawer opportunity={o} onClose={noop} />)
    expect(screen.getByText('D-42')).toBeInTheDocument()
  })

  it('renders nothing when reference_number is absent', () => {
    const o = mapOpportunity({ id: 'o2', title: 'Deal B' })
    render(<OpportunityDrawer opportunity={o} onClose={noop} />)
    expect(screen.queryByText(/^D-/)).toBeNull()
  })
})
