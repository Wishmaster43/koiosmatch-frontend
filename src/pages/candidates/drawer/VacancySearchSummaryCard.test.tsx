/**
 * VacancySearchSummaryCard — GETALLEN-1 regression: the distance chip must
 * format through the ACTIVE-locale `useNumberFormat().formatDistanceKm`, not
 * the pure `lib/formatters` export pinned to nl-NL (fix, §5 GETALLEN-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import VacancySearchSummaryCard from './VacancySearchSummaryCard'
import type { VacancySearchRow } from '../hooks/useVacancySearch'

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn() }) }))

// Stub useNumberFormat so the test can assert the distance goes through the
// HOOK (locale-aware) rather than the pure nl-NL-default formatter.
const formatDistanceKm = vi.fn((v: number) => `${v} en-GB-km`)
vi.mock('@/lib/formatters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/formatters')>()
  return {
    ...actual,
    useNumberFormat: () => ({ formatCurrency: (v: number) => `£${v}`, formatDistanceKm }),
  }
})

const row: VacancySearchRow = {
  id: 'v1', title: 'Verpleegkundige', customer: 'Klant BV', city: 'Amsterdam',
  distanceKm: 12.5, status: 'open', employmentType: null, hoursMin: null, hoursMax: null,
} as VacancySearchRow

describe('VacancySearchSummaryCard · distance formatting (GETALLEN-1)', () => {
  it('renders the distance through the active-locale useNumberFormat hook', () => {
    render(
      <VacancySearchSummaryCard
        selectedRow={row} selectedIndex={0} total={1}
        goPrev={undefined} goNext={undefined}
        onClose={vi.fn()} onApply={vi.fn()}
        description={null} detail={null}
        statusMeta={() => ({ value: 'open', label: 'Open', color: 'var(--color-success-text)' })}
      />
    )
    // The hook was called with the row's distance, and its output is what renders.
    expect(formatDistanceKm).toHaveBeenCalledWith(12.5)
    expect(screen.getByText('12.5 en-GB-km km')).toBeInTheDocument()
  })
})
