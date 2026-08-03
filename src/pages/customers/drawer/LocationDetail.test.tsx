/**
 * LocationDetail · title-row status badge (Danny 28-07: "Status van locatie moet
 * hier!!") — status moved OUT of the Algemeen field table into a read-only
 * TitleBadge next to the location name (§3A(c)), with its own pencil → picker →
 * save/cancel cycle so changing it is still possible. Assert the onSave PATCH
 * shape (§13), never only that a callback fired.
 *
 * EditableFieldTable pulls in `@/lib/datetime`, which side-effect-imports the
 * real i18n instance — so (like AddCustomerModal.test.tsx) this file resolves
 * assertions through the ACTIVE locale's own copy instead of guessing/hardcoding
 * a language.
 */
import { useState, useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import LocationDetail from './LocationDetail'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
// ONE-CLICK-COUPLE-2: asserts the honest success/failure toasts the create-and-link
// flow fires — same mocked module the file already stubs above.
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Contact, Location } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// useCustomFields hits the API in an effect — stub it so the Extra sub-tab stays
// hidden (no custom fields defined) and no network call happens under test.
// useLocations is react-query-backed (the Vestiging block's option list) — mocked so
// this test needs no QueryClientProvider, mirroring OverviewTab.test.tsx.
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'br-1', label: 'Vestiging Noord' }] }))
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], allFields: [], loading: false, invalidate: () => {} }),
}))
// KLANTLOCATIE-GEOCODE-1: the Koppelingen sub-tab's PDOK card fires a REAL POST, so the
// client is stubbed (get too — useProvinces reads /provinces on mount) while the module's
// named helpers stay real. GeocodeButton hides itself without the permission, so useAuth
// is stubbed to grant it; hasModule stays false, exactly like the unprovided context did.
const mockPost = vi.fn()
// ONE-CLICK-COUPLE-1: `put` backs the real (unmocked) setLocationPrimaryContact —
// the new tests exercise the ACTUAL hook function, not a re-mock of it, so the
// event it dispatches on a real success is the real CONTACTS_CHANGED_EVENT too.
const mockPut = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: (...args: unknown[]) => mockPost(...args),
      put: (...args: unknown[]) => mockPut(...args),
      patch: vi.fn(), delete: vi.fn(),
    },
  }
})
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true, hasModule: () => false }),
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors EditableRichTextField.test.tsx's own convention (its pencil/save/cancel
// dance is unit-tested there; this file only needs to prove LocationDetail's wiring).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
// SCOPED-LIST-TAB-1: each own their own fetch (react-query/useMatchStatuses) —
// covered by ScopedListTab.test.tsx/useScopedEntityList.test.ts. Stubbed here so
// this file only proves LocationDetail's OWN wiring (right scope/id per sub-tab).
vi.mock('./ScopedVacanciesTab', () => ({
  default: ({ scope, id, customerId, customerName, scopeName }: { scope: string; id?: string; customerId?: string; customerName?: string; scopeName?: string }) =>
    <div data-testid="scoped-vacancies">{scope}:{id}:{customerId}:{customerName}:{scopeName}</div>,
}))
vi.mock('./ScopedMatchesTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-matches">{scope}:{id}:{customerId}</div>,
}))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ status: 202, data: {} }) })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

// Hex values here are DATA — fixture colours for a tenant lookup, not UI styling.
const statuses: LookupOption[] = [
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-active', label: 'Actief', color: '#22C55E', id: 'status-active' },
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-inactive', label: 'Inactief', color: '#9CA3AF', id: 'status-inactive' },
]

const location = (overrides: Partial<Location> = {}): Location => ({
  id: 'loc-1', helloflexLink: null, shiftmanagerLink: null, name: 'Hoofdlocatie',
  street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', state: '', country: '',
  cocNumber: '', vatNumber: '', contactName: '', phone: '', email: '', isHeadquarter: false,
  costCenter: '', billingEmail: '', address: '', description: '', departments: [], contacts: [],
  // LOCATIE-VESTIGING-1 — no own couplings, so this site inherits the customer's.
  branchIds: [], branches: [], branchInherited: true, effectiveBranches: [],
  lat: null, lng: null,
  statusId: 'status-active', status: 'active', statusLabel: 'Actief',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  statusColor: '#22C55E',
  customFields: {},
  ...overrides,
} as Location)

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', customerName: 'Zorggroep A', locations: [], departments: [], contacts: [],
  statuses, departmentStatuses: [] as LookupOption[], contactStatuses: [] as LookupOption[],
  onDelete: vi.fn(), onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(), close: vi.fn(),
}

