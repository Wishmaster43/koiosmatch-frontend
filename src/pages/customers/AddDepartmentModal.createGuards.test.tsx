/** AddDepartmentModal · single create per click and required custom fields (split from AddDepartmentModal.test.tsx; mocks duplicated because hoisted vi.mock blocks cannot be shared). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddDepartmentModal from './AddDepartmentModal'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — the real wizard/steps run,
// so these tests prove the actual wiring (dry-run-before-real-run, xlsx rejection,
// close-on-success, parent-mismatch), not a stub of it (mirrors AddLocationModal.test.tsx).
import { dryRunImport, runImport } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors the house convention (AddLocationModal.test.tsx / MatchModal.test.tsx).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
// hasPermission defaults to "allow everything" so the tests in this file (none of which
// touch the import card) keep behaving as before; the import describe block in
// AddDepartmentModal.import.test.tsx overrides it per test to exercise the gate itself.
const { authState, settingsState } = vi.hoisted(() => ({
  authState: { hasPermission: (() => true) as (perm: string) => boolean },
  // STATUS-HIDDEN-1: the settings blob a test can flip per-case (e.g. tenant marks
  // status_id required) — defaults to empty (nothing required).
  settingsState: { settings: {} as Record<string, unknown> },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: authState.hasPermission }) }))
// Keep the REAL getJsonSetting (the component parses the required-fields config
// through it); only the settings blob itself is test-controlled.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => settingsState.settings }
})
// ONIX N-005: one required def ('vog') for the describe block at the bottom of
// this file — every other describe block above renders no field for it (fields: []).
const { customFieldsState } = vi.hoisted(() => ({ customFieldsState: { fields: [] as unknown[] } }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn() }) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  customFieldsState.fields = []
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

// ONIX N-007 (FE correctness): a double-click on "Aanmaken" created the department twice.
describe('AddDepartmentModal · one create per click (ONIX N-007)', () => {
  it('ignores the second click while the first create is still running, then closes once', async () => {
    let resolve!: () => void
    const onCreate = vi.fn(() => new Promise<void>(r => { resolve = r }))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={onClose} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')

    const create = screen.getByRole('button', { name: ct('subModal.create') })
    fireEvent.click(create)
    fireEvent.click(create)
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    // The footer shows the busy face and refuses further clicks until the request settles.
    expect(screen.getByRole('button', { name: `${ct('subModal.create')}…` })).toBeDisabled()

    resolve()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})

// ONIX N-005: the department create form renders + submits the tenant's REQUIRED custom fields.
describe('AddDepartmentModal · required custom fields (ONIX N-005)', () => {
  it('renders the required def, blocks submit while empty, and submits the typed value', async () => {
    customFieldsState.fields = [{ key: 'vog', label: 'VOG', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }]
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')

    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    // The required custom field is empty — submit stays blocked even though name+location are filled.
    expect(createBtn).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'VOG' }), 'VOG-12345')
    expect(createBtn).not.toBeDisabled()
    await user.click(createBtn)
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0][0].customFields).toEqual({ vog: 'VOG-12345' })
  })

  // POLISH-ARCHIVE-GUARD-CUSTOMFIELDS: a 422 on the dotted custom_fields key shows
  // the SERVER's own message under the field, not only the generic required sentence.
  it('shows the server 422 message under the required custom field', async () => {
    customFieldsState.fields = [{ key: 'vog', label: 'VOG', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }]
    const onCreate = vi.fn().mockRejectedValue({
      response: { data: { errors: { 'custom_fields.vog': ['Only digits'] } } },
    })
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')
    await user.type(screen.getByRole('textbox', { name: 'VOG' }), 'VOG-12345')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Only digits')).toBeInTheDocument()
  })
})

// B1 (#79): an untouched REQUIRED boolean custom field is an answer (false) — it must not block, and the payload carries it.
describe('AddDepartmentModal · required boolean custom field', () => {
  it('submits customFields { gdpr: false } when the checkbox is left untouched', async () => {
    customFieldsState.fields = [{ key: 'gdpr', label: 'GDPR', type: 'boolean', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }]
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).not.toBeDisabled()
    await user.click(createBtn)
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0][0].customFields).toEqual({ gdpr: false })
    customFieldsState.fields = []
  })
})
