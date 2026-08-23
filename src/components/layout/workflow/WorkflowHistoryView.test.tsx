import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import api from '@/lib/api'
import WorkflowHistoryView from './WorkflowHistoryView'

// The history view fetches this workflow's runs on mount → stub the api client.
// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

// Raw key passthrough (assertions target stable keys, not locale copy) + a
// MUTABLE `i18n.language` (vi.hoisted ref, changed per test below) so
// useDateFormat()'s useLocale() (now used for the started_at column) never
// touches the real i18next singleton — mirrors the house pattern (see
// RetentionConsentBlock.test.tsx). `@/i18n` itself is mocked too: importing the
// real module self-initialises i18next as a side effect (its own
// `i18n.use(initReactI18next).init(...)`), which would otherwise crash under
// the react-i18next mock above (no initReactI18next export) — see
// lib/countries.ts's file-header note on the same landmine.
const activeI18n = vi.hoisted(() => ({ language: 'nl' }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: activeI18n }),
}))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))

const run = { id: 1, status: 'success', started_at: '2026-06-23T10:00:00Z', trigger: 'manual', duration_ms: 5000 }

describe('WorkflowHistoryView', () => {
  // Braces are load-bearing: mockReset() returns the mock, and a function returned
  // from beforeEach becomes a vitest cleanup hook that CALLS it argless (VACTAB-TEST-1).
  beforeEach(() => { vi.mocked(api.get).mockReset(); activeI18n.language = 'nl' })

  it('shows the loading state while runs are fetching', async () => {
    // Deferred promise: assert loading, then resolve so the worker settles cleanly.
    let resolve!: (v: unknown) => void
    vi.mocked(api.get).mockReturnValue(new Promise(r => { resolve = r }))
    render(<WorkflowHistoryView workflowId={1} />)
    expect(screen.getByText('runs.loading')).toBeInTheDocument()
    resolve({ data: [] })
    await screen.findByText('runs.editorEmpty')
  })

  it('shows the empty state when there are no runs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    render(<WorkflowHistoryView workflowId={1} />)
    expect(await screen.findByText('runs.editorEmpty')).toBeInTheDocument()
  })

  it('renders a run row and opens the drawer on click', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [run] })
    render(<WorkflowHistoryView workflowId={1} />)
    const triggerCell = await screen.findByText('manual')
    fireEvent.click(triggerCell)
    expect(await screen.findByText('runs.drawer.timeline')).toBeInTheDocument()
  })

  // FINISH audit (2026-08): the started_at column used to hardcode 'nl-NL' in a
  // toLocaleDateString call — now it reuses useDateFormat().formatDate, so the
  // separator follows the active app language (dd-mm vs dd/mm), never a fixed locale.
  it('follows the active app locale for the started_at date, not a hardcoded nl-NL', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [run] })
    const { unmount } = render(<WorkflowHistoryView workflowId={1} />)
    expect(await screen.findByText('23-06-2026')).toBeInTheDocument()
    unmount()

    activeI18n.language = 'en'
    render(<WorkflowHistoryView workflowId={1} />)
    expect(await screen.findByText('23/06/2026')).toBeInTheDocument()
  })

  // P39: the chevron expands the row inline WITHOUT opening the drawer, reading
  // straight off the already-fetched list row (step data rides `run`, not a new fetch).
  it('expands a row inline on chevron click without opening the drawer', async () => {
    const runWithSteps = { ...run, step_results: [{ label: 'Sync candidates', status: 'success' }] }
    vi.mocked(api.get).mockResolvedValue({ data: [runWithSteps] })
    render(<WorkflowHistoryView workflowId={1} />)
    await screen.findByText('manual')

    const toggle = screen.getByRole('button', { name: 'runs.cols.expand' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('Sync candidates')).toBeInTheDocument()
    expect(screen.queryByText('runs.drawer.timeline')).not.toBeInTheDocument()
  })

  it('still opens the drawer when clicking the row outside the chevron', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [run] })
    render(<WorkflowHistoryView workflowId={1} />)
    const triggerCell = await screen.findByText('manual')
    fireEvent.click(triggerCell)
    expect(await screen.findByText('runs.drawer.timeline')).toBeInTheDocument()
  })

  // WF-DRYRUN-FE-1: the banner rides the RUN-LEVEL `dry_run` boolean — never a
  // per-step guess — and renders ONLY when it is actually true.
  it('shows the dry-run banner only when dry_run is true on the expanded row', async () => {
    const dryRun = { ...run, dry_run: true, step_results: [{ label: 'WhatsApp versturen', status: 'skipped' }] }
    vi.mocked(api.get).mockResolvedValue({ data: [dryRun] })
    render(<WorkflowHistoryView workflowId={1} />)
    await screen.findByText('manual')
    fireEvent.click(screen.getByRole('button', { name: 'runs.cols.expand' }))
    expect(await screen.findByText('runs.dryRun.banner')).toBeInTheDocument()
  })

  it('renders no dry-run banner for a normal (non-dry) run', async () => {
    const normalRun = { ...run, step_results: [{ label: 'Sync candidates', status: 'success' }] }
    vi.mocked(api.get).mockResolvedValue({ data: [normalRun] })
    render(<WorkflowHistoryView workflowId={1} />)
    await screen.findByText('manual')
    fireEvent.click(screen.getByRole('button', { name: 'runs.cols.expand' }))
    await screen.findByText('Sync candidates')
    expect(screen.queryByText('runs.dryRun.banner')).not.toBeInTheDocument()
  })
})