describe('LocationDetail · title-row status badge', () => {
  it('renders the status as a read-only badge next to the name, not a field-table row', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // The badge shows the resolved label.
    expect(screen.getByText('Actief')).toBeInTheDocument()
    // The pencil to change it sits right there in the title row.
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('renders no badge (but still an edit affordance) when the location carries no status yet', () => {
    render(<LocationDetail location={location({ statusId: null, status: '', statusLabel: '', statusColor: '' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('pencil reveals a picker seeded with the current status; picking another value + save PATCHes statusId', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    // Seeded with the current value — the trigger shows "Actief" (closed dropdown, one match).
    await user.click(screen.getByRole('button', { name: 'Actief' }))
    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    await user.click(screen.getByRole('button', { name: cm('save') }))

    expect(onSave).toHaveBeenCalledWith('loc-1', { statusId: 'status-inactive' })
    // Back to read-only badge display — the local edit state must have closed.
    expect(screen.queryByRole('button', { name: cm('save') })).not.toBeInTheDocument()
  })

  it('cancel discards the draft without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    await user.click(screen.getByRole('button', { name: cm('cancel') }))

    expect(onSave).not.toHaveBeenCalled()
    // The badge is back.
    expect(screen.getByText('Actief')).toBeInTheDocument()
  })

  it('the Algemeen field table no longer has its own status row (moved to the title)', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // Only ONE "Actief" on screen — the title badge — not a second one inside a field row.
    expect(screen.getAllByText('Actief')).toHaveLength(1)
  })
})

/**
 * KLANTLOCATIE-GEOCODE-1 (backend 2026-08-01) — until today the customer LOCATION was the
 * only geocodable record without a per-record re-geocode route, so its PDOK card could
 * only read. The route now exists and the card acts, mirroring the customer's own card.
 * Assert the REQUEST (§13): a card that renders a button which POSTs the wrong URL is a
 * 404 nobody sees, which is exactly the failure this test exists to catch.
 */
const openKoppelingen = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('tab', { name: cm('backofficeLinks.tabLabel') }))

describe('LocationDetail · PDOK card in Koppelingen', () => {
  it('POSTs the per-location geocode route, addressed through its customer', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)

    await user.click(screen.getByRole('button', { name: cm('geocode.refresh') }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/geocode')
  })

  it('renders the coordinates it already has instead of "not geocoded"', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem', lat: 51.8367, lng: 4.9705 })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)
    expect(screen.getByText('51.83670, 4.97050')).toBeInTheDocument()
    expect(screen.queryByText(cm('backofficeLinks.pdok.notGeocoded'))).not.toBeInTheDocument()
  })

  it('disables the trigger and fires nothing while the site has no address worth geocoding', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: '' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)

    const btn = screen.getByRole('button', { name: cm('geocode.refresh') })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('stays honestly read-only (no trigger at all) when there is no customer to address the route through', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} customerId={undefined} />)
    await openKoppelingen(user)

    expect(screen.queryByRole('button', { name: cm('geocode.refresh') })).toBeNull()
    expect(screen.getByText(cm('backofficeLinks.pdok.readOnly'))).toBeInTheDocument()
  })

  it('never fires the geocode POST on mount — only on an explicit click', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

/**
 * CONTACT-LOCATION-PRIMARY-1 — two rounds of the same underlying complaint.
 *
 * ROUND ONE: a location used to carry only free text ("Contact ter plaatse") and the screen
 * GUESSED which contact record the typed name meant: it matched on the name, gave up when two
 * people shared one, and when it did match it could open somebody who was never meant. Danny:
 * "je typt Joost de Boer en Joost weet van niets." Fixed by resolving the real coupling
 * (customer_contact_customer_location.is_primary) instead of guessing from text.
 *
 * ROUND TWO (02-08): that fix left TWO blocks on screen — "Contact ter plaatse" (free text)
 * and "Primaire contactpersoon" (the real coupling) — which could flatly disagree: Danny typed
 * a contact when creating the location, saw it under "Contact ter plaatse", and the adjacent
 * block still said "Nog geen primaire contactpersoon" for the exact same location. "Dat is
 * fout: contact ter plaatse is aangegeven als primaire contactpersoon van deze vestiging!!"
 * Fixed by merging into ONE block (LocationContactSection): the coupling is the only thing
 * rendered as a live, linked record; legacy free text is a plain (unlinked, non-editable)
 * fallback shown only until a real contact is coupled — never both, never a claim of "none"
 * while text is sitting right there.
 */
const contactFixture = (over: Partial<Contact> = {}): Contact => ({
  id: 'con-1', helloflexLink: null, shiftmanagerLink: null, customerId: 'cust-1',
  firstName: 'Joost', middleName: 'de', lastName: 'Boer', name: 'Joost de Boer', role: 'Teamleider',
  email: 'joost@klant.test', phone: '', mobile: '', gender: '', isPrimary: false,
  locationId: 'loc-1', locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '',
  lastContactAt: null, lastContactType: null, customFields: {},
  ...over,
} as Contact)

// The per-location primary flags ride along on the row, exactly as useCustomerContacts
// attaches them (see primaryLocationIdsOf).
const primaryAt = (locationIds: string[], over: Partial<Contact> = {}): Contact =>
  ({ ...contactFixture(over), primaryLocationIds: locationIds } as Contact)

describe('LocationDetail · one contact block, one truth (round two)', () => {
  it('resolves the site\'s primary contact from the coupling flag and links to the real record, with its own email', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      contacts={[primaryAt(['loc-1'])]} />)

    const link = screen.getByRole('button', { name: 'Joost de Boer' })
    expect(link).toBeInTheDocument()
    // The coupled contact's OWN email shows here too — one full identity, not just a name.
    expect(screen.getByText('joost@klant.test')).toBeInTheDocument()
    // It opens THAT contact's own screen, on the Contactpersonen sub-tab.
    await user.click(link)
    expect(screen.getByText(ct('contacts.detail.infoTitle'))).toBeInTheDocument()
  })

  it('ignores a primary flag for a DIFFERENT site — this one then has none', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      contacts={[primaryAt(['loc-2'])]} />)

    expect(screen.getByText(ct('locations.detail.noPrimaryContact'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Joost de Boer' })).toBeNull()
  })

  it('states plainly that none is set and offers the one place that sets it', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    expect(screen.getByText(ct('locations.detail.noPrimaryContact'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ct('locations.detail.pickPrimaryContact') }))
    // Lands on the contact list of this site, where the flag is actually set.
    expect(screen.getByText(ct('contacts.col.locationPrimary'))).toBeInTheDocument()
  })

  it('no longer guesses a contact from the typed name — not even on a single exact match', () => {
    render(<LocationDetail location={location({ contactName: 'Joost de Boer' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    // The typed value is still shown — it is real data and is never dropped…
    expect(screen.getByText('Joost de Boer')).toBeInTheDocument()
    // …but it is text, not a link to a record it was only ASSUMED to mean.
    expect(screen.queryByRole('button', { name: 'Joost de Boer' })).toBeNull()
  })

  /**
   * THE REPORTED CONTRADICTION (Danny 02-08). Before this fix, "Contact ter plaatse" showed
   * the typed name/email/phone while the SEPARATE "Primaire contactpersoon" block, right next
   * to it, claimed there was none — for the exact same location. Danny: "Dat is fout: contact
   * ter plaatse is aangegeven als primaire contactpersoon van deze vestiging!!" Proven here:
   * with typed on-site text but no coupled contact, the screen must never claim "no contact",
   * and there must be only ONE contact heading, never two disagreeing ones.
   *
   * ONE-CLICK-COUPLE-2 (Danny, third escalation) updated this test's own expectation: the
   * italic "not linked" text used to be the only next step here — now the no-match dead end
   * offers the promoted create-and-link action instead (see the describe block below for the
   * full create+couple behaviour), so the warning copy is gone precisely BECAUSE the button
   * replaced it, not because the contradiction crept back in.
   */
  it('does not claim there is no contact when on-site text is filled but not yet coupled — the reported contradiction', () => {
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test', phone: '+31104811775' })}
      onSave={vi.fn()} {...baseProps} contacts={[]} />)

    expect(screen.queryByText(ct('locations.detail.noPrimaryContact'))).not.toBeInTheDocument()
    // The typed identity is still visible — never silently dropped — and honestly marked
    // as not yet linked, rather than presented as a second, competing truth.
    expect(screen.getByText('Sanne de Vries')).toBeInTheDocument()
    expect(screen.getByText('locatie1@example.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('locations.detail.createAndLink') })).toBeInTheDocument()
    expect(screen.queryByText(ct('locations.detail.contactNotLinked'))).not.toBeInTheDocument()
    // Never a second, separate "Primaire contactpersoon" heading competing with this one.
    expect(screen.queryByText(ct('locations.detail.primaryContactTitle'))).not.toBeInTheDocument()
  })

  it('no longer offers to edit the free text here — the fix is coupling a real contact, not retyping text', () => {
    const onSave = vi.fn()
    render(<LocationDetail location={location({ contactName: 'Joost de Boer' })} onSave={onSave} {...baseProps}
      contacts={[contactFixture()]} />)

    // Only the description's own pencil plus the two remaining field tables (Gegevens/Adres)
    // — none of the three belongs to the on-site contact block any more.
    expect(screen.getAllByRole('button', { name: cm('edit') })).toHaveLength(3)
    expect(onSave).not.toHaveBeenCalled()
  })
})

/**
 * ONE-CLICK-COUPLE-1 (Danny: "Die txt staat er nog steeds — is dat van primair contact
 * niet opgelost?") — in almost every real case the typed legacy text already exactly
 * matches an existing contact of this customer, so forcing a manual search on
 * Contactpersonen is a puzzle the screen created itself. Email is the ONLY match key
 * (never the name — that guess is exactly what round one of this section replaced, see
 * the docblock above): a unique email hit renders a one-click "Koppel {{name}}" button
 * that calls the SAME route the star action uses (setLocationPrimaryContact); zero or
 * more than one hit falls back to today's unchanged generic CTA.
 *
 * These tests exercise the REAL (unmocked) setLocationPrimaryContact, only stubbing the
 * underlying `api.put` — so a successful click fires the REAL CONTACTS_CHANGED_EVENT,
 * proving the section can flip into its coupled state off that real event and not just
 * off a locally re-mocked prop.
 */
describe('LocationDetail · one-click couple on a unique email match (ONE-CLICK-COUPLE-1)', () => {
  it('renders the named button on a unique email match and calls setLocationPrimaryContact with the right ids', async () => {
    const user = userEvent.setup()
    mockPut.mockResolvedValue({ data: { data: { id: 'con-1', locations: [{ id: 'loc-1', name: 'Hoofdlocatie', is_primary: true }] } } })
    render(<LocationDetail location={location({ contactName: 'Joost de Boer', email: 'joost@klant.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    const btn = screen.getByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Joost de Boer' }) })
    await user.click(btn)

    // Proves the exact ids (customer/contact/location) travelled through, not just that
    // SOME callback fired (§13) — this is the same PUT route the star action's own test asserts.
    expect(mockPut).toHaveBeenCalledWith('/customers/cust-1/contacts/con-1/locations/loc-1/primary')
  })

  it('offers only the generic CTA when neither the email nor the name matches any contact', () => {
    // Both keys must miss: the email is unknown AND the typed name is nobody's — with
    // the name-fallback (Danny 03-08) an unknown email alone no longer means "no button".
    render(<LocationDetail location={location({ contactName: 'Piet Onbekend', email: 'unknown@example.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    expect(screen.queryByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Piet Onbekend' }) })).toBeNull()
    expect(screen.getByRole('button', { name: ct('locations.detail.pickPrimaryContact') })).toBeInTheDocument()
  })

  it('falls back to a unique exact NAME match when the email misses (seeded locations carry a location mailbox)', () => {
    render(<LocationDetail location={location({ contactName: 'Joost de Boer', email: 'locatie2@example.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    // The location's mailbox matches no contact email, but exactly one contact carries
    // the typed name — the named one-click button appears.
    expect(screen.getByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Joost de Boer' }) })).toBeInTheDocument()
  })

  it('two same-named contacts mean NO button — the classic name collision stays a manual pick', () => {
    render(<LocationDetail location={location({ contactName: 'Joost de Boer', email: 'locatie2@example.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture(), contactFixture({ id: 'con-9', email: 'joost.b@klant.test' })]} />)

    expect(screen.queryByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Joost de Boer' }) })).toBeNull()
    expect(screen.getByRole('button', { name: ct('locations.detail.pickPrimaryContact') })).toBeInTheDocument()
  })

  it('offers only the generic CTA when the typed email matches more than one contact — a wrong auto-couple is worse than the friction', () => {
    render(<LocationDetail location={location({ contactName: 'Joost de Boer', email: 'joost@klant.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture(), contactFixture({ id: 'con-2', name: 'Jan Jansen' })]} />)

    expect(screen.queryByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Joost de Boer' }) })).toBeNull()
    expect(screen.getByRole('button', { name: ct('locations.detail.pickPrimaryContact') })).toBeInTheDocument()
  })

  it('flips into the coupled state after a successful one-click couple — no manual reload needed', async () => {
    const user = userEvent.setup()
    mockPut.mockResolvedValue({ data: { data: { id: 'con-1', locations: [{ id: 'loc-1', name: 'Hoofdlocatie', is_primary: true }] } } })

    // A tiny stand-in for CustomerDrawer/useCustomerContacts: it owns the `contacts` array
    // and reacts to CONTACTS_CHANGED_EVENT the same way that hook does, so the flip below
    // is proven off the REAL event the real setLocationPrimaryContact dispatches.
    function Harness() {
      const [contacts, setContacts] = useState<Contact[]>([contactFixture()])
      useEffect(() => {
        const onChanged = () => setContacts([primaryAt(['loc-1'])])
        window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)
        return () => window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
      }, [])
      return <LocationDetail location={location({ contactName: 'Joost de Boer', email: 'joost@klant.test' })} onSave={vi.fn()} {...baseProps} contacts={contacts} />
    }
    render(<Harness />)

    // With a named one-click on offer the italic warning stays hidden (one message,
    // not two — Danny 03-08); the button itself is the pre-couple state's proof.
    await user.click(screen.getByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Joost de Boer' }) }))

    // The coupled branch renders (real link + email row), and the legacy warning is gone —
    // all from props updated by the real event, never a manual re-render/reload.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Joost de Boer' })).toBeInTheDocument())
    expect(screen.queryByText(ct('locations.detail.contactNotLinked'))).not.toBeInTheDocument()
  })
})

/**
 * ONE-CLICK-COUPLE-2 (Danny, third escalation: "Waarom staat dit er nog steeds!!") — every
 * seeded location shows the fallback because the one-click couple above only fires on a
 * UNIQUE match, and most seeded/typed text matches nobody (a location mailbox email, a
 * pool-generated name). This closes THAT dead end: the no-match branch gets a second,
 * PROMOTED action that creates the missing contact from the typed text, then couples it the
 * exact same way `coupleMatch` does — one click instead of a manual detour to Contactpersonen.
 *
 * These tests exercise the REAL (unmocked) setLocationPrimaryContact — only `api.put` is
 * stubbed (`mockPut`) — so a successful click proves the real CONTACTS_CHANGED_EVENT chain,
 * same discipline as the ONE-CLICK-COUPLE-1 tests above. `onAddContact` is a per-test mock —
 * this is the container boundary LocationContactSection actually owns; the real POST body
 * that mock stands in for is covered separately by useCustomerContacts.test.ts's own `add()` tests.
 */
describe('LocationDetail · create contact and link on a no-match dead end (ONE-CLICK-COUPLE-2)', () => {
  it('(a) renders the promoted create-and-link button on a no-match dead end, with the italic warning hidden', () => {
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[]} />)

    expect(screen.getByRole('button', { name: ct('locations.detail.createAndLink') })).toBeInTheDocument()
    expect(screen.queryByText(ct('locations.detail.contactNotLinked'))).not.toBeInTheDocument()
    // The manual pick stays available too — it is now the SECONDARY way to link a
    // DIFFERENT existing person, not the only option.
    expect(screen.getByRole('button', { name: ct('locations.detail.pickPrimaryContact') })).toBeInTheDocument()
  })

  it('(b) click: calls onAddContact with the split name/email/phone, THEN PUTs the primary coupling with the returned id, in that order', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onAddContact = vi.fn(async () => { calls.push('contact'); return { id: 'con-new', name: 'Sanne de Vries' } as Contact })
    mockPut.mockImplementation(async () => {
      calls.push('couple')
      return { data: { data: { id: 'con-new', locations: [{ id: 'loc-1', name: 'Hoofdlocatie', is_primary: true }] } } }
    })
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test', phone: '+31104811775' })}
      onSave={vi.fn()} {...baseProps} contacts={[]} onAddContact={onAddContact} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.createAndLink') }))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/customers/cust-1/contacts/con-new/locations/loc-1/primary'))
    // The split name (first word -> firstName, rest -> lastName) plus the location's own
    // typed email/phone ride along — the request body, not just that a callback fired (§13).
    expect(onAddContact).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Sanne', lastName: 'de Vries', email: 'locatie1@example.test', phone: '+31104811775',
    }))
    // Order matters: the coupling PUT must never fire before the contact itself exists.
    expect(calls).toEqual(['contact', 'couple'])
    expect(notifySuccess).toHaveBeenCalledWith(ct('locations.detail.setPrimaryContactDone', { name: 'Sanne de Vries' }))
  })

  it('(c) contact-create failure: one honest toast, nothing lost, no coupling attempted', async () => {
    const user = userEvent.setup()
    const onAddContact = vi.fn().mockRejectedValue(new Error('422 required first_name'))
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test' })}
      onSave={vi.fn()} {...baseProps} contacts={[]} onAddContact={onAddContact} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.createAndLink') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(ct('locations.detail.createContactFailed')))
    expect(mockPut).not.toHaveBeenCalled()
    // The block stays on the exact same fallback render — nothing to reconcile.
    expect(screen.getByRole('button', { name: ct('locations.detail.createAndLink') })).toBeInTheDocument()
  })

  it('(c) coupling fails after a successful create: the contact stays created, one honest toast, block stays in fallback', async () => {
    const user = userEvent.setup()
    const onAddContact = vi.fn().mockResolvedValue({ id: 'con-new', name: 'Sanne de Vries' } as Contact)
    mockPut.mockRejectedValue(new Error('network'))
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test' })}
      onSave={vi.fn()} {...baseProps} contacts={[]} onAddContact={onAddContact} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.createAndLink') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(ct('locations.detail.setPrimaryContactFailed')))
    // Never rolled back: the create call happened and stays that way — the fallback UI
    // (still driven by the CALLER's own `contacts` prop, which this failure never updates)
    // simply keeps showing this same render; a real reload would find the new contact via
    // the unique-match button above once the caller's list refreshes.
    expect(onAddContact).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Sanne de Vries' })).toBeNull()
  })

  it('(d) unique-match case is unchanged: its own "Koppel {name}" button renders, not the create-and-link one', () => {
    render(<LocationDetail location={location({ contactName: 'Joost de Boer', email: 'joost@klant.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    expect(screen.getByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Joost de Boer' }) })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ct('locations.detail.createAndLink') })).toBeNull()
  })
})

/**
 * LOCATIE-OMSCHRIJVING-1 (Danny 02-08: "bij locatie en afdeling moeten we ook een
 * beschrijving hebben") — the location never had a description surface at all
 * (unlike the department, which already had EditableRichTextField). Placed FIRST
 * on the Adres & gegevens sub-tab (identity-field-adjacent, not buried) — see the
 * component's own comment for why it sits ahead of the field tables rather than after.
 */
describe('LocationDetail · description (LOCATIE-OMSCHRIJVING-1)', () => {
  it('renders the stored description as sanitised HTML', () => {
    render(<LocationDetail location={location({ description: '<p>Grootste vestiging</p>' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText('Grootste vestiging')).toBeInTheDocument()
  })

  it('shows the italic empty state when there is none yet', () => {
    render(<LocationDetail location={location({ description: '' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText(ct('richText.empty'))).toBeInTheDocument()
  })

  it('pencil → edit → save PATCHes description only, through this location\'s own id', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location({ description: '<p>Oud</p>' })} onSave={onSave} {...baseProps} />)

    // The description block's OWN pencil (Edit2, title="edit") now comes LAST in DOM
    // order — Danny 02-08 moved Omschrijving to mirror the Bedrijf tab's field-tables →
    // Contact → Omschrijving sequence, trailing the two field-table pencils (Gegevens/Adres)
    // instead of leading them (see the full-order test below).
    const pencils = screen.getAllByRole('button', { name: cm('edit') })
    await user.click(pencils[2])
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Nieuw</p>')
    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith('loc-1', { description: '<p>Nieuw</p>' })
  })
})

/**
 * LOCATIE-SECTIE-VOLGORDE-1 (Danny 02-08, same day as KOIOS-ADVICE-POSITION-1, then
 * overruled again). The customer's own Bedrijf tab (OverviewTab.tsx) renders, top to
 * bottom: field tables (Gegevens → Adres) → Contact → Bedrijfstekst → Koios advice →
 * Vestiging — OverviewTab.tsx:162 puts its description directly under Contact. The
 * location used to put Omschrijving FIRST (ahead of the field tables); Danny overruled
 * that placement the same day, so this pins the WHOLE sequence, not just Koios-vs-
 * Vestiging, so a future drift on any one block fails here.
 */
describe('LocationDetail · Adres & gegevens section order (mirrors the Bedrijf tab)', () => {
  it('renders field tables → Contact → Omschrijving → Koios advice → Vestiging, in that order', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)

    const gegevens = screen.getByText(ct('overview.details'))
    // "Adres" legitimately appears twice: the field table's own title, THEN (further
    // down, still inside that same table) the address composite row's label, which
    // reuses the exact same translation key. The table's title always renders first.
    const adres = screen.getAllByText(ct('subModal.groups.address'))[0]
    const contact = screen.getByText(ct('locations.detail.contactTitle'))
    const omschrijving = screen.getByText(ct('locations.detail.description'))
    const koios = screen.getByText(ct('ai.title'))
    const vestiging = screen.getByText(ct('locations.detail.branchTitle'))

    // DOCUMENT_POSITION_FOLLOWING on `b` relative to `a` means `a` sits first in DOM order.
    const isBefore = (a: HTMLElement, b: HTMLElement) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(isBefore(gegevens, adres)).toBe(true)
    expect(isBefore(adres, contact)).toBe(true)
    expect(isBefore(contact, omschrijving)).toBe(true)
    expect(isBefore(omschrijving, koios)).toBe(true)
    expect(isBefore(koios, vestiging)).toBe(true)
  })
})

/**
 * DRILL-PAGER-1 (Danny 02-08) — LocationDetail only RENDERS the pager the caller
 * (LocationsTab) hands it; the caller-side scoping/navigation is covered in
 * LocationsTab.test.tsx. This proves the wiring: no `pager` prop → no pager on
 * screen (today's behaviour, unaffected); a `pager` prop renders it in the title
 * row, before the delete button, and its buttons call exactly what was passed in.
 */
describe('LocationDetail · pager wiring', () => {
  it('renders no pager when the caller passes none', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByLabelText(cm('drillPager.next'))).toBeNull()
  })

  it('renders the pager before the delete button, wired to the caller\'s own handlers', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      pager={{ index: 2, total: 4, onPrev, onNext }} />)

    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 2, total: 4 }))).toBeInTheDocument()
    // The delete button carries only a `title`, no aria-label — matched the same way
    // the save/cancel buttons elsewhere in this file already are (getByTitle).
    const deleteBtn = screen.getByTitle(ct('locations.detail.deleteLocation'))
    const nextBtn = screen.getByRole('button', { name: cm('drillPager.next') })
    // The pager sits BEFORE the delete button in the same title-row corner.
    expect(nextBtn.compareDocumentPosition(deleteBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: cm('drillPager.prev') }))
    expect(onPrev).toHaveBeenCalledTimes(1)
  })
})

