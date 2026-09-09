/**
 * useCustomerTextPopout — the contact text popout's read and write on the MEASURED
 * contract (FE-BE contract audit 09-09, ENT1-05/06): CustomerContactResource emits
 * `description` (never `notes`), and CustomerContactRequest validates `description`
 * — the old `notes` read opened the window empty and the `notes` write was dropped
 * with a 200. Read and write are asserted together, on purpose.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { useContactTextLite, patchContactText } from './useCustomerTextPopout'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
import api from '@/lib/api'
const mockGet = vi.mocked(api.get)
const mockPatch = vi.mocked(api.patch)
const t = ((k: string) => k) as unknown as TFunction

describe('contact text popout · description is the contract (ENT1-05/06)', () => {
  it('reads the text from GET /contacts/{id} description', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 'ct1', name: 'Piet de Vries', description: '<p>dossier</p>' } } })
    const { result } = renderHook(() => useContactTextLite('cu1', 'ct1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGet).toHaveBeenCalledWith('/contacts/ct1', expect.anything())
    expect(result.current.contact).toMatchObject({ id: 'ct1', customerId: 'cu1', name: 'Piet de Vries', description: '<p>dossier</p>' })
  })

  it('writes the text as PATCH /customers/{cid}/contacts/{id} { description }', async () => {
    mockPatch.mockResolvedValue({ data: {} })
    const revert = vi.fn()
    await expect(patchContactText('cu1', 'ct1', '<p>nieuw</p>', t, revert)).resolves.toBe(true)
    expect(mockPatch).toHaveBeenCalledWith('/customers/cu1/contacts/ct1', { description: '<p>nieuw</p>' })
    expect(revert).not.toHaveBeenCalled()
  })

  it('reverts and reports when the write is refused', async () => {
    mockPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Te lang.' } } })
    const revert = vi.fn()
    await expect(patchContactText('cu1', 'ct1', '<p>x</p>', t, revert)).resolves.toBe(false)
    expect(revert).toHaveBeenCalledTimes(1)
  })
})
