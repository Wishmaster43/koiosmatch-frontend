/**
 * OverviewTab · Contact card (Danny 28-07: "Ik wil de klant meer hebben zoals de
 * kandidaat. Elke hoofdklant moet een adres en contactgegevens hebben.") — the
 * customer's own e-mail/phone now render in their own titled card right after
 * Algemeen, mirroring the candidate ProfileTab's Contact grouping (§3A). Assert
 * the onSave PATCH payload (§13), not just that a callback fired.
 *
 * EditableFieldTable pulls in `@/lib/datetime`, which side-effect-imports the
 * real i18n instance — so (like AddCustomerModal.test.tsx) this file resolves
 * assertions through the ACTIVE locale's own copy instead of guessing/hardcoding
 * a language.
 *
 * BRANCH-LINKS-1: the shared BranchSection block (useEntityBranches) now GETs
 * /customers/{id}/branches on mount, so `@/lib/api` is mocked below (real
 * `unwrapList` kept via importActual) — every existing render in this file would
 * otherwise fire a real, unmocked network request.
 *
 * VESTIGING-2: `@/lib/settings/useAllSettings` is mocked so `branch_authz_enabled`
 * is controllable per test (real `getBoolSetting` kept via importActual, so the
 * "true"/true coercion the production code relies on is exercised for real) —
 * the widen-on-last-removal confirm only fires while that tenant flag is on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import OverviewTab from './OverviewTab'
import { useCustomerAdvice } from '@/lib/useCustomerAdvice'
import type { Customer } from '@/types/customer'

vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'] }) }))
// useLocations is react-query-backed — mocked directly so this test doesn't need
// a QueryClientProvider ancestor (mirrors AddCustomerModal.test.tsx).
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }],
}))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
      post: vi.fn(() => Promise.resolve({})),
      delete: vi.fn(() => Promise.resolve({})),
    },
  }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// Mutable per-test settings blob — default {} so branch_authz_enabled falls back
// to false (matches the real tenant default) unless a test opts in.
let mockSettings: Record<string, unknown> = {}
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings }
})
import api from '@/lib/api'

const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>
const apiDelete = api.delete as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { vi.clearAllMocks(); mockSettings = {} })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

// Minimal Customer fixture — only the fields OverviewTab/customerAiInsights read.
const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1, name: 'Test customer', initials: 'TC', debtorNumber: '', status: 'prospect',
  statusLabel: 'Prospect', statusColor: 'slate', owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
  city: 'Utrecht', email: 'info@rivas.nl', phone: '030-1234567',
  lat: null, lng: null, distanceKm: null, industry: 'Zorg', website: '', employeeCount: '',
  toneOfVoice: '', description: '', recruitmentProblems: '', privacyPolicyUrl: '',
  hideCompanyName: false, hasCareerPage: false, showInVacancies: false, excludeFromSourcing: false,
  costCenter: '', billingEmail: '', tags: [], archived: false, locations: [], departments: [], contacts: [],
  notes: [], locationsCount: 0, departmentsCount: 0, contactsCount: 0, openVacanciesCount: 0,
  activeMatchesCount: 0, created: '', logo: null, koiosAdvice: null, customFields: {},
  ...overrides,
} as Customer)

describe('OverviewTab · Contact card', () => {
  it('renders the customer\'s own e-mail and phone in a Contact card, after Gegevens and Adres', async () => {
    const { container } = render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    expect(screen.getByText(ct('overview.contact'))).toBeInTheDocument()
    expect(screen.getByText('info@rivas.nl')).toBeInTheDocument()
    expect(screen.getByText('030-1234567')).toBeInTheDocument()
    // Card order after the 28-07 restructure: Gegevens · Adres · Contact · Vestiging.
    const html = container.innerHTML
    expect(html.indexOf(ct('overview.details'))).toBeLessThan(html.indexOf(ct('overview.address')))
    expect(html.indexOf(ct('overview.address'))).toBeLessThan(html.indexOf(ct('overview.contact')))
    expect(html.indexOf(ct('overview.contact'))).toBeLessThan(html.indexOf(ct('overview.branch')))
    // Let the branch-links GET (mounted by the new BranchSection block) settle before
    // the test ends, so its state update never lands outside act() in a later test.
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })

  it('shows the empty-state dash when no email/phone is filled in yet', async () => {
    render(<OverviewTab c={customer({ email: '', phone: '' })} onSave={vi.fn()} />)
    // At least the two Contact rows render the empty placeholder (other empty
    // fields elsewhere on the tab may add more dashes — this only asserts the floor).
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })

  it('editing PATCHes the mapped email/phone values alongside the rest of the form', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<OverviewTab c={customer()} onSave={onSave} />)

    // Each block now has its OWN pencil (Danny 28-07). Open the Contact block by its
    // position in the block order: Gegevens · Adres · Contact · Vestiging, then the two
    // rich-text pencils below.
    await user.click(screen.getAllByTitle(cm('edit'))[2])
    const emailInput = screen.getByDisplayValue('info@rivas.nl')
    await user.clear(emailInput)
    await user.type(emailInput, 'nieuw@rivas.nl')
    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ email: 'nieuw@rivas.nl', phone: '030-1234567' }))
  })
})

describe('OverviewTab · Vestiging koppelen (BRANCH-LINKS-1, shared BranchSection)', () => {
  it('GETs the linked branches on mount and shows the empty state when none are linked', async () => {
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/customers/1/branches'))
    expect(screen.getByText(ct('overview.branchesEmpty'))).toBeInTheDocument()
  })

  it('renders a linked branch as a chip from the GET response', async () => {
    apiGet.mockResolvedValueOnce({ data: { data: [{ id: 'loc-1', name: 'Vestiging Noord' }] } })
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    expect(await screen.findByText('Vestiging Noord')).toBeInTheDocument()
    expect(screen.queryByText(ct('overview.branchesEmpty'))).toBeNull()
  })

  it('picking an option POSTs /customers/{id}/branches with { location_id }', async () => {
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await user.click(screen.getByText(ct('overview.branchesLink')))
    // The picker stays open after a pick (no closeOnToggle), so the option label and
    // the newly-added chip both render "Vestiging Noord" — scope the click to the option.
    await user.click(screen.getAllByText('Vestiging Noord')[0])
    expect(apiPost).toHaveBeenCalledWith('/customers/1/branches', { location_id: 'loc-1' })
    await waitFor(() => expect(screen.getAllByText('Vestiging Noord').length).toBeGreaterThanOrEqual(2))
  })

  it('removing a chip DELETEs /customers/{id}/branches/{branch}', async () => {
    apiGet.mockResolvedValueOnce({ data: { data: [{ id: 'loc-1', name: 'Vestiging Noord' }] } })
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await screen.findByText('Vestiging Noord')
    await user.click(screen.getByRole('button', { name: cm('remove') }))
    expect(apiDelete).toHaveBeenCalledWith('/customers/1/branches/loc-1')
  })

  it('reverts the optimistic chip when the link POST fails', async () => {
    apiPost.mockRejectedValueOnce({ response: { data: { message: 'failed' } } })
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await user.click(screen.getByText(ct('overview.branchesLink')))
    // The picker stays open after a pick — scope the click to the option, not the chip.
    await user.click(screen.getAllByText('Vestiging Noord')[0])
    // The optimistic chip reverts once the rejected POST settles, leaving only the
    // still-open picker's own option label — the empty state returns underneath it.
    await waitFor(() => expect(screen.getByText(ct('overview.branchesEmpty'))).toBeInTheDocument())
  })
})

describe('OverviewTab · removing the LAST branch widens visibility (VESTIGING-2)', () => {
  it('while branch_authz_enabled is OFF (default), removing the last chip DELETEs immediately — no dialog', async () => {
    apiGet.mockResolvedValueOnce({ data: { data: [{ id: 'loc-1', name: 'Vestiging Noord' }] } })
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await screen.findByText('Vestiging Noord')
    await user.click(screen.getByRole('button', { name: cm('remove') }))
    expect(apiDelete).toHaveBeenCalledWith('/customers/1/branches/loc-1')
    expect(screen.queryByText(cm('branchSection.widenTitle'))).toBeNull()
  })

  it('while branch_authz_enabled is ON, removing the ONLY chip opens the confirm dialog and does NOT delete yet', async () => {
    mockSettings = { branch_authz_enabled: 'true' }
    apiGet.mockResolvedValueOnce({ data: { data: [{ id: 'loc-1', name: 'Vestiging Noord' }] } })
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await screen.findByText('Vestiging Noord')
    await user.click(screen.getByRole('button', { name: cm('remove') }))
    expect(await screen.findByText(cm('branchSection.widenTitle'))).toBeInTheDocument()
    expect(apiDelete).not.toHaveBeenCalled()
  })

  it('confirming the dialog then DELETEs the branch', async () => {
    mockSettings = { branch_authz_enabled: 'true' }
    apiGet.mockResolvedValueOnce({ data: { data: [{ id: 'loc-1', name: 'Vestiging Noord' }] } })
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await screen.findByText('Vestiging Noord')
    await user.click(screen.getByRole('button', { name: cm('remove') }))
    await screen.findByText(cm('branchSection.widenTitle'))
    await user.click(screen.getByText(cm('confirm')))
    expect(apiDelete).toHaveBeenCalledWith('/customers/1/branches/loc-1')
  })

  it('cancelling the dialog leaves the branch linked — no DELETE fires', async () => {
    mockSettings = { branch_authz_enabled: 'true' }
    apiGet.mockResolvedValueOnce({ data: { data: [{ id: 'loc-1', name: 'Vestiging Noord' }] } })
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await screen.findByText('Vestiging Noord')
    await user.click(screen.getByRole('button', { name: cm('remove') }))
    await screen.findByText(cm('branchSection.widenTitle'))
    await user.click(screen.getByText(cm('cancel')))
    expect(apiDelete).not.toHaveBeenCalled()
    expect(screen.getByText('Vestiging Noord')).toBeInTheDocument()
  })

  it('while branch_authz_enabled is ON but a SECOND branch remains, removing one chip DELETEs immediately — no dialog', async () => {
    mockSettings = { branch_authz_enabled: 'true' }
    apiGet.mockResolvedValueOnce({ data: { data: [{ id: 'loc-1', name: 'Vestiging Noord' }, { id: 'loc-2', name: 'Vestiging Zuid' }] } })
    const user = userEvent.setup()
    render(<OverviewTab c={customer()} onSave={vi.fn()} />)
    await screen.findByText('Vestiging Noord')
    await user.click(screen.getAllByRole('button', { name: cm('remove') })[0])
    expect(apiDelete).toHaveBeenCalledWith('/customers/1/branches/loc-1')
    expect(screen.queryByText(cm('branchSection.widenTitle'))).toBeNull()
  })
})

// KOIOS-ADVIES-OVERAL-1: the drawer's advice block shows EXACTLY the advice the
// customers table's Koios column derives — asserted through the SAME resolver
// (useCustomerAdvice), never a copied literal.
describe('OverviewTab · table-identical Koios advice (KOIOS-ADVIES-OVERAL-1)', () => {
  // Resolve the advice through the shared hook, exactly as CustomersTable does.
  const resolveVia = (c: Customer) => renderHook(() => useCustomerAdvice()).result.current(c)

  it('shows the same label the table pill derives for a customer without open vacancies', async () => {
    const quiet = customer() // openVacanciesCount: 0 → the follow-up rule fires
    const expected = resolveVia(quiet)?.label
    expect(expected).toBeTruthy()
    render(<OverviewTab c={quiet} onSave={vi.fn()} />)
    expect(screen.getByText(expected as string)).toBeInTheDocument()
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })

  it('renders no advice row on a clean customer (open vacancies present) — heuristics only', async () => {
    const active = customer({ openVacanciesCount: 2 })
    expect(resolveVia(active)).toBeNull()
    const adviceLabel = resolveVia(customer())?.label
    render(<OverviewTab c={active} onSave={vi.fn()} />)
    expect(screen.queryByText(adviceLabel as string)).not.toBeInTheDocument()
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })
})
