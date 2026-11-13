/** SectionTabsSort · sort preference persistence (split from SectionTabsSort.test.tsx; mocks and helpers are duplicated per file because hoisted vi.mock blocks cannot be shared). */
import i18n from '@/i18n'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceTab } from './SectionTabs'

// Hoisted so these bindings exist before the (hoisted) vi.mock factories below
// run during module resolution — a plain `const` here would TDZ-error the
// first time `api.put`/`useAuth()` are actually invoked from inside a mock.
const { getMock, putMock, authState } = vi.hoisted(() => ({
  getMock: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  // Explicit call signature (mirrors ReportKpiSettings.test.tsx's saveSettingsKeys
  // mock) — the own-order persistence-separation test in SectionTabsSort.ownOrder.test.tsx reads `call[1]` (the
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

describe('Sort preference persistence (ui_preferences via PUT /auth/me)', () => {
  const items = [
    { id: 'a', title: 'Verpleegkundige', start: '2020-01-01' },
    { id: 'b', title: 'Arts', start: '2022-06-15' },
  ]
  const names = () => screen.getAllByText(/Verpleegkundige|Arts/).map(el => el.textContent)

  it('reads a previously saved sort back on mount, from the already-loaded user — no extra fetch', () => {
    authState.user = { ui_preferences: { candidate_background_sort: { experience: { field: 'function', dir: 'asc' } } } }
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    expect(names()).toEqual(['Arts', 'Verpleegkundige']) // A→Z by title, applied immediately
    expect(putMock).not.toHaveBeenCalled()
  })

  it('writes the picked sort to the real route with the real, MERGED body — another feature\'s ui_preferences key survives', async () => {
    authState.user = { ui_preferences: { some_other_feature: 'keep-me' } }
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Functietitel')
    await waitFor(() => expect(putMock).toHaveBeenCalledWith('/auth/me', {
      ui_preferences: {
        some_other_feature: 'keep-me',
        candidate_background_sort: { experience: { field: 'function', dir: 'asc' } },
      },
    }))
    expect(authState.refreshUser).toHaveBeenCalled()
  })

  it('keeps the chosen sort applied even when the background save fails — a preference write never costs the user their view', async () => {
    authState.user = { ui_preferences: {} }
    putMock.mockImplementation(() => Promise.reject(new Error('network')))
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Functietitel')
    expect(names()).toEqual(['Arts', 'Verpleegkundige'])
    await waitFor(() => expect(putMock).toHaveBeenCalled())
    // The rejection has now resolved — the sort must still stand, not revert.
    expect(names()).toEqual(['Arts', 'Verpleegkundige'])
  })
})
