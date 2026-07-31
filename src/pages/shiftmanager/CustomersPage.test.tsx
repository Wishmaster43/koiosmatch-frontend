/**
 * CustomersPage — regression test for the gated "+Add" control (audit fix,
 * WORKLIST LOOKUP-GAP-1). /sm_customers has no create route (GET/{id} + /sync
 * only, api-generated.ts) — this page mirrors ShiftManager, so a customer must
 * exist there first. The trigger must render disabled with an honest reason and
 * must never open AddCustomerModal (which only ever inserted a local-only row
 * that vanished on refetch — a false success, §3).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import i18n from '@/i18n'
import CustomersPage from './CustomersPage'

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

// One SM customer so the table has a row to render past the loading state.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [
    { id: 'cust-1', name: 'Zorggroep Noord', debtor_number: '10042', status: 'actief', city: 'Zwolle' },
  ], meta: { total: 1, last_page: 1 } } })) },
  unwrapList: (r: { data?: { data?: unknown[]; meta?: { total?: number; last_page?: number } } }) => ({
    rows: r?.data?.data ?? [], total: r?.data?.meta?.total ?? 0, lastPage: r?.data?.meta?.last_page ?? 1,
  }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))

describe('shiftmanager/CustomersPage · geen aanmaakknop (spiegelpagina)', () => {
  // Danny 31-07: the trigger is gone. This page mirrors ShiftManager — /sm_customers has
  // GET and /sync only — so a customer is created THERE or on the native Koios customers
  // page. The button was inert, and before that it inserted a local row that vanished on
  // the next refetch: a user could believe they had created a customer that never existed.
  // This test keeps it from coming back without a real create route behind it.
  it('toont geen aanmaakknop', async () => {
    render(<CustomersPage />)
    await screen.findByText('Zorggroep Noord')
    expect(screen.queryByRole('button', { name: `+ ${ct('page.add')}` })).not.toBeInTheDocument()
  })
})
