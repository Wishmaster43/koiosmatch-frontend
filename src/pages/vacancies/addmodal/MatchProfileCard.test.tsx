/**
 * MatchProfileCard — punt 18. Proves: picking a template alone reports only
 * the template id (server snapshots the weights); touching a slider afterwards
 * reports an explicit `match_weights` override alongside it (never silently
 * dropped) — mirrors StoreVacancyRequest/VacancyWriter's "explicit weights
 * always win" precedence. useMatchWeightTemplates is mocked (no QueryClient
 * needed, mirrors MatchingTab.test.tsx's convention for the same hook).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import MatchProfileCard from './MatchProfileCard'
import nl from '@/i18n/locales/nl/vacancies.json'

// A second template (V18) so the search-box test below has something real to
// filter OUT — a single-option list would pass a filter test even without a
// working filter.
const templates = [
  { id: 't1', name: 'IC-verpleegkundige', weights: { qualifications: 5, technical_fit: 4, soft_skills: 3, cultural_alignment: 3, career_aspirations: 2, location: 4 }, linkedVacanciesCount: 3 },
  { id: 't2', name: 'Oproepkracht', weights: { qualifications: 2, technical_fit: 2, soft_skills: 4, cultural_alignment: 4, career_aspirations: 3, location: 2 }, linkedVacanciesCount: 1 },
]
vi.mock('../hooks/useMatchWeightTemplates', () => ({ useMatchWeightTemplates: () => ({ templates, loading: false, error: false }) }))

describe('MatchProfileCard · template pick vs explicit override', () => {
  it('picking a template reports only the template id, and clears any prior override', async () => {
    const onTemplateChange = vi.fn()
    const onWeightsChange = vi.fn()
    render(<MatchProfileCard templateId="" onTemplateChange={onTemplateChange} onWeightsChange={onWeightsChange} />)

    await userEvent.click(screen.getByRole('button', { name: nl.matching.custom }))
    await userEvent.click(screen.getByRole('button', { name: 'IC-verpleegkundige' }))

    expect(onTemplateChange).toHaveBeenCalledWith('t1')
    expect(onWeightsChange).toHaveBeenCalledWith(null)
  })

  it('touching a slider after "Aanpassen" reports an explicit match_weights override', async () => {
    const onWeightsChange = vi.fn()
    render(<MatchProfileCard templateId="t1" onTemplateChange={vi.fn()} onWeightsChange={onWeightsChange} />)

    await userEvent.click(screen.getByRole('button', { name: nl.matching.adjust }))
    const slider = screen.getByRole('slider', { name: nl.matching.dim.qualifications })
    slider.focus()
    await userEvent.keyboard('{ArrowLeft}')

    expect(onWeightsChange).toHaveBeenCalledWith(expect.objectContaining({ qualifications: 4 }))
  })
})

// V18 (VACATURES-100): the test above only proves open→click-an-option, which a
// non-searchable dropdown would pass too. This proves the box is a REAL
// client-side filter (CreatableSelect's own search input) — typing narrows the
// visible options instead of just decorating the trigger.
describe('MatchProfileCard · V18 template picker is searchable (client-side filter)', () => {
  it('typing in the search box narrows the option list to matching templates only', async () => {
    render(<MatchProfileCard templateId="" onTemplateChange={vi.fn()} onWeightsChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: nl.matching.custom }))
    expect(screen.getByRole('button', { name: 'IC-verpleegkundige' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oproepkracht' })).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText(nl.matching.custom), 'Oproep')
    expect(screen.queryByRole('button', { name: 'IC-verpleegkundige' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oproepkracht' })).toBeInTheDocument()
  })
})
