/**
 * DetailsTab · VAC-DETAILS-SPLIT-1 (Danny 24-07) regression guard: the tab now
 * shows a SubTabBar (Algemeen/Locatie/Eisen/Voorwaarden) — the OPPOSITE of the
 * earlier flat-stack redesign (21-07) — because ONE shared editing/form pair
 * meant a single pencil turned all 21 fields into inputs at once. Each
 * sub-tab renders its OWN Details<X>Tab component wired to its OWN hook
 * section (general/location/requirements/conditions), so a pencil opened in
 * one sub-tab can only ever flip that sub-tab. The whole hook is stubbed
 * (DetailsTab wires data + the tab list only), so no context providers are
 * needed to mount it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetailsTab from './DetailsTab'
import { useVacancyAdvice } from '@/lib/useVacancyAdvice'
import type { VacancyDetail } from '@/types/vacancy'

// Deterministic stand-in for the real ISO-3166 + Intl.DisplayNames lookup — the
// real function is exercised by countries.test.ts, not here.
vi.mock('@/lib/countries', () => ({
  getCountryOptions: () => [{ value: 'NL', label: 'Netherlands' }, { value: 'BE', label: 'Belgium' }],
  getCountryName: (code: string) => (code === 'NL' ? 'Netherlands' : code),
}))
// The advice-block WIRING is under test (KOIOS-ADVIES-OVERAL-1), not its chrome —
// the stub exposes each insight's collapsed label as plain text.
vi.mock('@/components/ai/KoiosAdviceBlock', () => ({
  default: ({ insights }: { insights: { type: string }[] }) => (
    <div data-testid="koios-advice">{insights.map((i, idx) => <span key={idx}>{i.type}</span>)}</div>
  ),
}))
// useVacancyAdvice reads the tenant settings blob — stubbed so no /settings GET
// fires from jsdom (real getNumberSetting keeps the 14-day default in play).
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => ({}) }
})

// One section's mock shape — every Details<X>Tab only ever reads/calls its OWN
// section, so each test can override just the bits it needs (e.g. `editing: true`).
const baseSection = (extra: Record<string, unknown> = {}) => ({
  editing: false, setEditing: vi.fn(), form: {}, setF: vi.fn(), save: vi.fn(), cancel: vi.fn(), ...extra,
})
const makeHookReturn = (overrides: { general?: object; location?: object; requirements?: object; conditions?: object } = {}) => ({
  candidateTypes: [], typeMeta: () => ({ label: '', color: '#000' }),
  seniorityLevels: [], educationLevels: [], industries: [], formatDate: (d: string) => d, fnOptions: [],
  // VACANCY-CONTRACT-FIELD-1: Voorwaarden's own contract-type/CAO lookups.
  contractTypeOptions: [], caoOptions: [],
  general: baseSection({
    clientId: '', handleClientChange: vi.fn(), customerOptions: [],
    cascade: { locationName: '', departmentName: '', contactName: '' },
    locationPicker: null, departmentPicker: null, contactPicker: null,
    types: [], toggleType: vi.fn(),
    ...overrides.general,
  }),
  location: baseSection({ provinces: ['Utrecht', 'Zuid-Holland'], ...overrides.location }),
  requirements: baseSection({ skills: [], newSkill: '', setNewSkill: vi.fn(), addSkill: vi.fn(), removeSkill: vi.fn(), ...overrides.requirements }),
  conditions: baseSection({ ...overrides.conditions }),
})

// Mutable so each test can install its own hook stub before rendering.
let hookReturn = makeHookReturn()
vi.mock('../hooks/useVacancyDetailsForm', () => ({
  useVacancyDetailsForm: () => hookReturn,
  composeAddress: () => '',
}))

const vacancy = { id: 'v1', title: 'Verpleegkundige', aiAgentId: 'a1', aiAgentName: 'Kelly' } as unknown as VacancyDetail

describe('DetailsTab · sub-tab strip (VAC-DETAILS-SPLIT-1)', () => {
  it('renders a tablist with the four existing group labels, Algemeen active first', () => {
    hookReturn = makeHookReturn()
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'details.groups.general' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'details.groups.location' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'details.groups.requirements' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'details.groups.conditions' })).toBeInTheDocument()
    // Only Algemeen's own fields render initially — the other three sub-tabs are unmounted.
    expect(screen.getByText('details.contractType')).toBeInTheDocument()
    expect(screen.queryByText('details.address')).not.toBeInTheDocument()
    expect(screen.queryByText('details.experience')).not.toBeInTheDocument()
    expect(screen.queryByText('details.salary')).not.toBeInTheDocument()
  })

  it('switching sub-tabs swaps the rendered fields', async () => {
    hookReturn = makeHookReturn()
    const user = userEvent.setup()
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: 'details.groups.location' }))
    expect(screen.getByText('details.address')).toBeInTheDocument()
    expect(screen.queryByText('details.contractType')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'details.groups.requirements' }))
    expect(screen.getByText('details.experience')).toBeInTheDocument()
    expect(screen.getByText('details.skills')).toBeInTheDocument()
    expect(screen.queryByText('details.address')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'details.groups.conditions' }))
    expect(screen.getByText('details.salary')).toBeInTheDocument()
    expect(screen.queryByText('details.experience')).not.toBeInTheDocument()
  })

  it('a pencil open in one sub-tab never flips another (each section has its OWN editing flag)', async () => {
    // Eisen is mid-edit; Algemeen/Locatie/Voorwaarden are not.
    hookReturn = makeHookReturn({ requirements: { editing: true } })
    const user = userEvent.setup()
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    // Algemeen (the active tab) still shows its READ-mode pencil, not save/cancel.
    expect(screen.getByTitle('common:edit')).toBeInTheDocument()
    expect(screen.queryByTitle('common:save')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'details.groups.requirements' }))
    // Eisen's OWN card is mid-edit — save/cancel show, not a pencil.
    expect(screen.getByTitle('common:save')).toBeInTheDocument()
    expect(screen.getByTitle('common:cancel')).toBeInTheDocument()
  })

  it('clicking a sub-tab\'s own pencil calls ONLY that section\'s setEditing', async () => {
    hookReturn = makeHookReturn()
    const user = userEvent.setup()
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    expect(hookReturn.general.setEditing).toHaveBeenCalledWith(true)
    expect(hookReturn.location.setEditing).not.toHaveBeenCalled()
    expect(hookReturn.requirements.setEditing).not.toHaveBeenCalled()
    expect(hookReturn.conditions.setEditing).not.toHaveBeenCalled()
  })
})

describe('DetailsTab · the AI-agent card is gone (moved to VacancyAgentTab)', () => {
  it('renders no AI-agent picker copy or the linked agent name', () => {
    hookReturn = makeHookReturn()
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    // In unit tests i18n resources aren't loaded, so t() echoes the raw key — if the
    // card were reintroduced these keys would render literally as this text.
    expect(screen.queryByText('details.groups.aiAgent')).not.toBeInTheDocument()
    expect(screen.queryByText('details.aiAgent.placeholder')).not.toBeInTheDocument()
    expect(screen.queryByText('details.aiAgent.none')).not.toBeInTheDocument()
    // The vacancy DOES carry a linked agent name — it must not leak into this tab.
    expect(screen.queryByText('Kelly')).not.toBeInTheDocument()
  })
})

// KOIOS-ADVIES-OVERAL-1: the drawer block shows EXACTLY the advice the table's
// Koios column derives — asserted through the SAME resolver (useVacancyAdvice),
// never a copied literal.
describe('DetailsTab · table-identical Koios advice (KOIOS-ADVIES-OVERAL-1)', () => {
  // Published long ago with zero applications → the stale rule fires.
  const staleVacancy = { ...vacancy, published: true, publishedAt: '2026-01-01', applicationsCount: 0 } as unknown as VacancyDetail

  it('shows the same label the table pill derives for a stale published vacancy', () => {
    hookReturn = makeHookReturn()
    const { result } = renderHook(() => useVacancyAdvice())
    const expected = result.current(staleVacancy)?.label
    expect(expected).toBeTruthy()
    render(<DetailsTab vacancy={staleVacancy} onUpdate={vi.fn()} />)
    expect(screen.getByTestId('koios-advice')).toHaveTextContent(expected as string)
  })

  it('renders no advice row on a clean (unpublished) vacancy — heuristics only', () => {
    hookReturn = makeHookReturn()
    const { result } = renderHook(() => useVacancyAdvice())
    expect(result.current(vacancy as unknown as VacancyDetail)).toBeNull()
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    // The FIRST rendered row is the completeness heuristic — nothing was prepended.
    const rows = screen.getByTestId('koios-advice').querySelectorAll('span')
    expect(rows[0]).toHaveTextContent('ai.completeness')
  })
})

describe('DetailsTab · land→provincie cascade (Danny 22-07, punt 2)', () => {
  it('read-mode resolves the country to its display name, never the bare ISO code', async () => {
    hookReturn = makeHookReturn()
    const user = userEvent.setup()
    const v = { ...vacancy, country: 'NL', province: 'Utrecht' } as VacancyDetail
    render(<DetailsTab vacancy={v} onUpdate={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'details.groups.location' }))
    expect(screen.getByText('Netherlands')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })

  it('shows a dash for an unset country/province, never a raw empty string', async () => {
    hookReturn = makeHookReturn()
    const user = userEvent.setup()
    const v = { ...vacancy, country: '', province: '' } as VacancyDetail
    render(<DetailsTab vacancy={v} onUpdate={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'details.groups.location' }))
    // Both the Location card's province and country rows fall back to the dash.
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2)
  })
})
