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

const templates = [
  { id: 't1', name: 'IC-verpleegkundige', weights: { qualifications: 5, technical_fit: 4, soft_skills: 3, cultural_alignment: 3, career_aspirations: 2, location: 4 }, linkedVacanciesCount: 3 },
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
