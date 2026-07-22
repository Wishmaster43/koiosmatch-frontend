import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VacancyList } from './VacancyList'
import { strings } from '../strings'
import type { VacancySummary } from '../types'

const vacancy: VacancySummary = {
  reference_number: 'REF-1',
  title: 'Verpleegkundige',
  city: 'Utrecht',
  province: 'Utrecht',
  hours: { from: 24, to: 32 },
  contract_types: ['Uitzenden'],
  salary: null,
  intro: 'Leuke functie in de zorg.',
  published_at: '2026-01-01T00:00:00Z',
}

// Renders each of the four required UI states (CLAUDE.md §3) straight off props —
// VacancyList is a dumb renderer, so no fetch mocking is needed to cover all four.
describe('VacancyList — four UI states', () => {
  it('loading', () => {
    render(
      <MemoryRouter>
        <VacancyList tenant="acme" status="loading" vacancies={[]} onRetry={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(strings.list.loading)).toBeTruthy()
  })

  it('error — shows a retry action wired to onRetry', async () => {
    const onRetry = vi.fn()
    render(
      <MemoryRouter>
        <VacancyList tenant="acme" status="error" vacancies={[]} onRetry={onRetry} />
      </MemoryRouter>,
    )
    expect(screen.getByText(strings.list.error)).toBeTruthy()
    screen.getByRole('button', { name: strings.list.retry }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('empty — success status with zero results', () => {
    render(
      <MemoryRouter>
        <VacancyList tenant="acme" status="success" vacancies={[]} onRetry={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(strings.list.empty)).toBeTruthy()
  })

  it('success — renders one card per vacancy', () => {
    render(
      <MemoryRouter>
        <VacancyList tenant="acme" status="success" vacancies={[vacancy]} onRetry={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(vacancy.title)).toBeTruthy()
  })
})
