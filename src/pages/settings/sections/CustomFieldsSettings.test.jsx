/**
 * CustomFieldsSettings — regression test for the per-field visible_in_ui toggle
 * (worklist #44 "Oogje eigen veld: wel API, niet FE-zichtbaar"). Covers: the
 * toggle PATCHes the real update endpoint (method/route/body, not just a local
 * state flip), an API-only field is marked legibly in words (not icon colour
 * alone), and a failed PATCH rolls the optimistic UI back.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import CustomFieldsSettings from './CustomFieldsSettings'
import api from '@/lib/api'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

// One baseline field def, matching the generic /custom-fields shape.
const FIELD = { id: '1', key: 'plate', label_i18n: { en: 'Plate' }, type: 'text', active: true, in_use: false, visible_in_ui: true, sort_order: 0 }

describe('CustomFieldsSettings — visible_in_ui toggle (worklist #44)', () => {
  it('shows no API-only badge when visible_in_ui is true', async () => {
    mockedGet.mockResolvedValue({ data: { data: [FIELD] } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())
    expect(screen.queryByText(new RegExp(st('customFieldsSettings.apiOnly')))).not.toBeInTheDocument()
  })

  it('marks an API-only field in words, not only by icon colour', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ ...FIELD, visible_in_ui: false }] } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText(new RegExp(st('customFieldsSettings.apiOnly')))).toBeInTheDocument())
  })

  it('PATCHes visible_in_ui: false through the real update endpoint when hiding a field', async () => {
    mockedGet.mockResolvedValue({ data: { data: [FIELD] } })
    mockedPatch.mockResolvedValue({ data: { data: { ...FIELD, visible_in_ui: false } } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle(st('customFieldsSettings.hideFromUi')))

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/custom-fields/1', { visible_in_ui: false }))
  })

  it('PATCHes visible_in_ui: true through the real update endpoint when showing a field again', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ ...FIELD, visible_in_ui: false }] } })
    mockedPatch.mockResolvedValue({ data: { data: { ...FIELD, visible_in_ui: true } } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle(st('customFieldsSettings.showInUi')))

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/custom-fields/1', { visible_in_ui: true }))
  })

  it('rolls the optimistic toggle back if the PATCH fails', async () => {
    mockedGet.mockResolvedValue({ data: { data: [FIELD] } })
    mockedPatch.mockRejectedValue(new Error('network'))
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle(st('customFieldsSettings.hideFromUi')))
    await waitFor(() => expect(mockedPatch).toHaveBeenCalled())

    // Rejection reverts the local field back to visible — the badge must not persist.
    await waitFor(() => expect(screen.queryByText(new RegExp(st('customFieldsSettings.apiOnly')))).not.toBeInTheDocument())
  })

  it('leaves the active/inactive toggle independent — active stays true while API-only', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ ...FIELD, visible_in_ui: false }] } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())
    // The "active" eye toggle still reads Deactivate (field is active), distinct
    // from the visible_in_ui "Show in UI" control that reflects the hidden state.
    expect(screen.getByTitle(st('customFieldsSettings.deactivate'))).toBeInTheDocument()
    expect(screen.getByTitle(st('customFieldsSettings.showInUi'))).toBeInTheDocument()
  })
})
