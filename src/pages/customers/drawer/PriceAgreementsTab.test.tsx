/**
 * PriceAgreementsTab · "+ Prijsafspraak toevoegen" trigger (Danny 27-07 → 03-08):
 * 27-07 swapped the bare text link for the shared DrawerAddButton; 03-08 moved
 * the ADD path from an inline expanding form into AddPriceAgreementModal (a real
 * popup, mirroring every other entity's "+"). This now covers: the trigger opens
 * a MODAL (role="dialog"), not the old inline panel; Save posts the exact payload
 * the hook receives (assert the REQUEST, §13); Escape and the form's own Cancel
 * both close without saving. PriceAgreementForm is a different file's scope
 * (tenant lookup hooks: useFunctions/useCao) — stood in with a marker exposing
 * onSave/onCancel, mirroring WorkTab.test.tsx's pattern; the one mock backs both
 * call sites (PriceAgreementsTab's type-only import and AddPriceAgreementModal's
 * default import), since vitest mocks by resolved module id.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PriceAgreementsTab from './PriceAgreementsTab'
import { usePriceAgreements } from '../hooks/usePriceAgreements'
import type { Customer } from '@/types/customer'

// This project ships no @types/node; process.env.TZ is a genuine Node global at
// test runtime (Vitest runs under Node) — this is a minimal local type shim for it.
declare const process: { env: Record<string, string | undefined> }

// PriceAgreementRow (rendered per row, unmocked) imports '@/lib/datetime', which
// itself imports '@/i18n' as a side effect — that would boot the REAL i18next
// instance and turn every t() call into translated Dutch instead of the raw key
// this test asserts on (mirrors DocumentsTab.test.tsx's same stand-in).
// useLocations is react-query-backed (the Facturatie block's Vestiging picker uses it),
// so it is mocked here rather than wrapping this test in a QueryClientProvider.
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }] }))
// toLocalIsoDate is re-implemented here (NOT vi.importActual — that would load the
// real '@/lib/datetime', which itself imports '@/i18n' as a side effect, exactly
// what the comment above is avoiding) so `todayIso` still computes for real.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => v }),
  toLocalIsoDate: (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },
}))
vi.mock('../hooks/usePriceAgreements', () => ({ usePriceAgreements: vi.fn() }))
// TOOLBAR-4: the toolbar tests below render a real (populated) row list, which
// mounts the real PriceAgreementRow -> useCao() -> useCachedLookup's own GET /cao.
// `unwrapList` stays the REAL implementation (importActual, mirrors MatchModal.test.tsx)
// so that parsing is untouched; only the network call itself is stubbed to an empty
// list, so useCao keeps its own DEFAULT_CAO seed fallback — no extra mock needed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})
vi.mock('./PriceAgreementForm', () => ({
  default: ({ onSave, onCancel, saveLabel }: { onSave: () => void; onCancel: () => void; saveLabel: string }) => (
    <div data-testid="price-agreement-form">
      <button onClick={onSave}>{saveLabel}</button>
      <button onClick={onCancel}>cancel-form</button>
    </div>
  ),
  emptyDraft: () => ({ functionTitle: '', cao: '', scale: '', step: '', purchaseRate: '', saleRate: '', validFrom: '', validUntil: '', remarks: '' }),
  draftToPayload: (d: unknown) => d,
  // TOOLBAR-4: the read-only row (PriceAgreementRow, unmocked below) seeds its OWN
  // edit-toggle draft from this on mount — needed once the toolbar tests render a
  // real (populated) row list, not just the empty-list tests above.
  draftFromAgreement: (a: unknown) => a,
}))

const baseHook = { agreements: [], loading: false, error: false, reload: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() }
// The exact body the hook's add() receives for a fresh (untouched) draft — the
// stubbed draftToPayload above is the identity function, so this IS the request.
const emptyPayload = { functionTitle: '', cao: '', scale: '', step: '', purchaseRate: '', saleRate: '', validFrom: '', validUntil: '', remarks: '' }

describe('PriceAgreementsTab · "+ Prijsafspraak toevoegen" opens AddPriceAgreementModal (Danny 03-08: popup, not inline)', () => {
  it('does not render the modal until the trigger is clicked', () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    render(<PriceAgreementsTab customerId="cust-1" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('price-agreement-form')).not.toBeInTheDocument()
  })

  it('opens a real MODAL (role="dialog") when the house button is clicked — not the old inline panel', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" />)
    await user.click(screen.getByRole('button', { name: 'priceAgreements.add' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('price-agreement-form')).toBeInTheDocument()
  })

  it('submits via the hook\'s add() with the exact request body (assert the REQUEST, §13), then closes the modal', async () => {
    const add = vi.fn()
    vi.mocked(usePriceAgreements).mockReturnValue({ ...baseHook, add })
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" />)
    await user.click(screen.getByRole('button', { name: 'priceAgreements.add' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'priceAgreements.add' }))
    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(emptyPayload)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape closes the modal without saving', async () => {
    const add = vi.fn()
    vi.mocked(usePriceAgreements).mockReturnValue({ ...baseHook, add })
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" />)
    await user.click(screen.getByRole('button', { name: 'priceAgreements.add' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })

  it('the form\'s own Cancel button closes the modal without saving', async () => {
    const add = vi.fn()
    vi.mocked(usePriceAgreements).mockReturnValue({ ...baseHook, add })
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" />)
    await user.click(screen.getByRole('button', { name: 'priceAgreements.add' }))
    await user.click(screen.getByRole('button', { name: 'cancel-form' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })
})

/**
 * TOOLBAR-4 (Danny, live 04-08: "ook zoek venster en status!!") — the search box
 * (function/CAO/scale) and the DERIVED active/expired filter (a price agreement
 * carries no real status field, only validFrom/validUntil — see the tab's own
 * docblock), plus the house toolbar ORDER: search, then status, then "+".
 */
