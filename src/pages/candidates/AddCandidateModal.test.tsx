/**
 * AddCandidateModal — covers Danny's Optie A layout rework (2026-07-18): the right
 * panel renders as titled cards (Persoonlijk / Contact / Werk) in the drill-down
 * style, the address card is always open (Danny r2), functietitel/geslacht/
 * provincie render as searchable comboboxen, Esc closes via the focus trap, and the submit body is UNCHANGED by the layout work — including the
 * explicit location_ids chips and the omit-when-empty rule (punt 10). Network-
 * backed hooks are mocked directly (no QueryClientProvider needed); the shared
 * form fields render for real. i18next is uninitialised in tests, so t() returns
 * raw keys — assertions query those keys (same pattern as MatchPlacementModal.test).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddCandidateModal from './AddCandidateModal'

// Hoisted mutable test state: per-test settings blob + the create spy the
// component's mocked mutation hook hands back.
const { state, createCandidate } = vi.hoisted(() => ({
  state: { settings: {} as Record<string, unknown> },
  // Typed with the body param so mock.calls[0][0] is a typed body in assertions.
  createCandidate: vi.fn<(body: Record<string, unknown>) => Promise<{ id: string }>>(async () => ({ id: 'cand-new' })),
}))

// Tenant lookups/auth/users/locations are network-backed hooks — mocked directly
// so the test isolates this modal's own wiring.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ phases: [
    // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant phase lookup colour (mirrors DEFAULT_PHASES)
    { value: 'lead', label: 'Lead', color: '#94A3B8', is_default: true },
    // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant phase lookup colour (mirrors DEFAULT_PHASES)
    { value: 'candidate', label: 'Kandidaat', color: '#79B58E' },
  ] }),
}))
// Keep the REAL getJsonSetting (the component parses the required-fields config
// through it); only the settings blob itself is test-controlled.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => state.settings }
})
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter', branch_ids: ['b1'] } }) }))
vi.mock('./hooks/useCandidateMutations', () => ({ useCreateCandidate: () => ({ createCandidate, saving: false }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [{ value: 'Verzorgende IG', label: 'Verzorgende IG' }], allowFreeEntry: true }) }))
vi.mock('./hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: [{ value: 'Utrecht', label: 'Utrecht' }] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'b1', label: 'Vestiging Noord' }, { value: 'b2', label: 'Vestiging Zuid' }] }))

const noop = () => {}

beforeEach(() => {
  state.settings = {}
  createCandidate.mockClear()
})

describe('AddCandidateModal · Optie A card layout', () => {
  it('renders the titled cards (Persoonlijk / Contact / Werk) with their fields', () => {
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByText('modal.fields.cardPersonal')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardContact')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardWork')).toBeInTheDocument()
    // A representative field per card still renders (names / email / function).
    expect(screen.getByPlaceholderText('modal.fields.firstName')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('modal.fields.emailPlaceholder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.fields.functionPlaceholder' })).toBeInTheDocument()
    // Branch chips seed from /auth/me (punt 10) — the b1 chip is visible.
    expect(screen.getByText('Vestiging Noord')).toBeInTheDocument()
  })

  it('renders the address card open by default (Danny r2: geen inklap)', () => {
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByText('modal.fields.cardAddress')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('modal.fields.streetPlaceholder')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('modal.fields.cityPlaceholder')).toBeInTheDocument()
  })

  it('geslacht/provincie/functietitel are searchable comboboxen (drill-down pattern)', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    // Opening the function combobox reveals its type-to-filter input + lookup option.
    await user.click(screen.getByRole('button', { name: 'modal.fields.functionPlaceholder' }))
    expect(await screen.findByRole('button', { name: /Verzorgende IG/ })).toBeInTheDocument()
    // Province combobox lists the lookup value.
    await user.click(screen.getAllByRole('button', { name: 'common:select' })[1])
    expect(await screen.findByRole('button', { name: /Utrecht/ })).toBeInTheDocument()
  })

  it('Esc closes the modal via the focus trap', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('AddCandidateModal · submit body unchanged by the layout rework', () => {
  it('POSTs the exact same body incl. the seeded location_ids', async () => {
    // NOTE: onCreated must be passed — `onCreated?.(await createCandidate(body))`
    // short-circuits the whole call (argument included) when the prop is absent.
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('modal.fields.lastName'), 'Jansen')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(createCandidate).toHaveBeenCalledWith({
      first_name: 'Jan', middle_name: null, last_name: 'Jansen', function_title: null,
      email: null, phone: null, mobile: null, date_of_birth: null, gender: null,
      street: null, house_number: null, house_number_suffix: null, postal_code: null,
      city: null, province: null, country: null, owner_id: 'u1',
      phase: 'lead', status: 'available', candidate_types: [],
      location_ids: ['b1'],
    })
  })

  it('omits location_ids entirely when the branch chips are cleared (punt 10 omit-rule)', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    // Remove the single seeded chip, then submit with only the required names.
    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('modal.fields.lastName'), 'Jansen')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(createCandidate).toHaveBeenCalledTimes(1)
    expect(createCandidate.mock.calls[0][0]).not.toHaveProperty('location_ids')
  })
})

// Job B (P1 follow-up, 2026-07-20): Mobiel sits paired next to Telefoon in the
// Contact card and rides along in the create body as its own `mobile` key.
describe('AddCandidateModal · Mobiel field (job B)', () => {
  it('renders a Mobiel field next to Telefoon in the Contact card', () => {
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByPlaceholderText('modal.fields.phonePlaceholder')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('modal.fields.mobilePlaceholder')).toBeInTheDocument()
  })

  it('POSTs the mobile value under its own `mobile` body key', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('modal.fields.lastName'), 'Jansen')
    await user.type(screen.getByPlaceholderText('modal.fields.mobilePlaceholder'), '0612345678')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(createCandidate.mock.calls[0][0]).toMatchObject({ mobile: '0612345678' })
  })
})
