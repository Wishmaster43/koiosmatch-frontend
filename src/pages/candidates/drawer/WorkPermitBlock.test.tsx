import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n so t()/defaultValue resolve real Dutch text, like the rest of this drawer's tests.
import '@/i18n'
import WorkPermitBlock from './WorkPermitBlock'
import { useIsNonEuNationality } from './useIsNonEuNationality'
import type { Candidate } from '@/types/candidate'

// Own hook, own test (useIsNonEuNationality.test.ts) — mocked directly here so
// this component's tests don't depend on its network call, mirroring how
// ProfilePersonalTab.test.tsx mocks useProfileRequiredKeys.
vi.mock('./useIsNonEuNationality', () => ({ useIsNonEuNationality: vi.fn(() => true) }))

describe('WorkPermitBlock · visible only for a non-EU/EEA candidate (KAND-WERKVERGUNNING-2)', () => {
  beforeEach(() => { vi.mocked(useIsNonEuNationality).mockReturnValue(true) })

  const candidate = { id: 1, nationality: 'Marokkaans' } as unknown as Candidate

  it('renders nothing for an EU/EEA candidate', () => {
    vi.mocked(useIsNonEuNationality).mockReturnValue(false)
    const { container } = render(<WorkPermitBlock c={candidate} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the group title and both fields for a non-EU/EEA candidate', () => {
    render(<WorkPermitBlock c={candidate} />)
    expect(screen.getByText('Werkvergunning')).toBeInTheDocument()
    expect(screen.getByText('Type werkvergunning')).toBeInTheDocument()
    expect(screen.getByText('Geldig tot')).toBeInTheDocument()
  })

  it('the pencil flips the card into edit mode (save/cancel replace it)', async () => {
    const user = userEvent.setup()
    render(<WorkPermitBlock c={candidate} />)
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(1)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByTitle('Opslaan')).toBeInTheDocument()
    expect(screen.getByTitle('Annuleren')).toBeInTheDocument()
    expect(screen.queryByTitle('Bewerken')).toBeNull()
  })

  it('sends the typed work-permit type + date on save (assert the REQUEST body)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<WorkPermitBlock c={candidate} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const typeRow = screen.getByText('Type werkvergunning').parentElement as HTMLElement
    const typeInput = within(typeRow).getByRole('textbox') as HTMLInputElement
    await user.type(typeInput, 'Gecombineerde vergunning')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ workPermitType: 'Gecombineerde vergunning', workPermitValidUntil: '' })
  })

  it('cancel restores the original value without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    // KAND-WERKVERGUNNING-2 data-plumbing note (see WorkPermitBlock.tsx): read
    // defensively off the raw snake_case field until mapCandidate.ts is extended.
    const withValue = { ...candidate, work_permit_type: 'Tewerkstellingsvergunning' } as unknown as Candidate
    render(<WorkPermitBlock c={withValue} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const typeRow = screen.getByText('Type werkvergunning').parentElement as HTMLElement
    const typeInput = within(typeRow).getByRole('textbox') as HTMLInputElement
    await user.clear(typeInput)
    await user.type(typeInput, 'Iets anders')
    await user.click(screen.getByTitle('Annuleren'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Tewerkstellingsvergunning')).toBeInTheDocument()
  })

  it('reads the current valid-until date defensively off the raw snake_case field, formatted DD-MM-YYYY', () => {
    const withValue = { ...candidate, work_permit_valid_until: '2027-01-01' } as unknown as Candidate
    render(<WorkPermitBlock c={withValue} />)
    expect(screen.getByText('01-01-2027')).toBeInTheDocument()
  })

  it('shows a dash for both fields when nothing is set yet', () => {
    render(<WorkPermitBlock c={candidate} />)
    expect(screen.getAllByText('-')).toHaveLength(2)
  })
})
