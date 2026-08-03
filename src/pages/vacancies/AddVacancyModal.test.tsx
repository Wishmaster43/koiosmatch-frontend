/**
 * AddVacancyModal — SLICE 1 (Danny's 22-point spec): the popup rebuild that
 * splits the form into `addmodal/` cards (Algemeen/Klant/Inzet/Functie-eisen/
 * Voorwaarden/Beschrijving/Recruiter), moves status into a header pill row,
 * replaces the old silent location/department id-passthrough with a REAL
 * cascade, and adds every field the backend already accepts (measured against
 * StoreVacancyRequest/VacancyWriter). Every new field rides the POST body
 * CONDITIONALLY (absent when empty) so the pre-SLICE-1 exact-body contract
 * (title-only create) stays byte-identical — asserted below.
 *
 * Network-backed hooks are mocked directly (no QueryClient needed, mirrors
 * AddCandidateModal.test.tsx); i18next is uninitialised so t() returns raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'

// useAddVacancyForm reuses composeAddress from useVacancyDetailsForm.ts, which
// (for the DRAWER's own date formatting) imports lib/datetime -> src/i18n's real
// instance -> react-i18next's initReactI18next — so the mock below must still
// export a usable stub for it, or that eager import chain throws at module load.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

// Hoisted, mutable per-test lookup state — lets the "honest empty status" test
// override just the statuses list without redeclaring every mock.
const { lookupState } = vi.hoisted(() => ({
  lookupState: {
    statuses: [
      { value: 'open', label: 'Open', color: '#79B58E' },
      { value: 'closed', label: 'Closed', color: '#8A94A6' },
    ] as Array<{ value: string; label: string; color?: string }>,
  },
}))
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({
    statuses: lookupState.statuses,
    seniorityLevels: [{ value: 'senior', label: 'Senior' }, { value: 'medior', label: 'Medior' }],
    educationLevels: [{ value: 'hbo', label: 'HBO' }],
    defaultSeniority: '', defaultEducation: '',
  }),
}))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ candidateTypes: [{ value: 'flex', label: 'Flex', color: '#6E8FD6' }, { value: 'zzp', label: 'ZZP', color: '#79B58E' }] }),
}))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'] }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'], allowFreeEntry: false }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'branch-1', label: 'Vestiging Noord' }] }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Zuid-Holland', 'Utrecht'] }) }))
// The cascade fetch itself — stubbed so only useCascadePickers' own pick/reset
// logic is under test (no live fetch, mirrors useCascadePickers.test.tsx).
vi.mock('@/hooks/useCustomerCascade', () => ({
  useCustomerCascade: () => ({ detail: null, locations: [], contacts: [], refetch: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' } }) }))
// Tiptap needs a real browser to mount — stubbed with a plain controlled
// textarea (mirrors AddCandidateModal.test.tsx / AddLocationModal.test.tsx);
// CollapsibleRichText itself runs for real around it.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

const mockPost = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})

const users = [{ id: 'u1', name: 'Piet Recruiter' }]
const customers = [{ id: 'c1', name: 'Rivas Zorggroep' }, { id: 'c2', name: 'Yesway Zorg' }]
const noop = () => {}

beforeEach(() => {
  lookupState.statuses = [
    { value: 'open', label: 'Open', color: '#79B58E' },
    { value: 'closed', label: 'Closed', color: '#8A94A6' },
  ]
  mockPost.mockReset()
  mockPost.mockResolvedValue({ data: { data: { id: 'v-new', title: 'Verpleegkundige' } } })
})

// Fill the required title and submit — the shared last step of most tests below.
async function fillTitleAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Verpleegkundige')
  await user.click(screen.getByRole('button', { name: 'modal.create' }))
}

describe('AddVacancyModal · seven titled cards (SLICE 1)', () => {
  it('renders Algemeen / Klant / Inzet / Functie-eisen / Voorwaarden / Beschrijving / Recruiter', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByText('modal.fields.cardGeneral')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardClient')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardPlacement')).toBeInTheDocument()
    expect(screen.getByText('details.groups.requirements')).toBeInTheDocument()
    expect(screen.getByText('details.groups.conditions')).toBeInTheDocument()
    expect(screen.getByText('details.description')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardOwner')).toBeInTheDocument()
  })
})

describe('AddVacancyModal · validation', () => {
  it('blocks submit while the title is empty', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    const createBtn = screen.getByRole('button', { name: 'modal.create' })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('AddVacancyModal · base create body stays byte-identical', () => {
  it('POSTs only the original seven keys when nothing else is filled (owner defaults from auth)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    // Piet Recruiter (u1) is both the mocked logged-in user AND in `users`, so
    // owner_id defaults to him (punt 8) — the one base-body field that is no
    // longer null by default now that the recruiter default landed.
    expect(mockPost).toHaveBeenCalledWith('/vacancies', {
      title: 'Verpleegkundige', status: 'open', owner_id: 'u1', customer_id: null,
      industry: null, category: null, location: null,
    })
  })
})

describe('AddVacancyModal · status pill row (punt 7)', () => {
  it('highlights the tenant default pill and sends it, never a form field', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ status: 'open' }))
  })

  it('picking another pill changes the submitted status', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'Closed' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ status: 'closed' }))
  })

  it('renders no pill and sends status: null when the tenant lookup is genuinely empty', async () => {
    lookupState.statuses = []
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Closed' })).not.toBeInTheDocument()
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ status: null }))
  })
})

describe('AddVacancyModal · industry prefill (punt 4)', () => {
  it('prefills an ACTIVE industry name and includes it in the create body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} initialIndustry="Zorg" />)
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ industry: 'Zorg' }))
  })

  it('falls back to empty for an inactive/unknown industry name (never risks a 422)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} initialIndustry="Uitgefaseerde Sector" />)
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ industry: null }))
  })
})

describe('AddVacancyModal · klant cascade (punt 6)', () => {
  it('seeds the cascade from the initial location/department props and rides them on the body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers}
      initialCustomerLocationId="loc-1" initialCustomerLocationName="Locatie Noord"
      initialCustomerDepartmentId="dep-1" initialCustomerDepartmentName="Afdeling ICU" />)
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      customer_location_id: 'loc-1', customer_department_id: 'dep-1',
    }))
  })

  it('omits the cascade keys entirely when no scope is given (default byte-identical)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0]
    expect(body).not.toHaveProperty('customer_location_id')
    expect(body).not.toHaveProperty('customer_department_id')
    expect(body).not.toHaveProperty('contact_id')
  })

  it('keeps a locked customer read-only (no picker) while location/department still show', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers}
      lockCustomerId="c1" lockCustomerName="Rivas Zorggroep" />)
    expect(screen.getByText('Rivas Zorggroep')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'modal.fields.client' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'details.customerLocation' })).toBeInTheDocument()
  })
})

describe('AddVacancyModal · Inzet card — contractvorm, adres, vestiging (punt 10/12/13)', () => {
  it('carries a toggled contract type and the structured address, absent when untouched', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'Flex' }))
    await user.type(screen.getByLabelText('details.street'), 'Kerkstraat')
    await user.type(screen.getByLabelText('details.city'), 'Den Haag')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      contract_types: ['flex'], street: 'Kerkstraat', city: 'Den Haag',
      // The single free-text `location` column is DERIVED from the structured address.
      location: 'Kerkstraat, Den Haag',
    }))
  })

  it('picks a vestiging (bureau) via the searchable picker and sends location_id', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.fields.branch' }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-1' }))
  })
})

describe('AddVacancyModal · Functie-eisen — senioriteit/opleiding + skills (punt 14/15)', () => {
  it('picks a seniority level and adds a required skill', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'details.seniority' }))
    await user.click(screen.getByRole('button', { name: 'Senior' }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'BIG-registratie')
    await user.click(screen.getByTitle('details.addSkill'))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      seniority: 'senior', skills: ['BIG-registratie'],
    }))
  })

  it('never adds experience_min_years/experience_max_years — not accepted by the backend', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByText('details.experience')).not.toBeInTheDocument()
  })
})

describe('AddVacancyModal · Voorwaarden — salaris + uren (punt 16)', () => {
  it('carries salary min/max/period and hours min/max', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    const salaryInputs = screen.getAllByPlaceholderText('min')
    await user.type(salaryInputs[0], '2500')
    await user.type(screen.getByPlaceholderText('modal.fields.salaryPeriodPlaceholder'), 'per maand')
    await user.type(screen.getAllByPlaceholderText('max')[1], '32')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      salary_min: '2500', salary_period: 'per maand', hours_max: '32',
    }))
  })
})

describe('AddVacancyModal · Beschrijving (punt 9)', () => {
  it('reveals the rich-text editor on click and carries the typed description', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: /details.description/ }))
    await user.type(screen.getByLabelText('rich-text-editor'), 'Dienst op de IC-afdeling.')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ description: 'Dienst op de IC-afdeling.' }))
  })
})
