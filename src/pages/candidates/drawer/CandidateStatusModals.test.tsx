/**
 * CandidateStatusModals — G34 regression: the three native <select>s (existing-match
 * picker, new-match vacancy picker, blacklist reason picker) are now the house
 * `CreatableSelect` (allowCreate={false}), never a raw <select>. Asserts the same
 * onChange/state wiring as before (value/options identical, no request shape change)
 * through the new click-to-open interaction. No `react-i18next` mock — neither this
 * component nor FloatingPanel imports the real i18n bootstrap (`@/lib/datetime`), so
 * `t()` falls back to returning the raw key (mirrors PlanIntakeModal.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateStatusModals from './CandidateStatusModals'

// api.get('/candidate-blacklist-reasons') only fires while a blacklist prompt is
// open — stubbed so the reason dropdown has real options to pick from.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [{ name: 'No-show' }, { name: 'Fraud', icon: '🚫' }] } })) },
  unwrapList: (r: { data?: { data?: unknown } }) => ({ rows: r?.data?.data ?? [] }),
}))

const noop = () => {}
const baseProps = {
  matchPrompt: false, onCloseMatch: noop, matches: [], matchChoice: null, setMatchChoice: vi.fn(),
  newMatchVacancyId: '', setNewMatchVacancyId: vi.fn(), vacancyOptions: [], creatingMatch: false, onConfirmMatch: vi.fn(),
  statusModal: null, setStatusModal: vi.fn(), onConfirmStatus: vi.fn(),
}

describe('CandidateStatusModals · match-pick dropdowns are the house CreatableSelect, not a native <select>', () => {
  it('renders no native <select> anywhere in the match-pick overlay', () => {
    const { container } = render(<CandidateStatusModals {...baseProps} matchPrompt
      matches={[{ id: 'm1', vacancyTitle: 'Verzorgende IG', client: 'Zorggroep A' }]}
      vacancyOptions={[{ value: 'vac-1', label: 'Helpende', client: 'Zorggroep B' }]} />)
    expect(container.querySelector('select')).toBeNull()
  })

  it('picking an existing match calls setMatchChoice with its id and clears the new-vacancy field', async () => {
    const user = userEvent.setup()
    const setMatchChoice = vi.fn()
    const setNewMatchVacancyId = vi.fn()
    render(<CandidateStatusModals {...baseProps} matchPrompt setMatchChoice={setMatchChoice} setNewMatchVacancyId={setNewMatchVacancyId}
      matches={[{ id: 'm1', vacancyTitle: 'Verzorgende IG', client: 'Zorggroep A' }]}
      vacancyOptions={[]} />)

    // Trigger shows the placeholder text until a value is picked (CreatableSelect convention).
    await user.click(screen.getByRole('button', { name: 'drawer.placedPickPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))

    expect(setMatchChoice).toHaveBeenCalledWith('m1')
    expect(setNewMatchVacancyId).toHaveBeenCalledWith('')
  })

  it('picking a vacancy to create a new match calls setNewMatchVacancyId and clears matchChoice', async () => {
    const user = userEvent.setup()
    const setMatchChoice = vi.fn()
    const setNewMatchVacancyId = vi.fn()
    render(<CandidateStatusModals {...baseProps} matchPrompt setMatchChoice={setMatchChoice} setNewMatchVacancyId={setNewMatchVacancyId}
      matches={[]} vacancyOptions={[{ value: 'vac-1', label: 'Helpende', client: 'Zorggroep B' }]} />)

    await user.click(screen.getByRole('button', { name: 'drawer.placedNewPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /Helpende/ }))

    expect(setNewMatchVacancyId).toHaveBeenCalledWith('vac-1')
    expect(setMatchChoice).toHaveBeenCalledWith(null)
  })
})

describe('CandidateStatusModals · blacklist reason dropdown', () => {
  it('renders no native <select> and offers the lookup-backed reasons', async () => {
    const setStatusModal = vi.fn()
    const { container } = render(<CandidateStatusModals {...baseProps}
      statusModal={{ target: 'blacklist', reason: '', date: '', needReason: true, needDate: false, isBlacklist: true }}
      setStatusModal={setStatusModal} />)
    expect(container.querySelector('select')).toBeNull()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'drawer.blacklistReasonPick' }))
    await user.click(await screen.findByRole('button', { name: 'No-show' }))

    // setStatusModal is called with an updater function — apply it to the previous
    // state to assert the actual patched value, mirroring the component's own usage.
    expect(setStatusModal).toHaveBeenCalledTimes(1)
    const updater = setStatusModal.mock.calls[0][0] as (m: unknown) => unknown
    expect(updater({ target: 'blacklist', reason: '', date: '', needReason: true, needDate: false, isBlacklist: true }))
      .toEqual({ target: 'blacklist', reason: 'No-show', date: '', needReason: true, needDate: false, isBlacklist: true })
  })

  // BLACKLIST-ICON-1: the reasons carry the tenant lookup's own icon (S-icon-1,
  // mirrored via CreatableSelect) — a reason with an icon shows it next to its label.
  it('shows the lookup icon next to a reason that has one', async () => {
    render(<CandidateStatusModals {...baseProps}
      statusModal={{ target: 'blacklist', reason: '', date: '', needReason: true, needDate: false, isBlacklist: true }}
      setStatusModal={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'drawer.blacklistReasonPick' }))
    await screen.findByRole('button', { name: 'No-show' })
    // "Fraud" carries icon: '🚫' (emoji passthrough in LookupIcon) — "No-show" has none.
    expect(screen.getByText('🚫')).toBeInTheDocument()
  })
})
