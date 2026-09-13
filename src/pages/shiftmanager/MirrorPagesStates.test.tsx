/**
 * Shiftmanager mirror pages — the four UI states (§3, JOINT-DEEP-AUDIT-1 D8): a failed
 * /sm_* fetch is never an empty table that looks like success. Each page shows the
 * shared ErrorBanner and its retry really refetches; while loading, the table is told so.
 */
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import api from '@/lib/api'
import ContactsPage from './ContactsPage'
import DepartmentsPage from './DepartmentsPage'
import LocationsPage from './LocationsPage'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } | unknown[] }) => {
    const rows = Array.isArray(r?.data) ? r.data : (r?.data as { data?: unknown[] })?.data ?? []
    return { rows, total: rows.length, lastPage: 1 }
  },
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))

// Resolve the active locale's own copy so the assertion never hardcodes a language.
const sm = (key: string) => i18n.t(key, { ns: 'shiftmanager' })
const mockedGet = vi.mocked(api.get)

// A fresh client per render: no retries, so a rejected fetch surfaces as isError at once.
const renderPage = (Page: () => ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><Page /></QueryClientProvider>)
}

beforeEach(() => mockedGet.mockReset())

describe.each([
  ['ContactsPage', ContactsPage, '/sm_contacts'],
  ['DepartmentsPage', DepartmentsPage, '/sm_departments'],
  ['LocationsPage', LocationsPage, '/sm_locations'],
])('shiftmanager %s · error state', (_name, Page, route) => {
  it('shows the shared error banner when the mirror fetch fails and retries on click', async () => {
    mockedGet.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ data: { data: [] } })
    const user = userEvent.setup()
    renderPage(Page)

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent(sm('mirror.loadError'))
    expect(mockedGet).toHaveBeenCalledWith(route, expect.anything())

    await user.click(screen.getByRole('button', { name: sm('mirror.retry') }))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
