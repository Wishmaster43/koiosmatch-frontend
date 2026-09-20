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
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

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
    const row = screen.getByText('Plate').parentElement!.parentElement!
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

// WORKLIST row 17 (Danny 13-09): the label/key example placeholders follow the
// currently chosen type, in both the create form and an existing field's edit form —
// switching type swaps the examples immediately without touching the typed value.
describe('CustomFieldsSettings — per-type example placeholders (row 17)', () => {
  it('swaps the create-form label/key placeholders when the type toggle changes', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    fireEvent.click(screen.getByText(st('customFieldsSettings.add')))
    // Default type is 'text' — its examples show first.
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.text.label'))).toBeInTheDocument()
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.text.key'))).toBeInTheDocument()

    // Switch to 'date' — the examples swap, the options placeholder stays absent.
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.types.text') }))
    fireEvent.click(screen.getByText(st('customFieldsSettings.types.date')))
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.date.label'))).toBeInTheDocument()
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.date.key'))).toBeInTheDocument()

    // Switch to 'select' — its examples show, and the options placeholder appears too.
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.types.date') }))
    fireEvent.click(screen.getByText(st('customFieldsSettings.types.select')))
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.select.label'))).toBeInTheDocument()
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.select.key'))).toBeInTheDocument()
    expect(screen.getByPlaceholderText(st('customFieldsSettings.optionsPlaceholder'))).toBeInTheDocument()
  })

  it('swaps the edit-form label placeholder when an existing field\'s type is changed', async () => {
    mockedGet.mockResolvedValue({ data: { data: [FIELD] } })
    render(<CustomFieldsSettings entityType="vacancy" />)
    await waitFor(() => expect(screen.getByText('Plate')).toBeInTheDocument())

    // Expand the field's edit form (chevron is the last button in the row).
    const row = screen.getByText('Plate').parentElement!.parentElement!
    const buttons = within(row).getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1])
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.text.label'))).toBeInTheDocument()

    // Switch the type to 'number' — the label placeholder follows it.
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.types.text') }))
    fireEvent.click(screen.getByText(st('customFieldsSettings.types.number')))
    expect(screen.getByPlaceholderText(st('customFieldsSettings.examples.number.label'))).toBeInTheDocument()
  })
})

