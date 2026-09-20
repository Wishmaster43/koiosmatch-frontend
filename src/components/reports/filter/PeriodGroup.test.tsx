// D6 keyboard-audit regression: the granularity toggle is a real ARIA
// radiogroup, so arrow keys must move AND select, mirroring SegmentedControl.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PeriodGroup from './PeriodGroup'
import type { ReportFilterGroup } from '@/types/reports'

// `@/lib/datetime` transitively boots the real i18n singleton — mocked so
// react-i18next stays uninitialised and t() keeps returning the raw key.
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))

describe('PeriodGroup — granularity toggle', () => {
  it('exposes a radiogroup with one checked option and roving tabindex', () => {
    const group: ReportFilterGroup = { key: 'period', label: 'Period', type: 'period', value: '2024', years: [2024] }
    render(<PeriodGroup group={group} />)
    expect(screen.getByRole('radiogroup', { name: 'Period' })).toBeInTheDocument()
    const yearOption = screen.getByRole('radio', { name: 'filters.granYear' })
    expect(yearOption).toHaveAttribute('aria-checked', 'true')
    expect(yearOption).toHaveAttribute('tabIndex', '0')
    expect(screen.getByRole('radio', { name: 'filters.granMonth' })).toHaveAttribute('tabIndex', '-1')
  })

  it('ArrowRight moves from year to month and commits the change (no year selected → clears)', () => {
    const onChange = vi.fn()
    const group: ReportFilterGroup = { key: 'period', label: 'Period', type: 'period', value: '2024', years: [2024], onChange }
    render(<PeriodGroup group={group} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'filters.granYear' }), { key: 'ArrowRight' })
    // Leaving 'year' with a year selected clears the value (see setGranularity).
    expect(onChange).toHaveBeenCalledWith('')
  })
})
