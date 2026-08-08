/**
 * TasksBoard — drag-drop contract. History matters here: the board briefly owned
 * its own PATCH because the page's `onMove` chain sent the slug key the server
 * silently dropped (TASK-ID-SHAPE-1). That chain now resolves the real
 * `status_id` (useTaskDrawerActions.handleUpdate, covered by its own §13 tests),
 * so the board is purely presentational again — a second write from here would
 * be a duplicate request racing itself. This file therefore asserts exactly two
 * things: the drop reports the target column to the host, and the board itself
 * issues NO request of its own.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TasksBoard from './TasksBoard'
import type { Task } from '@/types/task'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })), patch: vi.fn() } }
})

const mockedPatch = vi.mocked((await import('@/lib/api')).default.patch)

afterEach(() => vi.clearAllMocks())

const columns = [
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { key: 'todo', label: 'Todo', color: '#D98A8A' },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { key: 'done', label: 'Done', color: '#79B58E' },
]
const row = { id: 't1', title: 'Task 1', statusKey: 'todo' } as unknown as Task

// Minimal DataTransfer stub — jsdom has no native drag-and-drop implementation.
function dataTransferStub() {
  const store: Record<string, string> = {}
  return {
    effectAllowed: '', dropEffect: '',
    setData: (k: string, v: string) => { store[k] = v },
    getData: (k: string) => store[k] ?? '',
  } as unknown as DataTransfer
}

// Drag the one card onto the "Done" column and return the drop target used.
function dragCardToDone() {
  const card = screen.getByText('Task 1').closest('[draggable]') as HTMLElement
  const dt = dataTransferStub()
  const doneColumn = screen.getByText('Done').closest('div')?.parentElement as HTMLElement
  card.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: dt }))
  doneColumn.dispatchEvent(Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), { dataTransfer: dt }))
  doneColumn.dispatchEvent(Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer: dt }))
}

describe('TasksBoard · drag-drop', () => {
  it('reports the dropped card and its target column to the host', () => {
    const onMove = vi.fn()
    render(<TasksBoard rows={[row]} columns={columns} onMove={onMove} onSelect={vi.fn()} />)
    dragCardToDone()
    expect(onMove).toHaveBeenCalledWith('t1', 'done')
  })

  it('issues no request of its own — persistence belongs to the host chain', () => {
    render(<TasksBoard rows={[row]} columns={columns} onMove={vi.fn()} onSelect={vi.fn()} />)
    dragCardToDone()
    expect(mockedPatch).not.toHaveBeenCalled()
  })
})