describe('PriceAgreementsTab · toolbar search + derived active/expired filter (TOOLBAR-4)', () => {
  const agreementRow = (over: Partial<{
    id: string; functionTitle: string | null; cao: string | null; scale: string | null
    validUntil: string | null
  }> = {}) => ({
    id: 'pa-1', functionTitle: 'Verpleegkundige', cao: null, scale: null, step: null,
    purchaseRate: 20, saleRate: 28, validFrom: '2020-01-01', validUntil: null, remarks: null,
    ...over,
  })

  it('shows every agreement until a status is picked (nothing selected = all)', () => {
    vi.mocked(usePriceAgreements).mockReturnValue({
      ...baseHook,
      agreements: [agreementRow({ id: 'pa-1', functionTitle: 'Verpleegkundige' }), agreementRow({ id: 'pa-2', functionTitle: 'Verzorgende', validUntil: '2020-01-01' })],
    })
    render(<PriceAgreementsTab customerId="cust-1" />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Verzorgende')).toBeInTheDocument()
  })

  it('search narrows on function/CAO/scale', async () => {
    const user = userEvent.setup()
    vi.mocked(usePriceAgreements).mockReturnValue({
      ...baseHook,
      agreements: [agreementRow({ id: 'pa-1', functionTitle: 'Verpleegkundige' }), agreementRow({ id: 'pa-2', functionTitle: 'Verzorgende' })],
    })
    render(<PriceAgreementsTab customerId="cust-1" />)
    await user.type(screen.getByPlaceholderText('priceAgreements.searchPlaceholder'), 'pleeg')
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.queryByText('Verzorgende')).toBeNull()
  })

  it('the derived status filter narrows to "expired" (validUntil in the past) only', async () => {
    const user = userEvent.setup()
    vi.mocked(usePriceAgreements).mockReturnValue({
      ...baseHook,
      agreements: [
        agreementRow({ id: 'pa-1', functionTitle: 'Verpleegkundige', validUntil: null }), // active (no end date)
        agreementRow({ id: 'pa-2', functionTitle: 'Verzorgende', validUntil: '2020-01-01' }), // expired
      ],
    })
    render(<PriceAgreementsTab customerId="cust-1" />)
    // No real i18n instance in this file (see the top-of-file comment) — t() returns
    // the raw key, same as every other assertion here ('priceAgreements.add' etc.).
    await user.click(screen.getByRole('button', { name: 'filters.allStatuses' }))
    await user.click(await screen.findByRole('button', { name: 'priceAgreements.statusExpired' }))
    expect(screen.getByText('Verzorgende')).toBeInTheDocument()
    expect(screen.queryByText('Verpleegkundige')).toBeNull()
  })

  // Regression guard (Danny 09-08, UTC-date-shift fix): `todayIso` (the "active vs
  // expired" boundary) must be TODAY'S local day, never a UTC-shifted one. Wrong in
  // the old code: just after local midnight, `.toISOString().slice(0, 10)` still
  // reported YESTERDAY, so an agreement that expired yesterday kept showing "active".
  describe('the "expired" boundary uses the LOCAL calendar day, never UTC-shifted', () => {
    const originalTz = process.env.TZ
    beforeEach(() => {
      // Explicit TZ so this proves something on any machine, not just one that
      // happens to run in UTC (where old-buggy and fixed code would coincide).
      process.env.TZ = 'Europe/Amsterdam'
      // Freeze "now" just after local midnight (CET, winter) — the exact window
      // where the old UTC conversion read "today" as the day before.
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 0, 15, 0, 30, 0))
    })
    afterEach(() => {
      vi.useRealTimers()
      process.env.TZ = originalTz
    })

    it('treats an agreement that expired YESTERDAY (local) as already expired', async () => {
      const user = userEvent.setup()
      vi.mocked(usePriceAgreements).mockReturnValue({
        ...baseHook,
        agreements: [agreementRow({ id: 'pa-1', functionTitle: 'Verpleegkundige', validUntil: '2026-01-14' })],
      })
      render(<PriceAgreementsTab customerId="cust-1" />)
      await user.click(screen.getByRole('button', { name: 'filters.allStatuses' }))
      await user.click(await screen.findByRole('button', { name: 'priceAgreements.statusExpired' }))
      // Only visible under "expired" if todayIso resolved to 2026-01-15 (local), not
      // 2026-01-14 (the UTC-shifted value the old code would have produced).
      expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    })
  })

  it('renders the toolbar in house order: search, then status filter, then "+"', () => {
    vi.mocked(usePriceAgreements).mockReturnValue({ ...baseHook, agreements: [agreementRow()] })
    render(<PriceAgreementsTab customerId="cust-1" />)
    const searchInput = screen.getByPlaceholderText('priceAgreements.searchPlaceholder')
    const statusTrigger = screen.getByTitle('filters.statusFilter')
    const addButton = screen.getByRole('button', { name: 'priceAgreements.add' })
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
    expect(Boolean(searchInput.compareDocumentPosition(statusTrigger) & FOLLOWING)).toBe(true)
    expect(Boolean(statusTrigger.compareDocumentPosition(addButton) & FOLLOWING)).toBe(true)
  })
})

