import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n runtime — this component has no other module in its import graph that
// pulls it in (mirrors the note in WorkflowListRow.test.tsx), so load it explicitly;
// assertions below check the actual translated nl copy, not raw keys. Default-exported
// so the seeded-name test below can switch languages (LOOKUP-I18N-1).
import i18n from '@/i18n'
import WorkflowFolderSidebar from './WorkflowFolderSidebar'
import type { WorkflowFolder } from './hooks/useWorkflowsData'

// Audit 2026-07-28 (§6 — keyboard trap): the per-folder delete button used to only
// mount when `hover` was true (a mouse-only state, no onFocus handler), so a
// keyboard-only user tabbing through the sidebar could never reach it at all —
// not just "hard to see", literally absent from the DOM and the tab order. It also
// had no accessible name. Assert both are fixed: the button exists unconditionally
// and exposes a real name via role+name lookup (which requires an accessible name).
describe('WorkflowFolderSidebar — folder delete is keyboard-reachable', () => {
  const folders: WorkflowFolder[] = [{ id: 'f1', name: 'Onboarding' }]

  const baseProps = {
    folders,
    canManageFolders: true,
    selectedFolder: null,
    setSelectedFolder: vi.fn(),
    dragOverFolder: null,
    setDragOverFolder: vi.fn(),
    dragWf: { current: null },
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    moveToFolder: vi.fn(),
  }

  it('renders the delete button without requiring mouse hover first', () => {
    render(<WorkflowFolderSidebar {...baseProps} />)
    // No hover/mouseEnter fired anywhere — if the button only mounted on hover,
    // this lookup (which needs both presence AND an accessible name) would fail.
    expect(screen.getByRole('button', { name: 'Verwijderen' })).toBeInTheDocument()
  })

  it('reveals the delete button on keyboard focus (not just mouse hover)', () => {
    render(<WorkflowFolderSidebar {...baseProps} />)
    const deleteBtn = screen.getByRole('button', { name: 'Verwijderen' })
    expect(deleteBtn).toHaveStyle({ opacity: '0' })
    fireEvent.focus(deleteBtn)
    expect(deleteBtn).toHaveStyle({ opacity: '1' })
  })

  it('never renders a delete button when the user cannot manage folders', () => {
    render(<WorkflowFolderSidebar {...baseProps} canManageFolders={false} />)
    expect(screen.queryByRole('button', { name: 'Verwijderen' })).toBeNull()
  })

  it('exposes an accessible name on the "new folder" button', () => {
    render(<WorkflowFolderSidebar {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Nieuwe folder' })).toBeInTheDocument()
  })
})

// LOOKUP-I18N-1 (round 2 pin): a folder that still carries its seeded Dutch name
// renders in the user language; a tenant rename/creation stays exactly as typed.
describe('WorkflowFolderSidebar · seeded folder name i18n (LOOKUP-I18N-1)', () => {
  const baseProps = {
    canManageFolders: true,
    selectedFolder: null,
    setSelectedFolder: vi.fn(),
    dragOverFolder: null,
    setDragOverFolder: vi.fn(),
    dragWf: { current: null },
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    moveToFolder: vi.fn(),
  }

  it('renders a seeded folder name in English when the UI language is English', async () => {
    await i18n.changeLanguage('en')
    const folders: WorkflowFolder[] = [{ id: 'f1', name: 'Kandidaten' }]
    const { unmount } = render(<WorkflowFolderSidebar {...baseProps} folders={folders} />)
    expect(screen.getByText('Candidates')).toBeInTheDocument()
    expect(screen.queryByText('Kandidaten')).not.toBeInTheDocument()
    // Unmount before switching back — resetting the language on a still-mounted
    // component would fire a state update outside act().
    unmount()
    await i18n.changeLanguage('nl')
  })

  it('leaves a tenant-renamed folder name untouched under English', async () => {
    await i18n.changeLanguage('en')
    const folders: WorkflowFolder[] = [{ id: 'f1', name: 'Onboarding' }]
    const { unmount } = render(<WorkflowFolderSidebar {...baseProps} folders={folders} />)
    expect(screen.getByText('Onboarding')).toBeInTheDocument()
    unmount()
    await i18n.changeLanguage('nl')
  })
})
