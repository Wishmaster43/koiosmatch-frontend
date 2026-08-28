/**
 * AddVacancyModal — klant-cascade + Inzet/Functie-eisen/Voorwaarden/Beschrijving
 * slice (split from AddVacancyModal.test.tsx, §3 1000-line hard-cap, Opus
 * fixAdvies): the location/department/contact cascade (V3-6), the vestiging
 * branch-prediction (VAC-VESTIGING-1), and the Inzet/Functie-eisen/Voorwaarden/
 * Beschrijving field cards. Titled-cards chrome and the byte-identical base
 * body live in .layout.test.tsx; Matchprofiel/AI-agent/Publicatie/attachments/
 * Excel live in .slice2.test.tsx.
 *
 * Network-backed hooks are mocked directly (no QueryClient needed, mirrors
 * AddCandidateModal.test.tsx); i18next is uninitialised so t() returns raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'
import { users, customers, noop, makeDefaultStatuses, fillTitleAndSubmit, openTab } from './AddVacancyModal.testFixtures'
import { dryRunImport, runImport } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

// useAddVacancyForm reuses composeAddress from useVacancyDetailsForm.ts, which
// (for the DRAWER's own date formatting) imports lib/datetime -> src/i18n's real
// instance -> react-i18next's initReactI18next — so the mock below must still
// export a usable stub for it, or that eager import chain throws at module load.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const { lookupState } = vi.hoisted(() => ({
  lookupState: {
    statuses: [] as Array<{ value: string; label: string; color?: string }>,
    channels: [] as Array<{ value: string; label: string }>,
  },
}))
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({
    statuses: lookupState.statuses,
    seniorityLevels: [{ value: 'senior', label: 'Senior' }, { value: 'medior', label: 'Medior' }],
    educationLevels: [{ value: 'hbo', label: 'HBO' }],
    defaultSeniority: '', defaultEducation: '',
    channels: lookupState.channels,
  }),
}))
vi.mock('@/context/LookupsContext', () => ({
  // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
  useLookups: () => ({ candidateTypes: [{ value: 'flex', label: 'Flex', color: '#6E8FD6' }, { value: 'zzp', label: 'ZZP', color: '#79B58E' }] }),
}))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'], industryOptions: ['Zorg', 'IT'].map(n => ({ value: n, label: n })) }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'], functionOptions: ['Verzorgende IG', 'Helpende'].map(n => ({ value: n, label: n })), allowFreeEntry: false }) }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Vestiging Noord' }, { value: 'branch-2', label: 'Vestiging Zuid' }],
}))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Zuid-Holland', 'Utrecht'] }) }))
// The cascade fetch itself — stubbed so only useCascadePickers' own pick/reset
// logic is under test (no live fetch, mirrors useCascadePickers.test.tsx).
// V3-6: keyed by customer id (default empty per id) — the narrowing describe
// block below fills `cascadeState.byCustomer` per test so a customer SWITCH can
// be proven to actually change what the location/department pickers offer; every
// OTHER test keeps the previous always-empty behaviour untouched.
const { cascadeState } = vi.hoisted(() => ({
  cascadeState: {
    byCustomer: {} as Record<string, {
      locations: Array<{ id: string; name: string; departments?: Array<{ id: string; name: string }> }>
      contacts: Array<{ id: string; name: string }>
      // VAC-VESTIGING-1: the customer's own mirrored branch — feeds the create
      // form's branch-proposal prediction (useVacancyBranchDefault).
      branch_id?: string
    }>,
  },
}))
// A STABLE `detail` object per customer id (not a fresh literal every render) —
// the real hook only replaces its `detail` state once per resolved fetch, so a
// mock that hands out a new object identity on every render would fire any
// `useEffect([detail, ...])` reader on every render too (an infinite loop this
// exact mock shape once produced, VAC-VESTIGING-1).
const detailByCustomer = new Map<string, { branch_id: string | null } | null>()
vi.mock('@/hooks/useCustomerCascade', () => ({
  useCustomerCascade: (customerId: string) => {
    const data = cascadeState.byCustomer[customerId] ?? { locations: [], contacts: [] }
    if (!detailByCustomer.has(customerId)) {
      detailByCustomer.set(customerId, customerId ? { branch_id: data.branch_id ?? null } : null)
    }
    return { detail: detailByCustomer.get(customerId) ?? null, locations: data.locations, contacts: data.contacts, refetch: vi.fn() }
  },
}))
const { authState } = vi.hoisted(() => ({
  authState: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock grants neither; the param exists only to match hasModule's real signature
    hasModule: (_k: string): boolean => false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock grants neither; the param exists only to match hasPermission's real signature
    hasPermission: (_p: string): boolean => false,
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' }, hasModule: authState.hasModule, hasPermission: authState.hasPermission }),
}))
const { matchTemplatesState } = vi.hoisted(() => ({
  matchTemplatesState: { templates: [] as Array<{ id: string; name: string; weights: Record<string, number>; linkedVacanciesCount: number }> },
}))
vi.mock('./hooks/useMatchWeightTemplates', () => ({ useMatchWeightTemplates: () => ({ templates: matchTemplatesState.templates, loading: false, error: false }) }))
const { aiAgentsState } = vi.hoisted(() => ({
  aiAgentsState: {
    options: [] as Array<{ value: string; label: string }>,
    agents: [] as Array<{ id: string; name: string; user?: { id: string; name?: string } | null }>,
  },
}))
vi.mock('./hooks/useAiAgents', () => ({ useAiAgents: () => ({ options: aiAgentsState.options, agents: aiAgentsState.agents, loading: false, error: false }) }))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getJsonSetting: (_values: unknown, _key: string, fallback: unknown) => fallback,
}))
vi.mock('./addmodal/useGenerateDescription', () => ({
  useGenerateDescription: () => ({
    open: false, openFlow: vi.fn(), closeFlow: vi.fn(), profile: null, resolving: false, resolveFailed: false,
    noProfileConfigured: false, status: 'idle', concept: '', generate: vi.fn(), discard: vi.fn(),
  }),
}))
const { attachmentsState } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default no-op mock ignores it; the param exists only to match runSequence's real signature
  attachmentsState: { hasPending: false, runSequence: (async (_id: unknown) => {}) as (id: unknown) => Promise<void> },
}))
vi.mock('./addmodal/usePostCreateAttachments', () => ({
  usePostCreateAttachments: () => ({
    files: [], addFile: vi.fn(), removeFile: vi.fn(),
    noteText: '', setNoteText: vi.fn(), noteStatus: 'idle', noteError: '',
    running: false, hasPending: attachmentsState.hasPending, runSequence: attachmentsState.runSequence,
    retryFile: vi.fn(), retryNote: vi.fn(),
  }),
}))
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

beforeEach(() => {
  detailByCustomer.clear()
  lookupState.statuses = makeDefaultStatuses()
  lookupState.channels = []
  authState.hasModule = () => false
  authState.hasPermission = () => false
  aiAgentsState.options = []
  aiAgentsState.agents = []
  matchTemplatesState.templates = []
  attachmentsState.hasPending = false
  attachmentsState.runSequence = async () => {}
  cascadeState.byCustomer = {}
  mockPost.mockReset()
  mockPost.mockResolvedValue({ data: { data: { id: 'v-new', title: 'Verpleegkundige' } } })
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
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

describe('AddVacancyModal · cascade narrowing (V3-6, VACATURES-100)', () => {
  // Two customers, each with its OWN sites (nested afdelingen) and contacts —
  // proves a customer SWITCH actually narrows what the deeper pickers offer,
  // never just the same (possibly empty) list reused across ids.
  beforeEach(() => {
    cascadeState.byCustomer = {
      c1: {
        locations: [
          { id: 'loc-1', name: 'Rivas Noord', departments: [{ id: 'dep-1', name: 'ICU' }] },
          { id: 'loc-2', name: 'Rivas Zuid', departments: [{ id: 'dep-2', name: 'Kraamzorg' }] },
        ],
        contacts: [{ id: 'con-1', name: 'Jan Jansen' }],
      },
      c2: {
        locations: [{ id: 'loc-3', name: 'Yesway Centrum' }],
        contacts: [{ id: 'con-2', name: 'Eva Bos' }],
      },
    }
  })

  // Pick a customer via the unlocked Klant picker (open -> click the option).
  async function pickCustomer(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole('button', { name: 'modal.fields.client' }))
    await user.click(screen.getByRole('button', { name: label }))
  }

  it('narrows the location picker to the picked customer\'s own sites', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    expect(screen.getByRole('button', { name: 'Rivas Noord' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rivas Zuid' })).toBeInTheDocument()
    // Yesway's own site must never leak into Rivas's cascade.
    expect(screen.queryByRole('button', { name: 'Yesway Centrum' })).not.toBeInTheDocument()
  })

  it('narrows the department picker to the picked location\'s own afdelingen', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    await user.click(screen.getByRole('button', { name: 'Rivas Noord' }))
    await user.click(screen.getByRole('button', { name: 'details.customerDepartment' }))
    expect(screen.getByRole('button', { name: 'ICU' })).toBeInTheDocument()
    // Rivas Zuid's own afdeling must not show once Rivas Noord narrowed the list.
    expect(screen.queryByRole('button', { name: 'Kraamzorg' })).not.toBeInTheDocument()
  })

  it('rides the interactively-picked location/department/contact ids on the create body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    await user.click(screen.getByRole('button', { name: 'Rivas Noord' }))
    await user.click(screen.getByRole('button', { name: 'details.customerDepartment' }))
    await user.click(screen.getByRole('button', { name: 'ICU' }))
    await user.click(screen.getByRole('button', { name: 'details.contactPerson' }))
    await user.click(screen.getByRole('button', { name: 'Jan Jansen' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      customer_id: 'c1', customer_location_id: 'loc-1', customer_department_id: 'dep-1', contact_id: 'con-1',
    }))
  })

  it('changing the customer clears the previously picked location/department/contact — never a stale id on the body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: 'details.customerLocation' }))
    await user.click(screen.getByRole('button', { name: 'Rivas Noord' }))
    await user.click(screen.getByRole('button', { name: 'details.customerDepartment' }))
    await user.click(screen.getByRole('button', { name: 'ICU' }))
    await user.click(screen.getByRole('button', { name: 'details.contactPerson' }))
    await user.click(screen.getByRole('button', { name: 'Jan Jansen' }))

    // Switch to a different customer — Rivas's now-invalid picks must not survive.
    await pickCustomer(user, 'Yesway Zorg')
    await fillTitleAndSubmit(user)

    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).toMatchObject({ customer_id: 'c2' })
    expect(body).not.toHaveProperty('customer_location_id')
    expect(body).not.toHaveProperty('customer_department_id')
    expect(body).not.toHaveProperty('contact_id')
  })
})

describe('AddVacancyModal · vestiging cosmetic prediction (VAC-VESTIGING-1)', () => {
  beforeEach(() => {
    cascadeState.byCustomer = {
      c1: { locations: [], contacts: [], branch_id: 'branch-1' },
      // A branch id NOT among the picker's own options (branch-1/branch-2) —
      // proves the "freezes" test below can't pass by coincidence.
      c2: { locations: [], contacts: [], branch_id: 'branch-9' },
    }
  })
  async function pickCustomer(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole('button', { name: 'modal.fields.client' }))
    await user.click(screen.getByRole('button', { name: label }))
  }

  it('proposes the picked customer\'s own mirrored branch onto the create body', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-1' }))
  })

  it('re-predicts the branch on a customer switch while the field stays untouched', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    await pickCustomer(user, 'Yesway Zorg')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-9' }))
  })

  it('freezes the proposal once the recruiter picks the branch by hand — a later customer switch never overwrites it', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await pickCustomer(user, 'Rivas Zorggroep')
    // Manual pick overrides the proposed 'branch-1' with the other option.
    await user.click(screen.getByRole('button', { name: 'modal.fields.branch' }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))
    // Switching customer would otherwise re-propose 'branch-9' — must not happen now.
    await pickCustomer(user, 'Yesway Zorg')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ location_id: 'branch-2' }))
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

  // VAC-VESTIGING-1: optional at create — clearing it (or never picking it)
  // must send NO `location_id` key at all, so the server can apply its own
  // default (never a stray `location_id: ''`/`null` on the base create).
  it('sends no location_id key at all when the vestiging is never picked', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('location_id')
  })

  it('sends no location_id key when a picked vestiging is cleared again', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.fields.branch' }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))
    // The shared CreatableSelect's own clear-X (VAC-CLEAR-1) — scoped to the
    // branch FieldRow specifically (other fields elsewhere in the form may
    // also carry a value + their own clear-X).
    const branchLabel = screen.getByText('modal.fields.branch')
    await user.click(within(branchLabel.parentElement as HTMLElement).getByRole('button', { name: 'clearField' }))
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).not.toHaveProperty('location_id')
  })
})

describe('AddVacancyModal · Functie-eisen — senioriteit/opleiding + skills (punt 14/15)', () => {
  it('picks a seniority level and adds a required skill', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'requirements')
    await user.click(screen.getByRole('button', { name: 'details.seniority' }))
    await user.click(screen.getByRole('button', { name: 'Senior' }))
    // K6e: AdditionalSkillsSection's add/edit/remove list — the "+" trigger opens
    // an inline AddForm (placeholder = the field label), saved via the diskette icon.
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'BIG-registratie')
    await user.click(screen.getByTitle('save'))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      seniority: 'senior', skills: ['BIG-registratie'],
    }))
  })

  it('edits a staged required skill in place (K6e)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'requirements')
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'BIG-registratie')
    await user.click(screen.getByTitle('save'))
    // The saved row now carries an edit pencil (AdditionalSkillsSection/AddableSection).
    await user.click(screen.getByTitle('edit'))
    const input = screen.getByPlaceholderText('details.addSkill')
    await user.clear(input)
    await user.type(input, 'VCA-certificaat')
    await user.click(screen.getByTitle('save'))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      skills: ['VCA-certificaat'],
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
    const salaryInputs = screen.getAllByPlaceholderText('common:placeholders.min')
    await user.type(salaryInputs[0], '2500')
    await user.type(screen.getByPlaceholderText('modal.fields.salaryPeriodPlaceholder'), 'per maand')
    await user.type(screen.getAllByPlaceholderText('common:placeholders.max')[1], '32')
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
    await openTab(user, 'description')
    await user.click(screen.getByRole('button', { name: /details.description/ }))
    await user.type(screen.getByLabelText('rich-text-editor'), 'Dienst op de IC-afdeling.')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ description: 'Dienst op de IC-afdeling.' }))
  })
})
