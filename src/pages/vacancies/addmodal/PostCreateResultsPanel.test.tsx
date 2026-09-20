/**
 * PostCreateResultsPanel — HUISSTIJL-1 fix regression: the per-row retry
 * control used to be a hand-painted text `<button>` in a file that already
 * imports and uses the house `Button` for Close; it is now `Button` too.
 * This just asserts the request (§13) — retry still fires onRetryFile with
 * the failed row's id — after the markup swap.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PostCreateResultsPanel from './PostCreateResultsPanel'
import type { PendingFile } from './usePostCreateAttachments'

const files: PendingFile[] = [
  { id: 'f1', file: new File(['x'], 'cv.pdf'), name: 'cv.pdf', status: 'error', error: 'upload failed' },
]

describe('PostCreateResultsPanel · retry affordance', () => {
  it('clicking the retry control calls onRetryFile with the failed file id', async () => {
    const onRetryFile = vi.fn()
    const user = userEvent.setup()
    render(<PostCreateResultsPanel files={files} noteText="" noteStatus="idle" noteError=""
      running={false} onRetryFile={onRetryFile} onRetryNote={vi.fn()} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    expect(onRetryFile).toHaveBeenCalledWith('f1')
  })
})
