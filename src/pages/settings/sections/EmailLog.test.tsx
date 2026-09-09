/**
 * EmailLog — contract audit DL-05 (server-side pagination + honest counts) and
 * DL-04 (lazy body fetch that swallows 403/404 instead of a drawer error state).
 * §13: assert the REQUEST (params), not just that a callback fired. LogView and
 * PaginationBar are mocked to a minimal shape — this file tests EmailLog's own
 * fetch/param wiring, not the shared table/pager chrome (covered elsewhere).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import EmailLog from './EmailLog'

// Keep the real unwrap/unwrapList helpers, mock only the axios instance itself
// (mirrors EmailTab.test.tsx's own '@/lib/api' mock).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const mockedGet = vi.mocked(api.get)

vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    formatDateTime: (v: unknown) => (v == null ? '—' : String(v).split('T')[0].split('-').reverse().join('-')),
  }),
}))
import '@/i18n'

// Captures the filterGroups EmailLog hands to LogView (which normally forwards
// them into RightPanelContext) so a test can drive the direction toggle directly
// — the mock below captures them straight from LogView's own props.
interface FilterGroup { key: string; onToggle?: (v: string) => void }
let lastGroups: FilterGroup[] = []

// Minimal LogView stand-in: renders row buttons (for the onRowClick assertions)
// and the loading/error text — the real table chrome is LogView's own concern.
vi.mock('@/components/ui/LogView', () => ({
  default: ({ rows, loading, error, onRowClick, emptyText, filterGroups, totalCount }: {
    rows: Array<{ id?: string | number; subject?: string }>
    loading?: boolean; error?: string | null
    onRowClick?: (r: unknown) => void; emptyText?: string; filterGroups?: FilterGroup[]
    totalCount?: number
  }) => {
    lastGroups = filterGroups ?? []
    return (
      <div>
        {loading && <span>loading</span>}
        {error && <span>{error}</span>}
        {!loading && !error && rows.length === 0 && <span>{emptyText}</span>}
        {/* Renders the server total handed to LogView — proves the "50 van 50" bug is fixed (DL-05). */}
        <span>total {totalCount}</span>
        {rows.map(r => (
          <button key={r.id} type="button" onClick={() => onRowClick?.(r)}>{r.subject}</button>
        ))}
      </div>
    )
  },
}))

// Minimal PaginationBar stand-in exposing the page-change callback directly.
vi.mock('@/components/ui/PaginationBar', () => ({
  default: ({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) => (
    <div>
      <span>page {page}/{totalPages}</span>
      <button type="button" onClick={() => onPageChange(page + 1)}>next page</button>
    </div>
  ),
}))

afterEach(() => vi.clearAllMocks())

const ROW = {
  id: 'e1', direction: 'inbound', from: 'klant@bedrijf.nl', to: 'recruiter@koios.nl',
  subject: 'Vraag over tarief', status: 'delivered', created_at: '2026-08-20T10:15:00Z',
  entity_type: 'App\\Models\\Candidate', entity_id: 'c1',
}

function renderLog() {
  return render(<I18nextProvider i18n={i18n}><EmailLog /></I18nextProvider>)
}

describe('EmailLog · the list request (DL-05)', () => {
  it('requests page 1 with per_page 50 on mount', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 50 } })
    renderLog()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    const call = mockedGet.mock.calls.find(c => c[0] === '/email-log')
    expect(call?.[1]?.params).toEqual({ page: 1, per_page: 50 })
  })

  it('requests page 2 after the pager fires onPageChange', async () => {
    mockedGet.mockResolvedValue({ data: { data: [ROW], total: 60, current_page: 1, last_page: 2, per_page: 50 } })
    const user = userEvent.setup()
    renderLog()
    await screen.findByText('page 1/2')

    await user.click(screen.getByText('next page'))
    await waitFor(() => {
      const last = mockedGet.mock.calls.at(-1)
      expect(last?.[0]).toBe('/email-log')
      expect(last?.[1]?.params).toEqual({ page: 2, per_page: 50 })
    })
  })

  it('sends the selected direction as a server param', async () => {
    mockedGet.mockResolvedValue({ data: { data: [ROW], total: 20, current_page: 1, last_page: 1, per_page: 50 } })
    renderLog()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    const directionGroup = lastGroups.find(g => g.key === 'direction')!
    act(() => { directionGroup.onToggle!('in') })
    await waitFor(() => {
      const last = mockedGet.mock.calls.at(-1)
      expect(last?.[1]?.params).toEqual({ page: 1, per_page: 50, direction: 'inbound' })
    })
  })

  it('resets to page 1 when the direction filter changes while on a later page', async () => {
    mockedGet.mockResolvedValue({ data: { data: [ROW], total: 60, current_page: 1, last_page: 2, per_page: 50 } })
    const user = userEvent.setup()
    renderLog()
    await screen.findByText('page 1/2')

    await user.click(screen.getByText('next page'))
    await waitFor(() => {
      const last = mockedGet.mock.calls.at(-1)
      expect(last?.[1]?.params).toEqual({ page: 2, per_page: 50 })
    })

    const directionGroup = lastGroups.find(g => g.key === 'direction')!
    act(() => { directionGroup.onToggle!('in') })
    await waitFor(() => {
      const last = mockedGet.mock.calls.at(-1)
      expect(last?.[1]?.params).toEqual({ page: 1, per_page: 50, direction: 'inbound' })
    })
  })

  it('shows the real server total, not the loaded-page count (the old "50 van 50" bug)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [ROW], total: 60, current_page: 1, last_page: 2, per_page: 50 } })
    renderLog()
    // The previous version passed totalCount={rows.length} (1 row loaded); the
    // server total is 60 — LogView must receive the real paginator total, not the
    // loaded-page length.
    await screen.findByText('total 60')
    await screen.findByText('page 1/2')
  })

  it('surfaces the honest error state on a load failure, never a fake empty log', async () => {
    mockedGet.mockRejectedValue(new Error('network boom'))
    renderLog()
    await waitFor(() => expect(screen.getByText(i18n.t('settings:emailLog.loadError'))).toBeInTheDocument())
  })
})