/** VESTIGING-HINT-1 (Danny: "Weg die txt toch?") — the inherited/deviate explainer
 *  paragraph under Vestiging was noise Danny asked removed; the state badge (Volgt de
 *  klant / Afwijkend ingesteld) already says the same thing in three words. */
describe('LocationDetail · Vestiging helper text removed', () => {
  it('no longer renders the inherited/deviate explainer paragraph under Vestiging', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText(ct('locations.detail.branchHint'))).not.toBeInTheDocument()
  })
})

/**
 * SCOPED-LIST-TAB-1 — the two new read-only sub-tabs pass this location's own
 * id + the right scope token through to the shared children (stubbed above).
 */
describe('LocationDetail · Vacatures/Matches sub-tabs', () => {
  it('wires the location scope + id into ScopedVacanciesTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.vacancies') }))
    expect(screen.getByTestId('scoped-vacancies')).toHaveTextContent('location:loc-1')
  })

  // Point 1 (Danny's ten-point round): "+ Vacature"/"+ Match" from a scoped
  // sub-tab need the customer too — this location knows it, so it passes it on
  // (ScopedVacanciesTab also needs the customer NAME, for its lock display).
  it('also threads customerId/customerName/scopeName into ScopedVacanciesTab (point 1)', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.vacancies') }))
    expect(screen.getByTestId('scoped-vacancies')).toHaveTextContent('location:loc-1:cust-1:Zorggroep A:Hoofdlocatie')
  })

  it('wires the location scope + id into ScopedMatchesTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByTestId('scoped-matches')).toHaveTextContent('location:loc-1')
  })

  // Point 1: "+ Match" needs the customer id to prefill MatchModal's cascade.
  it('also threads customerId into ScopedMatchesTab (point 1)', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByTestId('scoped-matches')).toHaveTextContent('location:loc-1:cust-1')
  })
})

