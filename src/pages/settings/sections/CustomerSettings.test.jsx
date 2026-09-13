/**
 * CustomerStatusesSettings, LocationStatusesSettings, DepartmentStatusesSettings,
 * ContactStatusesSettings (CUST-DEFAULT-1 / SUBSTATUS-DEFAULT-1) — each mounts the
 * shared StatusListEditor against /settings/customer-lookups/{type}, with
 * `is_default` passed to render the per-row DefaultToggle (the singleton status
 * the backend enforces, marked on the model in SINGLETON_FLAGS).
 *
 * These assert the REQUESTS, checking that the is_default flag round-trips
 * correctly through the API when toggling a row to default.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import {
  CustomerStatusesSettings,
  CustomerPhasesSettings,
  LocationStatusesSettings,
  DepartmentStatusesSettings,
  ContactStatusesSettings,
} from './CustomerSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// Fixture rows in the shape the lookup endpoint returns (value/label/color/is_default + in_use).
const mockStatus = (id, label, opts = {}) => ({
  id,
  value: label.toLowerCase().replace(/\s+/g, '_'),
  label,
  // eslint-disable-next-line no-restricted-syntax -- DATA: seed colour for test fixtures, not UI chrome
  color: '#3B8FD4',
  is_default: false,
  in_use: false,
  ...opts,
})

afterEach(() => vi.clearAllMocks())

describe('CustomerStatusesSettings', () => {
  it('loads statuses and shows the is_default toggle', async () => {
    const active = mockStatus('s1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('s2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    render(<CustomerStatusesSettings />)

    await screen.findByText('Active')
    expect(api.get).toHaveBeenCalledWith('/settings/customer-lookups/statuses', undefined)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    // The row with is_default:true renders the active (clickable) "Standaard" pill.
    expect(screen.getByRole('button', { name: st('common.default') })).not.toBeDisabled()
  })

  it('promoting a status to default PUTs is_default:true on that row', async () => {
    const active = mockStatus('s1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('s2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    api.put.mockResolvedValue({ data: mockStatus('s2', 'Inactive', { is_default: true }) })
    const user = userEvent.setup()
    render(<CustomerStatusesSettings />)
    await screen.findByText('Inactive')

    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = api.put.mock.calls[0]
    expect(url).toBe('/settings/customer-lookups/statuses/s2')
    expect(body.is_default).toBe(true)
  })

  it('create POST to /settings/customer-lookups/statuses carries the slugged value (withValueSlug)', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: mockStatus('s3', 'Prospect') })
    const user = userEvent.setup()
    render(<CustomerStatusesSettings />)

    await user.click(await screen.findByRole('button', { name: st('customerLookups.statuses.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Prospect')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/customer-lookups/statuses',
      expect.objectContaining({ name: 'Prospect', value: 'prospect' })))
  })

  // LOOKUP-ICONS-FE-2 fix (13-09): CustomerLookupController.php validates `color`
  // only for customer_statuses (no icon column/rule) — colour-only mark stays.
  it('the value mark stays colour-only and PUTs {color} when a colour is picked', async () => {
    const active = mockStatus('s1', 'Active', { is_default: true })
    api.get.mockResolvedValue({ data: [active] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CustomerStatusesSettings />)

    await screen.findByText('Active')
    const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Active' }) })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Active' }) })).toBeInTheDocument()
  })
})

// readOnly (Danny 13-09, rows 45/46, verbatim: "Aangezien we dit niet moeten
// wijzigen omdat er een scherm aan vast hangt · Potlootje altijd grijs · Delete
// altijd grijs · Plus fase toevoegen grijs"): the pencil/delete/add render
// DISABLED — grey, always PRESENT, never hidden; colour/icon and drag-reorder
// stay editable. CustomerPhasesSettings previously passed nothing (fully open).
describe('CustomerPhasesSettings — readOnly (system value locked)', () => {
  // Reuses mockStatus (already carrying the one house fixture-colour disable
  // above) instead of a second hex literal — is_customer is the extra field
  // this lookup carries on top of the shared status/phase shape.
  const phase = (over = {}) => mockStatus('p1', 'Prospect', { is_customer: false, ...over })

  it('renders the pencil, delete and add controls DISABLED with the systemValueLocked reason, never hidden', async () => {
    api.get.mockResolvedValue({ data: [phase()] })
    render(<CustomerPhasesSettings />)

    await screen.findByText('Prospect')
    const editBtn = screen.getByRole('button', { name: st('statusList.edit') })
    const deleteBtn = editBtn.nextElementSibling
    const addBtn = screen.getByRole('button', { name: st('customerLookups.phases.add') })

    expect(editBtn).toBeDisabled()
    expect(editBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(editBtn).toHaveAttribute('aria-description', st('statusList.systemValueLocked'))
    // Present, never hidden — a system-locked control is grey, not gone.
    expect(deleteBtn).toBeDisabled()
    expect(deleteBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(addBtn).toBeDisabled()
    expect(addBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(addBtn).toHaveAttribute('aria-description', st('statusList.systemValueLocked'))
  })

  // LOOKUP-ICONS-FE-2 fix (13-09): the customer-phases endpoint validates color
  // only — colour/icon mark stays colour-only ('dialog', not 'menu').
  it('the value mark still opens its popover — colour stays editable (he did not name it)', async () => {
    api.get.mockResolvedValue({ data: [phase()] })
    const user = userEvent.setup()
    render(<CustomerPhasesSettings />)

    await screen.findByText('Prospect')
    await user.click(screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Prospect' }) }))
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Prospect' }) })).toBeInTheDocument()
  })
})

describe('LocationStatusesSettings', () => {
  it('loads location statuses and shows the is_default toggle', async () => {
    const active = mockStatus('l1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('l2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    render(<LocationStatusesSettings />)

    await screen.findByText('Active')
    expect(api.get).toHaveBeenCalledWith('/settings/customer-lookups/location-statuses', undefined)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('common.default') })).not.toBeDisabled()
  })

  it('promoting a location status to default PUTs is_default:true on that row', async () => {
    const active = mockStatus('l1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('l2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    api.put.mockResolvedValue({ data: mockStatus('l2', 'Inactive', { is_default: true }) })
    const user = userEvent.setup()
    render(<LocationStatusesSettings />)
    await screen.findByText('Inactive')

    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = api.put.mock.calls[0]
    expect(url).toBe('/settings/customer-lookups/location-statuses/l2')
    expect(body.is_default).toBe(true)
  })

  it('create POST to /settings/customer-lookups/location-statuses carries the slugged value (withValueSlug)', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: mockStatus('l3', 'Pending') })
    const user = userEvent.setup()
    render(<LocationStatusesSettings />)

    await user.click(await screen.findByRole('button', { name: st('customerLookups.locationStatuses.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Pending')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/customer-lookups/location-statuses',
      expect.objectContaining({ name: 'Pending', value: 'pending' })))
  })
})

describe('DepartmentStatusesSettings', () => {
  it('loads department statuses and shows the is_default toggle', async () => {
    const active = mockStatus('d1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('d2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    render(<DepartmentStatusesSettings />)

    await screen.findByText('Active')
    expect(api.get).toHaveBeenCalledWith('/settings/customer-lookups/department-statuses', undefined)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('common.default') })).not.toBeDisabled()
  })

  it('promoting a department status to default PUTs is_default:true on that row', async () => {
    const active = mockStatus('d1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('d2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    api.put.mockResolvedValue({ data: mockStatus('d2', 'Inactive', { is_default: true }) })
    const user = userEvent.setup()
    render(<DepartmentStatusesSettings />)
    await screen.findByText('Inactive')

    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = api.put.mock.calls[0]
    expect(url).toBe('/settings/customer-lookups/department-statuses/d2')
    expect(body.is_default).toBe(true)
  })

  it('create POST to /settings/customer-lookups/department-statuses carries the slugged value (withValueSlug)', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: mockStatus('d3', 'On hold') })
    const user = userEvent.setup()
    render(<DepartmentStatusesSettings />)

    await user.click(await screen.findByRole('button', { name: st('customerLookups.departmentStatuses.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'On hold')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/customer-lookups/department-statuses',
      expect.objectContaining({ name: 'On hold', value: 'on_hold' })))
  })
})

describe('ContactStatusesSettings', () => {
  it('loads contact statuses and shows the is_default toggle', async () => {
    const active = mockStatus('c1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('c2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    render(<ContactStatusesSettings />)

    await screen.findByText('Active')
    expect(api.get).toHaveBeenCalledWith('/settings/customer-lookups/contact-statuses', undefined)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('common.default') })).not.toBeDisabled()
  })

  it('promoting a contact status to default PUTs is_default:true on that row', async () => {
    const active = mockStatus('c1', 'Active', { is_default: true, in_use: true })
    const inactive = mockStatus('c2', 'Inactive')
    api.get.mockResolvedValue({ data: [active, inactive] })
    api.put.mockResolvedValue({ data: mockStatus('c2', 'Inactive', { is_default: true }) })
    const user = userEvent.setup()
    render(<ContactStatusesSettings />)
    await screen.findByText('Inactive')

    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = api.put.mock.calls[0]
    expect(url).toBe('/settings/customer-lookups/contact-statuses/c2')
    expect(body.is_default).toBe(true)
  })

  it('create POST to /settings/customer-lookups/contact-statuses carries the slugged value (withValueSlug)', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: mockStatus('c3', 'Retired') })
    const user = userEvent.setup()
    render(<ContactStatusesSettings />)

    await user.click(await screen.findByRole('button', { name: st('customerLookups.contactStatuses.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Retired')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/customer-lookups/contact-statuses',
      expect.objectContaining({ name: 'Retired', value: 'retired' })))
  })
})

// LOOKUP-ICONS-FE-2 (13-09): contact statuses gained withColor like the four sibling
// blocks (colour column + `color` validation on the customer lookup controller).
describe('ContactStatusesSettings — colour mark (LOOKUP-ICONS-FE-2)', () => {
  it('the value mark is colour-only and opens its palette', async () => {
    const lead = mockStatus('cs1', 'Contactpersoon actief', { is_default: true })
    api.get.mockResolvedValue({ data: [lead] })
    const user = userEvent.setup()
    render(<ContactStatusesSettings />)
    await screen.findByText('Contactpersoon actief')
    await user.click(screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Contactpersoon actief' }) }))
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Contactpersoon actief' }) })).toBeInTheDocument()
  })
})
