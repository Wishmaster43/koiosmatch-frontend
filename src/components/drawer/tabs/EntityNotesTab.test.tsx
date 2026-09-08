import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TFunction } from 'i18next'
import EntityNotesTab from './EntityNotesTab'
import { useNotesTabSetup } from '@/hooks/useNotesTabSetup'

// Mock useNotesTabSetup to control its output
vi.mock('@/hooks/useNotesTabSetup')

interface MockSharedNotesTabProps {
  entity: string
  id: string
}

// Mock SharedNotesTab — verify it receives the right props
vi.mock('@/components/drawer/tabs/NotesTab', () => ({
  default: ({ entity, id }: MockSharedNotesTabProps) => (
    <div data-testid="shared-notes-tab" data-entity={entity} data-id={id} />
  ),
}))

describe('EntityNotesTab', () => {
  it('renders loading state when loading=true', () => {
    const mockT = vi.fn((key: string) => key) as unknown as TFunction
    vi.mocked(useNotesTabSetup).mockReturnValue({
      t: mockT,
      noteTypes: [],
      notes: [],
      loading: true,
      error: false,
      fetchNotes: vi.fn(),
      addNote: vi.fn(),
      editNote: vi.fn(),
      deleteNote: vi.fn(),
      initials: 'JS',
    })

    render(<EntityNotesTab entity="match" id="123" basePath="/matches/123" ns="matches" />)
    expect(screen.getByText('notes.loading')).toBeDefined()
  })

  it('renders SharedNotesTab when loading=false', () => {
    const mockT = vi.fn((key: string) => key) as unknown as TFunction
    vi.mocked(useNotesTabSetup).mockReturnValue({
      t: mockT,
      noteTypes: [],
      notes: [],
      loading: false,
      error: false,
      fetchNotes: vi.fn(),
      addNote: vi.fn(),
      editNote: vi.fn(),
      deleteNote: vi.fn(),
      initials: 'JS',
    })

    render(<EntityNotesTab entity="match" id="123" basePath="/matches/123" ns="matches" />)
    expect(screen.getByTestId('shared-notes-tab')).toBeDefined()
  })
})
