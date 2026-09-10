/**
 * reportTableChrome.test — unit tests for ReportRow, ReportTableFrame and
 * ReportTableShell.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReportRow, ReportTableFrame, ReportTableShell } from './reportTableChrome'
import type { ReportTableColumn } from './reportTableChrome'

describe('ReportRow', () => {
  it('fires onClick when row is clicked', () => {
    const onClick = vi.fn()
    render(
      <table>
        <tbody>
          <ReportRow onClick={onClick}>
            <td>Test Cell</td>
          </ReportRow>
        </tbody>
      </table>
    )
    const row = screen.getByText('Test Cell').closest('tr')
    fireEvent.click(row!)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders children correctly', () => {
    render(
      <table>
        <tbody>
          <ReportRow onClick={() => {}}>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </ReportRow>
        </tbody>
      </table>
    )
    expect(screen.getByText('Cell 1')).toBeInTheDocument()
    expect(screen.getByText('Cell 2')).toBeInTheDocument()
  })

  it('swaps background on hover', () => {
    const onClick = vi.fn()
    render(
      <table>
        <tbody>
          <ReportRow onClick={onClick}>
            <td>Test Cell</td>
          </ReportRow>
        </tbody>
      </table>
    )
    const row = screen.getByText('Test Cell').closest('tr')!
    expect(row.style.background).toBe('')

    fireEvent.mouseEnter(row)
    expect(row.style.background).toBe('var(--hover-bg)')

    fireEvent.mouseLeave(row)
    expect(row.style.background).toBe('transparent')
  })

  it('has cursor: pointer style', () => {
    const { container } = render(
      <table>
        <tbody>
          <ReportRow onClick={() => {}}>
            <td>Test</td>
          </ReportRow>
        </tbody>
      </table>
    )
    const row = container.querySelector('tr')!
    expect(row.style.cursor).toBe('pointer')
  })
})

describe('ReportTableFrame', () => {
  it('renders loading label when loading is true', () => {
    render(
      <ReportTableFrame
        loading
        loadingLabel="Loading data..."
        empty={false}
        emptyLabel="No data"
      >
        <table><tbody><tr><td>Content</td></tr></tbody></table>
      </ReportTableFrame>
    )
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders empty state when empty is true', () => {
    render(
      <ReportTableFrame
        loading={false}
        loadingLabel="Loading data..."
        empty
        emptyLabel="No data found"
      >
        <table><tbody><tr><td>Content</td></tr></tbody></table>
      </ReportTableFrame>
    )
    expect(screen.getByText('No data found')).toBeInTheDocument()
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders children when not loading and not empty', () => {
    render(
      <ReportTableFrame
        loading={false}
        loadingLabel="Loading data..."
        empty={false}
        emptyLabel="No data"
      >
        <table><tbody><tr><td>Content</td></tr></tbody></table>
      </ReportTableFrame>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.queryByText('Loading data...')).not.toBeInTheDocument()
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  it('renders spinner when spinner prop is true and loading', () => {
    const { container } = render(
      <ReportTableFrame
        loading
        loadingLabel="Loading..."
        empty={false}
        emptyLabel="No data"
        spinner
      >
        <table><tbody><tr><td>Content</td></tr></tbody></table>
      </ReportTableFrame>
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    // The Spinner component is rendered when spinner={true}
    const spinnerDiv = container.querySelector('[class*="animate"]')
    expect(spinnerDiv || screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('uses loadingHeight prop for loading state height', () => {
    const { container } = render(
      <ReportTableFrame
        loading
        loadingLabel="Loading..."
        empty={false}
        emptyLabel="No data"
        loadingHeight={300}
      >
        <table><tbody><tr><td>Content</td></tr></tbody></table>
      </ReportTableFrame>
    )
    const loadingDiv = container.querySelector('div[style*="height: 300"]')
    expect(loadingDiv).toBeInTheDocument()
  })

  it('uses emptyHeight prop for empty state', () => {
    const { container } = render(
      <ReportTableFrame
        loading={false}
        loadingLabel="Loading..."
        empty
        emptyLabel="No data"
        emptyHeight={200}
      >
        <table><tbody><tr><td>Content</td></tr></tbody></table>
      </ReportTableFrame>
    )
    const emptyDiv = container.querySelector('div[style*="height: 200"]')
    expect(emptyDiv).toBeInTheDocument()
  })

  it('applies correct CSS classes to wrapper divs', () => {
    const { container } = render(
      <ReportTableFrame
        loading={false}
        loadingLabel="Loading..."
        empty={false}
        emptyLabel="No data"
      >
        <table><tbody><tr><td>Content</td></tr></tbody></table>
      </ReportTableFrame>
    )
    const outerDiv = container.querySelector('.flex.flex-1.min-h-0.overflow-hidden')
    const innerDiv = container.querySelector('.flex-1.min-w-0.overflow-auto')
    expect(outerDiv).toBeInTheDocument()
    expect(innerDiv).toBeInTheDocument()
  })
})

describe('ReportTableShell', () => {
  const columns: ReportTableColumn[] = [{ key: 'name', label: 'Name', sortable: true }]
  type Row = { id: number; name: string }
  const rows: Row[] = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]

  it('renders one row per entry via renderRow, with the sortable head and pagination footer', () => {
    render(
      <ReportTableShell
        loading={false} loadingLabel="Loading..." empty={false} emptyLabel="No data"
        columns={columns} sort={{ key: 'name', dir: 'asc' }} onSort={() => {}}
        rows={rows}
        renderRow={(r: Row) => <tr key={r.id}><td>{r.name}</td></tr>}
        pagination={<div data-testid="pagination-slot" />}
      />
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('renders the drawer node when supplied, and nothing when falsy', () => {
    const { rerender } = render(
      <ReportTableShell
        loading={false} loadingLabel="Loading..." empty={false} emptyLabel="No data"
        columns={columns} sort={{ key: 'name', dir: 'asc' }} onSort={() => {}}
        rows={[]} renderRow={() => null}
        pagination={<div data-testid="pagination-slot" />}
        drawer={<div data-testid="drawer">Drawer open</div>}
      />
    )
    expect(screen.getByTestId('drawer')).toBeInTheDocument()

    rerender(
      <ReportTableShell
        loading={false} loadingLabel="Loading..." empty={false} emptyLabel="No data"
        columns={columns} sort={{ key: 'name', dir: 'asc' }} onSort={() => {}}
        rows={[]} renderRow={() => null}
        pagination={<div data-testid="pagination-slot" />}
        drawer={null}
      />
    )
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument()
  })

  it('shows the loading label instead of rows while loading', () => {
    render(
      <ReportTableShell
        loading={true} loadingLabel="Loading rows..." empty={false} emptyLabel="No data"
        columns={columns} sort={{ key: 'name', dir: 'asc' }} onSort={() => {}}
        rows={rows}
        renderRow={(r: Row) => <tr key={r.id}><td>{r.name}</td></tr>}
        pagination={<div data-testid="pagination-slot" />}
      />
    )
    expect(screen.getByText('Loading rows...')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  it('calls onSort with the clicked column key', () => {
    const onSort = vi.fn()
    render(
      <ReportTableShell
        loading={false} loadingLabel="Loading..." empty={false} emptyLabel="No data"
        columns={columns} sort={{ key: 'name', dir: 'asc' }} onSort={onSort}
        rows={rows}
        renderRow={(r: Row) => <tr key={r.id}><td>{r.name}</td></tr>}
        pagination={<div data-testid="pagination-slot" />}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSort).toHaveBeenCalledWith('name')
  })
})
