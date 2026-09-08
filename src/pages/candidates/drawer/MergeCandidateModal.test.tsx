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
 *
 * X-37 (K-27): confirming the survivor first loads both records' custom_fields;
 * no collision → the merge fires with the plain body (or with the source's values
 * absorbed into the survivor's empty fields); a collision → step 3 with a per-field
 * choice, and the chosen map ships INSIDE the merge call as field_choices — never
 * a separate PATCH. The custom-field definitions hook is mocked flat (labels/types).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text (mirrors SectionTabs.test).
import '@/i18n'
import { notifyError } from '@/lib/notify'
import MergeCandidateModal from './MergeCandidateModal'

const { getMock, postMock, patchMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), patchMock: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: getMock, post: postMock, patch: patchMock },
  unwrap: (res: { data: unknown }) => {
    const body = res.data as { data?: unknown }
    return body && typeof body === 'object' && 'data' in body ? body.data : body
  },
  unwrapList: (res: { data: { data: unknown[] } }) => ({ rows: res.data.data, total: res.data.data.length, lastPage: 1 }),
  getActiveTenantId: () => null,
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// The tenant's custom-field definitions, flat: labels + types for the conflict step.
const DEFS = [
  { key: 'region', label: 'Regio', type: 'text', sort_order: 0, active: true, has_data: true, visible_in_ui: true },
  { key: 'vog', label: 'VOG', type: 'boolean', sort_order: 1, active: true, has_data: true, visible_in_ui: true },
  { key: 'start', label: 'Startdatum', type: 'date', sort_order: 2, active: true, has_data: true, visible_in_ui: true },
]
vi.mock('@/lib/useCustomFields', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/useCustomFields')>()),
  useCustomFields: () => ({ fields: DEFS, allFields: DEFS, loading: false, invalidate: () => {} }),
}))

const current = { id: 'aaa', name: 'Anna Huidig', code: 'K-1', email: 'anna@x.nl' }
const dupRow = { id: 'bbb', name: 'Anna Dubbel', reference_number: 'K-2', email: 'dup@x.nl' }

// Route GET by url: the capped search list, and each record's detail with the
// custom_fields map given per id (missing id → empty map, the pre-X-37 case).
function routeGet(details: Record<string, Record<string, unknown>> = {}) {
  getMock.mockImplementation((url: string) => {
    if (url === '/candidates') return Promise.resolve({ data: { data: [dupRow, { ...dupRow, id: 'aaa' }] } })
    const detail = /^\/candidates\/([^/]+)$/.exec(url)
    if (detail) return Promise.resolve({ data: { data: { id: detail[1], custom_fields: details[detail[1]] ?? {} } } })
    return Promise.resolve({ data: { data: [] } })
  })
}

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
  openPickerAndType()
  const row = await screen.findByText(/Anna Dubbel · K-2/, undefined, { timeout: 2000 })
  fireEvent.click(row)
}

describe('MergeCandidateModal', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); patchMock.mockReset(); routeGet() })

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
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); routeGet() })

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

/**
 * X-37 (K-27) — custom-field collisions. Every merge here asserts the REQUEST (§13):
 * the survivor route, the source id, and whether/what field_choices carries. A PATCH
 * is never sent — the chosen map rides inside the merge transaction.
 */
