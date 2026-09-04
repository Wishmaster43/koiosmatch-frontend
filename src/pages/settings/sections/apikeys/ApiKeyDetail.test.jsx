/**
 * ApiKeyDetail — K-282: "Maak primair" confirms via the shared house ConfirmDialog,
 * then PATCHes /api-keys/{id} with { type: 'primary' } (never PUT — a partial,
 * single-field promotion, distinct from the general-tab full-form save). The
 * backend auto-demotes the previous primary key, so success reloads the parent
 * list via onPatch (useApiKeys.test.js covers that reload itself) and notifies.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ApiKeyDetail from './ApiKeyDetail'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
// The house ConfirmDialog (useConfirm) renders Confirm/Cancel from 'common' top-level keys.
const ct = (key, opts) => i18n.t(key, { ns: 'common', ...opts })

const listRow = (over = {}) => ({
  id: 'k1', friendly_name: 'Backoffice key', status: 'active', organisation: 'Yesway',
  type: 'additional', guid: 'abcd1234-5678-90ab-cdef-1234567890ab',
  created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', ...over,
})

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks() })

// Click "Maak primair", then resolve the house confirm dialog it stages (never
// native window.confirm) by clicking Confirm or Cancel inside it.
const makePrimary = async (user, { accept = true } = {}) => {
  await user.click(screen.getByRole('button', { name: st('apiKeys.makePrimary') }))
  const dialog = await screen.findByRole('dialog', { name: st('apiKeys.makePrimaryConfirm') })
  await user.click(within(dialog).getByRole('button', { name: accept ? ct('confirm') : ct('cancel') }))
}

describe('ApiKeyDetail — K-282 make-primary flow', () => {
  it('PATCHes /api-keys/{id} with { type: "primary" }, updates the open detail and notifies success', async () => {
    api.get.mockResolvedValue({ data: listRow() })
    api.patch.mockResolvedValue({ data: listRow({ type: 'primary' }) })
    const { notifySuccess } = await import('@/lib/notify')
    const onPatch = vi.fn()
    const user = userEvent.setup()

    render(<ApiKeyDetail keyId="k1" listRow={listRow()} onBack={vi.fn()} onPatch={onPatch} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: st('apiKeys.makePrimary') })

    await makePrimary(user)

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api-keys/k1', { type: 'primary' }))
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('k1', expect.objectContaining({ type: 'primary' })))
    expect(notifySuccess).toHaveBeenCalledWith(st('apiKeys.makePrimarySuccess'))
    // The button disappears once the open detail itself reflects the new type.
    await waitFor(() => expect(screen.queryByRole('button', { name: st('apiKeys.makePrimary') })).not.toBeInTheDocument())
  })

  it('a failed promotion surfaces the server error via notifyError, never a silent failure', async () => {
    api.get.mockResolvedValue({ data: listRow() })
    api.patch.mockRejectedValue({ response: { status: 409, data: { message: 'Already has a primary key.' } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()

    render(<ApiKeyDetail keyId="k1" listRow={listRow()} onBack={vi.fn()} onPatch={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: st('apiKeys.makePrimary') })

    await makePrimary(user)

    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    // A failed PATCH must not silently flip the local view to primary.
    expect(screen.getByRole('button', { name: st('apiKeys.makePrimary') })).toBeInTheDocument()
  })

  it('declining the confirm dialog never sends the PATCH', async () => {
    api.get.mockResolvedValue({ data: listRow() })
    const user = userEvent.setup()

    render(<ApiKeyDetail keyId="k1" listRow={listRow()} onBack={vi.fn()} onPatch={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: st('apiKeys.makePrimary') })

    await makePrimary(user, { accept: false })

    expect(api.patch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: st('apiKeys.makePrimary') })).toBeInTheDocument()
  })

  it('a key that is already primary never shows "Maak primair"', async () => {
    api.get.mockResolvedValue({ data: listRow({ type: 'primary' }) })
    render(<ApiKeyDetail keyId="k1" listRow={listRow({ type: 'primary' })} onBack={vi.fn()} onPatch={vi.fn()} onDelete={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Backoffice key' })
    expect(screen.queryByRole('button', { name: st('apiKeys.makePrimary') })).not.toBeInTheDocument()
  })
})
