/**
 * WorkflowsPage · trash view wiring (TRASH-OVERAL-2). Proves the page-level
 * seams the row tests can't: the Prullenbak toggle reveals lifecycle
 * pending_erase rows, unmark is settings.update-gated (hidden without) and
 * POSTs the real per-id route, and the workflows.delete-gated mark action
 * opens the preview flow (GET deletion-preview). Heavy children (sidebar,
 * canvas editor) are stubbed; the list panel + rows render for real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import { __resetDeletionGraceCache } from '@/hooks/useDeletionLifecycle'
import WorkflowsPage from './WorkflowsPage'
import type { Workflow } from '@/types/workflow'

// Mutable permission set: [] = none; the page reads workflows.delete itself and
// settings.update arrives via the (mocked) data hook's canManageFolders below.
let grantedPerms: string[] = []
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (p: string) => grantedPerms.includes(p) }),
}))

// One trashed + one plain-archived workflow — the fixtures the views split on.
const trashedWf: Workflow = {
  id: 'wf-1', name: 'Oude flow', status: 'draft', steps: [],
  archived: true, lifecycle: 'pending_erase', pending_erase_at: '2026-08-10T12:00:00Z',
}
const archivedWf: Workflow = {
  id: 'wf-2', name: 'Gearchiveerde flow', status: 'draft', steps: [],
  archived: true, lifecycle: 'archived',
}

// Data hook mocked (network-backed); canManageFolders is the settings.update seam.
let canManageFolders = false
const retryLoad = vi.fn()
vi.mock('./hooks/useWorkflowsData', () => ({
  useWorkflowsData: () => ({
    workflows: [trashedWf, archivedWf], folders: [], loading: false, error: false,
    canManageFolders, editingWorkflow: null, focusRunId: null,
    selectedFolder: null, setSelectedFolder: vi.fn(), dragOverFolder: null, setDragOverFolder: vi.fn(),
    dragWf: { current: null }, retryLoad, openEditor: vi.fn(), closeEditor: vi.fn(),
    handleRun: vi.fn(), handleToggleStatus: vi.fn(), handleSave: vi.fn(),
    handleArchive: vi.fn(), handleRestore: vi.fn(),
    createFolder: vi.fn(), deleteFolder: vi.fn(), moveToFolder: vi.fn(),
    dialog: null,
  }),
}))

// Heavy children out of scope; the list panel + rows render for real.
vi.mock('./WorkflowFolderSidebar', () => ({ default: () => null }))
vi.mock('@/components/layout/WorkflowCanvasEditor', () => ({ default: () => null }))
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }) }))
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))

// API mocked for useTrashFlow's useDeletionLifecycle chain (settings + preview + posts).
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn((url: string) => url === '/settings'
      ? Promise.resolve({ data: { deletion_grace_days: '30' } })
      : Promise.resolve({ data: { data: { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' } } })),
    post: vi.fn(() => Promise.resolve({ data: { data: { lifecycle: 'pending_erase' } } })),
  },
  getActiveTenantId: () => null,
  unwrap: (res: { data?: unknown }) => {
    const body = res?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  __resetDeletionGraceCache()
  grantedPerms = []
  canManageFolders = false
  localStorage.clear()
})

// Real i18n (nl) — the shared common:trash strings.
const openTrashView = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Prullenbak' }))
  await screen.findByText('Oude flow')
}

describe('WorkflowsPage · Prullenbak view (TRASH-OVERAL-2)', () => {
  it('the trash toggle shows ONLY pending_erase rows; the archived row stays out', async () => {
    const user = userEvent.setup()
    render(<WorkflowsPage />)
    // Default view: soft-deleted rows hidden entirely.
    expect(screen.queryByText('Oude flow')).not.toBeInTheDocument()
    await openTrashView(user)
    expect(screen.queryByText('Gearchiveerde flow')).not.toBeInTheDocument()
  })

  it('unmark is HIDDEN without settings.update', async () => {
    const user = userEvent.setup()
    render(<WorkflowsPage />)
    await openTrashView(user)
    expect(screen.queryByRole('button', { name: 'Terugzetten naar archief' })).not.toBeInTheDocument()
  })

  it('with settings.update, unmark POSTs the per-id route and refetches the list', async () => {
    canManageFolders = true
    const user = userEvent.setup()
    render(<WorkflowsPage />)
    await openTrashView(user)
    await user.click(screen.getByRole('button', { name: 'Terugzetten naar archief' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/unmark-deletion'))
    expect(retryLoad).toHaveBeenCalled()
  })

  it('the archived view offers mark-deletion only WITH workflows.delete, and opening it fetches the preview', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<WorkflowsPage />)
    await user.click(screen.getByRole('button', { name: 'Gearchiveerd' }))
    await screen.findByText('Gearchiveerde flow')
    expect(screen.queryByRole('button', { name: 'Definitief verwijderen' })).not.toBeInTheDocument()
    unmount()

    grantedPerms = ['workflows.delete']
    render(<WorkflowsPage />)
    await user.click(screen.getByRole('button', { name: 'Gearchiveerd' }))
    await screen.findByText('Gearchiveerde flow')
    await user.click(screen.getByRole('button', { name: 'Definitief verwijderen' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflows/wf-2/deletion-preview'))
  })
})
