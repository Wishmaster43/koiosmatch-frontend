/**
 * CandidateVacancyTabSettings — §13 seam guard: toggling one lookup chip must
 * persist the FULL merged `candidate_vacancy_tab` object (all four arrays),
 * never a partial write.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateVacancyTabSettings from './CandidateVacancyTabSettings'

const blobRef = vi.hoisted(() => ({ current: {} }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
// getActiveTenantId is the real (unmocked) useAllSettings module's tenant-scope key.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))

vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    /* eslint-disable no-restricted-syntax -- seed DATA mirroring the DEFAULT_* seeds, not a UI colour choice */
    phases: [{ value: 'lead', label: 'Lead', color: '#79B58E' }, { value: 'candidate', label: 'Candidate', color: '#4A90D9' }],
    statuses: [{ value: 'available', label: 'Available', color: '#79B58E' }],
    candidateTypes: [{ value: 'temp_agency', label: 'Uitzendkracht', color: '#DDA071' }],
    /* eslint-enable no-restricted-syntax */
  }),
}))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

const STORED = {
  phases: ['lead'],
  hidden_statuses: [],
  candidate_types: ['temp_agency'],
  vacancy_statuses: ['open'],
}

describe('CandidateVacancyTabSettings', () => {
  it('toggling a phase switch POSTs the FULL merged object, no sibling key lost', async () => {
    blobRef.current = { candidate_vacancy_tab: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<CandidateVacancyTabSettings />)
    // The control is a real Toggle switch since 05-08 ("Toggle maken!!") — the
    // coloured chip next to it is a label, not the clickable element.
    await user.click(screen.getByRole('switch', { name: 'Candidate' }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      candidate_vacancy_tab: JSON.stringify({ ...STORED, phases: ['lead', 'candidate'] }),
    })
  })
})