// B-36: options field validation — options REQUIRED for select, PROHIBITED for others.
describe('CustomFieldsSettings — B-36 options field validation', () => {
  it('POSTs a select field with options key in the body', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    mockedPost.mockResolvedValue({ data: { data: { id: 'new-id', key: 'pref', label_i18n: { en: 'Preference' }, type: 'select', options: ['A', 'B'], active: true, in_use: false, visible_in_ui: true, sort_order: 0 } } })
    render(<CustomFieldsSettings entityType="vacancy" />)

    // Wait for load to finish (empty list)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    // Open add-field form
    fireEvent.click(screen.getByText(st('customFieldsSettings.add')))

    // Fill the form: label, type=select, options
    fireEvent.change(screen.getByPlaceholderText(st('customFieldsSettings.examples.text.label')), { target: { value: 'Preference' } })
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.types.text') }))
    fireEvent.click(screen.getByText(st('customFieldsSettings.types.select')))

    // Options field now appears — fill it
    await waitFor(() => expect(screen.getByPlaceholderText(st('customFieldsSettings.optionsPlaceholder'))).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(st('customFieldsSettings.optionsPlaceholder')), { target: { value: 'A, B' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.add') }))

    // Assert the POST body: options key PRESENT for select type.
    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/custom-fields', expect.objectContaining({
      type: 'select',
      options: ['A', 'B'],
    })))
  })

  it('POSTs a text field WITHOUT options key in the body', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    mockedPost.mockResolvedValue({ data: { data: { id: 'new-id', key: 'name', label_i18n: { en: 'Name' }, type: 'text', active: true, in_use: false, visible_in_ui: true, sort_order: 0 } } })
    render(<CustomFieldsSettings entityType="vacancy" />)

    // Wait for load to finish (empty list)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    // Open add-field form
    fireEvent.click(screen.getByText(st('customFieldsSettings.add')))

    // Fill the form: label, type=text (default)
    fireEvent.change(screen.getByPlaceholderText(st('customFieldsSettings.examples.text.label')), { target: { value: 'Name' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.add') }))

    // Assert the POST body: options key NOT PRESENT for non-select type.
    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/custom-fields', expect.not.objectContaining({
      options: expect.anything(),
    })))
  })

  it('shows an error and refuses to save a select field with zero options', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    render(<CustomFieldsSettings entityType="vacancy" />)

    // Wait for load to finish (empty list)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    // Open add-field form
    fireEvent.click(screen.getByText(st('customFieldsSettings.add')))

    // Fill the form: label, type=select, leave options empty
    fireEvent.change(screen.getByPlaceholderText(st('customFieldsSettings.examples.text.label')), { target: { value: 'Preference' } })
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.types.text') }))
    fireEvent.click(screen.getByText(st('customFieldsSettings.types.select')))

    // Options field appears — leave it empty (default)
    await waitFor(() => expect(screen.getByPlaceholderText(st('customFieldsSettings.optionsPlaceholder'))).toBeInTheDocument())

    // Submit without options
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.add') }))

    // Assert: the error message appears, POST not called.
    await waitFor(() => expect(screen.getByText(st('customFieldsSettings.optionsRequired'))).toBeInTheDocument())
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('PATCHes a select field with options key in the body', async () => {
    const selectField = { id: '1', key: 'pref', label_i18n: { en: 'Preference' }, type: 'select', options: ['A'], active: true, in_use: false, visible_in_ui: true, sort_order: 0 }
    mockedGet.mockResolvedValue({ data: { data: [selectField] } })
    mockedPatch.mockResolvedValue({ data: { data: { ...selectField, options: ['A', 'B', 'C'] } } })
    render(<CustomFieldsSettings entityType="vacancy" />)

    await waitFor(() => expect(screen.getByText('Preference')).toBeInTheDocument())

    // Expand the field
    const row = screen.getByText('Preference').parentElement!.parentElement!
    const buttons = within(row).getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]) // Expand

    // Edit options
    fireEvent.change(screen.getByDisplayValue('A'), { target: { value: 'A, B, C' } })

    // Save
    fireEvent.click(screen.getByRole('button', { name: st('common.save') }))

    // Assert the PATCH body: options key PRESENT for select type.
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/custom-fields/1', expect.objectContaining({
      options: ['A', 'B', 'C'],
    })))
  })

  it('PATCHes a text field WITHOUT options key in the body', async () => {
    const textField = { id: '1', key: 'name', label_i18n: { en: 'Name' }, type: 'text', active: true, in_use: false, visible_in_ui: true, sort_order: 0 }
    mockedGet.mockResolvedValue({ data: { data: [textField] } })
    mockedPatch.mockResolvedValue({ data: { data: textField } })
    render(<CustomFieldsSettings entityType="vacancy" />)

    await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument())

    // Expand the field
    const row = screen.getByText('Name').parentElement!.parentElement!
    const buttons = within(row).getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]) // Expand

    // Edit label
    fireEvent.change(screen.getByDisplayValue('Name'), { target: { value: 'Full Name' } })

    // Save
    fireEvent.click(screen.getByRole('button', { name: st('common.save') }))

    // Assert the PATCH body: options key NOT PRESENT for non-select type.
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/custom-fields/1', expect.not.objectContaining({
      options: expect.anything(),
    })))
  })
})

// A rejected create/save must never fail silently (§13) — the admin sees a notice,
// the same statusList.saveFailed key the reorder failure already uses in this file.
describe('CustomFieldsSettings — create/save failure notifies (§13)', () => {
  it('notifies when the create POST fails', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    mockedPost.mockRejectedValue(new Error('server down'))
    const { notifyError } = await import('@/lib/notify')
    render(<CustomFieldsSettings entityType="vacancy" />)

    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    fireEvent.click(screen.getByText(st('customFieldsSettings.add')))
    fireEvent.change(screen.getByPlaceholderText(st('customFieldsSettings.examples.text.label')), { target: { value: 'Name' } })
    fireEvent.click(screen.getByRole('button', { name: st('customFieldsSettings.add') }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalled())
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
  })

  it('notifies when the save PATCH fails', async () => {
    const textField = { id: '1', key: 'name', label_i18n: { en: 'Name' }, type: 'text', active: true, in_use: false, visible_in_ui: true, sort_order: 0 }
    mockedGet.mockResolvedValue({ data: { data: [textField] } })
    mockedPatch.mockRejectedValue(new Error('server down'))
    const { notifyError } = await import('@/lib/notify')
    render(<CustomFieldsSettings entityType="vacancy" />)

    await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument())
    const row = screen.getByText('Name').parentElement!.parentElement!
    const buttons = within(row).getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]) // Expand
    fireEvent.change(screen.getByDisplayValue('Name'), { target: { value: 'Full Name' } })
    fireEvent.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(mockedPatch).toHaveBeenCalled())
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
  })
})
