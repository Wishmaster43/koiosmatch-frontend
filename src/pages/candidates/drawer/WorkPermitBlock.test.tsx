import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n so t()/defaultValue resolve real Dutch text, like the rest of this drawer's tests.
import '@/i18n'
import WorkPermitBlock from './WorkPermitBlock'
import { useWorkPermitVisibility } from './useWorkPermitVisibility'
import type { Candidate } from '@/types/candidate'

// This project ships no @types/node; process.env.TZ is a genuine Node global at
// test runtime (Vitest runs under Node) — this is a minimal local type shim for it.
declare const process: { env: Record<string, string | undefined> }

// Own hook, own tests (workPermitVisibility.test.ts covers the RULE; the wiring
// test below covers what this component feeds it) — mocked here so the rendering
// tests don't depend on its network call, mirroring how ProfilePersonalTab.test.tsx
// mocks useProfileRequiredKeys.
vi.mock('./useWorkPermitVisibility', () => ({ useWorkPermitVisibility: vi.fn(() => true) }))

// KAND-WERKVERGUNNING-LOOKUP-1: the work-permit-type lookup, mocked directly
// (own hook, own test — useWorkPermitTypes is a thin useCachedLookup wrapper,
// same convention as ProfilePersonalTab.test.tsx mocking useGenders).
vi.mock('@/lib/useWorkPermitTypes', () => ({
  useWorkPermitTypes: () => ({
    workPermitTypes: [
      { value: 'twv', label: 'Tewerkstellingsvergunning (TWV)' },
      { value: 'gvva', label: 'Gecombineerde vergunning (GVVA)' },
    ],
  }),
}))

