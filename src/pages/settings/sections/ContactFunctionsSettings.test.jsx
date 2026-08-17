/**
 * ContactFunctionsSettings — FUNCTIONS-SPLIT-1 (Danny 2026-07-20). Covers the
 * backend lookup not being deployed on every tenant yet (a 404 renders a calm
 * notice with NO live Add button, §3 no fake affordances) and the normal CRUD
 * editor render (§13).
 *
 * FUNC-FREEENTRY-FIX (2026-08-17): the free-entry toggle reflects the API's own
 * `allow_free_entry` flag (GET /contact-functions) and persists through the REAL
 * dedicated `PUT /contact-functions/free-entry` route — never the generic
 * `/settings` blob (that used to write a DIFFERENT, unread Setting row, a fake
 * affordance — see the component's own doc comment).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ContactFunctionsSettings from './ContactFunctionsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
const confirmBtnName = i18n.t('confirm', { ns: 'common' })

afterEach(() => vi.clearAllMocks())

describe('ContactFunctionsSettings', () => {
  it('GETs /contact-functions on mount with no params', async () => {
    api.get.mockResolvedValue({ data: [] })
    render(<ContactFunctionsSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/contact-functions', undefined))
  })

  it('shows a calm notice (no live Add button) when the endpoint 404s', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } })
    render(<ContactFunctionsSettings />)
    await screen.findByText(st('contactFunctionsSettings.notAvailable'))
    expect(screen.queryByRole('button', { name: st('contactFunctionsSettings.add') })).not.toBeInTheDocument()
  })

  it('renders the full editor with items when the endpoint responds normally', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'f1', name: 'Locatiemanager' }] })
    render(<ContactFunctionsSettings />)
    await screen.findByText('Locatiemanager')
    expect(screen.getByRole('button', { name: st('contactFunctionsSettings.add') })).toBeInTheDocument()
  })
})

// useCachedLookup caches /contact-functions at module scope (one fetch per
// session), so each case needs a FRESH module graph.
async function renderWithContactFunctions(rows = [], allowFreeEntry = true) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  apiModule.default.get.mockImplementation(url => {
    if (url === '/contact-functions') return Promise.resolve({ data: { data: rows, allow_free_entry: allowFreeEntry } })
    return Promise.resolve({ data: {} })
  })
  const { default: FreshContactFunctionsSettings } = await import('./ContactFunctionsSettings')
  render(<FreshContactFunctionsSettings />)
  return apiModule.default
}

describe('ContactFunctionsSettings — free-entry toggle (real dedicated route)', () => {
  it('reflects the API allow_free_entry:false as unchecked', async () => {
    await renderWithContactFunctions([], false)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('reflects the API allow_free_entry:true as checked (the backend default for this lookup)', async () => {
    await renderWithContactFunctions([], true)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('turning it ON PUTs the REAL dedicated route (never the generic /settings blob)', async () => {
    const apiMod = await renderWithContactFunctions([], false)
    apiMod.put.mockResolvedValue({ data: { allow_free_entry: true } })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)
    await user.click(await screen.findByRole('button', { name: confirmBtnName }))

    await waitFor(() => expect(apiMod.put).toHaveBeenCalledWith('/contact-functions/free-entry', { allow_free_entry: true }))
    expect(apiMod.post).not.toHaveBeenCalledWith('/settings', expect.anything())
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('turning it OFF PUTs the dedicated route directly, no confirmation needed', async () => {
    const apiMod = await renderWithContactFunctions([], true)
    apiMod.put.mockResolvedValue({ data: { allow_free_entry: false } })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    await waitFor(() => expect(apiMod.put).toHaveBeenCalledWith('/contact-functions/free-entry', { allow_free_entry: false }))
  })

  it('reverts the optimistic flip and notifies on a 409 (the strict-tightening mismatch guard)', async () => {
    const apiMod = await renderWithContactFunctions([], true)
    apiMod.put.mockRejectedValue({ response: { status: 409, data: { message: 'Niet alle bestaande waarden staan in de lijst.' } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    await waitFor(() => expect(apiMod.put).toHaveBeenCalledWith('/contact-functions/free-entry', { allow_free_entry: false }))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(notifyError).toHaveBeenCalledWith('Niet alle bestaande waarden staan in de lijst.')
  })
})
