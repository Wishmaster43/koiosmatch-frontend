/**
 * PeopleReport — the Recruiters/Accountmanagers switch (RAPPORTEN-CONSOLIDATIE-1).
 * Each position's own report keeps its full existing test coverage in its own
 * file — this file only proves the SWITCH mechanics: the right sub-report
 * renders per position, `initialView` seeds a legacy-route deep link, and
 * switching updates the shareable URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Side-effect import: initialises the shared i18next singleton (see
// CustomerStructureReport.test.tsx's identical note).
import '@/i18n'
import PeopleReport from './PeopleReport'

vi.mock('./RecruitersReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">recruiters:{period}</div> }))
vi.mock('./AccountManagersReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">accountmanagers:{period}</div> }))

beforeEach(() => { window.history.replaceState(null, '', '#reports.people') })

describe('PeopleReport — Recruiters/Accountmanagers switch', () => {
  it('defaults to Recruiters when no initialView is given (the canonical reports.people route)', () => {
    render(<PeopleReport period="month" />)
    expect(screen.getByTestId('active-report').textContent).toBe('recruiters:month')
  })

  it('honours initialView for a legacy-route deep link (reports.accountmanagers)', () => {
    render(<PeopleReport period="month" initialView="accountmanagers" />)
    expect(screen.getByTestId('active-report').textContent).toBe('accountmanagers:month')
  })

  it('clicking a switch option swaps the rendered sub-report AND updates the shareable URL', async () => {
    const user = userEvent.setup()
    render(<PeopleReport period="week" />)
    await user.click(screen.getByRole('radio', { name: 'Accountmanagers' }))
    expect(screen.getByTestId('active-report').textContent).toBe('accountmanagers:week')
    expect(window.location.hash).toBe('#reports.people?view=accountmanagers')
  })

  it('renders both positions as a labelled radiogroup', () => {
    render(<PeopleReport period="month" />)
    expect(screen.getByRole('radiogroup', { name: 'Team' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Recruiters' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Accountmanagers' })).toBeInTheDocument()
  })
})
