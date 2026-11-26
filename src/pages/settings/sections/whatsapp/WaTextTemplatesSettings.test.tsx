/**
 * WaTextTemplatesSettings: rows, the exact PUT/DELETE requests (adapter calls), permission
 * gating, and the error/empty states. Copy is read through the real i18n instance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { languageDisplayName } from '@/lib/languageNames'
import { whatsappTextTemplatesKey } from '@/components/whatsappWeb/useWhatsappTextTemplates'
import WaTextTemplatesSettings from './WaTextTemplatesSettings'

const tt = (k: string) => i18n.t(`settings:waTextTemplates.${k}`)
const row = { id: 'a1', name: 'Welcome', body: 'Hi {{first_name}}', language: 'nl', is_active: true }

let hook: Record<string, unknown>
let canEdit = true
const update = vi.fn().mockResolvedValue({})
const del = vi.fn().mockResolvedValue(undefined)
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => canEdit }) }))
vi.mock('@/components/whatsappWeb/useWhatsappTextTemplates', () => ({
  useWhatsappTextTemplates: () => hook,
  whatsappTextTemplatesKey: (t: string | null) => ['wtt', t],
}))
const notifyError = vi.fn()
vi.mock('@/lib/notify', () => ({ notifyError: (m: string) => notifyError(m), notifySuccess: vi.fn() }))
vi.mock('@/components/whatsappWeb/whatsappTextTemplatesApi', () => ({
  createWhatsappTextTemplate: vi.fn(),
  updateWhatsappTextTemplate: (...a: unknown[]) => update(...a),
  deleteWhatsappTextTemplate: (...a: unknown[]) => del(...a),
}))

const qc = new QueryClient()
const setup = () => render(<QueryClientProvider client={qc}><WaTextTemplatesSettings /></QueryClientProvider>)

describe('WaTextTemplatesSettings', () => {
  beforeEach(() => {
    canEdit = true; update.mockReset().mockResolvedValue({}); del.mockClear(); notifyError.mockClear()
    hook = { templates: [row], placeholders: ['first_name'], isLoading: false, isError: false, refetch: vi.fn(), tenantId: 't1' }
  })

  it('renders name, language chip and active switch', () => {
    setup()
    expect(screen.getByText(languageDisplayName('nl', i18n.language))).toBeTruthy()
    expect(screen.getByText('Welcome')).toBeTruthy()
    expect(screen.getByRole('switch', { name: `${tt('toggleActive')}: Welcome` }).getAttribute('aria-checked')).toBe('true')
  })

  it('PUTs the row with is_active flipped', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries')
    setup()
    await userEvent.click(screen.getByRole('switch'))
    expect(update).toHaveBeenCalledWith('a1', { name: 'Welcome', body: 'Hi {{first_name}}', language: 'nl', is_active: false })
    expect(spy).toHaveBeenCalledWith({ queryKey: whatsappTextTemplatesKey('t1') })
  })

  it('toasts the save error when the PUT fails', async () => {
    update.mockRejectedValueOnce(new Error('x'))
    setup()
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(tt('saveError')))
  })

  it('toasts the name-taken sentence on a 422 carrying errors.name, never the server text', async () => {
    update.mockRejectedValueOnce({ response: { status: 422, data: { message: 'The name has already been taken.', errors: { name: ['The name has already been taken.'] } } } })
    setup()
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(tt('nameTaken')))
  })

  it('deletes only after the confirm', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: `${tt('delete')}: Welcome` }))
    expect(del).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: tt('delete') }))
    expect(del).toHaveBeenCalledWith('a1')
  })

  it('opens the modal from the add button', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: tt('add') }))
    expect(await screen.findByRole('dialog', { name: tt('createTitle') })).toBeTruthy()
  })

  it('renders no edit affordances without settings.update', () => {
    canEdit = false
    setup()
    expect(screen.queryByRole('button', { name: `${tt('edit')}: Welcome` })).toBeNull()
    expect(screen.queryByRole('button', { name: `${tt('delete')}: Welcome` })).toBeNull()
    expect(screen.queryByRole('button', { name: tt('add') })).toBeNull()
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the load error and the empty sentence', () => {
    hook = { ...hook, templates: [], isError: true }
    const { unmount } = setup()
    expect(screen.getByText(tt('loadError'))).toBeTruthy()
    unmount()
    hook = { ...hook, isError: false }
    setup()
    expect(screen.getByText(tt('empty'))).toBeTruthy()
  })
})
