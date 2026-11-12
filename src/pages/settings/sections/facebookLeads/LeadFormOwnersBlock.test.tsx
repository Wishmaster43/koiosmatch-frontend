/**
 * LeadFormOwnersBlock (LEAD-FORM-OWNER-FE-1) — asserts the REAL requests on the mocked client:
 * the GET on mount and the whole-map PUT body (key echo for copy, no Dutch literals).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import LeadFormOwnersBlock from './LeadFormOwnersBlock'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockRejectedValue(new Error('offline')), put: vi.fn().mockRejectedValue(new Error('offline')) } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/queries', () => ({
  useUserOptions: () => ({ data: [{ id: 'u1', name: 'Anna' }, { id: 'u2', name: 'Bram' }] }),
}))

const mockedApi = vi.mocked(api, true)
afterEach(() => vi.clearAllMocks())

describe('LeadFormOwnersBlock', () => {
  it('wraps the owner picker in a content-sized cell so the clear X sits at the trigger edge', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { owners: { '111': 'u1' } } } })
    render(<LeadFormOwnersBlock />)
    const cell = await screen.findByTestId('lead-form-owner-cell')
    expect(cell.style.justifySelf).toBe('start')
    expect(within(cell).getByRole('button', { name: 'facebookLeads.formOwners.owner 111' })).toBeInTheDocument()
  })

  it('GETs the owner map on mount and renders the rows', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { owners: { '111': 'u1' } } } })
    render(<LeadFormOwnersBlock />)
    expect(await screen.findByText('111')).toBeTruthy()
    expect(mockedApi.get.mock.calls.map((c) => c[0])).toEqual(['/facebook-leads/form-owners'])
  })

  it('clearing the owner then saving PUTs null for that form', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { owners: { '111': 'u1' } } } })
    mockedApi.put.mockResolvedValue({ data: { data: { owners: { '111': null } } } })
    render(<LeadFormOwnersBlock />)
    await screen.findByText('111')
    await userEvent.click(screen.getByRole('button', { name: /clear|common/i }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(mockedApi.put).toHaveBeenCalled())
    expect(mockedApi.put.mock.calls[0]).toEqual(['/facebook-leads/form-owners', { owners: { '111': null } }])
  })

  it('adding form 222 with owner u2 PUTs the whole map', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { owners: { '111': 'u1' } } } })
    mockedApi.put.mockResolvedValue({ data: { data: { owners: { '111': 'u1', '222': 'u2' } } } })
    render(<LeadFormOwnersBlock />)
    await screen.findByText('111')
    await userEvent.type(screen.getByLabelText('facebookLeads.formOwners.formId'), '222')
    await userEvent.click(screen.getByRole('button', { name: 'facebookLeads.formOwners.add' }))
    await userEvent.click(screen.getByRole('button', { name: 'facebookLeads.formOwners.owner 222' }))
    await userEvent.click(await screen.findByText('Bram'))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(mockedApi.put).toHaveBeenCalled())
    expect(mockedApi.put.mock.calls[0]).toEqual(['/facebook-leads/form-owners', { owners: { '111': 'u1', '222': 'u2' } }])
  })

  it('a non-numeric id shows the invalid key and sends nothing', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { owners: {} } } })
    render(<LeadFormOwnersBlock />)
    await screen.findByText('facebookLeads.formOwners.empty')
    await userEvent.type(screen.getByLabelText('facebookLeads.formOwners.formId'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'facebookLeads.formOwners.add' }))
    expect(screen.getByText('facebookLeads.formOwners.invalidFormId')).toBeTruthy()
    expect(mockedApi.put).not.toHaveBeenCalled()
  })

  it('a rejected PUT toasts an error and keeps the rows', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { owners: { '111': 'u1' } } } })
    mockedApi.put.mockRejectedValue({ response: { status: 422, data: {} } })
    render(<LeadFormOwnersBlock />)
    await screen.findByText('111')
    await userEvent.type(screen.getByLabelText('facebookLeads.formOwners.formId'), '333')
    await userEvent.click(screen.getByRole('button', { name: 'facebookLeads.formOwners.add' }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(screen.getByText('111')).toBeTruthy()
    expect(screen.getByText('333')).toBeTruthy()
  })
  it('refuses a duplicate form id and sends nothing', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { owners: { '111': 'u1' } } } })
    render(<LeadFormOwnersBlock />)
    await screen.findByText('111')
    await userEvent.type(screen.getByLabelText('facebookLeads.formOwners.formId'), '111')
    await userEvent.click(screen.getByText('facebookLeads.formOwners.add'))
    expect(screen.getByRole('alert')).toHaveTextContent('facebookLeads.formOwners.invalidFormId')
    expect(mockedApi.put).not.toHaveBeenCalled()
  })

  it('shows the load error with a retry that GETs again', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { data: { owners: {} } } })
    render(<LeadFormOwnersBlock />)
    await screen.findByText('facebookLeads.formOwners.loadError')
    await userEvent.click(screen.getByText('facebookLeads.retry'))
    await screen.findByText('facebookLeads.formOwners.empty')
    expect(mockedApi.get).toHaveBeenCalledTimes(2)
  })
})
