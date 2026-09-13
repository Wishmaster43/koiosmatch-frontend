// Small pieces shared by the jobs settings tabs (Metrics/RecentJobs/QueueOverview):
// the refresh button (spinning icon while loading) and the error notice line.
import { RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'

// The "Refresh" button every jobs tab renders identically — spinner icon tied to
// `phase === 'loading'`, pushed to the right edge of its toolbar row.
export function JobsRefreshButton({ phase, onRefresh, label }: {
  phase: string
  onRefresh: () => void
  label: string
}) {
  return (
    <Button variant="secondary" size="sm" onClick={onRefresh} style={{ marginLeft: 'auto' }}>
      <RefreshCw size={12} className={phase === 'loading' ? 'animate-spin' : undefined} /> {label}
    </Button>
  )
}

// The shared "could not load" notice shown when a jobs tab's phase is 'error'.
export function JobsErrorNotice({ label }: { label: string }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{label}</p>
}
