/** AddLocationModal · on-site contact picker and create-and-couple (split from AddLocationModal.test.tsx; resolves copy through the active locale's own i18n). */
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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddLocationModal from './AddLocationModal'
import type { Location, Contact } from '@/types/customer'
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
const contact = (overrides: Partial<Contact>): Contact => ({
  id: 'c-1', helloflexLink: null, shiftmanagerLink: null, firstName: 'Joost', middleName: '', lastName: 'de Boer', name: 'Joost de Boer',
  customerId: 'cust-1', gender: '', role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  lastContactAt: null, lastContactType: null,
  ...overrides,
})

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
  vi.mocked(notifyError).mockReset()
  vi.mocked(setLocationPrimaryContact).mockReset()
})

describe('AddLocationModal · contact ter plaatse (Danny: "je typt Joost de Boer in en Joost weet er niets van")', () => {
  const existingContacts = [contact({ id: 'c-1', name: 'Joost de Boer' }), contact({ id: 'c-2', name: 'Marieke Jansen' })]

  it('picking an existing contact couples it as primary once the location is created', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    vi.mocked(setLocationPrimaryContact).mockResolvedValue(true)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    await user.click(await screen.findByRole('button', { name: 'Joost de Boer' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // The free-text column still carries the resolved name (unchanged column)…
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ contactName: 'Joost de Boer' })))
    // …AND the real coupling fires against the just-created location's id.
    await waitFor(() => expect(setLocationPrimaryContact).toHaveBeenCalledWith('cust-1', 'c-1', 'loc-99'))
  })

  it('shows "name — function" for an existing contact that has one (CONTACT-LABEL-1)', async () => {
    const withRole = [contact({ id: 'c-3', name: 'Sanne Bakker', role: 'Teamleider' })]
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} statuses={statuses} existingContacts={withRole} />)

    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    expect(await screen.findByRole('button', { name: 'Sanne Bakker — Teamleider' })).toBeInTheDocument()
  })

  it('reports a failed coupling honestly instead of pretending it worked — the location stays created', async () => {
    const onClose = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    vi.mocked(setLocationPrimaryContact).mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<AddLocationModal onClose={onClose} onCreate={onCreate} customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    await user.click(await screen.findByRole('button', { name: 'Joost de Boer' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // The location was created and the modal still closes — a coupling failure never
    // rolls back a location that may already hold other data (see this file's report).
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    // But the failure is surfaced, never silently swallowed as a bare success.
    expect(notifyError).toHaveBeenCalledWith(ct('subModal.contactCouplingFailed', { name: 'Hoofdlocatie' }))
  })
})

// CONTACT-PRIMAIR-LOCATIE-2: the last gap — typing a NEW name (matching no existing
// contact) used to only write the location's free-text column, never a real record.
describe('AddLocationModal · typing a brand-new contact now creates + couples it (CONTACT-PRIMAIR-LOCATIE-2)', () => {
  const existingContacts = [contact({ id: 'c-1', name: 'Joost de Boer' })]

  it('the request order: location, THEN the new contact, THEN the primary coupling — with the split name and carried-over email/phone', async () => {
    // Each mock records its own call into `calls` so the ORDER (not just the fact
    // each fired) is asserted — a contact must never be coupled before either the
    // location or itself exists.
    const calls: string[] = []
    const onCreate = vi.fn(async (v: unknown) => { calls.push('location'); return { id: 'loc-99', name: 'Hoofdlocatie', ...(v as object) } as unknown as Location })
    const onAddContact = vi.fn(async (v: unknown) => { calls.push('contact'); return contact({ id: 'c-new', name: 'Piet Nieuwkomer', ...(v as object) }) })
    vi.mocked(setLocationPrimaryContact).mockImplementation(async () => { calls.push('couple'); return true })
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} onAddContact={onAddContact}
      customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    const search = screen.getByPlaceholderText(ct('subModal.contactName'))
    await user.type(search, 'Piet Nieuwkomer')
    await user.click(screen.getByRole('button', { name: /Piet Nieuwkomer/ }))
    await user.type(screen.getByLabelText(ct('subModal.email')), 'piet@klant.nl')
    await user.type(screen.getByLabelText(ct('subModal.phone')), '0612345678')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // The free-text column on the location still carries the resolved name (legacy fallback, unchanged).
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ contactName: 'Piet Nieuwkomer' })))
    // The new contact record: first word -> firstName, rest -> lastName, email/phone ride along.
    expect(onAddContact).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Piet', lastName: 'Nieuwkomer', email: 'piet@klant.nl', phone: '0612345678',
    }))
    // The coupling fires against the just-created location AND the just-created contact's real id.
    expect(setLocationPrimaryContact).toHaveBeenCalledWith('cust-1', 'c-new', 'loc-99')
    // Order matters: the contact cannot be coupled before either the location or itself exists.
    expect(calls).toEqual(['location', 'contact', 'couple'])
  })

  it('a lone single word goes wholly into lastName (never a fabricated firstName)', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    const onAddContact = vi.fn().mockResolvedValue(contact({ id: 'c-new', name: 'Receptie' }))
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} onAddContact={onAddContact}
      customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    const search = screen.getByPlaceholderText(ct('subModal.contactName'))
    await user.type(search, 'Receptie')
    await user.click(screen.getByRole('button', { name: /Receptie/ }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    await waitFor(() => expect(onAddContact).toHaveBeenCalledWith(expect.objectContaining({ firstName: '', lastName: 'Receptie' })))
  })

  it('picking an existing contact never re-attempts a create (pick-existing path stays untouched)', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    const onAddContact = vi.fn()
    vi.mocked(setLocationPrimaryContact).mockResolvedValue(true)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} onAddContact={onAddContact}
      customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    await user.click(await screen.findByRole('button', { name: 'Joost de Boer' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    await waitFor(() => expect(setLocationPrimaryContact).toHaveBeenCalledWith('cust-1', 'c-1', 'loc-99'))
    expect(onAddContact).not.toHaveBeenCalled()
  })

  it('contact-create failure: the location AND its free text stay, one honest toast, no coupling attempted', async () => {
    const onClose = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    const onAddContact = vi.fn().mockRejectedValue(new Error('422 required first_name'))
    const user = userEvent.setup()
    render(<AddLocationModal onClose={onClose} onCreate={onCreate} onAddContact={onAddContact}
      customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    const search = screen.getByPlaceholderText(ct('subModal.contactName'))
    await user.type(search, 'Piet Nieuwkomer')
    await user.click(screen.getByRole('button', { name: /Piet Nieuwkomer/ }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // The location was created (and the free-text column sent) regardless of what follows.
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ contactName: 'Piet Nieuwkomer' })))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(notifyError).toHaveBeenCalledWith(ct('subModal.contactCreateFailed', { name: 'Hoofdlocatie' }))
    expect(setLocationPrimaryContact).not.toHaveBeenCalled()
  })

  it('contact created but the coupling PUT fails: the contact stays created, one honest toast', async () => {
    const onClose = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    const onAddContact = vi.fn().mockResolvedValue(contact({ id: 'c-new', name: 'Piet Nieuwkomer' }))
    vi.mocked(setLocationPrimaryContact).mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<AddLocationModal onClose={onClose} onCreate={onCreate} onAddContact={onAddContact}
      customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    const search = screen.getByPlaceholderText(ct('subModal.contactName'))
    await user.type(search, 'Piet Nieuwkomer')
    await user.click(screen.getByRole('button', { name: /Piet Nieuwkomer/ }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    await waitFor(() => expect(onAddContact).toHaveBeenCalled())
    await waitFor(() => expect(setLocationPrimaryContact).toHaveBeenCalledWith('cust-1', 'c-new', 'loc-99'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(notifyError).toHaveBeenCalledWith(ct('subModal.contactCouplingFailed', { name: 'Hoofdlocatie' }))
  })

  it('no onAddContact wired at all: a typed-new name never throws, location still creates (graceful degradation)', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate}
      customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    const search = screen.getByPlaceholderText(ct('subModal.contactName'))
    await user.type(search, 'Piet Nieuwkomer')
    await user.click(screen.getByRole('button', { name: /Piet Nieuwkomer/ }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(setLocationPrimaryContact).not.toHaveBeenCalled()
    expect(notifyError).not.toHaveBeenCalled()
  })
})
