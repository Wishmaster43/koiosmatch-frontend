/**
 * renderCvBlob — the single place that statically pulls in the react-pdf engine for the CV
 * download. Callers load it with `await import(...)` inside their handler, so the ~2 MB PDF
 * engine stays out of every chunk a page imports statically.
 */
import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from '../CandidateCvTemplate'
import type { CvCandidate } from '../CandidateCvTemplate'

type CvDocProps = Parameters<typeof CvDocument>[0]

// Render the CV document to a PDF blob (client-side, no server round-trip).
export async function renderCvBlob(props: CvDocProps & { c: CvCandidate }): Promise<Blob> {
  // react-pdf's pdf() types its argument as a <Document> element; CvDocument renders one at its root.
  return pdf(createElement(CvDocument, props) as Parameters<typeof pdf>[0]).toBlob()
}
