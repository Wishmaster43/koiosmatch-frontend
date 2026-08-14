/**
 * ApplicationSourcesSettings — S-SOURCE-1 GRADUATION (2026-08-14). Covers: the
 * free-entry toggle reflects the API's own `allow_free_entry` flag and persists
 * through the REAL dedicated `PUT /candidate-sources/free-entry` route (never the
 * generic `/settings` blob — see the component's own doc comment for why that
 * would be a fake affordance), reverts + notifies on a failed/409 PUT (the
 * strict-tightening mismatch guard), and every StatusListEditor action (create,
 * rename, reorder, delete, in-use protection) sends its real request against the
 * real `/candidate-sources` lookup.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
const confirmBtnName = i18n.t('confirm', { ns: 'common' })

afterEach(() => vi.clearAllMocks())

// useCachedLookup caches /candidate-sources at module scope (one fetch per
// session), so each case needs a FRESH module graph — otherwise a later test
// would just see an earlier test's cached response (mirrors FunctionsSettings.
// test.jsx's own reset). allowFreeEntry seeds GET /candidate-sources' own flag —
// the ONLY source of truth this component reads (no generic /settings blob).
async function renderWithSources(sourceRows = [], allowFreeEntry = false) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  apiModule.default.get.mockImplementation(url => {
    if (url === '/candidate-sources') return Promise.resolve({ data: { data: sourceRows, allow_free_entry: allowFreeEntry } })
    return Promise.resolve({ data: {} })
  })
  const { default: ApplicationSourcesSettings } = await import('./ApplicationSourcesSettings')
  render(<ApplicationSourcesSettings />)
  return apiModule.default
}

describe('ApplicationSourcesSettings — free-entry toggle (real dedicated route)', () => {
  it('reflects the API allow_free_entry:false as unchecked', async () => {
    await renderWithSources([], false)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('reflects the API allow_free_entry:true as checked', async () => {
    await renderWithSources([], true)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('turning it ON PUTs the REAL dedicated route (never the generic /settings blob)', async () => {
    const api = await renderWithSources([], false)
    api.put.mockResolvedValue({ data: { allow_free_entry: true } })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)
    await user.click(await screen.findByRole('button', { name: confirmBtnName }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-sources/free-entry', { allow_free_entry: true }))
    expect(api.post).not.toHaveBeenCalledWith('/settings', expect.anything())
    // Optimistic: the switch reflects the change immediately, before any refetch.
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('turning it OFF PUTs the dedicated route directly, no confirmation needed', async () => {
    const api = await renderWithSources([], true)
    api.put.mockResolvedValue({ data: { allow_free_entry: false } })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-sources/free-entry', { allow_free_entry: false }))
  })

  it('reverts the optimistic flip and notifies on a 409 (the strict-tightening mismatch guard)', async () => {
    const api = await renderWithSources([], true)
    api.put.mockRejectedValue({ response: { status: 409, data: { message: 'Niet alle bestaande waarden staan in de lijst.' } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-sources/free-entry', { allow_free_entry: false }))
    // Reverted back to checked — the server refused to tighten, so the UI never
    // shows a state the backend does not actually enforce.
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(notifyError).toHaveBeenCalledWith('Niet alle bestaande waarden staan in de lijst.')
  })
})

describe('ApplicationSourcesSettings — wired to the REAL /candidate-sources lookup', () => {
  it('GETs /candidate-sources on mount with no params', async () => {
    const api = await renderWithSources()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidate-sources', undefined))
  })

  it('creating a new source POSTs it to /candidate-sources', async () => {
    const api = await renderWithSources()
    api.post.mockResolvedValue({ data: { id: 's1', name: 'Indeed' } })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: st('applicationSourcesSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Indeed')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/candidate-sources', expect.objectContaining({ name: 'Indeed' })))
  })

  it('renaming an existing source PUTs the change to /candidate-sources/{id}', async () => {
    const api = await renderWithSources([{ id: 's1', name: 'Indeed' }])
    api.put.mockResolvedValue({ data: {} })
    await screen.findByText('Indeed')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    const nameInput = screen.getByDisplayValue('Indeed')
    await user.clear(nameInput)
    await user.type(nameInput, 'Indeed.com')
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-sources/s1', expect.objectContaining({ name: 'Indeed.com' })))
  })

  it('reordering the list persists on drop via PUT /candidate-sources/reorder', async () => {
    const api = await renderWithSources([{ id: 's1', name: 'Indeed' }, { id: 's2', name: 'LinkedIn' }])
    api.put.mockResolvedValue({ data: {} })
    await screen.findByText('LinkedIn')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')

    fireEvent.dragStart(rowOf('LinkedIn'))
    fireEvent.dragOver(rowOf('Indeed'))
    fireEvent.drop(rowOf('Indeed'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-sources/reorder', { ids: ['s2', 's1'] }))
  })

  it('deletes a source that is not in use via DELETE /candidate-sources/{id}', async () => {
    const api = await renderWithSources([{ id: 's1', name: 'Indeed', in_use: false }])
    api.delete.mockResolvedValue({})
    await screen.findByText('Indeed')
    const user = userEvent.setup()

    const editBtn = screen.getByRole('button', { name: st('statusList.edit') })
    await user.click(editBtn.nextElementSibling)
    await user.click(await screen.findByRole('button', { name: confirmBtnName }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/candidate-sources/s1'))
  })

  it('never lets an IN-USE source be deleted — the delete button is disabled, no request ever fires', async () => {
    const api = await renderWithSources([{ id: 's1', name: 'Indeed', in_use: true }])
    await screen.findByText('Indeed')

    const deleteBtn = screen.getByTitle(st('statusList.inUse'))
    expect(deleteBtn).toBeDisabled()
    fireEvent.click(deleteBtn)
    expect(api.delete).not.toHaveBeenCalled()
  })
})
