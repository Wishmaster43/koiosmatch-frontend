/**
 * CustomerStructureReport — the Contacts/Locations/Departments switch
 * (RAPPORTEN-CONSOLIDATIE-1). Each position's own report keeps its full
 * existing test coverage (loading/error/nine-cards/drill) in its own file —
 * this file only proves the SWITCH mechanics: the right sub-report renders per
 * position, `initialView` seeds a legacy-route deep link, and switching
 * updates the shareable URL (never a client-side-only toggle).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Side-effect import: initialises the shared i18next singleton. Every sibling
// report test gets this for free via a real child that imports lib/datetime;
// this file mocks all three real children away, so it needs the import itself.
import '@/i18n'
import CustomerStructureReport from './CustomerStructureReport'

// Every position's real report collapses to a thin stub — it only needs to
// prove WHICH one rendered + what `period` it received, never its own body
// (each already has its own dedicated test file).
vi.mock('./ContactsReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">contacts:{period}</div> }))
vi.mock('./LocationsReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">locations:{period}</div> }))
vi.mock('./DepartmentsReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">departments:{period}</div> }))

beforeEach(() => { window.history.replaceState(null, '', '#reports.customerstructure') })

describe('CustomerStructureReport — Contacts/Locations/Departments switch', () => {
  it('defaults to Contacts when no initialView is given (the canonical reports.customerstructure route)', () => {
    render(<CustomerStructureReport period="month" />)
    expect(screen.getByTestId('active-report').textContent).toBe('contacts:month')
  })

  it('honours initialView for a legacy-route deep link (e.g. reports.locations)', () => {
    render(<CustomerStructureReport period="month" initialView="locations" />)
    expect(screen.getByTestId('active-report').textContent).toBe('locations:month')
  })

  it('clicking a switch option swaps the rendered sub-report AND updates the shareable URL', async () => {
    const user = userEvent.setup()
    render(<CustomerStructureReport period="week" />)
    await user.click(screen.getByRole('radio', { name: 'Afdelingen' }))
    expect(screen.getByTestId('active-report').textContent).toBe('departments:week')
    expect(window.location.hash).toBe('#reports.customerstructure?view=departments')
  })

  it('renders all three positions as a labelled radiogroup (searchable-picker parity: every switch position is a real, named control)', () => {
    render(<CustomerStructureReport period="month" />)
    const group = screen.getByRole('radiogroup', { name: 'Klantstructuur' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Contactpersonen' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Locaties' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Afdelingen' })).toBeInTheDocument()
  })
})
