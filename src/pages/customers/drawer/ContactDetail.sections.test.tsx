/** ContactDetail · free-text, preferred language and retention consent blocks (split from ContactDetail.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import ContactDetail from './ContactDetail'
import type { Contact, Department } from '@/types/customer'

// useContactFunctions + useCustomFields both hit @/lib/api under the hood (the
// contact-function lookup + tenant settings, and the custom-field defs) — a
// harmless empty response keeps each on its own seed fallback, same mock as
// AddContactPersonModal.test.tsx for the same hooks. The archive/restore/erase tests
// that assert the exact POST route live in ContactDetail.actions.test.tsx; here
// `post` is a plain stub because no test in this file reaches it.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

// Notify stubs only: no test in this file asserts a toast (the K-005 erase toast is asserted in ContactDetail.actions.test.tsx).
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

// CONTACT-TEKST-1: minimal stand-in for the Tiptap editor the free-text block
// mounts while editing — same stub EditableRichTextField.test.tsx uses; its own
// ProseMirror internals are out of scope here.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

// Merge is permission-gated (customers.update). Default null = no auth context at all,
// which is what every pre-existing test in this file renders under.
const mockAuth: { current: { hasPermission: (p: string) => boolean } | null } = { current: null }
vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual('@/context/AuthContext')
  return { ...actual, useAuth: () => mockAuth.current }
})

// DD-FE-6 ("no empty tabs"): the Koppelingen sub-tab only lists when a connector
// app is enabled — default both off (matches the pre-existing no-provider
// behaviour every other test in this file already renders under).
const mockUseApps = vi.fn<() => { isAppEnabled: (id: string) => boolean }>()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => false }) })

// K-288: the linked-notes feed is now its own sub-tab (LinkedNotesTab), built in a
// parallel lane with its own suite — stub it here so this file never touches its
// internals (react-query, useNoteFeed, …).
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({ default: () => <div data-testid="linked-notes-tab" /> }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

// Minimal-but-type-complete Department fixture (mirrors AddContactPersonModal.test.tsx) —
// only id/name/locationId vary per test, everything else is a harmless default.
const dept = (id: string, name: string, locationId: string): Department => ({
  id, helloflexLink: null, shiftmanagerLink: null, name, description: '', locationId, locationName: '',
  contacts: [], costCenter: '', billingEmail: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {}, inUse: false,
})
const departments = [dept('dep-1', 'Verpleging', 'loc-1'), dept('dep-2', 'Thuiszorg', 'loc-2')]

const baseContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c1', helloflexLink: null, shiftmanagerLink: null,
  // CONTACT-GESLACHT-1 + the merge scope id — both required on Contact now.
  customerId: 'cust-1', gender: '',
  firstName: 'Jan', middleName: '', lastName: 'Jansen', name: 'Jan Jansen',
  // CONTACT-LINKEDIN-1: optional on Contact, defaulted here like every other field.
  linkedin: '',
  role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  // Last-contact pair — the resource sends both now; null here means "never contacted".
  lastContactAt: null, lastContactType: null,
  ...overrides,
})

/**
 * CONTACT-TEKST-1: the free-text block, canon-ordered directly under the field
 * card and above the Vestiging coupling. Asserts the REQUEST SHAPE (§13) —
 * onSave is the same update() callback the drawer routes to
 * `PATCH /customers/{cid}/contacts/{id}`, so proving `{ notes }` here proves
 * the real save, never only that a callback fired.
 */
describe('ContactDetail · free-text block (CONTACT-TEKST-1)', () => {
  it('renders the saved text through SafeHtml on the Gegevens tab', () => {
    render(<ContactDetail contact={baseContact({ description: '<p>Werkt op afspraak</p>' })} locations={locations} departments={departments}
      statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText('Werkt op afspraak')).toBeInTheDocument()
  })

  it('shows the calm empty state when no text is stored yet', () => {
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments}
      statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText(ct('richText.empty'))).toBeInTheDocument()
  })

  it('saves the edited HTML as { description } through the same onSave the drawer wires to the contact PATCH route', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact({ notes: '<p>Original</p>' })} locations={locations} departments={departments}
      statuses={statuses} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    // The free-text block's own pencil — the LAST "edit"-titled control before
    // the Vestiging coupling (field table pencil is first, mirrors [0] above).
    const editButtons = screen.getAllByTitle(cm('edit'))
    await user.click(editButtons[editButtons.length - 1])
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Edited</p>')
    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith('c1', { description: '<p>Edited</p>' })
  })

  it('shows the second-screen popout icon for the free-text block', () => {
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments}
      statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByTitle(cm('openSecondScreen'))).toBeInTheDocument()
  })
})

// AVG-RET-2-TAAL-1: one additive row on the frozen contact card — name when set, agency default when empty.
describe('ContactDetail · preferred language row', () => {
  it('shows the stored code by display name', () => {
    render(<ContactDetail contact={baseContact({ preferredLanguage: 'pl' })} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText(ct('contacts.detail.preferredLanguage'))).toBeInTheDocument()
    expect(screen.getByText('Pools (PL)')).toBeInTheDocument()
  })

  it('shows the agency-default placeholder when no language is set', () => {
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText(i18n.t('profile.preferredLanguageDefault', { ns: 'candidates' }))).toBeInTheDocument()
  })
})

// CONTACT-CONSENT-AS-1 (K-262): the shared RetentionConsentBlock renders in the
// data tab with customers namespace and customers.update permission gate. The PATCH
// body must contain ONLY { retention_consent: boolean }, never the *_at stamps.
describe('ContactDetail · retention consent block', () => {
  it('renders the block in the data tab with a consented contact', async () => {
    render(<ContactDetail contact={baseContact({ retentionConsent: true, retentionConsentAt: '2026-01-15T10:00:00Z' })}
      locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    // The block should be visible in the data tab (default when component mounts).
    await waitFor(() => {
      expect(screen.getByText(ct('communication.retentionTitle'))).toBeInTheDocument()
    })
  })

  it('sends ONLY { retention_consent: boolean } on toggle, never the *_at stamps', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<QueryClientProvider client={new QueryClient()}>
      <ContactDetail contact={baseContact({ retentionConsent: false })}
        locations={locations} departments={departments} statuses={statuses}
        onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />
    </QueryClientProvider>)

    // Find and click the consent toggle (aria-label from the shared block).
    await waitFor(() => {
      const toggle = screen.getByLabelText(ct('communication.consentRetentionOptIn'))
      expect(toggle).toBeInTheDocument()
    })
    const toggle = screen.getByLabelText(ct('communication.consentRetentionOptIn'))
    await user.click(toggle)

    // Verify the PATCH body contains ONLY retention_consent (no retention_consent_at or retention_warned_at).
    expect(onSave).toHaveBeenCalledWith('c1', { retentionConsent: true })
  })

  it('displays the house formatter date via RetentionConsentBlock (date formatting tested separately)', async () => {
    // The shared RetentionConsentBlock handles date formatting (tested in RetentionConsentBlock.test.tsx).
    // This test just verifies the block is rendered with the correct contact data.
    render(<ContactDetail contact={baseContact({ retentionConsent: true, retentionConsentAt: '2026-01-15T10:00:00Z' })}
      locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await waitFor(() => {
      // Block should be present when consent is set.
      expect(screen.getByText(ct('communication.retentionTitle'))).toBeInTheDocument()
    })
  })
})
