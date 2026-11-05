/**
 * AddDepartmentModal — covers the house "wide form" adoption (Danny 27-07): the
 * card regroup (Algemeen/Zakelijk/Omschrijving) still submits the exact same
 * DepartmentPayload shape via `onCreate`, the location picker (bare <select>
 * before, now a searchable CreatableSelect, allowCreate={false}) actually filters
 * by typing, and the name/location-required validation still blocks an
 * incomplete submit.
 *
 * Danny 02-08 addition covered here: a CSV import card (mirrors AddLocationModal's
 * own — same shared wizard/card, same parent-mismatch safety net, entity="departments"),
 * the Omschrijving field becoming the shared collapsed-ghost block (COLLAPSIBLE-TEXT-1),
 * and the status picker hiding by default (STATUS-HIDDEN-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
// ONIX N-005: one required def ('vog') for the required-custom-field describe in
// AddDepartmentModal.createGuards.test.tsx; every describe in this file renders no field for it (fields: []).
const { customFieldsState } = vi.hoisted(() => ({ customFieldsState: { fields: [] as unknown[] } }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn() }) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The location trigger's accessible name is now its field LABEL (aria-labelledby
// self-reference drops the button's own visible text), not the selected value —
// the label doubles as the picker's placeholder (same i18n key). The required
// asterisk is the shared form-kit mark and aria-hidden (5a2b6cb1) — legitimate
// only once the control itself carries `aria-required` (REQUIRED-A11Y-1),
// which reaches the trigger because CreatableSelect now forwards the prop
// (REQUIRED-A11Y-2) — see the assertion at the bottom of the describe block below.
const locationTriggerName = () => ct('subModal.selectLocation')

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  customFieldsState.fields = []
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

// HET-RECEPT (Danny 14-08, MatchModal is the reference): this is the small
// popup exception (may stay narrower/single-column) but still follows the
// label-LEFT FieldRow rule for every field. Card-structure regression test.
describe('AddDepartmentModal · card structure follows HET-RECEPT (label-left FieldRow)', () => {
  it('renders the Algemeen card title', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} />)
    expect(screen.getByText(ct('subModal.groups.general'))).toBeInTheDocument()
  })

  it('renders the department-name label at the canon label width, immediately before its field', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} />)
    const label = screen.getByText(ct('subModal.departmentName'))
    expect(label.tagName).toBe('LABEL')
    expect(label.style.width).toBe('120px')
    const row = label.parentElement as HTMLElement
    expect(row.style.display).toBe('flex')
    expect(row.style.flexDirection).not.toBe('column')
    expect(row.children[0]).toBe(label)
    expect(row.children.length).toBeGreaterThan(1)
  })
})

describe('AddDepartmentModal', () => {
  it('blocks submit while the name is empty', async () => {
    const onCreate = vi.fn()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // A location is pre-selected (locations[0]) once locations exist, but the
    // required name is still blank — submit stays disabled.
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('blocks submit and flags both fields when created with no locations available', async () => {
    const onCreate = vi.fn()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={[]} statuses={statuses} />)

    // No locations: the picker renders the "create a location first" notice instead.
    expect(screen.getByText(ct('subModal.noLocationsFirst'))).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the location picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // Location defaults to the first entry (locations[0]), but the trigger's name
    // is the field label now — find it by that, not the selected value.
    await user.click(screen.getByRole('button', { name: locationTriggerName() }))

    const search = screen.getByPlaceholderText(ct('subModal.selectLocation'))
    await user.type(search, 'Zuid')

    // Filtering to "Zuid" narrows the OPTION list to the one match — the trigger's
    // own name never included "Locatie Noord" to begin with, so absence is a clean check.
    expect(screen.getByRole('button', { name: 'Locatie Zuid' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Noord' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: locationTriggerName() })).toHaveTextContent('Locatie Zuid')
  })

  it('submits the same DepartmentPayload shape via onCreate once required fields are filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')

    // Switch the pre-selected location to prove the field still lands in the
    // payload after becoming a CreatableSelect.
    await user.click(screen.getByRole('button', { name: locationTriggerName() }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Thuiszorg', locationId: 'loc-2',
    }))
  })

  it('hides the location picker and skips its validation when lockLocationId is set', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} lockLocationId="loc-1" />)

    expect(screen.queryByText(ct('subModal.selectLocation'))).not.toBeInTheDocument()

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Thuiszorg', locationId: 'loc-1' }))
  })

  // REQUIRED-A11Y-1 + REQUIRED-A11Y-2: the required asterisk next to "Kies locatie"
  // is aria-hidden (5a2b6cb1), so aria-required on the trigger itself is the ONLY
  // signal that reaches assistive tech — CreatableSelect now forwards it onto its
  // `<button>` trigger, closing the gap the earlier `.todo` tracked.
  it('the location trigger exposes aria-required="true"', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} />)
    expect(screen.getByRole('button', { name: locationTriggerName() })).toHaveAttribute('aria-required', 'true')
  })
})

// COLLAPSIBLE-TEXT-1 (Danny 02-08, second round): Omschrijving gets the exact same
// collapsed-ghost affordance as +Match's Opmerkingen — always present, near-zero
// height until clicked, never auto-opens (mirrors AddLocationModal's own pass).
describe('AddDepartmentModal · description (COLLAPSIBLE-TEXT-1)', () => {
  it('starts collapsed — no rich-text editor before the recruiter opens it', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} />)
    expect(screen.queryByLabelText('rich-text-editor')).toBeNull()
    // ARIA-LABEL-1: this modal's own footer submit button is ALSO labelled
    // "Toevoegen"/"Add" (subModal.create), so the ghost button's accessible
    // name is its own card heading instead of the generic common:add text.
    expect(screen.getByRole('button', { name: ct('departments.detail.description') })).toBeInTheDocument()
  })

  it('reveals the shared RichTextEditor on click and its value reaches onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')
    await user.click(screen.getByRole('button', { name: ct('departments.detail.description') }))
    fireEvent.change(screen.getByLabelText('rich-text-editor'), { target: { value: '<p>Grootste afdeling</p>' } })
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ description: '<p>Grootste afdeling</p>' }))
  })
})

// STATUS-HIDDEN-1 (Danny 02-08, second round): the status picker is hidden by
// default in the create popup — DepartmentDetail's own title-row editor is where
// status is actually set — and only reappears when the tenant marked status_id
// required (customer_department_required_fields).
describe('AddDepartmentModal · status picker hidden by default (STATUS-HIDDEN-1)', () => {
  it('does not render a status picker when the tenant has not required it', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} />)
    expect(screen.queryByText(ct('subModal.status'))).toBeNull()
  })

  it('renders the status picker when the tenant marked status_id required', () => {
    settingsState.settings = { customer_department_required_fields: JSON.stringify(['status_id']) }
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} />)
    expect(screen.getByText(ct('subModal.status'))).toBeInTheDocument()
  })
})
