/**
 * WorkflowsListPanel — WF-WACHTRIJ-FE-1: the list⇄queue SegmentedControl switch
 * mounts WorkflowQueueView in place of the workflow grid/list, and hides the
 * list-only toolbar controls (count/archived/trash/view-mode) while queue is
 * active. Real i18next runtime (mirrors WorkflowCard.test.tsx).
 */
import { useRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import WorkflowsListPanel from './WorkflowsListPanel'
import api from '@/lib/api'

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

beforeEach(() => vi.clearAllMocks())

// Thin wrapper: WorkflowsListPanel needs a real ref, not a bare object.
function Panel() {
  const dragWf = useRef<string | number | null>(null)
  return (
    <WorkflowsListPanel
      loading={false} error={false} retryLoad={vi.fn()}
      visibleWorkflows={[]} folders={[]} viewMode="list" setViewMode={vi.fn()}
      showArchived={false} onToggleArchived={vi.fn()}
      showTrash={false} onToggleTrash={vi.fn()}
      selectedFolder={null} dragWf={dragWf}
      openEditor={vi.fn()} handleRun={vi.fn()} handleToggleStatus={vi.fn()}
      canManageFolders={false} handleArchive={vi.fn()} handleRestore={vi.fn()}
    />
  )
}

describe('WorkflowsListPanel · list⇄queue switch', () => {
  it('starts on the workflow list, with the archived/trash toggles visible', () => {
    render(<Panel />)
    expect(screen.getByTitle('Toon gearchiveerde workflows')).toBeInTheDocument()
  })

  it('switching to Wachtrij mounts the queue view and hides the list-only toolbar', async () => {
    mockedGet.mockResolvedValue({ data: { pending: [], waiting: [], scheduled: [], retrying: [], counts: {} } })
    render(<Panel />)
    fireEvent.click(screen.getByRole('radio', { name: 'Wachtrij' }))
    expect(await screen.findByText(/wachtrij is leeg/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Toon gearchiveerde workflows')).not.toBeInTheDocument()
  })
})
