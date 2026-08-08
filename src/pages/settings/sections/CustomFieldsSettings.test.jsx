/**
 * CustomFieldsSettings — regression test for the per-field visible_in_ui toggle
 * (worklist #44 "Oogje eigen veld: wel API, niet FE-zichtbaar"). Covers: the
 * toggle PATCHes the real update endpoint (method/route/body, not just a local
 * state flip), an API-only field is marked legibly in words (not icon colour
 * alone), and a failed PATCH rolls the optimistic UI back.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import CustomFieldsSettings from './CustomFieldsSettings'
import api from '@/lib/api'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
const mockedGet = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)
const mockedPost = vi.mocked(api.post)

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

// One baseline field def, matching the generic /custom-fields shape.
const FIELD = { id: '1', key: 'plate', label_i18n: { en: 'Plate' }, type: 'text', active: true, in_use: false, visible_in_ui: true, sort_order: 0 }
// A second field, used by the drag-reorder tests below to have something to swap with.
const FIELD_2 = { id: '2', key: 'color', label_i18n: { en: 'Color' }, type: 'text', active: true, in_use: false, visible_in_ui: true, sort_order: 1 }

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

// Type-selector lock (2026-08): a field that already has data must not let its type
// change — no safe text<->number conversion for stored values. This now runs through
// SearchSelect's own `disabled` prop instead of a hand-rolled onClick guard.
describe('CustomFieldsSettings — type selector locks once a field has data', () => {
  // The expand/collapse chevron is the last button in the row (active + visible-in-ui
  // toggles come first) — it carries no title/name of its own, so it's targeted
  // positionally within the row scoped by the field's own label text.
  const expandCard = () => {
    const row = screen.getByText('Plate').parentElement.parentElement
    const buttons = within(row).getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1])
  }

  it('renders the type trigger as a real disabled control when has_data is true, and it does not open', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ ...FIELD, in_use: true }] } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())
    expandCard()

    const typeTrigger = screen.getByRole('button', { name: st('customFieldsSettings.types.text') })
    expect(typeTrigger).toBeDisabled()

    // Clicking a natively disabled trigger must not open the dropdown.
    fireEvent.click(typeTrigger)
    expect(screen.queryByText(st('customFieldsSettings.types.number'))).not.toBeInTheDocument()
  })

  it('leaves the type trigger enabled and openable when the field has no data', async () => {
    mockedGet.mockResolvedValue({ data: { data: [FIELD] } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())
    expandCard()

    const typeTrigger = screen.getByRole('button', { name: st('customFieldsSettings.types.text') })
    expect(typeTrigger).not.toBeDisabled()

    fireEvent.click(typeTrigger)
    expect(screen.getByText(st('customFieldsSettings.types.number'))).toBeInTheDocument()
  })
})

// K11 (CF-ORDER-1): drag-reorder mirrors the Contractvorm (contract-forms) lookup
// editor's DragList exactly — same DnD idiom (native HTML5 drag events via the
// shared DragList), same visual affordance (grip handle, drag-over highlight).
// The body shape ({ ids: [...] }) is verified against CustomFieldController::reorder
// (koiosmatch-api, routes/api/tenant/core-lookups.php). §13: assert the REQUEST,
// and that a failed POST reverts the optimistic order instead of silently "succeeding"
// — mirrors CandidateLookupsSettings' "reverts the order and notifies" test for the
// same shared DragList.
describe('CustomFieldsSettings — drag-reorder (K11)', () => {
  it('POSTs the reordered ids to /custom-fields/reorder when a row is dropped', async () => {
    mockedGet.mockResolvedValue({ data: { data: [FIELD, FIELD_2] } })
    mockedPost.mockResolvedValue({ data: { reordered: 2 } })
    const { container } = render(<CustomFieldsSettings entityType="vacancy" />)

    await waitFor(() => expect(screen.getByText('Color')).toBeInTheDocument())
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(2)

    // Drag row 0 (Plate) onto row 1 (Color) to swap their order.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])
    fireEvent.dragEnd(rows[0])

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/custom-fields/reorder', { ids: ['2', '1'] }))
  })

  it('reverts the order and notifies when the reorder POST fails', async () => {
    mockedGet.mockResolvedValue({ data: { data: [FIELD, FIELD_2] } })
    mockedPost.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const { container } = render(<CustomFieldsSettings entityType="vacancy" />)

    await waitFor(() => expect(screen.getByText('Color')).toBeInTheDocument())
    const rows = container.querySelectorAll('[draggable="true"]')

    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])
    fireEvent.dragEnd(rows[0])

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/custom-fields/reorder', { ids: ['2', '1'] }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))

    // Reverted: Plate is back in its original (first) position.
    const labels = Array.from(container.querySelectorAll('[draggable="true"]')).map(r => r.textContent)
    expect(labels[0]).toContain('Plate')
  })
})
