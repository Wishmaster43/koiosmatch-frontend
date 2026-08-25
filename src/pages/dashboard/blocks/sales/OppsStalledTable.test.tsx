/**
 * OppsStalledTable — asserts rows render from the exact server shape and a row
 * click navigates to the opportunity record (OpportunitiesPage's { open } intent).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OppsStalledTable from './OppsStalledTable'
import type { OppStalledRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))

const rows: OppStalledRow[] = [
  { id: 'o1', title: 'Deal One', customer: 'Acme', owner: 'Bob', stage_label: 'Proposal', days_still: 14, value: 5000 },
  { id: 'o2', title: 'Deal Two', customer: null, owner: 'Bob', stage_label: null, days_still: 30, value: null },
]

describe('OppsStalledTable', () => {
  it('renders rows with fallback dashes for missing customer/stage/value', () => {
    render(<OppsStalledTable rows={rows} />)
    expect(screen.getByText('Deal One')).toBeInTheDocument()
    expect(screen.getByText('Deal Two')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('navigates to the opportunity record on row click', () => {
    const onNavigate = vi.fn()
    render(<OppsStalledTable rows={rows} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Deal One'))
    expect(onNavigate).toHaveBeenCalledWith('opportunities', { open: 'o1' })
  })

  it('carries no tabindex on its rows without onNavigate (DataTable rows never carry role=button)', () => {
    const { container } = render(<OppsStalledTable rows={rows} />)
    expect(container.querySelector('tbody tr[tabindex]')).not.toBeInTheDocument()
  })

  it('self-hides on an empty feed', () => {
    const { container } = render(<OppsStalledTable rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
