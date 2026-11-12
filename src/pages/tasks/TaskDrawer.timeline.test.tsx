/** TaskDrawer: timeline tab and the schedule-appointment quick action. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
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

/**
 * TIJDLIJN-OVERAL (27-08): the timeline tab is LAST (tasks carry no Statistics
 * tab) — X-36 update: now fires GET /tasks/{id}/timeline instead of the old
 * activity endpoint; the title-row popover still shows the raw activity/changelog.
 */
describe('TaskDrawer · Timeline tab (TIJDLIJN-OVERAL + X-36)', () => {
  it('renders "timeline" as the LAST tab, after notes', () => {
    mount(task(false))
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    const notesIdx = labels.indexOf(i18n.t('tasks:drawer.tabs.notes'))
    // Literal label: a raw-key render (missing i18n) must FAIL, never round-trip.
    const timelineIdx = labels.indexOf('Tijdlijn')
    expect(timelineIdx).toBeGreaterThan(notesIdx)
    expect(timelineIdx).toBe(labels.length - 1)
  })

  it('allows selecting and rendering the timeline tab with TimelineTab component', async () => {
    mount(task(false))
    // The timeline tab should be clickable and render (exact content tested in TimelineTab.test.tsx)
    const timelineTab = screen.getByRole('tab', { name: i18n.t('tasks:drawer.tabs.timeline') })
    expect(timelineTab).toBeInTheDocument()
    fireEvent.click(timelineTab)
    // After clicking, the tab should be active (aria-selected)
    await waitFor(() => {
      expect(timelineTab).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('the title-row popover still opens the raw changelog (GET /tasks/{id}/activity)', async () => {
    const user = userEvent.setup()
    mount(task(false))
    const trigger = screen.getByRole('button', { name: i18n.t('common:changelog') })
    await user.click(trigger)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tasks/t1/activity', expect.anything()))
  })
})

/**
 * X-36: quick action "Afspraak plannen" (schedule appointment) — appears only on
 * tasks linked to a candidate, opens PlanIntakeModal with candidateId and optional
 * applicationId.
 */
describe('TaskDrawer · Quick action "Afspraak plannen" (X-36)', () => {
  it('shows the "Afspraak plannen" button when the task links to a candidate', () => {
    mount({ ...task(false), links: [{ type: 'candidate', id: 'c123', label: 'Alice' }] })
    expect(screen.getByRole('button', { name: i18n.t('tasks:drawer.scheduleAppointment') })).toBeInTheDocument()
  })

  it('hides the button when the task has no candidate link', () => {
    mount({ ...task(false), links: [{ type: 'vacancy', id: 'v1', label: 'Role X' }] })
    expect(screen.queryByRole('button', { name: i18n.t('tasks:drawer.scheduleAppointment') })).toBeNull()
  })

  it('hides the button when the task is archived (restore first)', () => {
    mount({ ...task(true), links: [{ type: 'candidate', id: 'c123', label: 'Alice' }] })
    expect(screen.queryByRole('button', { name: i18n.t('tasks:drawer.scheduleAppointment') })).toBeNull()
  })

  it('opens the modal with the candidate ID when clicked', async () => {
    const user = userEvent.setup()
    mount({
      ...task(false),
      links: [
        { type: 'candidate', id: 'c123', label: 'Alice' },
      ],
    })
    const btn = screen.getByRole('button', { name: i18n.t('tasks:drawer.scheduleAppointment') })
    await user.click(btn)
    await waitFor(() => {
      const modal = screen.getByTestId('plan-intake-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute('data-candidate-id', 'c123')
    })
  })

  it('opens the modal with both candidate and application IDs when both are present', async () => {
    const user = userEvent.setup()
    mount({
      ...task(false),
      links: [
        { type: 'candidate', id: 'c123', label: 'Alice' },
        { type: 'application', id: 'app456', label: 'Application' },
      ],
    })
    const btn = screen.getByRole('button', { name: i18n.t('tasks:drawer.scheduleAppointment') })
    await user.click(btn)
    await waitFor(() => {
      const modal = screen.getByTestId('plan-intake-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute('data-candidate-id', 'c123')
      expect(modal).toHaveAttribute('data-application-id', 'app456')
    })
  })

  it('closes the modal when onClose is called', async () => {
    const user = userEvent.setup()
    mount({
      ...task(false),
      links: [
        { type: 'candidate', id: 'c123', label: 'Alice' },
      ],
    })
    const btn = screen.getByRole('button', { name: i18n.t('tasks:drawer.scheduleAppointment') })
    await user.click(btn)
    await waitFor(() => {
      expect(screen.getByTestId('plan-intake-modal')).toBeInTheDocument()
    })
    // Click the close button in the modal
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByTestId('plan-intake-modal')).not.toBeInTheDocument()
    })
  })
})