describe('MergeCandidateModal · custom-field conflicts (X-37)', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); patchMock.mockReset(); vi.mocked(notifyError).mockReset() })

  const confirm = () => fireEvent.click(screen.getByRole('button', { name: /^samenvoegen$/i }))

  it('loads both records and, without a collision, merges straight from step 2 with the plain body', async () => {
    routeGet({ aaa: { region: 'Noord' }, bbb: { region: 'Noord' } })
    postMock.mockResolvedValue({ data: {} })
    mount()
    await searchAndPick()
    confirm()
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/aaa/merge', { source_id: 'bbb' }))
    expect(getMock).toHaveBeenCalledWith('/candidates/aaa')
    expect(getMock).toHaveBeenCalledWith('/candidates/bbb')
    expect(screen.queryByRole('radiogroup', { name: /waarde voor/i })).toBeNull()
    expect(patchMock).not.toHaveBeenCalled()
  })

  it('absorbs source-only values into the survivor without a choice step', async () => {
    routeGet({ aaa: { region: '' }, bbb: { region: 'Zuid', start: '2026-09-08' } })
    postMock.mockResolvedValue({ data: {} })
    mount()
    await searchAndPick()
    confirm()
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/aaa/merge',
      { source_id: 'bbb', field_choices: { custom_fields: { region: 'Zuid', start: '2026-09-08' } } }))
    expect(screen.queryByRole('radiogroup', { name: /waarde voor/i })).toBeNull()
  })

  it('opens step 3 on a collision, preselected on the survivor, and ships the chosen values in field_choices', async () => {
    routeGet({ aaa: { region: 'Noord', vog: true, start: '2026-01-05' }, bbb: { region: 'Zuid', vog: true, start: '2026-09-08' } })
    postMock.mockResolvedValue({ data: {} })
    const onMerged = mount()
    await searchAndPick()
    confirm()
    const regionGroup = await screen.findByRole('radiogroup', { name: /waarde voor regio/i })
    // Nothing merged yet; the survivor choice is recapped read-only; identical VOG is no collision.
    expect(postMock).not.toHaveBeenCalled()
    expect(screen.getByText(/blijvend dossier: anna huidig/i)).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: /waarde voor vog/i })).toBeNull()
    expect(within(regionGroup).getByRole('radio', { name: /anna huidig/i })).toHaveAttribute('aria-checked', 'true')
    // Dates render as DD-MM-YYYY on both sides (DATUM-1), never the raw ISO value.
    const startGroup = screen.getByRole('radiogroup', { name: /waarde voor startdatum/i })
    expect(within(startGroup).getByText('05-01-2026')).toBeTruthy()
    expect(within(startGroup).getByText('08-09-2026')).toBeTruthy()
    // Take the source's region, keep the survivor's start date.
    fireEvent.click(within(regionGroup).getByRole('radio', { name: /anna dubbel/i }))
    confirm()
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/aaa/merge',
      { source_id: 'bbb', field_choices: { custom_fields: { region: 'Zuid', vog: true, start: '2026-01-05' } } }))
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(patchMock).not.toHaveBeenCalled()
    expect(onMerged).toHaveBeenCalledWith('aaa')
  })

  it('builds the map from the OTHER record when that one remains (swap case)', async () => {
    routeGet({ aaa: { region: 'Noord' }, bbb: { region: 'Zuid' } })
    postMock.mockResolvedValue({ data: {} })
    mount()
    await searchAndPick()
    fireEvent.click(screen.getByText('Anna Dubbel'))
    confirm()
    const regionGroup = await screen.findByRole('radiogroup', { name: /waarde voor regio/i })
    expect(screen.getByText(/blijvend dossier: anna dubbel/i)).toBeTruthy()
    fireEvent.click(within(regionGroup).getByRole('radio', { name: /anna huidig/i }))
    confirm()
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/bbb/merge',
      { source_id: 'aaa', field_choices: { custom_fields: { region: 'Noord' } } }))
  })

  it('"Terug" from step 3 reopens the survivor choice and drops the loaded collisions', async () => {
    routeGet({ aaa: { region: 'Noord' }, bbb: { region: 'Zuid' } })
    mount()
    await searchAndPick()
    confirm()
    await screen.findByRole('radiogroup', { name: /waarde voor regio/i })
    fireEvent.click(screen.getByRole('button', { name: /^terug$/i }))
    expect(screen.getByRole('radiogroup', { name: /dit dossier blijft/i })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: /waarde voor/i })).toBeNull()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('keeps step 2 and reports when the custom fields cannot be loaded — never a merge on unknown values', async () => {
    routeGet()
    getMock.mockImplementation((url: string) => url === '/candidates/bbb'
      ? Promise.reject(new Error('boom'))
      : Promise.resolve({ data: { data: url === '/candidates' ? [dupRow] : { id: 'aaa', custom_fields: {} } } }))
    mount()
    await searchAndPick()
    confirm()
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Eigen velden laden mislukt. Probeer het opnieuw.'))
    expect(postMock).not.toHaveBeenCalled()
    expect(screen.getByRole('radiogroup', { name: /dit dossier blijft/i })).toBeTruthy()
  })
})