describe('WorkPermitBlock · rendering + save (KAND-WERKVERGUNNING-2)', () => {
  beforeEach(() => { vi.mocked(useWorkPermitVisibility).mockReturnValue(true) })

  const candidate = { id: 1, nationality: 'Marokkaans' } as unknown as Candidate

  it('renders nothing when the visibility rule hides the card', () => {
    vi.mocked(useWorkPermitVisibility).mockReturnValue(false)
    const { container } = render(<WorkPermitBlock c={candidate} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the group title and both fields when visible', () => {
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

  // KAND-WERKVERGUNNING-LOOKUP-1: the field is a pick-only searchable dropdown
  // over the tenant lookup now, never a plain <select> and never free typing
  // (CLAUDE.md §4 standing rule) — mirrors ProfilePersonalTab's identical test.
  it('is a pick-only searchable dropdown fed by the lookup — no plain <select>, no create-on-type', async () => {
    const user = userEvent.setup()
    const { container } = render(<WorkPermitBlock c={candidate} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(container.querySelectorAll('select')).toHaveLength(0)
    const typeField = screen.getByText('Type werkvergunning').parentElement as HTMLElement
    await user.click(within(typeField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('Selecteer'), 'Gecombineerde')
    expect(screen.getByRole('button', { name: 'Gecombineerde vergunning (GVVA)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tewerkstellingsvergunning (TWV)' })).toBeNull()
  })

  // §13: assert the REQUEST — the picked option's lookup `value` (the slug PATCH
  // /candidates/{id} validates against work_permit_types.value, verified live),
  // never the display label.
  it('sends the picked work-permit type slug + date on save (assert the REQUEST body)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<WorkPermitBlock c={candidate} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const typeField = screen.getByText('Type werkvergunning').parentElement as HTMLElement
    await user.click(within(typeField).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Gecombineerde vergunning (GVVA)' }))
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ workPermitType: 'gvva', workPermitValidUntil: '' })
  })

  it('cancel restores the original value without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    // KAND-WERKVERGUNNING-2 data-plumbing note (see WorkPermitBlock.tsx): read
    // defensively off the raw snake_case field until mapCandidate.ts is extended.
    const withValue = { ...candidate, work_permit_type: 'twv' } as unknown as Candidate
    render(<WorkPermitBlock c={withValue} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const typeField = screen.getByText('Type werkvergunning').parentElement as HTMLElement
    await user.click(within(typeField).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Gecombineerde vergunning (GVVA)' }))
    await user.click(screen.getByTitle('Annuleren'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Tewerkstellingsvergunning (TWV)')).toBeInTheDocument()
  })

  // A candidate written before the value moved onto a lookup (or since renamed/
  // deleted in Settings) must keep showing its stored slug — never a silent blank.
  it('an unknown/legacy work-permit value still renders instead of being silently blanked', () => {
    const legacy = { ...candidate, work_permit_type: 'oud_type_niet_meer_in_lijst' } as unknown as Candidate
    render(<WorkPermitBlock c={legacy} />)
    expect(screen.getByText('oud_type_niet_meer_in_lijst')).toBeInTheDocument()
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

/**
 * DANNY-PUNT-1 · the SEAM between this component and the visibility rule. The rule
 * itself is proven in workPermitVisibility.test.ts; what must be pinned HERE is
 * that the component actually tells the rule whether the card holds data — get
 * that argument wrong and a filled-in work permit disappears off the screen, which
 * is the one failure mode Danny called out as unacceptable. §13: assert the call,
 * not merely that something rendered.
 */
describe('WorkPermitBlock · what it feeds the visibility rule', () => {
  beforeEach(() => { vi.mocked(useWorkPermitVisibility).mockReturnValue(true) })

  it('reports UNOBSERVABLE when the candidate carries no work-permit key at all', () => {
    // This is today's real production shape: mapCandidate.ts drops both columns, so
    // "no key" must never be read as "empty" — that would hide a stored permit.
    render(<WorkPermitBlock c={{ id: 1, nationality: 'Nederlandse' } as unknown as Candidate} />)
    expect(useWorkPermitVisibility).toHaveBeenCalledWith('Nederlandse', 'unobservable')
  })

  it('reports EMPTY only when the keys are present and both are blank', () => {
    const blank = { id: 1, nationality: 'Nederlandse', work_permit_type: null, work_permit_valid_until: null } as unknown as Candidate
    render(<WorkPermitBlock c={blank} />)
    expect(useWorkPermitVisibility).toHaveBeenCalledWith('Nederlandse', 'empty')
  })

  it('reports FILLED when a permit type is stored (so it can never be hidden)', () => {
    const withType = { id: 1, nationality: 'Nederlandse', work_permit_type: 'twv' } as unknown as Candidate
    render(<WorkPermitBlock c={withType} />)
    expect(useWorkPermitVisibility).toHaveBeenCalledWith('Nederlandse', 'filled')
  })

  it('reports FILLED when only a validity date is stored', () => {
    const withDate = { id: 1, nationality: 'Nederlandse', work_permit_valid_until: '2027-01-01' } as unknown as Candidate
    render(<WorkPermitBlock c={withDate} />)
    expect(useWorkPermitVisibility).toHaveBeenCalledWith('Nederlandse', 'filled')
  })
})

// Regression guard (Danny 09-08, UTC-date-shift fix): workPermitValidUntil is a
// DatePicker wired straight to toLocalIsoDate — prove the SENT value is the picked
// local day, not one rolled back by a UTC conversion. A wrong expiry is a document
// someone relies on being wrong.
describe('WorkPermitBlock · valid-until field sends the LOCAL calendar day, never UTC-shifted', () => {
  const originalTz = process.env.TZ
  beforeEach(() => {
    vi.mocked(useWorkPermitVisibility).mockReturnValue(true)
    // Explicit TZ so this proves something on any machine, not just one that
    // happens to run in UTC (where old-buggy and fixed code would coincide).
    process.env.TZ = 'Europe/Amsterdam'
    // Freeze "now" just after local midnight (CET, winter) — the exact window where
    // `.toISOString().slice(0, 10)` used to roll the picked day back by one (measured
    // 09-08: picking 15 Jan 2026 saved as "2026-01-14"). Only Date is faked, so
    // userEvent's own internal timers keep ticking normally.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 15, 0, 30, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
    process.env.TZ = originalTz
  })

  it('sends workPermitValidUntil "2026-01-15" when the today cell is picked, not "2026-01-14"', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const candidate = { id: 1, nationality: 'Marokkaans' } as unknown as Candidate
    render(<WorkPermitBlock c={candidate} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const validUntilRow = screen.getByText('Geldig tot').parentElement as HTMLElement
    await user.click(within(validUntilRow).getByRole('textbox'))
    // The calendar renders into the shared datepicker-portal, outside this row.
    const todayCell = document.querySelector('.react-datepicker__day--today') as HTMLElement
    expect(todayCell).toBeTruthy()
    await user.click(todayCell)
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workPermitValidUntil: '2026-01-15' }))
  })
})
