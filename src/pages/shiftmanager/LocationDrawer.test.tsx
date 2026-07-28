/**
 * LocationDrawer — regression test for the removed Add/Edit controls (audit fix).
 * /sm_locations is a read-only ShiftManager mirror (GET + GET/{id} only,
 * api-generated.ts) — the old "+ Add" (departments) and footer "Edit" buttons
 * had no onClick and no backing route: pure fake affordances (§3). They must
 * stay gone, not silently reappear on the next edit of this file.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@/i18n'
import LocationDrawer from './LocationDrawer'
import type { SmLocationRow } from '@/types/shiftmanager'

const loc: SmLocationRow = {
  id: 'loc-1', name: 'Zorgcentrum Zuid', customer: 'Yesway Zorg', city: 'Utrecht',
  address: 'Hoofdstraat 1', status: 'Actief', departments: ['Verpleging', 'Facilitair'], shifts: 4,
}

describe('shiftmanager/LocationDrawer · no fake add/edit controls', () => {
  it('renders the department list without an "Add" trigger', () => {
    render(<LocationDrawer loc={loc} onClose={() => {}} />)
    expect(screen.getByText('Verpleging')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /toevoegen|add/i })).not.toBeInTheDocument()
  })

  it('renders no footer "Edit" action', () => {
    render(<LocationDrawer loc={loc} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /bewerken|edit/i })).not.toBeInTheDocument()
  })
})
