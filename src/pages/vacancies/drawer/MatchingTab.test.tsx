/**
 * MatchingTab · MATCH-TEMPLATE-1 (template pick → weights preview + PATCH payload,
 * server-resync effect, manual save clears provenance). Rendered together with the
 * REAL useVacancyRecord hook (not a stub for onUpdate) so the PATCH body mapping
 * (buildVacancyPatch → match_weight_template_id) and the server-resync effect
 * (useVacancyRecord.updateVacancy re-syncing matchWeights/matchWeightTemplateId
 * from the PATCH response) are genuinely exercised, not asserted against a mock.
 * `api` is mocked; the Slider is stubbed with a plain range input (same value/
 * onChange contract) so tests can drive it without pointer-drag geometry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import MatchingTab from './MatchingTab'
import { useVacancyRecord } from '../hooks/useVacancyRecord'
import api from '@/lib/api'
import type { Vacancy } from '@/types/vacancy'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})

const TEMPLATE_WEIGHTS = { qualifications: 5, technical_fit: 5, soft_skills: 2, cultural_alignment: 3, career_aspirations: 2, location: 1 }
vi.mock('../hooks/useMatchWeightTemplates', () => ({
  useMatchWeightTemplates: () => ({
    templates: [{ id: 't1', name: 'Senior profile', weights: TEMPLATE_WEIGHTS, linkedVacanciesCount: 2 }],
    loading: false, error: false,
  }),
}))

// Stand-in for the pointer-drag Slider — same value/onChange contract, driveable via fireEvent.
vi.mock('@/components/ui/Slider', () => ({
  default: ({ value, onChange, ariaLabel }: { value: number; onChange: (v: number) => void; ariaLabel?: string }) => (
    <input type="range" aria-label={ariaLabel} value={value} min={0} max={4}
      onChange={e => onChange(Number(e.target.value))} />
  ),
}))

const mockGet   = api.get   as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// Raw (API-shaped) vacancy detail — mapVacancyDetail is defensive, so only the
// match-weight fields under test need to be populated.
const rawDetail = (over: Record<string, unknown> = {}) => ({
  id: 'v1', title: 'Verpleegkundige',
  match_weights: { qualifications: 3, technical_fit: 3, soft_skills: 3, cultural_alignment: 3, career_aspirations: 3, location: 3 },
  match_weight_template_id: null,
  ...over,
})
const vacancyRow = { id: 'v1', title: 'Verpleegkundige' } as Vacancy

// Harness: mounts the REAL useVacancyRecord + MatchingTab together, so `onUpdate`
// exercises the actual PATCH-mapping/server-resync wiring end to end.
function Harness() {
  const [, setVacancies] = useState<Vacancy[]>([vacancyRow])
  const [, setTotal] = useState(1)
  const record = useVacancyRecord({
    setVacancies, setTotal, statusMeta: () => ({ label: '', color: '' }),
    users: [], customers: [], t: ((k: string) => k) as unknown as TFunction,
  })
  // Auto-select on mount — fetches the detail via the mocked GET.
  useEffect(() => { record.selectVacancy(vacancyRow) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!record.detail) return <div>loading-detail</div>
  return <MatchingTab vacancy={record.detail} onUpdate={record.updateVacancy} />
}

beforeEach(() => { mockGet.mockReset(); mockPatch.mockReset() })

describe('MatchingTab · template pick → weights preview + PATCH payload', () => {
  it('previews the template weights immediately and PATCHes match_weight_template_id only', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail() } })
    render(<Harness />)
    await waitFor(() => screen.getByText('matching.profile'))

    mockPatch.mockResolvedValue({ data: { data: rawDetail({ match_weights: TEMPLATE_WEIGHTS, match_weight_template_id: 't1' }) } })
    const user = userEvent.setup()
    // V18: the template picker is a searchable CreatableSelect (was a plain
    // <select>) — open it (its trigger button's accessible name is its current
    // label text) then click the wanted option.
    await user.click(screen.getByRole('button', { name: 'matching.custom' }))
    await user.click(screen.getByRole('button', { name: 'Senior profile' }))

    // Optimistic preview — qualifications (template value 5 → slider index 4) updates at once.
    expect(screen.getByLabelText('matching.dim.qualifications')).toHaveValue('4')
    expect(screen.getByLabelText('matching.dim.location')).toHaveValue('0')

    // The PATCH body carries ONLY the template id (buildVacancyPatch → match_weight_template_id).
    expect(mockPatch).toHaveBeenCalledWith('/vacancies/v1', { match_weight_template_id: 't1' })
    expect(mockPatch.mock.calls[0][1]).not.toHaveProperty('match_weights')
  })

  it('server-resync effect: the authoritative PATCH response reconciles weights + shows the provenance hint', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail() } })
    render(<Harness />)
    await waitFor(() => screen.getByText('matching.profile'))

    // Server returns a DIFFERENT snapshot than the local template guess (e.g. rounded/adjusted server-side).
    mockPatch.mockResolvedValue({ data: { data: rawDetail({
      match_weights: { ...TEMPLATE_WEIGHTS, location: 2 }, match_weight_template_id: 't1',
    }) } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'matching.custom' }))
    await user.click(screen.getByRole('button', { name: 'Senior profile' }))

    // Resync replaces the optimistic guess (location=1) with the server's resolved value (location=2).
    await waitFor(() => expect(screen.getByLabelText('matching.dim.location')).toHaveValue('1'))
    // Provenance hint appears now that the vacancy carries a resolved matchWeightTemplateId.
    expect(screen.getByText(/matching.basedOn/)).toBeInTheDocument()
  })

  it('a manual slider edit + Save sends matchWeights only, and losing the template on resync clears the provenance hint', async () => {
    // Start from an already-templated vacancy (provenance hint visible).
    mockGet.mockResolvedValue({ data: { data: rawDetail({ match_weights: TEMPLATE_WEIGHTS, match_weight_template_id: 't1' }) } })
    render(<Harness />)
    await waitFor(() => screen.getByText('matching.profile'))
    expect(screen.getByText(/matching.basedOn/)).toBeInTheDocument()

    // Manual override — drag the location slider away from the template's preset value.
    fireEvent.change(screen.getByLabelText('matching.dim.location'), { target: { value: '3' } })

    // A manual weight edit is no longer a template snapshot — the server clears provenance.
    mockPatch.mockResolvedValue({ data: { data: rawDetail({
      match_weights: { ...TEMPLATE_WEIGHTS, location: 4 }, match_weight_template_id: null,
    }) } })
    const user = userEvent.setup()
    await user.click(screen.getByText('matching.save'))

    const [url, body] = mockPatch.mock.calls.at(-1) as [string, Record<string, unknown>]
    // The exact request Danny asked to be proven: PATCH /vacancies/{id} with the full
    // dragged weight set (not just "a" property), and nothing else riding along.
    expect(url).toBe('/vacancies/v1')
    expect(body).toEqual({ match_weights: { ...TEMPLATE_WEIGHTS, location: 4 } })

    await waitFor(() => expect(screen.queryByText(/matching.basedOn/)).toBeNull())
  })

  // Danny 22-07: concrete number + % instead of only the vague word label.
  it('shows the numeric weight + its % share of the total next to each dimension', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail({
      match_weights: { qualifications: 5, technical_fit: 3, soft_skills: 3, cultural_alignment: 3, career_aspirations: 3, location: 3 },
    }) } })
    render(<Harness />)
    await waitFor(() => screen.getByText('matching.profile'))

    // Sum = 5+3+3+3+3+3 = 20; qualifications' share = 5/20 = 25%.
    expect(screen.getByText('5/5 · 25%')).toBeInTheDocument()
    // Each of the other five dimensions (weight 3) shares 3/20 = 15%.
    expect(screen.getAllByText('3/5 · 15%')).toHaveLength(5)
  })
})
