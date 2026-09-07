/**
 * ReportStateFlow — render loading/error/empty states.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ReportStateFlow } from './ReportStateFlow'

describe('ReportStateFlow', () => {
  it('renders nothing when all states are false', () => {
    const { container } = render(
      <ReportStateFlow
        loading={false}
        error={false}
        empty={false}
        loadingLabel="Loading..."
        errorLabel="Error"
        emptyLabel="Empty"
        onRetry={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders card when loading', () => {
    const { container } = render(
      <ReportStateFlow
        loading={true}
        error={false}
        empty={false}
        loadingLabel="Loading..."
        errorLabel="Error"
        emptyLabel="Empty"
        onRetry={vi.fn()}
      />
    )

    expect(container.querySelector('div')).toBeInTheDocument()
  })
})
