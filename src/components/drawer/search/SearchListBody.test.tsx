// Shared list body for search tabs: loading/error/empty/rows states with delegated row rendering.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchListBody } from './SearchListBody'

interface TestRow {
  id: string | number
  name: string
}

describe('SearchListBody — shared list states for search tabs', () => {
  const rows: TestRow[] = [
    { id: 'r1', name: 'Row 1' },
    { id: 'r2', name: 'Row 2' },
  ]
  const renderRow = vi.fn((row: TestRow) => <div>{row.name}</div>)
  const onRetry = vi.fn()
  const onSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    render(
      <SearchListBody
        loading
        error={false}
        rows={[]}
        onRetry={onRetry}
        emptyMessage="Empty"
        noLocationMessage="No location"
        selectedId={null}
        onSelect={onSelect}
        renderRow={renderRow}
      />,
    )

    // i18n key without setup renders as the raw key
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(renderRow).not.toHaveBeenCalled()
  })

  it('renders error state with retry button', () => {
    render(
      <SearchListBody
        loading={false}
        error
        rows={[]}
        onRetry={onRetry}
        emptyMessage="Empty"
        noLocationMessage="No location"
        selectedId={null}
        onSelect={onSelect}
        renderRow={renderRow}
      />,
    )

    // i18n key without setup renders as the raw key
    expect(screen.getByText('error.body')).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: 'error.retry' })
    expect(retryBtn).toBeInTheDocument()
    retryBtn.click()
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders empty state', () => {
    render(
      <SearchListBody
        loading={false}
        error={false}
        rows={[]}
        onRetry={onRetry}
        emptyMessage="No results"
        noLocationMessage="No location"
        selectedId={null}
        onSelect={onSelect}
        renderRow={renderRow}
      />,
    )

    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(renderRow).not.toHaveBeenCalled()
  })

  it('renders no-location empty state with optional button', () => {
    render(
      <SearchListBody
        loading={false}
        error={false}
        rows={[]}
        onRetry={onRetry}
        noLocation
        emptyMessage="No results"
        noLocationMessage="No location"
        noLocationButton={<button type="button">Geocode</button>}
        selectedId={null}
        onSelect={onSelect}
        renderRow={renderRow}
      />,
    )

    expect(screen.getByText('No location')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Geocode' })).toBeInTheDocument()
  })

  it('renders rows and filters out the selected row', () => {
    render(
      <SearchListBody
        loading={false}
        error={false}
        rows={rows}
        onRetry={onRetry}
        emptyMessage="Empty"
        noLocationMessage="No location"
        selectedId="r1"
        onSelect={onSelect}
        renderRow={renderRow}
      />,
    )

    // r1 is filtered out, so only r2 renders
    expect(renderRow).toHaveBeenCalledTimes(1)
    expect(renderRow).toHaveBeenCalledWith(rows[1], false, onSelect)
    expect(screen.getByText('Row 2')).toBeInTheDocument()
    expect(screen.queryByText('Row 1')).toBeNull()
  })

  it('renders all rows when no row is selected', () => {
    render(
      <SearchListBody
        loading={false}
        error={false}
        rows={rows}
        onRetry={onRetry}
        emptyMessage="Empty"
        noLocationMessage="No location"
        selectedId={null}
        onSelect={onSelect}
        renderRow={renderRow}
      />,
    )

    expect(renderRow).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Row 1')).toBeInTheDocument()
    expect(screen.getByText('Row 2')).toBeInTheDocument()
  })
})