/**
 * FACTUURADRES-1 (Danny 2026-08-01) — the customer's OWN invoice address, in the
 * Facturatie sub-tab with billing e-mail and the billing vestiging. EMPTY MEANS "use
 * the visit address", so the empty state must SHOW that address and say it is being
 * used; the edit form must never pre-fill it (that would freeze a copy that drifts).
 * The save assertion is on the exact payload — the seam into the page's PATCH.
 */
// A customer carrying only what this tab reads; the billing keys are attached by
// useCustomerRecord's mapper, which the shared Customer type does not declare yet.
const customer = (overrides: Record<string, unknown> = {}): Customer => ({
  id: 'cust-1', name: 'Rivas', branchId: null, costCenter: 'KP-1', billingEmail: 'facturen@rivas.nl',
  street: 'Dorpsstraat', houseNumber: '12', houseNumberSuffix: 'a', postalCode: '1234 AB',
  city: 'Amsterdam', country: 'NL',
  billingPoBox: '', billingStreet: '', billingHouseNumber: '', billingHouseNumberSuffix: '',
  billingPostalCode: '', billingCity: '', billingCountry: '',
  ...overrides,
} as unknown as Customer)

// Open the Facturatie sub-tab and hand back the invoice-address block's pencil.
const openBilling = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: 'drawer.tabs.billing' }))
  const header = screen.getByText('overview.billingAddress.title').parentElement as HTMLElement
  return within(header).getByRole('button')
}

