import { describe, it, expect, vi } from 'vitest'
import { reportMergeError } from './mergeError'
import type { TFunction } from 'i18next'

// Shared merge-modal catch-block helper (MergeCandidateModal, MergeCustomerModal).
describe('reportMergeError', () => {
  const t = ((key: string) => key) as unknown as TFunction

  it('reports the forbidden key on a 403', () => {
    const notifyError = vi.fn()
    reportMergeError({ response: { status: 403 } }, t, notifyError)
    expect(notifyError).toHaveBeenCalledWith('merge.errForbidden')
  })

  it('reports the generic failure key on any other error', () => {
    const notifyError = vi.fn()
    reportMergeError(new Error('network'), t, notifyError)
    expect(notifyError).toHaveBeenCalledWith('merge.errFailed')
  })
})
