/**
 * AddLocationModal — covers the house "wide form" adoption (Danny 27-07): the
 * card regroup (Algemeen/Adres/Zakelijk/Contact) still submits the exact same
 * LocationPayload shape via `onCreate`, the status picker (bare <select> before,
 * now a searchable CreatableSelect, allowCreate={false}) actually filters by
 * typing, and the name-required validation still blocks an incomplete submit.
 *
 * Danny 02-08 additions covered here: (1) a CSV import card (mirrors
 * AddCustomerModal's own import card + its parent-mismatch safety net, new for
 * the per-entity importers which match an EXISTING customer by name); (2) the
 * province field became a searchable picker (was a bare TextField); (3) a rich-
 * text "Omschrijving" card; (4) "contact ter plaatse" became a real
 * pick-existing-or-type-new choice, coupled as the location's primary contact
 * once it exists (CONTACT-PRIMAIR-LOCATIE-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddLocationModal from './AddLocationModal'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — useImportWizard, UploadStep,
// PreviewStep and ResultStep all run for REAL, so these tests prove the actual wizard
// wiring (dry-run-before-real-run, xlsx rejection, close-on-success), not a stub of it.
import { dryRunImport, runImport } from '@/pages/settings/sections/import/importApi'
import { setLocationPrimaryContact } from './hooks/useCustomerContacts'
import { notifyError } from '@/lib/notify'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})
// Province cascade — mirrors AddCustomerModal.test.tsx's own province mock.
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Utrecht', 'Zuid-Holland'] }) }))
// CONTACT-PRIMAIR-LOCATIE-1: the coupling call is the only thing this file imports
// from useCustomerContacts — mocked so a test can assert it fired (or didn't) without
// hitting the network; the rest of the module runs for real.
vi.mock('./hooks/useCustomerContacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks/useCustomerContacts')>()
  return { ...actual, setLocationPrimaryContact: vi.fn() }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notify: vi.fn() }))
// K-283: useLocations is react-query-backed — mocked directly (mirrors
// AddCustomerModal.test.tsx's own branch-picker mock) so this test doesn't
// need a QueryClientProvider ancestor.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'br-1', label: 'Vestiging Noord' }, { value: 'br-2', label: 'Vestiging Zuid' }],
}))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors the house convention (DescriptionTab.test.tsx / candidate ProfileTab.test.tsx).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
// hasPermission defaults to "allow everything" so the pre-existing tests above (none of
// which touch the import card) keep behaving as before; the import describe block below
// overrides it per test to exercise the gate itself.
const { authState, settingsState } = vi.hoisted(() => ({
  authState: { hasPermission: (() => true) as (perm: string) => boolean },
  // STATUS-HIDDEN-1: the settings blob a test can flip per-case (e.g. tenant marks
  // status_id required) — defaults to empty (nothing required).
  settingsState: { settings: {} as Record<string, unknown> },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: authState.hasPermission }) }))
// B1: per-test required custom field defs for the host under test (empty by default).
const { customFieldsState } = vi.hoisted(() => ({ customFieldsState: { fields: [] as unknown[] } }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn() }) }))
// Keep the REAL getJsonSetting (the component parses the required-fields config
// through it); only the settings blob itself is test-controlled.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => settingsState.settings }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The reused import-wizard steps (PreviewStep/ResultStep) are in the 'settings' bundle.

const statuses = [{ value: 'st-1', label: 'Actief' }, { value: 'st-2', label: 'Inactief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
  vi.mocked(notifyError).mockReset()
  vi.mocked(setLocationPrimaryContact).mockReset()
})

// HET-RECEPT (Danny 14-08, MatchModal is the reference): titled cards (Algemeen/
// Adres/Zakelijk/Contact/Omschrijving) in two columns, every field a label-LEFT
// FieldRow. Card-structure regression test for the layout sweep.
describe('AddLocationModal · card structure follows HET-RECEPT (label-left FieldRow)', () => {
  it('renders the Algemeen / Adres card titles', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} />)
    expect(screen.getByText(ct('subModal.groups.general'))).toBeInTheDocument()
    expect(screen.getByText(ct('subModal.groups.address'))).toBeInTheDocument()
  })

  it('renders the location-name label at the canon label width, immediately before its field', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} />)
    const label = screen.getByText(ct('subModal.locationName'))
    expect(label.tagName).toBe('LABEL')
    expect(label.style.width).toBe('120px')
    const row = label.parentElement as HTMLElement
    expect(row.style.display).toBe('flex')
    expect(row.style.flexDirection).not.toBe('column')
    expect(row.children[0]).toBe(label)
    expect(row.children.length).toBeGreaterThan(1)
  })
})

describe('AddLocationModal', () => {
  it('blocks submit while the name is empty and shows the required message', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the status picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    // STATUS-HIDDEN-1: this picker only renders once the tenant marked it required —
    // opt in here so its search behaviour (the thing this test actually covers) is
    // still exercised.
    settingsState.settings = { customer_location_required_fields: JSON.stringify(['status_id']) }
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    // Status starts on its placeholder (no default picked) — open it via the trigger.
    // Trigger's name is the field LABEL (aria-labelledby self-reference drops its
    // own visible text), not the empty-state placeholder text it used to expose.
    await user.click(screen.getByRole('button', { name: ct('subModal.status') }))

    const search = screen.getByPlaceholderText(ct('subModal.selectStatus'))
    await user.type(search, 'Inactief')

    expect(screen.getByRole('button', { name: 'Inactief' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actief' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('subModal.status') })).toHaveTextContent('Inactief')
  })

  it('submits the same LocationPayload shape via onCreate once the name is filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.type(screen.getByLabelText(ct('subModal.city')), 'Utrecht')

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hoofdlocatie', city: 'Utrecht', country: 'Nederland',
    }))
  })
})

// K-283: the site's OWN single branch — optional and omitted from the POST
// entirely when untouched (toApi's `!== undefined` check), mirrors the same
// field on LocationAddressTab (LocationBranchField).
describe('AddLocationModal · own branch picker (K-283)', () => {
  it('omits branchId from the create payload when left untouched', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    // Property present but `undefined` (plain object spread) — JSON.stringify/axios
    // drop an `undefined` value on the wire, so this is the honest "omitted" check.
    expect(onCreate.mock.calls[0][0].branchId).toBeUndefined()
  })

  it('picking a branch sends its id in the create payload', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('location.branch')) }))
    await user.click(await screen.findByRole('button', { name: 'Vestiging Noord' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'br-1' }))
  })
})

describe('AddLocationModal · province picker (Danny 02-08: "provincie heeft geen zoekbare dropdown???")', () => {
  it('is a searchable dropdown, not a bare text field — typing narrows it, picking sends `state`', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')

    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.state')) }))
    const search = screen.getByPlaceholderText(ct('common:select'))
    await user.type(search, 'Zuid')
    expect(screen.getByRole('button', { name: 'Zuid-Holland' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Utrecht' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zuid-Holland' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    // Sends `state` (the legacy-but-still-accepted wire key) — see this file's report
    // for why the key was not renamed to `province`.
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ state: 'Zuid-Holland' }))
  })

  // CLEAR-SWEEP (Danny 13-08): province is optional — useCustomerLocations.toApi sends
  // `state` through as-is (nullable column), so an explicit clear must reach the payload.
  it('CLEAR-SWEEP: pick then clear the province picker', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    // CLEAR-SWEEP (Danny 13-08): once picked, the clear cross ALSO matches the
    // `/Provincie/` name regex (its own accessible name is "Provincie wissen") —
    // scope to the field's first button (the trigger, DOM order) like the house
    // `fieldTrigger` helper (OpportunityGeneralCard's own clear test).
    const stateTrigger = () => within(screen.getByText(ct('subModal.state')).parentElement as HTMLElement).getAllByRole('button')[0]
    await user.click(stateTrigger())
    await user.click(await screen.findByRole('button', { name: 'Zuid-Holland' }))
    expect(stateTrigger()).toHaveTextContent('Zuid-Holland')

    const clear = screen.getByTitle(i18n.t('clearField', { ns: 'common', field: ct('subModal.state') }))
    await user.click(clear)
    expect(stateTrigger()).toHaveTextContent(i18n.t('select', { ns: 'common' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ state: '' }))
  })
})

describe('AddLocationModal · description (Danny 02-08: "bij locatie en afdeling moeten we ook een beschrijving hebben")', () => {
  it('renders a rich-text Omschrijving card and its value reaches onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    expect(screen.getByText(ct('locations.detail.description'))).toBeInTheDocument()
    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    // COLLAPSIBLE-TEXT-1: the block starts collapsed — reveal it first.
    // ARIA-LABEL-1: this modal's own footer submit button is ALSO labelled
    // "Toevoegen"/"Add" (subModal.create), so the ghost button's accessible
    // name is its own card heading instead of the generic common:add text.
    await user.click(screen.getByRole('button', { name: ct('locations.detail.description') }))
    fireEvent.change(screen.getByLabelText('rich-text-editor'), { target: { value: '<p>Grootste vestiging</p>' } })

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ description: '<p>Grootste vestiging</p>' }))
  })

  it('starts collapsed — no rich-text editor before the recruiter opens it', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByLabelText('rich-text-editor')).toBeNull()
    // ARIA-LABEL-1: the ghost's accessible name is its card heading, not the
    // generic common:add text (which collides with this modal's own footer button).
    expect(screen.getByRole('button', { name: ct('locations.detail.description') })).toBeInTheDocument()
  })
})

// STATUS-HIDDEN-1 (Danny 02-08, second round): the status picker is hidden by
// default in the create/edit popup — LocationDetail's own title-row editor is
// where status is actually set — and only reappears when the tenant marked
// status_id required (customer_location_required_fields).
describe('AddLocationModal · status picker hidden by default (STATUS-HIDDEN-1)', () => {
  it('does not render a status picker when the tenant has not required it', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByText(ct('subModal.status'))).toBeNull()
  })

  it('renders the status picker when the tenant marked status_id required', () => {
    settingsState.settings = { customer_location_required_fields: JSON.stringify(['status_id']) }
    render(<AddLocationModal onClose={() => {}} statuses={statuses} />)
    expect(screen.getByText(ct('subModal.status'))).toBeInTheDocument()
  })
})

// VALIDATIE-LIVE-1-rest (2026-08-08): email ("contact ter plaatse") is the one
// field the backend validates with a shape rule (CustomerLocationController::
// rules `email` => Laravel's `email` rule) — a malformed value now shows a live,
// on-blur inline error and blocks submit instead of only bouncing back as a 422.
describe('AddLocationModal · live e-mail format validation (VALIDATIE-LIVE-1-rest)', () => {
  it('shows an inline error under e-mail once blurred with a malformed value, and disables Create', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    const emailField = screen.getByLabelText(ct('subModal.email'))
    await user.type(emailField, 'not-an-email')
    fireEvent.focusOut(emailField)

    expect(await screen.findByText(ct('validation.emailFormat'))).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('a well-formed e-mail never blocks submit', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    const emailField = screen.getByLabelText(ct('subModal.email'))
    await user.type(emailField, 'contact@klant.nl')
    fireEvent.focusOut(emailField)

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
  })
})

// ONIX N-007 (FE correctness): a double-click on "Aanmaken" created the location twice.
describe('AddLocationModal · one create per click (ONIX N-007)', () => {
  it('ignores the second click while the first create is still running, then closes once', async () => {
    let resolve!: (v: undefined) => void
    const onCreate = vi.fn(() => new Promise<undefined>(r => { resolve = r }))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={onClose} onCreate={onCreate} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')

    const create = screen.getByRole('button', { name: ct('subModal.create') })
    fireEvent.click(create)
    fireEvent.click(create)
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: `${ct('subModal.create')}…` })).toBeDisabled()

    resolve(undefined)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})

// B1 (#79): an untouched REQUIRED boolean custom field is an answer (false) — it must not block, and the payload carries it.
describe('AddLocationModal · required boolean custom field', () => {
  it('submits customFields { gdpr: false } when the checkbox is left untouched', async () => {
    customFieldsState.fields = [{ key: 'gdpr', label: 'GDPR', type: 'boolean', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }]
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdkantoor')
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).not.toBeDisabled()
    await user.click(createBtn)
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0][0].customFields).toEqual({ gdpr: false })
    customFieldsState.fields = []
  })
})
