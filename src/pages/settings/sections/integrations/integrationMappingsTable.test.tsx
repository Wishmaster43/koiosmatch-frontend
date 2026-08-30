/**
 * IntegrationMappingsTable.test — asserts the real request seam per §13: GET on
 * mount + on domain switch, POST body for a new row, PUT body with only the
 * changed field for an edit, delete goes through ConfirmDialog before the
 * DELETE call, a duplicate 422 surfaces the duplicate message, the empty state
 * renders, and no native <select> is used anywhere on the surface.
 */
import { describe, it, expect, afterEach, afterAll, beforeAll, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import IntegrationMappingsTable from './IntegrationMappingsTable'
import { listMappings, createMapping, updateMapping, deleteMapping } from './integrationsApi'
import { notifyError } from '@/lib/notify'

// Existing i18n keys render in Dutch by default in the test environment — force
// English so the assertions below can match real, stable copy.
let prevLanguage: string
beforeAll(async () => { prevLanguage = i18n.language; await i18n.changeLanguage('en') })
// Restore the shared singleton — BARREL-DATETIME-LES: never leak i18n state across suites.
afterAll(async () => { await i18n.changeLanguage(prevLanguage) })

vi.mock('./integrationsApi', () => ({
  listMappings: vi.fn(),
  createMapping: vi.fn(),
  updateMapping: vi.fn(),
  deleteMapping: vi.fn(),
}))
vi.mock('@/lib/notify', async () => {
  const actual = await vi.importActual('@/lib/notify')
  return { ...actual, notifyError: vi.fn() }
})

const mockList = listMappings as unknown as ReturnType<typeof vi.fn>
const mockCreate = createMapping as unknown as ReturnType<typeof vi.fn>
const mockUpdate = updateMapping as unknown as ReturnType<typeof vi.fn>
const mockDelete = deleteMapping as unknown as ReturnType<typeof vi.fn>

afterEach(() => vi.clearAllMocks())

const row = { id: 'm1', connector: 'werkzoeken' as const, domain: 'cao', koios_value: 'k1', external_value: 'e1', is_default: false }

describe('IntegrationMappingsTable', () => {
  // Mount fetches the first domain; switching the SubTabBar refetches the new one.
  it('GETs on mount with the first domain and again on domain switch', async () => {
    mockList.mockResolvedValue([])
    render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao', 'schaal']} />)
    await waitFor(() => expect(mockList).toHaveBeenCalledWith('werkzoeken', 'cao'))

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /scale/i }))
    await waitFor(() => expect(mockList).toHaveBeenCalledWith('werkzoeken', 'schaal'))
  })

  // Renders the honest empty state when the domain has no rows yet.
  it('renders the empty state for a domain with no mappings', async () => {
    mockList.mockResolvedValue([])
    render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao']} />)
    await screen.findByText(/no mappings for this domain yet/i)
  })

  // Adding a row and saving it POSTs the exact declared body.
  it('POSTs the exact body when a new row is added and saved', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue({ ...row, id: 'new1' })
    render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao']} />)
    await waitFor(() => expect(mockList).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /add mapping/i }))
    await user.type(screen.getByRole('textbox', { name: /koios value/i }), 'k1')
    await user.type(screen.getByRole('textbox', { name: /external value/i }), 'e1')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('werkzoeken', {
      domain: 'cao', koios_value: 'k1', external_value: 'e1', is_default: false,
    }))
  })

  // Editing one field of an existing row PUTs only that changed field.
  it('PUTs only the changed field for an edited row', async () => {
    mockList.mockResolvedValue([row])
    mockUpdate.mockResolvedValue({ ...row, koios_value: 'k1-edited' })
    render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao']} />)
    await screen.findByDisplayValue('k1')

    const user = userEvent.setup()
    const koiosInput = screen.getByRole('textbox', { name: /koios value/i })
    await user.clear(koiosInput)
    await user.type(koiosInput, 'k1-edited')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('werkzoeken', 'm1', { koios_value: 'k1-edited' }))
  })

  // Delete requires confirming the ConfirmDialog first; cancel never calls the API.
  it('confirms before deleting, and never deletes on cancel', async () => {
    mockList.mockResolvedValue([row])
    render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao']} />)
    await screen.findByDisplayValue('k1')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByText(/delete this mapping/i)
    expect(dialog).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()

    // Cancel: no DELETE call.
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(mockDelete).not.toHaveBeenCalled()

    // Delete again and confirm this time.
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    const confirmButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await user.click(confirmButtons[confirmButtons.length - 1])
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('werkzoeken', 'm1'))
  })

  // A 422 duplicate response on create surfaces the duplicate-specific message.
  it('shows the duplicate message on a 422 duplicate error', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValue({ response: { status: 422 } })
    render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao']} />)
    await waitFor(() => expect(mockList).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /add mapping/i }))
    await user.type(screen.getByRole('textbox', { name: /koios value/i }), 'k1')
    await user.type(screen.getByRole('textbox', { name: /external value/i }), 'e1')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('This Koios value already has a mapping in this domain.'))
  })

  // Regression (verify finding): an empty fresh row can never fire a doomed POST.
  it('keeps save disabled on an empty new row until both values are typed', async () => {
    mockList.mockResolvedValue([])
    render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao']} />)
    await waitFor(() => expect(mockList).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /add mapping/i }))
    const save = screen.getByRole('button', { name: /^save$/i })
    expect(save).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /koios value/i }), 'k1')
    expect(save).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /external value/i }), 'e1')
    expect(save).not.toBeDisabled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  // No native <select> anywhere on the surface (CLAUDE.md §3A — searchable dropdown always).
  it('never renders a native <select>', async () => {
    mockList.mockResolvedValue([row])
    const { container } = render(<IntegrationMappingsTable connector="werkzoeken" domains={['cao']} />)
    await screen.findByDisplayValue('k1')
    expect(container.querySelectorAll('select').length).toBe(0)
  })
})