describe('PriceAgreementsTab · Facturatie sub-tab: the invoice address', () => {
  it('shows the visit address plus the line saying it is the one being used, while the block is empty', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" c={customer()} onSave={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'drawer.tabs.billing' }))

    expect(screen.getByText('overview.billingAddress.title')).toBeInTheDocument()
    expect(screen.getByText('Dorpsstraat 12-a, 1234 AB Amsterdam')).toBeInTheDocument()
    expect(screen.getByText('overview.billingAddress.usesVisitAddress')).toBeInTheDocument()
  })

  it('says so honestly when there is no visit address to fall back to either (empty state)', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" c={customer({ street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '' })} onSave={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'drawer.tabs.billing' }))
    expect(screen.getByText('overview.billingAddress.visitEmpty')).toBeInTheDocument()
  })

  it('shows the customer\'s OWN address (and drops the fallback line) as soon as one field is filled', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" c={customer({ billingPoBox: 'Postbus 1234' })} onSave={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'drawer.tabs.billing' }))

    expect(screen.getByText('Postbus 1234')).toBeInTheDocument()
    expect(screen.queryByText('overview.billingAddress.usesVisitAddress')).not.toBeInTheDocument()
    // The block resolves as a whole: the visit street is never mixed into it.
    expect(screen.queryByText('Dorpsstraat 12-a, 1234 AB Amsterdam')).not.toBeInTheDocument()
  })

  it('opens an EMPTY form — the visit address is never pre-filled into the invoice fields', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" c={customer()} onSave={vi.fn()} />)
    await user.click(await openBilling(user))
    // PO box · street · house number · suffix · postcode · city (country is a picker).
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)
    inputs.forEach(i => expect(i).toHaveValue(''))
  })

  it('saves the exact billing_* payload the page PATCHes, and closes the edit cycle', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" c={customer()} onSave={onSave} />)
    await user.click(await openBilling(user))

    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'Postbus 1234')
    await user.type(inputs[4], '1015 CJ')
    await user.type(inputs[5], 'Amsterdam')
    await user.click(screen.getByRole('button', { name: 'save' }))

    expect(onSave).toHaveBeenCalledWith({
      billingPoBox: 'Postbus 1234', billingStreet: '', billingHouseNumber: '',
      billingHouseNumberSuffix: '', billingPostalCode: '1015 CJ', billingCity: 'Amsterdam',
      billingCountry: '',
    })
    // Controlled edit mode: the tab owns the toggle, so it must close it itself.
    expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument()
  })

  it('cancel discards the draft without saving', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" c={customer()} onSave={onSave} />)
    await user.click(await openBilling(user))
    await user.type(screen.getAllByRole('textbox')[0], 'Postbus 9999')
    await user.click(screen.getByRole('button', { name: 'cancel' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('overview.billingAddress.usesVisitAddress')).toBeInTheDocument()
  })

  it('offers no province field — a Dutch invoice does not carry one', async () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" c={customer()} onSave={vi.fn()} />)
    await user.click(await openBilling(user))
    expect(screen.queryByText('locations.detail.state')).not.toBeInTheDocument()
  })
})
