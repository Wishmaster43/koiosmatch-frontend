/**
 * MergeContactModal — the merge seam, asserted as a REQUEST (method/route/body), not as
 * "a callback fired". The route direction is INVERTED relative to the candidate merge:
 *
 *   candidates: POST /candidates/{SURVIVOR}/merge  { source_id }
 *   contacts:   POST /customers/{cid}/contacts/{DUPLICATE}/merge { target_contact_id }
 *
 * so the path id here is the record that DISAPPEARS. A copy-paste of the candidate call
 * shape would delete the person the recruiter chose to keep, and no callback-only
 * assertion would ever notice. The survivor-flip test below is the one that catches it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MergeContactModal from './MergeContactModal'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
import type { Contact } from '@/types/customer'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

import api from '@/lib/api'
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

// Resolve the active locale's own copy so assertions never hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

const contact = (id: string, name: string, overrides: Partial<Contact> = {}): Contact => ({
  id, customerId: 'cust-9', helloflexLink: null, shiftmanagerLink: null, referenceNumber: `C-${id}`,
  firstName: name.split(' ')[0], middleName: '', lastName: name.split(' ').slice(1).join(' '), name,
  role: '', email: `${id}@x.nl`, phone: '', mobile: '', gender: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '',
  lastContactAt: null, lastContactType: null, customFields: {},
  ...overrides,
})

const open = contact('c1', 'Jan Jansen')
const dupe = contact('c2', 'Jan Janssen')

const renderModal = (onMerged = vi.fn()) => {
  render(<MergeContactModal customerId="cust-9" current={open} others={[open, dupe]}
    onClose={vi.fn()} onMerged={onMerged} />)
  return onMerged
}

// Walk step 1 → step 2 by picking the duplicate from this customer's own contacts.
const pickDuplicate = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText('Jan Janssen'))
}

beforeEach(() => { mockPost.mockReset(); mockPost.mockResolvedValue({ data: { data: { id: 'c1' } } }) })

describe('MergeContactModal · the request', () => {
  it('PUTS THE DUPLICATE IN THE PATH and the survivor in the body (default: keep the open record)', async () => {
    const user = userEvent.setup()
    renderModal()
    await pickDuplicate(user)
    await user.click(screen.getByRole('button', { name: ct('contacts.merge.confirm') }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    // Open record c1 stays → c2 is the duplicate that goes in the PATH.
    expect(mockPost).toHaveBeenCalledWith('/customers/cust-9/contacts/c2/merge', { target_contact_id: 'c1' })
  })

  it('INVERTS path and body when the OTHER record is chosen as survivor', async () => {
    const user = userEvent.setup()
    renderModal()
    await pickDuplicate(user)
    // Choose the found record as the one that remains. HUISSTIJL-1: the survivor
    // picker is now the shared SegmentedControl, whose option label renders as a
    // <span> (not the old hand-rolled <div>) — the step-1 list is unmounted by now
    // so the name is unambiguous without a selector filter.
    await user.click(screen.getByText('Jan Janssen'))
    await user.click(screen.getByRole('button', { name: ct('contacts.merge.confirm') }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    // c2 now survives → c1 (the open record) is the duplicate in the PATH.
    expect(mockPost).toHaveBeenCalledWith('/customers/cust-9/contacts/c1/merge', { target_contact_id: 'c2' })
  })

  it('scopes the route to the customer it was opened from — never a bare /contacts route', async () => {
    const user = userEvent.setup()
    renderModal()
    await pickDuplicate(user)
    await user.click(screen.getByRole('button', { name: ct('contacts.merge.confirm') }))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][0]).toMatch(/^\/customers\/cust-9\/contacts\/[^/]+\/merge$/)
  })
})

describe('MergeContactModal · after the merge', () => {
  it('hands the SURVIVOR id back and tells the contact list to refetch', async () => {
    const user = userEvent.setup()
    const onMerged = vi.fn()
    const changed = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, changed)
    renderModal(onMerged)
    await pickDuplicate(user)
    await user.click(screen.getByRole('button', { name: ct('contacts.merge.confirm') }))

    await waitFor(() => expect(onMerged).toHaveBeenCalledWith('c1'))
    expect(changed).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONTACTS_CHANGED_EVENT, changed)
  })

  it('does NOT refetch or report success when the server rejects the merge', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 403 } })
    const user = userEvent.setup()
    const onMerged = vi.fn()
    const changed = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, changed)
    renderModal(onMerged)
    await pickDuplicate(user)
    await user.click(screen.getByRole('button', { name: ct('contacts.merge.confirm') }))

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(onMerged).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    window.removeEventListener(CONTACTS_CHANGED_EVENT, changed)
  })
})

describe('MergeContactModal · candidate list', () => {
  it('never offers the open contact itself as its own duplicate', () => {
    render(<MergeContactModal customerId="cust-9" current={open} others={[open, dupe]} onClose={vi.fn()} onMerged={vi.fn()} />)
    // Only the duplicate is listed; the open record appears inside the intro sentence
    // (interpolated, so never its own text node), never as a selectable row.
    expect(screen.queryAllByText('Jan Jansen')).toHaveLength(0)
    expect(screen.getByText('Jan Janssen')).toBeInTheDocument()
  })

  it('shows an honest empty state when this customer has no second contact', () => {
    render(<MergeContactModal customerId="cust-9" current={open} others={[open]} onClose={vi.fn()} onMerged={vi.fn()} />)
    expect(screen.getByText(ct('contacts.merge.noOthers'))).toBeInTheDocument()
  })

  it('cannot merge before a duplicate is picked', () => {
    render(<MergeContactModal customerId="cust-9" current={open} others={[open, dupe]} onClose={vi.fn()} onMerged={vi.fn()} />)
    expect(screen.getByRole('button', { name: ct('contacts.merge.confirm') })).toBeDisabled()
  })
})
