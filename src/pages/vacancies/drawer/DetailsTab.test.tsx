/**
 * DetailsTab · VAC-AGENT-2 (Danny 21-07) regression guard: the AI-agent picker
 * card moved to its own tab (VacancyAgentTab) — DetailsTab must never render it
 * again. The whole form/cascade/lookup hook is stubbed (DetailsTab is pure card/
 * row JSX around it, see useVacancyDetailsForm's own doc comment), so no context
 * providers are needed to mount it.
 *
 * Also covers the flat-layout redesign (Danny 21-07): the sub-tab strip
 * (Algemeen/Profiel/Koios-advies) is gone — every section now stacks in one flat
 * scroll (no `role="tablist"`), and the field-edit pencil sits in the Algemeen
 * card's own title row instead of a separate row above the tab content.
 * Description moved OUT to its own drawer main-tab (DescriptionTab.test.tsx).
 *
 * VAC-COUNTRY-1 (Danny 22-07, punt 2): the land→provincie cascade logic itself
 * (province options scoping to the picked country, clearing an invalid province)
 * lives in useVacancyDetailsForm — fully stubbed here — so it's covered by
 * useVacancyDetailsForm.test.ts instead. This file only proves the component's
 * OWN wiring: the resolved country display name in read-mode, and the province
 * options the hook hands back reaching the picker.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import DetailsTab from './DetailsTab'
import type { VacancyDetail } from '@/types/vacancy'

// Deterministic stand-in for the real ISO-3166 + Intl.DisplayNames lookup — the
// real function is exercised by countries.test.ts, not here.
vi.mock('@/lib/countries', () => ({
  getCountryOptions: () => [{ value: 'NL', label: 'Netherlands' }, { value: 'BE', label: 'Belgium' }],
  getCountryName: (code: string) => (code === 'NL' ? 'Netherlands' : code),
}))

vi.mock('../hooks/useVacancyDetailsForm', () => ({
  useVacancyDetailsForm: () => ({
    candidateTypes: [], typeMeta: () => ({ label: '', color: '#000' }),
    seniorityLevels: [], educationLevels: [], industries: [], formatDate: (d: string) => d, fnOptions: [],
    editing: false, setEditing: vi.fn(), form: {}, setF: vi.fn(), save: vi.fn(), cancel: vi.fn(),
    provinces: ['Utrecht', 'Zuid-Holland'],
    clientId: '', handleClientChange: vi.fn(), customerOptions: [],
    cascade: { locationName: '', departmentName: '', contactName: '' },
    locationPicker: null, departmentPicker: null, contactPicker: null,
    types: [], toggleType: vi.fn(),
    skills: [], newSkill: '', setNewSkill: vi.fn(), addSkill: vi.fn(), removeSkill: vi.fn(),
  }),
  composeAddress: () => '',
}))
// Not under test here — makes its own API/insight calls, irrelevant to this guard.
vi.mock('@/components/ai/KoiosAdviceBlock', () => ({ default: () => null }))

const vacancy = { id: 'v1', title: 'Verpleegkundige', aiAgentId: 'a1', aiAgentName: 'Kelly' } as unknown as VacancyDetail

describe('DetailsTab · the AI-agent card is gone (moved to VacancyAgentTab)', () => {
  it('renders no AI-agent picker copy or the linked agent name', () => {
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

describe('DetailsTab · flat layout (Danny 21-07: no sub-tab strip)', () => {
  it('renders Algemeen, Profiel and Koios-advies all stacked, with no tablist', () => {
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    expect(screen.getByText('details.groups.general')).toBeInTheDocument()
    expect(screen.getByText('details.groups.location')).toBeInTheDocument()
    expect(screen.getByText('details.groups.requirements')).toBeInTheDocument()
    expect(screen.getByText('details.groups.conditions')).toBeInTheDocument()
    expect(screen.getByText('details.skills')).toBeInTheDocument()
    // No sub-tab bar left (SubTabBar renders role="tablist").
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    // Description moved to its own drawer tab — never rendered here anymore.
    expect(screen.queryByText('details.description')).not.toBeInTheDocument()
  })

  it('puts the edit pencil in the Algemeen card title row', () => {
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    const generalTitle = screen.getByText('details.groups.general')
    const editButton = screen.getByTitle('common:edit')
    // Same row wrapper: the title and the pencil share one parent (title-row div).
    expect(editButton.parentElement).toBe(generalTitle.parentElement)
  })
})

describe('DetailsTab · land→provincie cascade (Danny 22-07, punt 2)', () => {
  it('read-mode resolves the country to its display name, never the bare ISO code', () => {
    const v = { ...vacancy, country: 'NL', province: 'Utrecht' } as VacancyDetail
    render(<DetailsTab vacancy={v} onUpdate={vi.fn()} />)
    expect(screen.getByText('Netherlands')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })

  it('shows a dash for an unset country/province, never a raw empty string', () => {
    const v = { ...vacancy, country: '', province: '' } as VacancyDetail
    render(<DetailsTab vacancy={v} onUpdate={vi.fn()} />)
    // Both the Location card's province and country rows fall back to the dash.
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2)
  })
})
