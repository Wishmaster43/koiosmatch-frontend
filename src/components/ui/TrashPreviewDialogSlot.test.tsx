import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import TrashPreviewDialogSlot from './TrashPreviewDialogSlot'
import DeletionPreviewModal from '@/components/ui/DeletionPreviewModal'

// The slot's whole job is the pass-through; assert the props the modal receives.
vi.mock('@/components/ui/DeletionPreviewModal', () => ({ default: vi.fn(() => null) }))
import type { useTrashFlow } from '@/hooks/useTrashFlow'

type TrashFlowState = ReturnType<typeof useTrashFlow>

// The ONE shared "Definitief verwijderen" preview dialog (TRASH-OVERAL-2).
// Renders only when trash.target is set; passes through all state to DeletionPreviewModal.
describe('TrashPreviewDialogSlot', () => {
  it('renders nothing when trash.target is null', () => {
    const { container } = render(
      <TrashPreviewDialogSlot trash={{
        target: null,
        openFor: vi.fn(),
        close: vi.fn(),
        confirmMark: vi.fn(),
        unmark: vi.fn(),
        busy: false,
        blocked: false,
        preview: null,
        loading: false,
        error: null,
        graceDays: 30,
      } as unknown as TrashFlowState} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the modal when trash.target is set', () => {
    const trash = {
      target: { id: '123', label: 'Test Workflow' },
      openFor: vi.fn(),
      close: vi.fn(),
      confirmMark: vi.fn(),
      unmark: vi.fn(),
      busy: false,
      blocked: false,
      preview: {
        id: '123',
        label: 'Test',
        blocking: [],
        transferable: false,
        can_mark: true,
        lifecycle: 'archived',
      },
      loading: false,
      error: null,
      graceDays: 30,
    } as unknown as TrashFlowState
    render(<TrashPreviewDialogSlot trash={trash} />)
    const props = vi.mocked(DeletionPreviewModal).mock.calls.at(-1)?.[0]
    expect(props).toMatchObject({ open: true, entityLabel: 'Test Workflow', graceDays: 30, busy: false, blocked: false })
    expect(props?.onClose).toBe(trash.close)
    expect(props?.onConfirm).toBe(trash.confirmMark)
  })
})
