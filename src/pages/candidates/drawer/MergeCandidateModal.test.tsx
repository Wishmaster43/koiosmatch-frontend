/**
 * MergeCandidateModal — behaviour: pick the duplicate → survivor choice →
 * POST /candidates/{survivor}/merge with the OTHER id as source; onMerged gets
 * the survivor id. The swap case (other record remains) is the regression that
 * matters: survivor/source must invert together.
 *
 * MERGE-PICKER-1 (Danny 08-08 punt 20 "zoekbare dropdown hebben die leesbaar
 * is"): step 1 is now the shared SearchSelect in server-search mode instead of a
 * hand-rolled input + result list, so the interaction that reaches the SAME
 * request assertions is open-dropdown → type → click option. The added block at
 * the bottom guards the punt itself: it IS a dropdown, it IS searchable, it is
 * never a native <select>, and it never offers a free-text value.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text (mirrors SectionTabs.test).
import '@/i18n'
import MergeCandidateModal from './MergeCandidateModal'

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: getMock, post: postMock },
  unwrapList: (res: { data: { data: unknown[] } }) => ({ rows: res.data.data, total: res.data.data.length, lastPage: 1 }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const current = { id: 'aaa', name: 'Anna Huidig', code: 'K-1', email: 'anna@x.nl' }
const dupRow = { id: 'bbb', name: 'Anna Dubbel', reference_number: 'K-2', email: 'dup@x.nl' }

function mount(onMerged = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MergeCandidateModal current={current} onClose={vi.fn()} onMerged={onMerged} />
    </QueryClientProvider>
  )
  return onMerged
}

// Open the dropdown and type — SearchSelect debounces the term up to the modal,
// which fetches the capped candidate list.
function openPickerAndType(term = 'anna') {
  fireEvent.click(screen.getByRole('button', { name: /zoek op naam/i }))
  fireEvent.change(screen.getByPlaceholderText(/zoeken/i), { target: { value: term } })
}

// Full step 1: open, search, pick the duplicate row.
async function searchAndPick() {
  getMock.mockResolvedValue({ data: { data: [dupRow, { ...dupRow, id: 'aaa' }] } })
  openPickerAndType()
  const row = await screen.findByText(/Anna Dubbel · K-2/, undefined, { timeout: 2000 })
  fireEvent.click(row)
}

describe('MergeCandidateModal', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset() })

  it('excludes the open candidate from search results and shows survivor cards after picking', async () => {
    mount()
    await searchAndPick()
    // the open candidate (id aaa) came back from the API but must not be listed twice
    expect(screen.getByText('Anna Huidig')).toBeTruthy()
    expect(screen.getByText(/dit dossier blijft/i)).toBeTruthy()
  })

  it('merges INTO the open candidate by default (survivor=current, source=other)', async () => {
    postMock.mockResolvedValue({ data: {} })
    const onMerged = mount()
    await searchAndPick()
    fireEvent.click(screen.getByRole('button', { name: /^samenvoegen$/i }))
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/aaa/merge', { source_id: 'bbb' }))
    expect(onMerged).toHaveBeenCalledWith('aaa')
  })

  it('swaps survivor and source when the other record is chosen to remain', async () => {
    postMock.mockResolvedValue({ data: {} })
    const onMerged = mount()
    await searchAndPick()
    // click the OTHER card to make it the survivor
    fireEvent.click(screen.getByText('Anna Dubbel'))
    fireEvent.click(screen.getByRole('button', { name: /^samenvoegen$/i }))
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/bbb/merge', { source_id: 'aaa' }))
    expect(onMerged).toHaveBeenCalledWith('bbb')
  })

  it('keeps the modal open and reports the error on a failed merge', async () => {
    postMock.mockRejectedValue({ response: { status: 500 } })
    const onMerged = mount()
    await searchAndPick()
    fireEvent.click(screen.getByRole('button', { name: /^samenvoegen$/i }))
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(onMerged).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

/**
 * MERGE-PICKER-1 — the punt-20 guard: the duplicate picker must be a real
 * searchable dropdown (house component, never a native <select>), it must search
 * SERVER-side (§8: never pull the whole candidate table into the client) and it
 * must never accept a typed value — a candidate is a relational id.
 */
describe('MergeCandidateModal · duplicate picker (punt 20)', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset() })

  it('is a dropdown, never a native <select>', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MergeCandidateModal current={current} onClose={vi.fn()} onMerged={vi.fn()} />
      </QueryClientProvider>
    )
    expect(container.querySelector('select')).toBeNull()
    const trigger = screen.getByRole('button', { name: /zoek op naam/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('opens a searchable list and queries the SERVER with the typed term (capped page)', async () => {
    getMock.mockResolvedValue({ data: { data: [dupRow] } })
    mount()
    openPickerAndType('anna')
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/candidates',
      expect.objectContaining({ params: expect.objectContaining({ search: 'anna', per_page: 8 }) })), { timeout: 2000 })
  })

  it('shows the candidate NUMBER and e-mail in the option, so lookalikes are tellable apart', async () => {
    getMock.mockResolvedValue({ data: { data: [dupRow] } })
    mount()
    openPickerAndType()
    const row = await screen.findByText(/Anna Dubbel · K-2 · dup@x.nl/, undefined, { timeout: 2000 })
    expect(row).toBeTruthy()
  })

  it('never fires a request below the minimum term length', async () => {
    mount()
    openPickerAndType('a')
    // Wait past SearchSelect's own 250ms debounce inside act(), so the state update
    // it schedules is flushed before the assertion (no act() warning).
    await act(async () => { await new Promise(r => setTimeout(r, 400)) })
    expect(getMock).not.toHaveBeenCalled()
  })

  it('offers no create/free-text row — a candidate is a relational id', async () => {
    getMock.mockResolvedValue({ data: { data: [] } })
    mount()
    openPickerAndType('zzzz')
    await waitFor(() => expect(getMock).toHaveBeenCalled(), { timeout: 2000 })
    expect(screen.queryByText(/“zzzz”/)).toBeNull()
  })

  it('Escape closes the dropdown first and returns focus to the trigger; a second Escape closes the modal', () => {
    const onClose = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MergeCandidateModal current={current} onClose={onClose} onMerged={vi.fn()} />
      </QueryClientProvider>
    )
    const trigger = screen.getByRole('button', { name: /zoek op naam/i })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByPlaceholderText(/zoeken/i), { key: 'Escape' })
    // The MENU closed — the modal did not (the innermost open thing wins Escape).
    expect(screen.queryByPlaceholderText(/zoeken/i)).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    // Focus is back inside the dialog, so the modal's own focus trap can still hear keys.
    expect(document.activeElement).toBe(trigger)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('reports a failed search instead of pretending there are no duplicates', async () => {
    getMock.mockRejectedValue(new Error('boom'))
    mount()
    openPickerAndType()
    expect(await screen.findByText(/merge\.errSearch|zoeken mislukt/i, undefined, { timeout: 2000 })).toBeTruthy()
  })
})
