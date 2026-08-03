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
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PriceAgreementsTab from './PriceAgreementsTab'
import { usePriceAgreements } from '../hooks/usePriceAgreements'
import type { Customer } from '@/types/customer'

// PriceAgreementRow (rendered per row, unmocked) imports '@/lib/datetime', which
// itself imports '@/i18n' as a side effect — that would boot the REAL i18next
// instance and turn every t() call into translated Dutch instead of the raw key
// this test asserts on (mirrors DocumentsTab.test.tsx's same stand-in).
// useLocations is react-query-backed (the Facturatie block's Vestiging picker uses it),
// so it is mocked here rather than wrapping this test in a QueryClientProvider.
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }] }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('../hooks/usePriceAgreements', () => ({ usePriceAgreements: vi.fn() }))
vi.mock('./PriceAgreementForm', () => ({
  default: ({ onSave, onCancel, saveLabel }: { onSave: () => void; onCancel: () => void; saveLabel: string }) => (
    <div data-testid="price-agreement-form">
      <button onClick={onSave}>{saveLabel}</button>
      <button onClick={onCancel}>cancel-form</button>
    </div>
  ),
  emptyDraft: () => ({ functionTitle: '', cao: '', scale: '', step: '', purchaseRate: '', saleRate: '', validFrom: '', validUntil: '', remarks: '' }),
  draftToPayload: (d: unknown) => d,
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
