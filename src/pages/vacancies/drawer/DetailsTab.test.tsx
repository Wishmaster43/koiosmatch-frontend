/**
 * DetailsTab · VAC-AGENT-2 (Danny 21-07) regression guard: the AI-agent picker
 * card moved to its own tab (VacancyAgentTab) — DetailsTab must never render it
 * again. The whole form/cascade/lookup hook is stubbed (DetailsTab is pure card/
 * row JSX around it, see useVacancyDetailsForm's own doc comment), so no context
 * providers are needed to mount it.
 *
 * Also covers the sub-tab reorg (Danny 21-07): the tab now splits into Algemeen ·
 * Profiel · Koios-advies via the shared SubTabBar instead of stacking every
 * section — default sub-tab, and switching shows/hides the right groups.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DetailsTab from './DetailsTab'
import type { VacancyDetail } from '@/types/vacancy'

vi.mock('../hooks/useVacancyDetailsForm', () => ({
  useVacancyDetailsForm: () => ({
    candidateTypes: [], typeMeta: () => ({ label: '', color: '#000' }),
    seniorityLevels: [], educationLevels: [], industries: [], formatDate: (d: string) => d, fnOptions: [],
    editing: false, setEditing: vi.fn(), form: {}, setF: vi.fn(), save: vi.fn(), cancel: vi.fn(),
    clientId: '', handleClientChange: vi.fn(), customerOptions: [],
    cascade: { locationName: '', departmentName: '', contactName: '' },
    locationPicker: null, departmentPicker: null, contactPicker: null,
    types: [], toggleType: vi.fn(),
    skills: [], newSkill: '', setNewSkill: vi.fn(), addSkill: vi.fn(), removeSkill: vi.fn(),
    descEditing: false, setDescEditing: vi.fn(), descExpanded: false, setDescExpanded: vi.fn(),
    description: '', setDescription: vi.fn(), saveDesc: vi.fn(), cancelDesc: vi.fn(),
    descKey: 0, applyGeneratedConcept: vi.fn(),
  }),
  composeAddress: () => '',
}))
// Not under test here — both make their own API/insight calls, irrelevant to this guard.
vi.mock('@/components/ai/KoiosAdviceBlock', () => ({ default: () => null }))
vi.mock('./VacancyGenerateFlow', () => ({ default: () => null }))

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

describe('DetailsTab · sub-tab reorg (Algemeen / Profiel / Koios-advies)', () => {
  it('defaults to Algemeen — general + location groups only', () => {
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    expect(screen.getByText('details.groups.general')).toBeInTheDocument()
    expect(screen.getByText('details.groups.location')).toBeInTheDocument()
    // Profiel and Koios-advies content stays hidden until picked.
    expect(screen.queryByText('details.groups.requirements')).not.toBeInTheDocument()
    expect(screen.queryByText('details.groups.conditions')).not.toBeInTheDocument()
    expect(screen.queryByText('details.skills')).not.toBeInTheDocument()
    expect(screen.queryByText('details.description')).not.toBeInTheDocument()
  })

  it('switching to Profiel shows requirements/conditions/skills/description and hides Algemeen', () => {
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByText('details.subtabs.profile'))
    expect(screen.getByText('details.groups.requirements')).toBeInTheDocument()
    expect(screen.getByText('details.groups.conditions')).toBeInTheDocument()
    expect(screen.getByText('details.skills')).toBeInTheDocument()
    expect(screen.getByText('details.description')).toBeInTheDocument()
    expect(screen.queryByText('details.groups.general')).not.toBeInTheDocument()
    expect(screen.queryByText('details.groups.location')).not.toBeInTheDocument()
  })

  it('switching to Koios-advies hides both Algemeen and Profiel groups', () => {
    render(<DetailsTab vacancy={vacancy} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByText('details.subtabs.advice'))
    expect(screen.queryByText('details.groups.general')).not.toBeInTheDocument()
    expect(screen.queryByText('details.groups.location')).not.toBeInTheDocument()
    expect(screen.queryByText('details.groups.requirements')).not.toBeInTheDocument()
    expect(screen.queryByText('details.groups.conditions')).not.toBeInTheDocument()
  })
})
