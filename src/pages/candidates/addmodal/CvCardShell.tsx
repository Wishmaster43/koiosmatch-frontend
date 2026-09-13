// CvCardShell — the shared outer wrapper for the CV-parse progress/result strips
// (CvUploadCard / PasteCvCard): full-width grid cell, titled head, boxed body.
// Both cards render nothing while idle; the shell itself never decides that —
// callers still guard on `phase === 'idle'` before mounting it.
import type { ReactNode } from 'react'
import { cardHead, cardBox } from './fields'

export function CvCardShell({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{title}</div>
      <div style={{ ...cardBox, gap: 8, padding: 10 }}>
        {children}
      </div>
    </div>
  )
}
