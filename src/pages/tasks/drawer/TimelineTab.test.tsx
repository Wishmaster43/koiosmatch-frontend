/**
 * TimelineTab — test the timeline tab that renders GET /tasks/{id}/timeline data
 * using the shared EventTimeline component. Verifies rows render correctly
 * and loading/error states work.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import TimelineTab from './TimelineTab'
import type { TaskDetail } from '@/types/task'
import i18n from '@/i18n'

vi.mock('./hooks/useTaskTimeline')

import { useTaskTimeline } from './hooks/useTaskTimeline'

describe('TimelineTab', () => {
  const mockTask: TaskDetail = {
    id: 'task-123',
    title: 'Test Task',
    typeKey: 'bug',
    typeLabel: 'Bug',
    typeColor: 'var(--color-info)',
    statusKey: 'open',
    statusLabel: 'Open',
    statusColor: 'var(--color-success)',
    statusIsDone: false,
    priorityKey: 'high',
    priorityLabel: 'High',
    priorityColor: 'var(--color-warning)',
    assigneeId: null,
    assignee: null,
    description: 'A test task',
    comments: [],
    customFields: {},
    linkLabel: 'test',
    links: [],
    commentCount: 0,
    owner: { name: 'Owner' },
    due: '2026-09-15',
    dueTime: '',
    completedAt: '',
    tags: [],
    createdAt: '2026-09-08T10:00:00+02:00',
  }

  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  it('renders timeline entries', async () => {
    const mockEntries = [
      {
        id: 'note-1',
        type: 'note',
        author: 'Alice',
        description: 'Added a note',
        link: null,
        created_at: '2026-09-08T14:00:00+02:00',
        meta: { note_type: 'general' },
      },
    ]

    vi.mocked(useTaskTimeline).mockReturnValue({
      entries: mockEntries,
      loading: false,
      error: false,
      meta: { count: 1, limit: 100, has_more: false },
    })

    render(<TimelineTab task={mockTask} />, { wrapper })

    // The EventTimeline component will render the entry's description
    await waitFor(() => {
      expect(screen.getByText('Added a note')).toBeInTheDocument()
    })
  })

  it('displays loading state', () => {
    vi.mocked(useTaskTimeline).mockReturnValue({
      entries: [],
      loading: true,
      error: false,
      meta: undefined,
    })

    render(<TimelineTab task={mockTask} />, { wrapper })

    // The loading text should be rendered (i18n key: tasks:timeline.loading)
    expect(screen.getByText(i18n.t('tasks:timeline.loading'))).toBeInTheDocument()
  })

  it('displays error state', () => {
    vi.mocked(useTaskTimeline).mockReturnValue({
      entries: [],
      loading: false,
      error: true,
      meta: undefined,
    })

    render(<TimelineTab task={mockTask} />, { wrapper })

    // The error text should be rendered (i18n key: tasks:timeline.error)
    expect(screen.getByText(i18n.t('tasks:timeline.error'))).toBeInTheDocument()
  })

  it('displays empty state when no entries', () => {
    vi.mocked(useTaskTimeline).mockReturnValue({
      entries: [],
      loading: false,
      error: false,
      meta: { count: 0, limit: 100, has_more: false },
    })

    render(<TimelineTab task={mockTask} />, { wrapper })

    // The empty text should be rendered (i18n key: tasks:timeline.empty)
    expect(screen.getByText(i18n.t('tasks:timeline.empty'))).toBeInTheDocument()
  })

  it('passes task ID to useTaskTimeline hook', () => {
    vi.mocked(useTaskTimeline).mockReturnValue({
      entries: [],
      loading: false,
      error: false,
      meta: undefined,
    })

    render(<TimelineTab task={mockTask} />, { wrapper })

    expect(useTaskTimeline).toHaveBeenCalledWith(mockTask.id)
  })

  it('renders multiple timeline entries', async () => {
    const mockEntries = [
      {
        id: 'status-1',
        type: 'status_change',
        author: 'Bob',
        description: 'Status changed to Done',
        link: null,
        created_at: '2026-09-08T14:30:00+02:00',
        meta: null,
      },
      {
        id: 'note-2',
        type: 'note',
        author: 'Alice',
        description: 'Reviewed and approved',
        link: null,
        created_at: '2026-09-08T14:00:00+02:00',
        meta: { note_type: 'approval' },
      },
    ]

    vi.mocked(useTaskTimeline).mockReturnValue({
      entries: mockEntries,
      loading: false,
      error: false,
      meta: { count: 2, limit: 100, has_more: false },
    })

    render(<TimelineTab task={mockTask} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Status changed to Done')).toBeInTheDocument()
      expect(screen.getByText('Reviewed and approved')).toBeInTheDocument()
    })
  })
})
