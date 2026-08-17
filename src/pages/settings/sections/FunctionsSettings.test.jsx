/**
 * FunctionsSettings — FUNC-FREEENTRY-FIX (2026-08-17): the free-entry toggle
 * reflects the API's own `allow_free_entry` flag (GET /functions) and persists
 * through the REAL dedicated `PUT /functions/free-entry` route (never the generic
 * `/settings` blob — that used to write a DIFFERENT, unread Setting row, a fake
 * affordance — see the component's own doc comment), reverts + notifies on a
 * failed/409 PUT (the strict-tightening mismatch guard).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const confirmBtnName = i18n.t('confirm', { ns: 'common' })

afterEach(() => vi.clearAllMocks())

// useCachedLookup caches /functions at module scope (one fetch per session), so
// each case needs a FRESH module graph. allowFreeEntry seeds GET /functions' own
// flag — the ONLY source of truth this component reads (no generic /settings blob).
async function renderWithFunctions(rows = [], allowFreeEntry = false) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  apiModule.default.get.mockImplementation(url => {
    if (url === '/functions') return Promise.resolve({ data: { data: rows, allow_free_entry: allowFreeEntry } })
    return Promise.resolve({ data: {} })
  })
  const { default: FunctionsSettings } = await import('./FunctionsSettings')
  render(<FunctionsSettings />)
  return apiModule.default
}

describe('FunctionsSettings — free-entry toggle (real dedicated route)', () => {
  it('reflects the API allow_free_entry:false as unchecked', async () => {
    await renderWithFunctions([], false)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('reflects the API allow_free_entry:true as checked', async () => {
    await renderWithFunctions([], true)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('turning it ON PUTs the REAL dedicated route (never the generic /settings blob)', async () => {
    const api = await renderWithFunctions([], false)
    api.put.mockResolvedValue({ data: { allow_free_entry: true } })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)
    await user.click(await screen.findByRole('button', { name: confirmBtnName }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/functions/free-entry', { allow_free_entry: true }))
    expect(api.post).not.toHaveBeenCalledWith('/settings', expect.anything())
    // Optimistic: the switch reflects the change immediately, before any refetch.
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('turning it OFF PUTs the dedicated route directly, no confirmation needed', async () => {
    const api = await renderWithFunctions([], true)
    api.put.mockResolvedValue({ data: { allow_free_entry: false } })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/functions/free-entry', { allow_free_entry: false }))
  })

  it('reverts the optimistic flip and notifies on a 409 (the strict-tightening mismatch guard)', async () => {
    const api = await renderWithFunctions([], true)
    api.put.mockRejectedValue({ response: { status: 409, data: { message: 'Niet alle bestaande waarden staan in de lijst.' } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/functions/free-entry', { allow_free_entry: false }))
    // Reverted back to checked — the server refused to tighten, so the UI never
    // shows a state the backend does not actually enforce.
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(notifyError).toHaveBeenCalledWith('Niet alle bestaande waarden staan in de lijst.')
  })
})
