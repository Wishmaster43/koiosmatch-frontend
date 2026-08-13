/**
 * AutomationsSettings (§13: assert the REQUEST) — the on/off toggle, the
 * date-relative "days before" rijtje (negative offset_days on the wire, positive
 * unit label on screen) and the segment status/phase multiselects all PATCH
 * `/workflows/{id}` with the exact contract body, never only "a callback fired".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import AutomationsSettings from './AutomationsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
// The segment multiselects read tenant lookups through LookupsContext (WF-MULTISELECT-1).
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    statuses: [{ value: 'available', label: 'Available' }, { value: 'placed', label: 'Placed' }],
    phases: [{ value: 'lead', label: 'Lead' }, { value: 'candidate', label: 'Candidate' }],
    candidateTypes: [],
  }),
}))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const wt = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'workflows', ...opts })

const dateRelativeWorkflow = (over: Record<string, unknown> = {}) => ({
  id: 'wf-1', name: 'Reactivate unplaceable', status: 'draft', trigger_type: 'date_relative',
  trigger_config: { date_field: 'available_again_date', offset_days: -28 },
  segment: { status: [], phase: [] },
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('AutomationsSettings', () => {
  it('shows the days-before value POSITIVE even though offset_days is stored negative', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [dateRelativeWorkflow()] })
    render(<AutomationsSettings />)

    const daysInput = await screen.findByLabelText(wt('dateRelative.daysBeforeLabel')) as HTMLInputElement
    expect(daysInput.value).toBe('28')
  })

  it('flips the active/draft toggle via a PATCH with only the status change', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [dateRelativeWorkflow()] })
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<AutomationsSettings />)

    await screen.findByText('Reactivate unplaceable')
    await user.click(screen.getByRole('switch', { name: t('automations.toggleAriaLabel', { name: 'Reactivate unplaceable' }) }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/workflows/wf-1', { status: 'active' }))
  })

  it('editing the days field PATCHes a NEGATIVE offset_days (28 shown → -28 saved)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [dateRelativeWorkflow()] })
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<AutomationsSettings />)

    const daysInput = await screen.findByLabelText(wt('dateRelative.daysBeforeLabel'))
    await user.clear(daysInput)
    await user.type(daysInput, '14')

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/workflows/wf-1', {
      trigger_config: { date_field: 'available_again_date', offset_days: -14 },
    }))
  })

  it('picking a target status PATCHes segment.status[]', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [dateRelativeWorkflow()] })
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<AutomationsSettings />)

    await screen.findByText('Reactivate unplaceable')
    const statusBoxes = screen.getAllByRole('textbox')
    // First searchable multiselect on the row is the status axis (segment.status[]).
    await user.click(statusBoxes[0])
    await user.click(await screen.findByText('Available'))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/workflows/wf-1', {
      segment: { status: ['available'], phase: [] },
    }))
  })

  it('renders the empty state when the tenant has no workflows yet', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    render(<AutomationsSettings />)

    expect(await screen.findByText(t('automations.empty'))).toBeInTheDocument()
  })

  it('renders the error state when the workflow list fails to load', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'))
    render(<AutomationsSettings />)

    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
  })
})
