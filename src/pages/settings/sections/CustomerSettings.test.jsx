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
})
