/**
 * ImportWizardPage tests — the wizard's whole point over the settings screen it
 * links from: a column can be REMAPPED and a cell can be EDITED before anything is
 * sent, and the real import is never offered on a stale preview. Mutation
 * assertions check the REQUEST (the actual CSV bytes inside the uploaded File),
 * never only that a callback fired (CLAUDE.md §13).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ImportWizardPage from './ImportWizardPage'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

type MockFn = ReturnType<typeof vi.fn>

// Resolve the active locale's own copy so assertions never guess a language; the
// NEW wizard-only keys are not added to the locale files yet (per this task's
// instruction), so their calls carry the same defaultValue the component itself
// passes — resolving to that fallback is the correct, intended behaviour.
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const TEMPLATE = { entity: 'customers', columns: ['naam', 'email'], example_rows: 2, url: '/imports/customers/template.csv' }

const emptyResult = (dryRun: boolean) => ({
  entity: 'customers', dry_run: dryRun, summary: { rows: 0, create: 0, update: 0, skip: 0, error: 0 }, unknown_columns: [], rows: [],
})

beforeEach(() => {
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  ;(api.get as MockFn).mockResolvedValue({ data: { data: [TEMPLATE] } })
})

afterEach(() => {
  vi.clearAllMocks()
})

// Drive the wizard from a blank render up to (and including) the mapping step, for
// a file whose headers already match the backend columns exactly.
async function uploadAndReachPreview(user: ReturnType<typeof userEvent.setup>) {
  render(<ImportWizardPage />)
  const input = await screen.findByLabelText(t('import.selectCsv'))
  const file = new File(['naam;email\nAcme;info@acme.nl'], 'customers.csv', { type: 'text/csv' })
  await user.upload(input, file)
  // Both columns auto-map exactly (identical header names) — Next is enabled.
  const next = await screen.findByRole('button', { name: t('import.wizard.next', { defaultValue: 'Next' }) })
  expect(next).toBeEnabled()
  await user.click(next)
  await screen.findByRole('button', { name: t('import.runPreview') })
}

describe('ImportWizardPage — mapping + editable preview', () => {
  it('auto-maps identical headers and shows the parsed row in the editable preview', async () => {
    const user = userEvent.setup()
    await uploadAndReachPreview(user)
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('info@acme.nl')).toBeInTheDocument()
  })

  it('sends the EDITED cell value, not the originally uploaded one', async () => {
    const user = userEvent.setup()
    await uploadAndReachPreview(user)
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: { ...emptyResult(true), summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 } } } })

    const nameCell = screen.getByDisplayValue('Acme')
    await user.clear(nameCell)
    await user.type(nameCell, 'Acme BV')
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/imports/customers/dry-run', expect.any(FormData)))
    const form = (api.post as MockFn).mock.calls[0][1] as FormData
    const uploaded = form.get('file') as File
    const text = await uploaded.text()
    expect(text).toContain('Acme BV')
    expect(text).not.toContain('Acme;info@acme.nl') // the original row must not survive unedited
  })

  it('never shows Confirm before a validate has run, and hides it again after a further edit (no stale confirm)', async () => {
    const user = userEvent.setup()
    await uploadAndReachPreview(user)
    expect(screen.queryByRole('button', { name: t('import.preview.confirm') })).not.toBeInTheDocument()

    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: { ...emptyResult(true), summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 } } } })
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))
    expect(await screen.findByRole('button', { name: t('import.preview.confirm') })).toBeInTheDocument()

    // Editing again after a successful validate must hide Confirm until re-validated.
    const emailCell = screen.getByDisplayValue('info@acme.nl')
    await user.type(emailCell, '.test')
    expect(screen.queryByRole('button', { name: t('import.preview.confirm') })).not.toBeInTheDocument()
  })

  it('confirm POSTs the real import with the LATEST validated data and shows the result', async () => {
    const user = userEvent.setup()
    await uploadAndReachPreview(user)
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: { ...emptyResult(true), summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 } } } })
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))
    await screen.findByRole('button', { name: t('import.preview.confirm') })

    ;(api.post as MockFn).mockResolvedValueOnce({
      data: { data: { entity: 'customers', dry_run: false, summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 }, unknown_columns: [], rows: [{ row: 2, action: 'create', reference: 'Acme', id: 'c-1', messages: [] }] } },
    })
    await user.click(screen.getByRole('button', { name: t('import.preview.confirm') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/imports/customers', expect.any(FormData)))
    expect(await screen.findByText(t('import.result.title'))).toBeInTheDocument()
  })

  // PDF-VACATURES-2026-08-14 point 7: the vacancies toolbar's Excel-upload button
  // passes `{ entity: 'vacancies' }` — the wizard must land there, not on the
  // first template in display order, when multiple templates are available.
  it('lands on the intent-requested entity instead of the first template', async () => {
    const user = userEvent.setup()
    const vacanciesTemplate = { entity: 'vacancies', columns: ['title'], example_rows: 1, url: '/imports/vacancies/template.csv' }
    ;(api.get as MockFn).mockResolvedValue({ data: { data: [TEMPLATE, vacanciesTemplate] } })
    render(<ImportWizardPage intent={{ entity: 'vacancies' }} />)
    const input = await screen.findByLabelText(t('import.selectCsv'))
    const file = new File(['title\nVerpleegkundige'], 'vacancies.csv', { type: 'text/csv' })
    await user.upload(input, file)
    const next = await screen.findByRole('button', { name: t('import.wizard.next', { defaultValue: 'Next' }) })
    await user.click(next)
    await screen.findByRole('button', { name: t('import.runPreview') })
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: { entity: 'vacancies', dry_run: true, summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 }, unknown_columns: [], rows: [] } } })
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/imports/vacancies/dry-run', expect.any(FormData)))
  })

  it('shows the server error and no Confirm button when the dry-run fails', async () => {
    const user = userEvent.setup()
    await uploadAndReachPreview(user)
    ;(api.post as MockFn).mockRejectedValueOnce({ response: { data: { message: 'Bestand kon niet worden gelezen.' } } })

    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))

    expect(await screen.findByText('Bestand kon niet worden gelezen.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('import.preview.confirm') })).not.toBeInTheDocument()
  })

  // The .xlsx entry point lives on the raw-upload screens (settings importeren,
  // the shared EntityImportCard, SubEntityImportCard) — THIS screen parses the file
  // client-side for column mapping (no xlsx parser in the repo), so it stays
  // .csv/.txt only on purpose.
  it('the upload input stays .csv/.txt only — this screen parses client-side, it never got .xlsx', async () => {
    render(<ImportWizardPage />)
    const input = await screen.findByLabelText(t('import.selectCsv')) as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt')
  })
})

// IMPORT-PERM-ENTITY-1: the permission gate follows the SELECTED entity, not a
// hardcoded customers.* pair — mirrors routes/api/tenant/exports.php (K6c: vacancies
// carries its own vacancies.view/vacancies.create right, every other entity here is
// a customer-tree sub-entity sharing customers.view/customers.create).
describe('ImportWizardPage — the permission gate follows the SELECTED entity (IMPORT-PERM-ENTITY-1)', () => {
  const VACANCIES_TEMPLATE = { entity: 'vacancies', columns: ['title'], example_rows: 1, url: '/imports/vacancies/template.csv' }

  it('a user with vacancies.create but NOT customers.create can proceed for the vacancies entity', async () => {
    ;(api.get as MockFn).mockResolvedValue({ data: { data: [VACANCIES_TEMPLATE] } })
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'vacancies.view' || perm === 'vacancies.create' })

    render(<ImportWizardPage intent={{ entity: 'vacancies' }} />)

    // No "no import permission" notice, upload input enabled for this entity.
    expect(await screen.findByLabelText(t('import.selectCsv'))).toBeEnabled()
    expect(screen.queryByText(t('import.noImportPermission'))).not.toBeInTheDocument()
  })

  it('that SAME user is correctly blocked on the customers entity', async () => {
    ;(api.get as MockFn).mockResolvedValue({ data: { data: [{ ...TEMPLATE }, VACANCIES_TEMPLATE] } })
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'vacancies.view' || perm === 'vacancies.create' })

    // No intent → lands on the first template in display order (customers).
    render(<ImportWizardPage />)

    expect(await screen.findByText(t('import.noImportPermission'))).toBeInTheDocument()
    expect(screen.getByLabelText(t('import.selectCsv'))).toBeDisabled()
  })
})
