/** TaskDrawer: trash lifecycle and header badge/colour lookups. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { chipInk, tint, tintBg } from '@/lib/tint'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import TaskDrawer from './TaskDrawer'
import type { TaskDetail } from '@/types/task'
import { task, lookupFixtures, metaOf } from './TaskDrawer.testKit'

// TASK-DISPLAY-DRILL-1: controllable display settings (DetailsTab.test.tsx's
// record pattern) — defaults on; the colour-toggle OFF-case below flips it.
const displaySettingsRecord = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => displaySettingsRecord.current,
  getBoolSetting: (s: Record<string, unknown>, key: string, fallback: boolean) =>
    key in s ? s[key] === true || s[key] === 'true' || s[key] === '1' : fallback,
}))

// Controllable tenant task lookups (plain refs read lazily by the mock below) — lets the
// TAKEN-CHIP-KLEUR-BUG-1 regression test mutate a lookup row without a network round-trip.
const lookups = lookupFixtures()
const statusesRef = { current: lookups.statuses }
const typesRef = { current: lookups.types }
const prioritiesRef = { current: lookups.priorities }

// Lookups/users/custom-fields arrive via mocked hooks, no providers needed.
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({
    statuses: statusesRef.current, types: typesRef.current, priorities: prioritiesRef.current,
    statusMeta: metaOf(statusesRef.current), typeMeta: metaOf(typesRef.current), priorityMeta: metaOf(prioritiesRef.current),
    doneStatusValues: ['done'], defaultPriority: null,
  }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
// TASK-LOCATION-READ-1: DetailsTab (rendered inside the 'details' tab) now reads
// the tenant's branches via react-query's useLocations — mock it out for the same
// reason useUsers above is mocked (no QueryClientProvider in this render harness).
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
// TEAM-1: DetailsTab also reads the tenant's INTERNAL departments through
// react-query — mocked for the same no-QueryClientProvider reason as the two above.
vi.mock('@/lib/useTeams', () => ({ useTeams: () => ({ teams: [], loading: false, error: false, retry: vi.fn() }) }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// TRASH-OVERAL-2: post + a real body-unwrap serve the shared TrashLifecycleSection
// (deletion-preview GET, mark/unmark POSTs); the never-resolving get default keeps
// the untested tab fetches quiet exactly as before.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(() => Promise.resolve({ data: { data: { lifecycle: 'pending_erase' } } })),
  },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
  unwrapList: () => ({ rows: [] }),
  getActiveTenantId: vi.fn(() => 'test-tenant'),
}))
vi.mock('@/pages/settings/lib/settingsApi', () => ({
  loadSettings: () => Promise.resolve({ deletion_grace_days: '30' }),
}))
vi.mock('@/pages/candidates/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/candidates/shared')>()
  return {
    ...actual,
    PlanIntakeModal: ({ candidateId, applicationId, onClose }: { candidateId?: string | number; applicationId?: string | number | null; onClose: () => void }) => (
      <div data-testid="plan-intake-modal" data-candidate-id={candidateId} data-application-id={applicationId}>
        <button onClick={onClose}>Close</button>
      </div>
    ),
  }
})

const noop = () => {}
const mount = (t: TaskDetail, onRestore?: (id: unknown) => void) =>
  render(<TaskDrawer task={t} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} onRestore={onRestore} />)

// TRASH-OVERAL-2: the drawer's trash surface — REQUEST-asserting (§13): the exact
// mark POST with and without transfer_to_owner_id, the unmark POST, and the
// permission-hidden mark action (tasks.delete / tasks.update via the page).
describe('TaskDrawer · trash lifecycle (TRASH-OVERAL-2)', () => {
  const tc = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })
  const PREVIEW = { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' }
  const trashWiring = (over: Partial<Record<string, unknown>> = {}) => ({
    canMark: true, canUnmark: true,
    users: [{ value: 'u-1', label: 'Anna de Vries' }],
    onMarked: vi.fn(), onUnmarked: vi.fn(), ...over,
  })
  // Route ONLY the preview GET to a resolved response; every other get keeps the
  // never-resolving default this file uses to quiet untested tab fetches.
  const routePreview = (preview: Record<string, unknown>) =>
    vi.mocked(api.get).mockImplementation(((url: string) => url.includes('deletion-preview')
      ? Promise.resolve({ data: { data: preview } })
      : new Promise(() => {})) as never)
  const mountTrash = (t: TaskDetail, wiring = trashWiring()) => {
    render(<TaskDrawer task={t} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} trash={wiring} />)
    return wiring
  }

  it('mark flow: preview GET + confirm POSTs /tasks/{id}/mark-deletion with an EMPTY body', async () => {
    routePreview(PREVIEW)
    const user = userEvent.setup()
    const wiring = mountTrash({ ...task(true), archived: true, lifecycle: 'archived' })

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tasks/t1/deletion-preview'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/mark-deletion', {}, { quietStatuses: [409] }))
    expect(wiring.onMarked).toHaveBeenCalledWith('t1')
  })

  it('mark flow with a picked transfer owner sends {transfer_to_owner_id}', async () => {
    routePreview({ ...PREVIEW, transferable: { attribute: 'owner_id', current_owner_id: null } })
    const user = userEvent.setup()
    mountTrash({ ...task(true), archived: true, lifecycle: 'archived' })

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await user.click(await screen.findByText(tc('trash.modal.transferPlaceholder') as string))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/mark-deletion',
      { transfer_to_owner_id: 'u-1' }, { quietStatuses: [409] }))
  })

  it('hides the mark action without tasks.delete (no fake affordances)', () => {
    mountTrash(task(true), trashWiring({ canMark: false }) as ReturnType<typeof trashWiring>)
    expect(screen.queryByRole('button', { name: tc('trash.markAction') as string })).toBeNull()
  })

  it('unmark on a pending_erase record POSTs /tasks/{id}/unmark-deletion', async () => {
    const pending = { ...task(true, '2026-08-01T10:00:00Z'), lifecycle: 'pending_erase', pendingEraseAt: '2026-08-02T10:00:00Z' }
    const user = userEvent.setup()
    const wiring = mountTrash(pending)

    await user.click(screen.getByRole('button', { name: tc('trash.unmarkAction') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks/t1/unmark-deletion', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
    expect(wiring.onUnmarked).toHaveBeenCalledWith('t1')
  })
})

/**
 * TAKEN-CHIP-KLEUR-BUG-1: the header's status badge/avatar and type subtitle used
 * to read task.statusLabel/statusColor/typeLabel — baked once at select/fetch time
 * and never re-derived. Same fix as DetailsTab.tsx: resolve from the LIVE tenant
 * lookup (statusMeta/typeMeta) by the raw key, at render.
 */
