/** SectionTabsSort · own order, DRAG-SORT-1 (split from SectionTabsSort.test.tsx; mocks and helpers are duplicated per file because hoisted vi.mock blocks cannot be shared). */
import i18n from '@/i18n'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceTab } from './SectionTabs'

// Hoisted so these bindings exist before the (hoisted) vi.mock factories below
// run during module resolution — a plain `const` here would TDZ-error the
// first time `api.put`/`useAuth()` are actually invoked from inside a mock.
const { getMock, putMock, authState } = vi.hoisted(() => ({
  getMock: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  // Explicit call signature (mirrors ReportKpiSettings.test.tsx's saveSettingsKeys
  // mock) — the own-order persistence-separation test below reads `call[1]` (the
  // request body) off `putMock.mock.calls`, which needs a real parameter tuple.
  putMock: vi.fn<(url: string, body: Record<string, unknown>) => Promise<{ data: object }>>(() => Promise.resolve({ data: {} })),
  authState: { user: null as { ui_preferences?: Record<string, unknown> } | null, refreshUser: vi.fn() },
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('@/lib/api', () => ({
  default: { get: getMock, put: putMock },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
  getActiveTenantId: () => 'test-tenant',
}))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => null }))
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: () => {} }))

beforeEach(() => {
  authState.user = null
  authState.refreshUser.mockClear()
  getMock.mockClear()
  putMock.mockClear()
  putMock.mockImplementation(() => Promise.resolve({ data: {} }))
})

// Open the sort menu, then pick the option with this exact label (mirrors how
// a recruiter actually drives the control — ActionMenu closes after each pick).
const pick = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('button', { name: i18n.t('candidates:sections.sortLabel') }))
  await user.click(screen.getByRole('menuitem', { name: label }))
}

/**
 * DRAG-SORT-1 — own order: display, drag handles gated to that ONE mode, the
 * real reorder gesture bubbling up as `onReorder`, and keyboard operability.
 * BackgroundTab.test.tsx separately asserts the REAL PUT .../reorder request +
 * revert-on-failure — this layer only proves the presentation/gesture contract
 * (§13: a mutation test asserts the request; a display test asserts the DOM).
 */
describe('ExperienceTab own order (DRAG-SORT-1)', () => {
  const items = [
    { id: 'a', title: 'Verpleegkundige', company: 'Zorg B.V.', start: '2020-01-01' },
    { id: 'b', title: 'Arts',            company: 'Kliniek',   start: '2022-06-15' },
    { id: 'c', title: 'Coördinator',     company: 'Huis',      start: '2018-03-10' },
  ]
  const names = () => screen.getAllByText(/Verpleegkundige|Arts|Coördinator/).map(el => el.textContent)

  it('renders no drag handles while a date/function axis is active (the default)', () => {
    const { container } = render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onReorder={() => {}} />)
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: i18n.t('common:dragList.moveUp') })).toBeNull()
  })

  it('picking "own order" shows the RECEIVED order (not the date-sorted one) and renders a handle per row', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onReorder={() => {}} />)
    await pick(user, 'Eigen volgorde')
    // Identity order — items as given, NOT newest-start-first (that would be Arts first).
    expect(names()).toEqual(['Verpleegkundige', 'Arts', 'Coördinator'])
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: i18n.t('common:dragList.moveUp') })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: i18n.t('common:dragList.moveDown') })).toHaveLength(3)
  })

  it('switching back to a date axis hides the handles again — sorting by date and then dragging would be meaningless (the next render re-sorts it away)', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onReorder={() => {}} />)
    await pick(user, 'Eigen volgorde')
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(3)
    await pick(user, 'Begindatum')
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
  })

  it('a drag reports the FULL item list in its new order to onReorder', async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    const { container } = render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onReorder={onReorder} />)
    await pick(user, 'Eigen volgorde')
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(3)

    // Drag row 0 (Verpleegkundige) onto row 1 (Arts) — Verpleegkundige moves after Arts.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])

    expect(onReorder).toHaveBeenCalledTimes(1)
    const next = onReorder.mock.calls[0][0] as { id: string }[]
    expect(next.map(x => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('the keyboard path (focused move-down button, real Enter keypress) reorders and calls onReorder — no mouse involved', async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onReorder={onReorder} />)
    await pick(user, 'Eigen volgorde')

    const moveDown = screen.getAllByRole('button', { name: i18n.t('common:dragList.moveDown') })[0]
    moveDown.focus()
    await user.keyboard('{Enter}')

    expect(onReorder).toHaveBeenCalledTimes(1)
    const next = onReorder.mock.calls[0][0] as { id: string }[]
    expect(next.map(x => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('the move-up button on the FIRST row and move-down on the LAST row are disabled — no dead reorder past either end', async () => {
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onReorder={() => {}} />)
    await pick(user, 'Eigen volgorde')
    expect(screen.getAllByRole('button', { name: i18n.t('common:dragList.moveUp') })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: i18n.t('common:dragList.moveDown') }).at(-1)).toBeDisabled()
  })

  it('picking "own order" persists ONLY the chosen axis to ui_preferences — the manual order/ids never ride along in that same body', async () => {
    authState.user = { ui_preferences: {} }
    const user = userEvent.setup()
    const onReorder = vi.fn()
    const { container } = render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onReorder={onReorder} />)
    await pick(user, 'Eigen volgorde')
    await waitFor(() => expect(putMock).toHaveBeenCalledWith('/auth/me', {
      ui_preferences: { candidate_background_sort: { experience: { field: 'own', dir: 'asc' } } },
    }))
    const callsAfterPick = putMock.mock.calls.length

    // Now drag — the ORDER itself is record data (BackgroundTab persists it
    // through the candidate's own reorder route), never this preference blob.
    const rows = container.querySelectorAll('[draggable="true"]')
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])
    expect(onReorder).toHaveBeenCalled()

    // No additional /auth/me write happened — the drag never touched this route,
    // and every earlier call already only ever carried {field, dir}, never an
    // items/ids array.
    expect(putMock.mock.calls.length).toBe(callsAfterPick)
    for (const call of putMock.mock.calls) {
      const body = call[1] as { ui_preferences: { candidate_background_sort: Record<string, unknown> } }
      expect(body.ui_preferences.candidate_background_sort.experience).toEqual({ field: 'own', dir: 'asc' })
    }
  })
})