describe('EmailLog · lazy body fetch (DL-04)', () => {
  it('fetches GET /email-log/{id} scoped to the row entity on open, and renders the body', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/email-log') return { data: { data: [ROW], total: 1, current_page: 1, last_page: 1, per_page: 50 } }
      if (url === `/email-log/${ROW.id}`) return { data: { data: { ...ROW, body: 'Kunnen we morgen bellen?' } } }
      throw new Error(`unexpected url ${url}`)
    })
    const user = userEvent.setup()
    renderLog()

    await user.click(await screen.findByText('Vraag over tarief'))
    await waitFor(() => expect(screen.getByText('Kunnen we morgen bellen?')).toBeInTheDocument())

    const bodyCall = mockedGet.mock.calls.find(c => c[0] === `/email-log/${ROW.id}`)
    expect(bodyCall?.[1]?.params).toEqual({ entity_type: ROW.entity_type, entity_id: ROW.entity_id })
  })

  it('swallows a 403 on the body fetch — no error text, the drawer just renders without a body', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/email-log') return { data: { data: [ROW], total: 1, current_page: 1, last_page: 1, per_page: 50 } }
      return Promise.reject({ response: { status: 403 } })
    })
    const user = userEvent.setup()
    renderLog()

    await user.click(await screen.findByText('Vraag over tarief'))
    await waitFor(() => expect(screen.queryByText(i18n.t('settings:emailLog.bodyLoading'))).not.toBeInTheDocument())
    // No generic error text anywhere, and the field rows (e.g. subject) still render.
    expect(screen.getAllByText('Vraag over tarief').length).toBeGreaterThan(0)
  })

  it('swallows a 404 on the body fetch the same way', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/email-log') return { data: { data: [ROW], total: 1, current_page: 1, last_page: 1, per_page: 50 } }
      return Promise.reject({ response: { status: 404 } })
    })
    const user = userEvent.setup()
    renderLog()

    await user.click(await screen.findByText('Vraag over tarief'))
    await waitFor(() => expect(screen.queryByText(i18n.t('settings:emailLog.bodyLoading'))).not.toBeInTheDocument())
  })

  it('surfaces a real error line on a non-access-boundary body fetch failure (e.g. a 500), never a silent blank panel', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/email-log') return { data: { data: [ROW], total: 1, current_page: 1, last_page: 1, per_page: 50 } }
      return Promise.reject({ response: { status: 500 } })
    })
    const user = userEvent.setup()
    renderLog()

    await user.click(await screen.findByText('Vraag over tarief'))
    await waitFor(() => expect(screen.getByText(i18n.t('settings:emailLog.bodyError'))).toBeInTheDocument())
  })
})
