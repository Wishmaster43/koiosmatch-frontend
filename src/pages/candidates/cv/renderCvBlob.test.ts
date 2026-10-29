/**
 * renderCvBlob.test — the lazy PDF seam hands a CvDocument element to react-pdf and returns its blob.
 */
import { describe, it, expect, vi } from 'vitest'

const { toBlob, pdfMock } = vi.hoisted(() => {
  const toBlob = vi.fn()
  return { toBlob, pdfMock: vi.fn(() => ({ toBlob })) }
})
vi.mock('@react-pdf/renderer', () => ({ pdf: (el: unknown) => (pdfMock as (e: unknown) => unknown)(el) }))
const { CvDocument } = vi.hoisted(() => ({ CvDocument: () => null }))
vi.mock('../CandidateCvTemplate', () => ({ CvDocument }))

import { renderCvBlob } from './renderCvBlob'

describe('renderCvBlob', () => {
  it('renders a CvDocument element with the given props and returns the blob', async () => {
    const blob = new Blob(['x'])
    toBlob.mockResolvedValueOnce(blob)
    const props = { c: { name: 'A' }, settings: {}, locale: 'nl-NL', t: vi.fn() } as never
    const out = await renderCvBlob(props)
    const el = (pdfMock.mock.calls[0] as unknown[])[0] as { type: unknown; props: unknown }
    expect(el.type).toBe(CvDocument)
    expect(el.props).toEqual(props)
    expect(out).toBe(blob)
  })
})
