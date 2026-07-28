/**
 * DepartmentDrawer — regression test for the removed footer "Edit" control
 * (audit fix). /sm_departments is a read-only ShiftManager mirror (GET only,
 * api-generated.ts) — the old button had no onClick and no backing route: a
 * fake affordance (§3). It must stay gone, not silently reappear.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@/i18n'
import DepartmentDrawer from './DepartmentDrawer'
import type { SmDepartmentRow } from '@/types/shiftmanager'

const dep: SmDepartmentRow = {
  id: 'dep-1', name: 'Verpleging', customer: 'Yesway Zorg', location: 'Zorgcentrum Zuid',
  status: 'Actief', employees: 12, shifts: 30,
}

describe('shiftmanager/DepartmentDrawer · no fake edit control', () => {
  it('renders the department detail without a footer "Edit" action', () => {
    render(<DepartmentDrawer dep={dep} onClose={() => {}} />)
    expect(screen.getByText('Verpleging')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bewerken|edit/i })).not.toBeInTheDocument()
  })
})
