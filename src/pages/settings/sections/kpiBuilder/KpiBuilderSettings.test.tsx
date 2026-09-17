/**
 * KpiBuilderSettings — mutation tests assert the REQUEST route + body (§13),
 * not just that a callback fired. Harness mirrors ReportKpiSettings.test.tsx:
 * mock `@/lib/api` fully, one QueryClientProvider per render, real i18n strings
 * via `i18n.t` (whether or not the KPI-builder locale keys have landed yet —
 * both the component and this test resolve the same key through the same t()).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import api from '@/lib/api'
import KpiBuilderSettings from './KpiBuilderSettings'
import type { KpiDefinition, KpiMetricsRegistry } from './kpiDefinitionsApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

let canEdit = true
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => canEdit }) }))

afterEach(() => { vi.clearAllMocks(); canEdit = true })

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const ct = (key: string) => i18n.t(key, { ns: 'common' })

const REGISTRY: KpiMetricsRegistry = {
  match: {
    metrics: [
      { key: 'new_in_period', label: 'New matches', kind: 'count', default_unit: 'count' },
      { key: 'avg_duration', label: 'Avg duration', kind: 'avg_days', default_unit: 'days' },
    ],
    dimensions: ['all', 'match_contract_form'],
  },
}

function rowsFixture(): KpiDefinition[] {
  return [
    { id: 'kd-1', entity: 'match', metric_key: 'new_in_period', dimension: 'all', dimension_value: null, label: 'Nieuwe matches', target_value: 10, warn_value: null, comparison: 'gte', unit: 'count', surfaces: ['report'], dashboard_roles: null, active: true, sort_order: 0, computed: { metric_label: 'New matches' } },
    { id: 'kd-2', entity: 'match', metric_key: 'avg_duration', dimension: 'all', dimension_value: null, label: null, target_value: null, warn_value: null, comparison: 'none', unit: 'days', surfaces: ['report'], dashboard_roles: null, active: true, sort_order: 1, computed: { metric_label: 'Avg duration' } },
  ]
}

function armApi(rows: KpiDefinition[], registry: KpiMetricsRegistry = REGISTRY) {
  vi.mocked(api.get).mockImplementation(((url: string, config?: { params?: { entity?: string } }) => {
    if (url === '/kpi-metrics') return Promise.resolve({ data: { data: registry } })
    if (url === '/kpi-definitions') {
      // The tenant-total query passes no `entity` param; the per-entity query does.
      const wantedEntity = config?.params?.entity
      return Promise.resolve({ data: { data: wantedEntity == null ? rows : rows.filter(r => r.entity === wantedEntity) } })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  }) as typeof api.get)
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{<KpiBuilderSettings />}</QueryClientProvider>)
}

describe('KpiBuilderSettings', () => {
  it('lists the match entity\'s two seeded rows from GET /kpi-definitions?entity=match', async () => {
    armApi(rowsFixture())
    renderPanel()
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/kpi-definitions', expect.objectContaining({ params: { entity: 'match' } })))
    expect(await screen.findByText('Nieuwe matches')).toBeInTheDocument()
    expect(screen.getByText('Avg duration')).toBeInTheDocument()
  })

  it('creates a definition with the full create body', async () => {
    armApi(rowsFixture())
    vi.mocked(api.post).mockResolvedValue({ data: { data: rowsFixture()[0] } })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Nieuwe matches')

    await user.click(screen.getByRole('button', { name: st('kpiBuilder.addBtn') }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: st('kpiBuilder.field.metric') }))
    // The picker's own option list portals to document.body (DropdownPopover),
    // outside the FloatingPanel subtree — query at document level, not within(dialog).
    await user.click(await screen.findByRole('button', { name: 'New matches' }))
    await user.click(within(dialog).getByRole('radio', { name: st('kpiBuilder.comparison.gte') }))
    await user.type(within(dialog).getByLabelText(st('kpiBuilder.field.target')), '15')
    // Create's submit label is the add-button wording, not common:save (only an edit says "Opslaan").
    await user.click(within(dialog).getByRole('button', { name: st('kpiBuilder.addBtn') }))

    // NOTE (declined/deviation, see report): the plan's §1.9 fixture pairs
    // target_value:15 with comparison:'none', but useKpiDefinitionDraft.createBody
    // (built in batch B1, held) forces target_value to null whenever comparison
    // is 'none' and the form only shows the target field once comparison !== 'none'
    // — so a real 15 requires picking 'gte' first. This asserts the body the
    // actually-built code produces.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/kpi-definitions', {
      entity: 'match', metric_key: 'new_in_period', unit: 'count', dimension: 'all', dimension_value: null,
      label: null, target_value: 15, warn_value: null, comparison: 'gte', surfaces: ['report'], active: true,
    }))
  })

  it('edits only the changed field, sending exactly one patch key', async () => {
    armApi(rowsFixture())
    vi.mocked(api.patch).mockResolvedValue({ data: { data: rowsFixture()[0] } })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Nieuwe matches')

    await user.click(screen.getAllByRole('button', { name: ct('edit') })[0])
    const dialog = await screen.findByRole('dialog')
    const targetField = within(dialog).getByLabelText(st('kpiBuilder.field.target'))
    await user.clear(targetField)
    await user.type(targetField, '20')
    await user.click(within(dialog).getByRole('button', { name: ct('save') }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/kpi-definitions/kd-1', { target_value: 20 }))
  })

  it('closes the edit popup without a request when nothing changed', async () => {
    armApi(rowsFixture())
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Nieuwe matches')

    await user.click(screen.getAllByRole('button', { name: ct('edit') })[0])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: ct('save') }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('deletes with an undo notice, then restores', async () => {
    armApi(rowsFixture())
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    vi.mocked(api.post).mockResolvedValue({ data: { data: rowsFixture()[0] } })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Nieuwe matches')

    await user.click(screen.getAllByRole('button', { name: ct('delete') })[0])
    await user.click(screen.getByRole('button', { name: ct('confirm') }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/kpi-definitions/kd-1'))

    await user.click(await screen.findByRole('button', { name: st('kpiBuilder.restoreBtn') }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/kpi-definitions/kd-1/restore'))
  })

  it('the keyboard "move down" reorder PUTs the new full id order', async () => {
    armApi(rowsFixture())
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Nieuwe matches')

    // DragList's shared keyboard reorder (ChevronDown, common:dragList.moveDown) on
    // row 1 swaps it with row 2 — exercised here rather than raw HTML5 DnD events.
    const moveDownButtons = screen.getAllByRole('button', { name: ct('dragList.moveDown') })
    await user.click(moveDownButtons[0])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/kpi-definitions/order', { ids: ['kd-2', 'kd-1'] }))
  })

  it('disables add and shows the cap notice at 12 active rows', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ ...rowsFixture()[0], id: `kd-${i}`, label: `Row ${i}` }))
    armApi(rows)
    renderPanel()
    await screen.findByText('Row 0')

    expect(screen.getByRole('button', { name: st('kpiBuilder.addBtn') })).toBeDisabled()
    expect(screen.getByText(st('kpiBuilder.capReached', { max: 12 }))).toBeInTheDocument()
  })

  it('disables every write control without settings.update, but still renders the list', async () => {
    canEdit = false
    armApi(rowsFixture())
    renderPanel()
    await screen.findByText('Nieuwe matches')

    expect(screen.getByRole('button', { name: st('kpiBuilder.addBtn') })).toBeDisabled()
    screen.getAllByRole('button', { name: ct('edit') }).forEach(btn => expect(btn).toBeDisabled())
    screen.getAllByRole('button', { name: ct('delete') }).forEach(btn => expect(btn).toBeDisabled())
    screen.getAllByRole('switch').forEach(sw => expect(sw).toBeDisabled())
    expect(screen.queryByRole('button', { name: ct('dragList.moveDown') })).not.toBeInTheDocument()
  })

  it('shows a retryable error banner and no add button when the definitions GET fails', async () => {
    vi.mocked(api.get).mockImplementation(((url: string) => {
      if (url === '/kpi-metrics') return Promise.resolve({ data: { data: REGISTRY } })
      if (url === '/kpi-definitions') return Promise.reject(new Error('boom'))
      return Promise.reject(new Error(`unexpected GET ${url}`))
    }) as typeof api.get)
    renderPanel()

    // useKpiDefinitions retries once (retry: 1) before settling into error — allow for that.
    expect(await screen.findByText(st('kpiBuilder.loadError'), {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('kpiBuilder.addBtn') })).not.toBeInTheDocument()
  })
})
