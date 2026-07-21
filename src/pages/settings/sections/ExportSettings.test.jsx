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

// Master-detail layout (Danny 21-07: same format as Importeren) — every entity is
// a left sub-nav item; the right detail panel shows the SELECTED entity's export action.
describe('ExportSettings screen', () => {
  it('lists every entity in the sub-nav and shows one enabled export button for the selection', () => {
    render(<ExportSettings />)

    // All five entities are reachable from the left sub-nav.
    for (const id of ['candidates', 'applications', 'vacancies', 'leads', 'customers']) {
      expect(screen.getByRole('button', { name: t(`export.entities.${id}.title`) })).toBeInTheDocument()
    }
    // The detail panel shows exactly one export button (the selected entity's), enabled.
    const exportButtons = screen.getAllByRole('button', { name: t('export.button') })
    expect(exportButtons).toHaveLength(1)
    expect(exportButtons[0]).toBeEnabled()
  })

  it('disables (never hides) the export button for a selected entity the user lacks view-permission for', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (perm) => perm !== 'vacancies.view' })
    const user = userEvent.setup()
    render(<ExportSettings />)

    // Candidates (default selection) is allowed → enabled.
    expect(screen.getByRole('button', { name: t('export.button') })).toBeEnabled()
    // Select vacancies from the sub-nav → its export button is disabled, never hidden.
    await user.click(screen.getByRole('button', { name: t('export.entities.vacancies.title') }))
    const btn = screen.getByRole('button', { name: t('export.button') })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', t('export.noPermission'))
  })
})
