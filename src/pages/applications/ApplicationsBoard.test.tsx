/**
 * ApplicationsBoard · S-board-2 (LANE A doorklikken): the candidate name and
 * vacancy title on a board card must navigate like every other application
 * surface, not render as plain text. Asserts the navigation INTENT (page + id),
 * not just that a click handler fired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Side-effect import: initialises the real i18next instance so useTranslation
// inside ApplicationsBoard/EntityLink does not warn.
import '@/i18n'
import { NavigationProvider } from '@/context/NavigationContext'
import ApplicationsBoard from './ApplicationsBoard'
import type { Application } from '@/types/application'
import type { BoardPhase } from './ApplicationsBoard'

const PHASES: BoardPhase[] = [{ key: 'applied', label: 'Applied', color: '#4f7fff' }]

// Minimal, typed application row — only the fields BoardCard actually reads.
const APP: Application = {
  id: 'app-1', candidateId: 'cand-1', candidateName: 'Jane Doe', candidateInitials: 'JD',
  vacancyId: 'vac-1', vacancyTitle: 'Verpleegkundige IC', client: 'Zorggroep A', customerId: 'cust-1',
  referenceNumber: 'S-1', score: null, task: '', phaseKey: 'applied', bucket: 'applied', source: '',
  owner: { initials: '', color: null, name: '' } as Application['owner'],
  candidateStatusLabel: '', candidateStatusColor: '', candidateStatus: '', candidatePhase: '',
  created: '2026-01-01', isNew: false, archived: false, deletedAt: null, interview: null,
  currentStageEnteredAt: null, missingAppointment: false, tooLongInStage: false, hasMatch: false,
}

function renderBoard(goTo = vi.fn()) {
  const utils = render(
    <NavigationProvider goTo={goTo}>
      <ApplicationsBoard rows={[APP]} phases={PHASES} onMove={vi.fn()} onSelect={vi.fn()} />
    </NavigationProvider>,
  )
  return { ...utils, goTo }
}

afterEach(() => cleanup())

describe('ApplicationsBoard · S-board-2 candidate/vacancy deep links', () => {
  it('clicking the candidate name navigates to that candidate record', async () => {
    const user = userEvent.setup()
    const { goTo } = renderBoard()
    await user.click(screen.getByRole('button', { name: 'Jane Doe' }))
    expect(goTo).toHaveBeenCalledWith('candidates', { open: 'cand-1', tab: undefined })
  })

  it('clicking the vacancy title navigates to that vacancy record', async () => {
    const user = userEvent.setup()
    const { goTo } = renderBoard()
    await user.click(screen.getByRole('button', { name: 'Verpleegkundige IC' }))
    expect(goTo).toHaveBeenCalledWith('vacancies', { open: 'vac-1', tab: undefined })
  })
})
