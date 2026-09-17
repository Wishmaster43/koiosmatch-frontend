/**
 * LAATSTE-CONTACT-SCOPE-1 regression: a mailto: click on a contact person's e-mail
 * in ContactDetail offers the shared B15-flow confirm banner (mirrors the candidate
 * flow); confirming POSTs the contact moment against the CONTACT-scoped route, and
 * a 422 (inactive/wrongly-scoped channel) shows the server's own message and never
 * stamps (contract M2 hand-closing, §13 — asserting the REQUEST, not just a callback).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import ContactDetail from './ContactDetail'
import type { Contact, Department } from '@/types/customer'

const mockPost = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})

// Spy on notifyError so the 422 case can assert the SERVER's own message reaches
// the user (§13: a test that does not touch the seam proves nothing about it).
const mockNotifyError = vi.fn()
vi.mock('@/lib/notify', async () => {
  const actual = await vi.importActual('@/lib/notify')
  return { ...actual, notifyError: (...args: unknown[]) => mockNotifyError(...args) }
})

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
// ADOPT-B1 gate: the contact-moment prompt is a customers.update affordance, so the flow
// tests run as a user who holds it; the gate test below flips it off.
const mockHasPermission = vi.fn((perm: string) => perm === 'customers.update')
vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual('@/context/AuthContext')
  return { ...actual, useAuth: () => ({ hasPermission: (perm: string) => mockHasPermission(perm) }) }
})
vi.mock('@/context/AppsContext', () => ({ useApps: () => ({ isAppEnabled: () => false }) }))
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({ default: () => <div data-testid="linked-notes-tab" /> }))

afterEach(() => vi.clearAllMocks())
beforeEach(() => { mockPost.mockReset(); mockNotifyError.mockReset(); mockHasPermission.mockImplementation((perm: string) => perm === 'customers.update') })

const cd = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'candidates', ...opts })

const locations: { id: string; name: string }[] = []
const departments: Department[] = []
const statuses: { value: string; label: string }[] = []

const contact: Contact = {
  id: 'c1', helloflexLink: null, shiftmanagerLink: null,
  customerId: 'cust-1', gender: '',
  firstName: 'Jan', middleName: '', lastName: 'Jansen', name: 'Jan Jansen',
  linkedin: '',
  role: '', email: 'jan@voorbeeld.nl', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  lastContactAt: null, lastContactType: null,
} as unknown as Contact

const renderDetail = () => render(<ContactDetail contact={contact} locations={locations} departments={departments}
  statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

describe('ContactDetail · B15-flow contact-moment confirm (LAATSTE-CONTACT-SCOPE-1)', () => {
  it('never offers the confirm banner to a user without customers.update (no fake affordance)', () => {
    mockHasPermission.mockImplementation(() => false)
    renderDetail()

    fireEvent.click(screen.getByText('jan@voorbeeld.nl'))
    expect(screen.queryByTestId('contact-moment-confirm-email')).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows the confirm banner after a mailto click and POSTs the exact route+body on confirm', async () => {
    mockPost.mockResolvedValue({ data: { data: { last_contact_at: '2026-09-17T10:00:00Z', last_contact_type: 'email' } } })
    renderDetail()

    fireEvent.click(screen.getByText('jan@voorbeeld.nl'))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByTestId('contact-moment-confirm-email')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('contact-moment-confirm-email'))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    // Assert the REQUEST shape — the CONTACT-scoped route, never the candidate one (§13).
    expect(mockPost).toHaveBeenCalledWith('/customer-contacts/c1/contact-moments', { channel: 'email' })
    await waitFor(() => expect(screen.queryByTestId('contact-moment-confirm-email')).toBeNull())
  })

  it('dismissing the banner never fires a request', () => {
    renderDetail()
    fireEvent.click(screen.getByText('jan@voorbeeld.nl'))
    fireEvent.click(screen.getByText(cd('profile.contactMomentDismiss')))
    expect(screen.queryByTestId('contact-moment-confirm-email')).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('a 422 on channel shows the server message and never stamps', async () => {
    mockPost.mockRejectedValue({ response: { status: 422, data: { message: 'Kanaal niet beschikbaar voor contactpersonen' } } })
    renderDetail()

    fireEvent.click(screen.getByText('jan@voorbeeld.nl'))
    fireEvent.click(screen.getByTestId('contact-moment-confirm-email'))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    // The banner stays open (nothing stamped) — the confirm rejected, not resolved.
    expect(screen.getByTestId('contact-moment-confirm-email')).toBeInTheDocument()
    // The SERVER's own message reaches the user via extractApiError, not a generic fallback.
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Kanaal niet beschikbaar voor contactpersonen'))
  })
})
