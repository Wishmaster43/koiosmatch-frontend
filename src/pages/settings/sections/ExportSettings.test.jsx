/**
 * ExportSettings — EXPORT-CSV-1 (live, koiosmatch-api commit 3a5f12c). `downloadCsv`
 * is the real request logic behind each button — tested directly against the actual
 * request shape (route + blob responseType) per §13: a mutation test must assert the
 * REQUEST, never only that a callback fired. The screen itself is tested for the
 * permission gate (a user lacking an entity's view-permission gets a disabled button,
 * never a hidden one — §7 the client gate is UX only, the backend re-checks).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ExportSettings, { downloadCsv } from './ExportSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// jsdom has no real blob: URL support — stub with predictable values (mirrors EntityHeader.test.tsx).
const createObjectURL = vi.fn(() => 'blob:mock-url')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('downloadCsv (the real per-entity export request)', () => {
  it('GETs the given route as a blob and triggers a download', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    api.get.mockResolvedValue({ data: new Blob(['a,b\n1,2'], { type: 'text/csv' }), headers: {} })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await downloadCsv('/exports/candidates.csv', 'candidates')

    expect(api.get).toHaveBeenCalledWith('/exports/candidates.csv', { responseType: 'blob' })
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('prefers the server Content-Disposition filename when the header is visible', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    api.get.mockResolvedValue({
      data: new Blob(['a,b\n1,2'], { type: 'text/csv' }),
      headers: { 'content-disposition': 'attachment; filename="candidates-2026-07-20-1943.csv"' },
    })
    let downloadedAs = null
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick() { downloadedAs = this.download })

    await downloadCsv('/exports/candidates.csv', 'candidates')

    expect(downloadedAs).toBe('candidates-2026-07-20-1943.csv')
    vi.unstubAllGlobals()
  })

  it('falls back to a client-built filename in the same convention when no header is visible (CORS)', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    api.get.mockResolvedValue({ data: new Blob(['a,b\n1,2'], { type: 'text/csv' }), headers: {} })
    let downloadedAs = null
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick() { downloadedAs = this.download })

    await downloadCsv('/exports/leads.csv', 'leads')

    expect(downloadedAs).toMatch(/^leads-\d{4}-\d{2}-\d{2}-\d{4}\.csv$/)
    vi.unstubAllGlobals()
  })
})

// All twelve entity ids the screen must list (five original + the seven
// EXPORT-UITBREIDEN-1 routes the backend shipped 2026-07-28).
const ALL_ENTITY_IDS = [
  'candidates', 'applications', 'vacancies', 'leads', 'customers',
  'contacts', 'locations', 'departments', 'matches', 'tasks', 'opportunities', 'outreach',
  'appointments',
]

// Master-detail layout (Danny 21-07: same format as Importeren) — every entity is
// a left sub-nav item; the right detail panel shows the SELECTED entity's export action.
describe('ExportSettings screen', () => {
  it('lists every entity in the sub-nav and shows one enabled export button for the selection', () => {
    render(<ExportSettings />)

    // All twelve entities are reachable from the left sub-nav, resolved through the
    // active locale's translated title — never a hardcoded Dutch label.
    for (const id of ALL_ENTITY_IDS) {
      expect(screen.getByRole('button', { name: t(`export.entities.${id}.title`) })).toBeInTheDocument()
    }
    // The detail panel shows the two format twins (CSV + xlsx), both enabled.
    expect(screen.getByRole('button', { name: t('export.formatCsv') })).toBeEnabled()
    expect(screen.getByRole('button', { name: t('export.formatXlsx') })).toBeEnabled()
  })

  it('disables (never hides) the export button for a selected entity the user lacks view-permission for', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (perm) => perm !== 'vacancies.view' })
    const user = userEvent.setup()
    render(<ExportSettings />)

    // Candidates (default selection) is allowed → enabled.
    expect(screen.getByRole('button', { name: t('export.formatCsv') })).toBeEnabled()
    // Select vacancies from the sub-nav → both twins disabled, never hidden.
    await user.click(screen.getByRole('button', { name: t('export.entities.vacancies.title') }))
    const btn = screen.getByRole('button', { name: t('export.formatCsv') })
    expect(btn).toBeDisabled()
    expect(screen.getByRole('button', { name: t('export.formatXlsx') })).toBeDisabled()
    expect(btn).toHaveAttribute('title', t('export.noPermission'))
  })

  it('disables (never hides) the export button for a NEW entity the user lacks its own view-permission for', async () => {
    // Matches is gated on matches.view (a different permission than the others), so
    // this proves the new rows are wired to their OWN entity permission, not a shared one.
    mockUseAuth.mockReturnValue({ hasPermission: (perm) => perm !== 'matches.view' })
    const user = userEvent.setup()
    render(<ExportSettings />)

    await user.click(screen.getByRole('button', { name: t('export.entities.matches.title') }))
    const btn = screen.getByRole('button', { name: t('export.formatCsv') })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', t('export.noPermission'))
  })

  it('GETs the exact new route when a new entity row triggers its export', async () => {
    api.get.mockResolvedValue({ data: new Blob(['a,b\n1,2'], { type: 'text/csv' }), headers: {} })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<ExportSettings />)

    // Select the new "outreach" row from the sub-nav, then trigger its export button —
    // this asserts the REQUEST (exact route), never just that a handler fired (§13).
    await user.click(screen.getByRole('button', { name: t('export.entities.outreach.title') }))
    await user.click(screen.getByRole('button', { name: t('export.formatCsv') }))

    expect(api.get).toHaveBeenCalledWith('/exports/outreach.csv', { responseType: 'blob' })

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

// FORMATEN (31-08): the xlsx twin rides the same helper — route + blob + .xlsx fallback name.
describe('downloadCsv · xlsx twin', () => {
  it('GETs the .xlsx route as blob and falls back to an .xlsx filename', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    api.get.mockResolvedValue({ data: new Blob(['x']), headers: {} })
    let capturedName
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { capturedName = this.download })

    await downloadCsv('/exports/candidates.xlsx', 'candidates')

    expect(api.get).toHaveBeenCalledWith('/exports/candidates.xlsx', { responseType: 'blob' })
    expect(capturedName).toMatch(/^candidates-\d{4}-\d{2}-\d{2}-\d{4}\.xlsx$/)

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

