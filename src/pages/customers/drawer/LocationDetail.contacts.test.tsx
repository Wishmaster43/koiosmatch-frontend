/** LocationDetail · primary contact block and couple flows (split from LocationDetail.test.tsx; resolves copy through the active locale's own i18n). */
import { useState, useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import LocationDetail from './LocationDetail'
import { statuses, location } from './LocationDetail.testKit'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
import type { Contact } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// useCustomFields hits the API in an effect — stub it so the Extra sub-tab stays
// hidden (no custom fields defined) and no network call happens under test.
// useLocations is react-query-backed (the Vestiging block's option list) — mocked away.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'br-1', label: 'Vestiging Noord' }, { value: 'br-2', label: 'Vestiging Zuid' }],
}))
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
// TAKEN-OP-LOCATIE-1: same stub convention as DepartmentDetail.test.tsx — this
// file only proves LocationDetail's OWN wiring (right linkType/id), not the
// shared tab's own fetch/columns (covered elsewhere).
vi.mock('@/components/drawer/tabs/EntityTasksTab', () => ({
  default: ({ linkType, id }: { linkType: string; id?: string }) => <div data-testid="entity-tasks">{linkType}:{id}</div>,
}))
// NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: same stub convention as ScopedVacanciesTab/
// ScopedMatchesTab above — this file only proves LocationDetail's OWN wiring
// (right scope/id/customerId), not the shared tabs' own fetch (covered elsewhere).
vi.mock('./ScopedNotesTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-notes">{scope}:{id}:{customerId}</div>,
}))
// K-288: linked-notes feed's own sub-tab — same stub convention as ScopedNotesTab
// above, this file only proves LocationDetail's OWN wiring (entity/id/sub).
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({
  default: ({ entity, id, sub }: { entity: string; id?: string; sub?: { kind: string; id?: string } }) =>
    <div data-testid="linked-notes-tab">{entity}:{id}:{sub?.kind}:{sub?.id}</div>,
}))
vi.mock('./ScopedDocumentsTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-documents">{scope}:{id}:{customerId}</div>,
}))

// CustomerApplicationsList (mounted, unstubbed, by that same sub-tab) reads the
// tenant funnel lookup via the global LookupsContext — mocked here the same way
// CustomerApplicationsList.test.tsx itself does, rather than mounting a real provider.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'applied', label: 'Aangemeld', color: 'var(--color-info)' }], funnelMeta: () => ({ label: '', color: 'var(--text-muted)' }) }),
}))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ status: 202, data: {} }) })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', customerName: 'Zorggroep A', locations: [], departments: [], contacts: [],
  statuses, departmentStatuses: [] as LookupOption[], contactStatuses: [] as LookupOption[],
  onDelete: vi.fn(), onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(), close: vi.fn(),
}

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
   * offers the promoted create-and-link action instead (see the ONE-CLICK-COUPLE-2 describe in LocationDetail.contactsCreate.test.tsx for the
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
