/**
 * ScopedListTab — the shared config-driven shell behind all four department/
 * location Vacatures/Matches sub-tabs (SCOPED-LIST-TAB-1). The underlying fetch
 * is stubbed (useScopedEntityList.test.ts already pins its request shape) so
 * this file only proves the four explicit UI states + search + row-click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScopedListTab from './ScopedListTab'
import { useScopedEntityList } from '../hooks/useScopedEntityList'

vi.mock('../hooks/useScopedEntityList', () => ({ useScopedEntityList: vi.fn() }))

interface Row { id: string; title: string }
const columns = [{ key: 'title', header: 'Title', render: (r: Row) => r.title }]
const baseProps = {
  queryKey: 'k', endpoint: '/vacancies', paramName: 'customer_department_id', id: 'dep-1',
  mapRow: (r: Record<string, unknown>) => r as unknown as Row,
  columns, searchKeys: ['title'] as (keyof Row)[],
  searchPlaceholder: 'Search…', emptyText: 'Nothing yet.', loadingText: 'Loading…', errorText: 'Could not load.',
}

describe('ScopedListTab · four UI states', () => {
  it('loading: renders the loading text, not the error/empty copy', () => {
    vi.mocked(useScopedEntityList).mockReturnValue({ rows: [], loading: true, error: false })
    render(<ScopedListTab {...baseProps} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Could not load.')).not.toBeInTheDocument()
  })

  it('error: renders the honest error message instead of the table (404 = no access, never silently empty)', () => {
    vi.mocked(useScopedEntityList).mockReturnValue({ rows: [], loading: false, error: true })
    render(<ScopedListTab {...baseProps} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.')
    expect(screen.queryByText('Nothing yet.')).not.toBeInTheDocument()
  })

  it('empty: renders the empty text once loaded with zero rows', () => {
    vi.mocked(useScopedEntityList).mockReturnValue({ rows: [], loading: false, error: false })
    render(<ScopedListTab {...baseProps} />)
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
  })

  it('success: renders one row per item, clickable through onRowClick', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    vi.mocked(useScopedEntityList).mockReturnValue({
      rows: [{ id: 'v-1', title: 'Verpleegkundige' }, { id: 'v-2', title: 'Verzorgende' }], loading: false, error: false,
    })
    render(<ScopedListTab {...baseProps} onRowClick={onRowClick} />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Verzorgende')).toBeInTheDocument()
    await user.click(screen.getByText('Verpleegkundige'))
    expect(onRowClick).toHaveBeenCalledWith({ id: 'v-1', title: 'Verpleegkundige' })
  })
})

describe('ScopedListTab · client-side search', () => {
  it('narrows the visible rows on the configured search keys', async () => {
    const user = userEvent.setup()
    vi.mocked(useScopedEntityList).mockReturnValue({
      rows: [{ id: 'v-1', title: 'Verpleegkundige' }, { id: 'v-2', title: 'Verzorgende' }], loading: false, error: false,
    })
    render(<ScopedListTab {...baseProps} />)
    await user.type(screen.getByPlaceholderText('Search…'), 'pleeg')
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.queryByText('Verzorgende')).not.toBeInTheDocument()
  })
})
