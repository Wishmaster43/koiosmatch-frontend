import { GitMerge } from 'lucide-react'
import type { ReactNode } from 'react'

// MergeModalHeaderTitle — the shared FloatingPanel `header` for every merge
// modal (MergeCandidateModal, MergeCustomerModal): the GitMerge icon + title.
export function MergeModalHeaderTitle({ title }: { title: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
      <GitMerge size={15} /> {title}
    </div>
  )
}

// MergeModalIntroLine — the one-line explanation directly under the header
// ("this absorbs X into Y"), same style on every merge modal.
export function MergeModalIntroLine({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{children}</div>
  )
}
