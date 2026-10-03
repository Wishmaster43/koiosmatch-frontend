/**
 * RunStepInspectorPanel — SHARED-UNIT-TEST-1: input/output trees render from
 * the step envelope, the Fields=own filter hides upstream keys via the
 * catalog's output_fields, load-more pages a list key with the right params,
 * and the loading/error states render honestly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import RunStepInspectorPanel from './RunStepInspectorPanel'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})
// Raw key passthrough — assertions target stable keys, not locale copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('./useModuleCatalog', () => ({
  useModuleCatalog: () => ({ catalog: { candidates_fetch: { outputFields: { candidates: 'Kandidaten' }, emits: 'replace' } } }),
}))

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const envelope = {
  data: {
    id: 'step-1', module_type: 'candidates_fetch', status: 'success', started_at: '2026-10-02T10:00:00Z',
    output: { candidates: [{ id: 1 }, { id: 2 }], candidates_total: 2, upstream_key: 'rides along' },
    list_keys: ['candidates'],
    attempts_log: [{ attempt: 1, status: 'success', input: { page: 1 }, output: { candidates: [{ id: 1 }], upstream_key: 'rides along' }, error: null, executed_at: '2026-10-02T10:00:00Z' }],
    attempts_total: 1,
  },
  list: null,
}

beforeEach(() => vi.clearAllMocks())

describe('RunStepInspectorPanel', () => {
  it('loads the step and renders both trees from the fixture', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: envelope } as never)
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="Kandidaten ophalen" onClose={() => {}} />, { wrapper })
    expect(await screen.findByText('inspector.input')).toBeInTheDocument()
    expect(screen.getByText('inspector.output')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/workflow-runs/run-1/steps/step-1', expect.objectContaining({ quietStatuses: [403] }))
  })

  it('Fields=own hides the upstream key, Fields=all shows it', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: envelope } as never)
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="Kandidaten ophalen" onClose={() => {}} />, { wrapper })
    await screen.findByText('inspector.output')
    // Default "all": the upstream key rides along in the full attempt output.
    expect(screen.getByText('upstream_key:')).toBeInTheDocument()
    // Open the Fields picker trigger, then pick "own".
    await userEvent.click(screen.getByText('inspector.fieldsAll'))
    await userEvent.click(screen.getByText('inspector.fieldsOwn'))
    await waitFor(() => expect(screen.queryByText('upstream_key:')).toBeNull())
  })

  it('shows an honest error state with a retry', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'))
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="X" onClose={() => {}} />, { wrapper })
    expect(await screen.findByText('common:errorGeneric')).toBeInTheDocument()
  })

  it('load-more pages a list key with the right params and merges the rows into Output', async () => {
    // attempts_log is non-empty (every executed step has a row per the FINAL
    // CONTRACT) — load-more must still show for the newest attempt, since it
    // paginates the step's own `output`, never a frozen attempt row.
    const withAttempt = {
      data: {
        id: 'step-1', module_type: 'candidates_fetch', status: 'success',
        output: { candidates: Array.from({ length: 50 }, (_, i) => ({ id: i })), candidates_total: 120 },
        list_keys: ['candidates'],
        attempts_log: [{ attempt: 1, status: 'success', input: { page: 1 }, output: { candidates: Array.from({ length: 50 }, (_, i) => ({ id: i })) }, executed_at: '2026-10-02T10:00:00Z' }],
        attempts_total: 1,
      },
      list: null,
    }
    vi.mocked(api.get).mockImplementation((_url, cfg) =>
      cfg?.params
        ? Promise.resolve({ data: { list: { key: 'candidates', data: [{ id: 'new-row' }], meta: { current_page: 2, last_page: 3, per_page: 50, total: 120 } } } } as never)
        : Promise.resolve({ data: withAttempt } as never))
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="Kandidaten ophalen" onClose={() => {}} />, { wrapper })
    const loadMore = await screen.findByText(/inspector\.loadMore/)
    await userEvent.click(loadMore)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflow-runs/run-1/steps/step-1', expect.objectContaining({
      params: { list: 'candidates', page: 2, per_page: 50 },
    })))
    // The newly loaded row rides into the Output tree once the merge settles —
    // the load-more label's shown count ticks from 50 to 51 first.
    await waitFor(() => expect(screen.getAllByText(/"shown":51/).length).toBeGreaterThan(0))
    // Search forces matching branches open, so the merged row (deep in bundle 51) surfaces.
    await userEvent.type(screen.getByLabelText('inspector.searchOutput'), 'new-row')
    await waitFor(() => expect(screen.getByText(/new-row/)).toBeInTheDocument())
  })

  it('narrows the tree via the search box', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: envelope } as never)
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="Kandidaten ophalen" onClose={() => {}} />, { wrapper })
    await screen.findByText('upstream_key:')
    await userEvent.type(screen.getByLabelText('inspector.searchOutput'), 'candidates')
    await waitFor(() => expect(screen.queryByText('upstream_key:')).toBeNull())
  })

  it('renders as a resizable, maximizable panel', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: envelope } as never)
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="Kandidaten ophalen" onClose={() => {}} />, { wrapper })
    await screen.findByText('inspector.input')
    expect(screen.getByLabelText('maximizeWindow')).toBeInTheDocument()
  })

  it('shows an honest forbidden state', async () => {
    const err = Object.assign(new Error('forbidden'), { response: { status: 403 } })
    vi.mocked(api.get).mockRejectedValue(err)
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="X" onClose={() => {}} />, { wrapper })
    expect(await screen.findByText('inspector.forbidden')).toBeInTheDocument()
  })

  it('renders the honest empty caption for a genuinely empty input bundle', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { id: 'step-1', module_type: 'wait', status: 'success', output: {}, attempts_log: [{ attempt: 1, status: 'success', input: {}, output: {}, executed_at: '2026-10-02T10:00:00Z' }] } },
    } as never)
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="Wachten" onClose={() => {}} />, { wrapper })
    expect(await screen.findByText('inspector.noInput')).toBeInTheDocument()
    expect(screen.getByText('inspector.noOutput')).toBeInTheDocument()
  })
})

// RUN-INSPECTOR-1 polish: each column's search box names what it searches (screen check 03-10:
// the Input column used to say "Zoeken in output…").
describe('RunStepInspectorPanel · per-column search placeholders', () => {
  it('labels the Input and Output search boxes with their own keys', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: envelope } as never)
    render(<RunStepInspectorPanel runId="run-1" stepId="step-1" moduleLabel="Kandidaten ophalen" onClose={() => {}} />, { wrapper })
    await screen.findByText('inspector.output')
    expect(screen.getByPlaceholderText('inspector.searchInput')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('inspector.searchOutput')).toBeInTheDocument()
  })
})

