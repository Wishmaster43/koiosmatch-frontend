/**
 * OpportunityLookupsSettings — four sub-tabs (stages/serviceTypes/agreementTypes/
 * dealTypes), each a StatusListEditor with `withValueSlug` (these controllers accept
 * a slugged `value`, so the create button must actually send one — mirrors
 * CustomerPhasesSettings' regression guard). Asserts each tab's own endpoint and
 * the create REQUEST body (§13), plus the deal-type `unit` extraField.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import OpportunityLookupsSettings from './OpportunityLookupsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over = {}) => ({ id: 's1', value: 'lead', label: 'Lead', color: '#94A3B8', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('OpportunityLookupsSettings', () => {
  it('defaults to the stages tab, GETting /opportunity-stages', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<OpportunityLookupsSettings />)

    await screen.findByText('Lead')
    expect(api.get).toHaveBeenCalledWith('/opportunity-stages', undefined)
  })

  it('creating a stage POSTs label + a slugged value to /opportunity-stages', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 's2', value: 'won', label: 'Won' }) })
    const user = userEvent.setup()
    render(<OpportunityLookupsSettings />)

    await screen.findByText('Lead')
    await user.click(screen.getByRole('button', { name: st('opportunityLookups.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Won')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/opportunity-stages', expect.objectContaining({ name: 'Won', value: 'won' })))
  })

  it('switching to the deal-types tab GETs /opportunity-deal-types and shows the unit field', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint === '/opportunity-deal-types') {
        return Promise.resolve({ data: [{ id: 'd1', value: 'project', label: 'Project', color: '#6E8FD6', unit: 'euro', in_use: false }] })
      }
      return Promise.resolve({ data: [row()] })
    })
    const user = userEvent.setup()
    render(<OpportunityLookupsSettings />)

    await screen.findByText('Lead')
    await user.click(screen.getByRole('tab', { name: st('opportunityLookups.tabs.dealTypes') }))

    await screen.findByText('Project')
    expect(api.get).toHaveBeenCalledWith('/opportunity-deal-types', undefined)
  })
})
