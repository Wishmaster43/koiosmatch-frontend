/**
 * WorkflowsPage · URL-driven editor (WF-EDITOR-DEEPLINK-1): the open editor
 * lives at `#aiagents?open=<id>` (the same useDrawerUrl/NAV-BACK-1 contract
 * every entity page uses), so F5/back/forward/new-tab all land IN the editor
 * instead of the bare list, and closing it clears the param. An id the loaded
 * list doesn't have renders the honest not-found state, never a blank screen.
 * Heavy children (sidebar, list panel, the real canvas editor) are stubbed;
 * the page's own data hook (useWorkflowsData) + useDrawerUrl wiring run for
 * real, mirroring WorkflowsPage.trash.test.tsx's mocking technique.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import WorkflowsPage from './WorkflowsPage'
import type { Workflow } from '@/types/workflow'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
vi.mock('./WorkflowFolderSidebar', () => ({ default: () => null }))
vi.mock('./WorkflowsListPanel', () => ({ default: () => null }))
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))
// The real canvas editor pulls in @xyflow/react + the whole config-panel tree —
// irrelevant to the URL-wiring under test, so a minimal stand-in confirms only
// WHICH workflow the page decided to open.
vi.mock('@/components/layout/WorkflowCanvasEditor', () => ({
  default: ({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) => (
    <div>
      <span>{`editor-open:${workflow.name}`}</span>
      <button onClick={onClose}>close-editor</button>
    </div>
  ),
}))

const wf1: Workflow = { id: 'wf-1', name: 'Welkomstflow', status: 'active', steps: [] }

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    default: {
      get: vi.fn((url: string) => {
        if (url === '/workflows') return Promise.resolve({ data: [wf1] })
        if (url === '/workflow-folders') return Promise.resolve({ data: [] })
        if (url === '/settings') return Promise.resolve({ data: { deletion_grace_days: '30' } })
        return Promise.resolve({ data: [] })
      }),
      post: vi.fn(),
    },
  }
})

beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, '', '#aiagents') })
afterEach(() => { window.history.replaceState({}, '', '#aiagents') })

describe('WorkflowsPage · URL-driven editor (WF-EDITOR-DEEPLINK-1)', () => {
  it('a reload landing on #aiagents?open=<id> opens that workflow in the editor', async () => {
    window.history.replaceState({}, '', '#aiagents?open=wf-1')
    render(<WorkflowsPage />)
    expect(await screen.findByText('editor-open:Welkomstflow')).toBeInTheDocument()
  })

  it('closing the editor clears the `open` param from the hash', async () => {
    window.history.replaceState({}, '', '#aiagents?open=wf-1')
    render(<WorkflowsPage />)
    fireEvent.click(await screen.findByText('close-editor'))
    await waitFor(() => expect(screen.queryByText(/editor-open/)).not.toBeInTheDocument())
    expect(window.location.hash).toBe('#aiagents')
  })

  it('back/forward (popstate) reopens the editor for the hash it lands on', async () => {
    render(<WorkflowsPage />)
    await waitFor(() => expect(screen.queryByText(/editor-open/)).not.toBeInTheDocument())

    window.history.pushState({}, '', '#aiagents?open=wf-1')
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(await screen.findByText('editor-open:Welkomstflow')).toBeInTheDocument()

    window.history.pushState({}, '', '#aiagents')
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    await waitFor(() => expect(screen.queryByText(/editor-open/)).not.toBeInTheDocument())
  })

  it('an id the loaded list does not have shows the honest not-found state, never a blank screen', async () => {
    window.history.replaceState({}, '', '#aiagents?open=does-not-exist')
    render(<WorkflowsPage />)
    // Real i18next runs in this file's import graph (mirrors the not-found copy
    // rendering translated, not a raw key) — assert the actual nl text.
    expect(await screen.findByText('Workflow niet gevonden')).toBeInTheDocument()
    expect(screen.queryByText(/editor-open/)).not.toBeInTheDocument()
  })
})
