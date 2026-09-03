/**
 * DeletionPreviewModal (candidate) — regression for POPOUT-PERSISTKEY-1: this
 * panel's FloatingPanel persistKey must be unique to the candidate hard-delete
 * confirm, never shared with the generic trash DeletionPreviewModal
 * (components/ui/DeletionPreviewModal.tsx, which also used the bare
 * "deletion-preview" key) — a shared key meant the two unrelated dialogs read
 * and wrote the same remembered-size localStorage slot.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DeletionPreviewModal from './DeletionPreviewModal'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})) } }))

// FloatingPanel's persistKey is not exposed as a DOM attribute, so the real
// assertion mocks useDraggablePanel and reads the key it was called with —
// mirrors how useDraggablePanel itself receives the prop.
const draggablePanelKeys: (string | undefined)[] = []
vi.mock('@/hooks/useDraggablePanel', () => ({
  useDraggablePanel: (persistKey: string | undefined) => {
    draggablePanelKeys.push(persistKey)
    return {
      panelRef: { current: null }, placement: {}, dragging: false,
      onDragPointerDown: vi.fn(), onResizePointerDown: vi.fn(), onDragHandleDoubleClick: vi.fn(),
    }
  },
}))

describe('DeletionPreviewModal (candidate)', () => {
  it('opens its own persistKey, distinct from the shared trash modal', () => {
    render(
      <DeletionPreviewModal candidateId="c1" candidateName="Jamie Bakker" onClose={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(draggablePanelKeys).toContain('candidate-deletion-preview')
    expect(draggablePanelKeys).not.toContain('deletion-preview')
  })
})