/**
 * SUBENTITEIT-DELETE-1 — the honest disabled-trash (no fake affordance, §3) and
 * the shared counts dialog for a 409 RACE (the row's own `in_use` was stale).
 */
describe('LocationDetail · honest delete (SUBENTITEIT-DELETE-1)', () => {
  it('disables the trash and names the reason when the location is still in use', () => {
    render(<LocationDetail location={location({ inUse: true })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByTitle(ct('locations.deleteInUse'))).toBeDisabled()
  })

  it('keeps the trash enabled with the normal label when nothing blocks it', () => {
    render(<LocationDetail location={location({ inUse: false })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByTitle(ct('locations.detail.deleteLocation'))).not.toBeDisabled()
  })

  it('closes the panel on a real delete success', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(ct('locations.detail.deleteLocation')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))
    expect(onDelete).toHaveBeenCalledWith('loc-1')
    await waitFor(() => expect(close).toHaveBeenCalled())
  })

  it('opens the shared counts dialog on a 409 race instead of closing', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: false, blocked: { counts: { departments: 3, contacts: 1 } } })
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(ct('locations.detail.deleteLocation')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))

    // Scoped to the dialog: "Afdelingen"/"Contactpersonen" also label other tabs
    // on this same panel, so an unscoped query would match more than once.
    const dialog = await screen.findByRole('dialog', { name: ct('inUse.title') })
    expect(within(dialog).getByText(ct('drawer.tabs.departments'))).toBeInTheDocument()
    expect(within(dialog).getByText('3')).toBeInTheDocument()
    expect(within(dialog).getByText(ct('drawer.tabs.contacts'))).toBeInTheDocument()
    expect(within(dialog).getByText('1')).toBeInTheDocument()
    expect(close).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: ct('inUse.close') }))
    expect(screen.queryByRole('dialog', { name: ct('inUse.title') })).not.toBeInTheDocument()
  })
})
