/**
 * proposalCv.test — asserts the redaction flag threaded through to CvDocument per
 * variant. Mocks the @react-pdf/renderer `pdf()` export so we can inspect the
 * React element it was called with, without actually rendering a PDF.
 */
import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { buildProposalCvBlob } from './proposalCv'

const pdfMock = vi.hoisted(() => vi.fn((element: unknown) => ({
  toBlob: () => Promise.resolve({ __element: element } as unknown as Blob),
})))
vi.mock('@react-pdf/renderer', () => ({ pdf: pdfMock }))

// Read the CvDocument props off the captured element (the blob stand-in).
async function capturedProps(blob: Blob) {
  const el = (blob as unknown as { __element: ReactElement<Record<string, unknown>> }).__element
  return el.props
}

describe('buildProposalCvBlob', () => {
  it('sets redactContact=true for the proposal variant', async () => {
    const blob = await buildProposalCvBlob({ candidate: { name: 'Jane Doe' }, variant: 'proposal' })
    const props = await capturedProps(blob)
    expect(props.redactContact).toBe(true)
  })

  it('sets redactContact=false for the full variant', async () => {
    const blob = await buildProposalCvBlob({ candidate: { name: 'Jane Doe' }, variant: 'full' })
    const props = await capturedProps(blob)
    expect(props.redactContact).toBe(false)
  })

  it('passes candidate/settings/locale/t through unchanged', async () => {
    const t = ((key: string) => key) as (key: string, opts?: Record<string, unknown>) => string
    const settings = { primaryColor: '#111111' } // eslint-disable-line no-restricted-syntax -- test fixture data, not UI styling
    const blob = await buildProposalCvBlob({ candidate: { name: 'Jane Doe' }, settings, locale: 'en-US', t, variant: 'full' })
    const props = await capturedProps(blob)
    expect(props.c).toEqual({ name: 'Jane Doe' })
    expect(props.settings).toEqual(settings)
    expect(props.locale).toBe('en-US')
    expect(props.t).toBe(t)
  })
})