describe('TaskDrawer · header badge reads the LIVE lookup, not a baked snapshot (TAKEN-CHIP-KLEUR-BUG-1)', () => {
  // The status BADGE sits in EntityHeader's own "title row" — the same flex row
  // as the close button, and a separate row from the meta pickers below it (whose
  // "status" SelectMenu ALSO shows "Te doen" as its live current value, by design)
  // and from DetailsTab's own chip in the visible 'details' tab body.
  const titleRowScope = () => within(screen.getByRole('button', { name: i18n.t('common:close') }).parentElement!)
  // The TYPE subtitle sits right below the title text, in its own wrapper div —
  // scoped there too, away from DetailsTab's own type chip in the tab body.
  const subtitleScope = () => within(screen.getByText('Bel kandidaat').parentElement!.parentElement!)

  it('renders the CURRENT lookup label/colour even when task.statusLabel/statusColor/typeLabel disagree (stale bake)', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture colour (DATA, not UI styling)
    const stale = { ...task(false), statusLabel: 'Oude naam', statusColor: '#000000', typeLabel: 'Oud type' }
    mount(stale)
    // The live lookup ('todo' → 'Te doen'/'#888888', 'call' → 'Belafspraak') wins.
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the test fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveInlineStyle({ color: chipInk('#888888') })
    expect(subtitleScope().getByText('Belafspraak')).toBeInTheDocument()
    expect(screen.queryByText('Oude naam')).not.toBeInTheDocument()
    expect(screen.queryByText('Oud type')).not.toBeInTheDocument()
  })

  it('updates the badge colour once the tenant lookup colour changes (live reactivity)', () => {
    const { rerender } = mount(task(false))
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the test fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveInlineStyle({ color: chipInk('#888888') })

    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    statusesRef.current[0].color = '#123456'
    rerender(<TaskDrawer task={task(false)} onClose={noop} onUpdate={noop} onAddLink={noop} onRemoveLink={noop} />)
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the test fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveInlineStyle({ color: chipInk('#123456') })
    // eslint-disable-next-line no-restricted-syntax -- restore the fixture colour for tests running after this one
    statusesRef.current[0].color = '#888888'
  })
})

/*
 * TASK-DISPLAY-DRILL-1 OFF-case (predecessor audit 65ad059e): colours off in the
 * table means a NEUTRAL drill-down header — Avatar hashes a palette colour on
 * null, so the fix must pass an explicit NEUTRAL_AVATAR, and the badge falls
 * back to TitleBadge's own grey.
 */
describe('TaskDrawer · header follows the table colour toggle (TASK-DISPLAY-DRILL-1 off-case)', () => {
  const titleRowScope = () => within(screen.getByRole('button', { name: i18n.t('common:close') }).parentElement!)
  beforeEach(() => { displaySettingsRecord.current = {} })
  afterEach(() => {
    displaySettingsRecord.current = {}
    // eslint-disable-next-line no-restricted-syntax -- restore the fixture colour for tests running after this one
    statusesRef.current[0].color = '#888888'
  })

  it('toggle ON (default): avatar and badge carry the live lookup colour', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    statusesRef.current[0].color = '#123456'
    mount(task(false))
    // eslint-disable-next-line no-restricted-syntax -- asserting tint() output for the fixture colour, not a UI colour choice
    expect(screen.getByText('BK')).toHaveInlineStyle({ background: tint('#123456', 12) })
    // eslint-disable-next-line no-restricted-syntax -- asserting chipInk() output for the fixture colour, not a UI colour choice
    expect(titleRowScope().getByText('Te doen')).toHaveInlineStyle({ color: chipInk('#123456') })
  })

  it('toggle OFF: avatar renders the explicit neutral and the badge its own grey', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    statusesRef.current[0].color = '#123456'
    displaySettingsRecord.current = { task_table_color_status: false }
    mount(task(false))
    expect(screen.getByText('BK')).toHaveInlineStyle({ background: tint(NEUTRAL_AVATAR, 12) })
    const badge = titleRowScope().getByText('Te doen')
    // The DOM lowercases hex colours, so assert against the lowercased token.
    expect(badge).toHaveInlineStyle({ color: chipInk(NEUTRAL_AVATAR.toLowerCase()), background: tintBg(NEUTRAL_AVATAR) })
  })
})
