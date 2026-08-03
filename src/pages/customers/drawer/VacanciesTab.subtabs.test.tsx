/**
 * VacanciesTab · Sollicitaties sub-tab wiring (Danny, asked three times: "Tabblad
 * Vacatures moet 2 subtabbladen hebben: Vacatures en Sollicitaties"). Proves only
 * the SubTabBar + lazy-mount wiring here — CustomerApplicationsList's own
 * rendering (columns/filter/search/click-through) is covered in its own test
 * file; this mirrors MatchesTab.test.tsx stubbing MatchModal so a wiring test
 * never re-proves another component's internals.
 *
 * A SEPARATE file from VacanciesTab.test.tsx on purpose (§13 "revert-proof the
 * new ones") — that file's own tenant-default-status-filter coverage for the
 * Vacatures sub-tab is untouched by this addition.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import VacanciesTab from './VacanciesTab'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'

// See VacanciesTab.test.tsx's own comment on this same line: a bare replacement
// drops the real `QueryClient` class that `lib/queryClient.ts` instantiates at
// module scope (reached transitively via AuthContext) — `importOriginal` keeps
// everything real except the one hook this file needs stubbed.
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})
// Only the Vacatures sub-tab's own data hook is needed here — CustomerApplicationsList
// is stubbed below, so its useCustomerApplications import never runs in this file.
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useCustomerVacancies: () => ({ rows: [] as VacancyRow[], loading: false }),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [], total: 0 }),
}))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}), useSettingsLoaded: () => true, getStringSetting: () => null,
}))

// Stubbed so this file only proves the SubTabBar + lazy-mount wiring, not the
// list's own rendering — mirrors MatchesTab.test.tsx's own MatchModal stub.
const listProps = vi.fn()
vi.mock('./CustomerApplicationsList', () => ({
  default: (props: Record<string, unknown>) => { listProps(props); return <div data-testid="applications-list" /> },
}))

afterEach(() => cleanup())

describe('VacanciesTab · Sollicitaties sub-tab', () => {
  it('renders both sub-tab labels, Vacatures active by default', async () => {
    render(<VacanciesTab customerId="cust-1" customerName="Acme" />)
    // Async query settles the Vacatures sub-tab's own /vacancy-statuses effect
    // before asserting, so it runs inside act() like the rest of this render.
    expect(await screen.findByRole('tab', { name: 'Vacatures' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Sollicitaties' })).toBeInTheDocument()
    expect(screen.queryByTestId('applications-list')).toBeNull()
  })

  it('does not mount the applications list before the sub-tab is opened (lazy)', async () => {
    render(<VacanciesTab customerId="cust-1" customerName="Acme" />)
    await screen.findByRole('tab', { name: 'Vacatures' })
    expect(listProps).not.toHaveBeenCalled()
  })

  it('mounts the applications list, passed this customer id, once opened', async () => {
    const user = userEvent.setup()
    render(<VacanciesTab customerId="cust-1" customerName="Acme" />)
    await user.click(screen.getByRole('tab', { name: 'Sollicitaties' }))
    expect(screen.getByTestId('applications-list')).toBeInTheDocument()
    expect(listProps).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-1' }))
  })
})
