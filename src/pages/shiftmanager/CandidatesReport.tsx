/**
 * Candidates report page — wraps the CandidatesReport component and switches
 * between tabs (candidates / coming-soon placeholders) based on initialTab.
 */
import type { ReactNode } from 'react'
import CandidatesReport from "@/components/reports/CandidatesReport";

// Placeholder shown for tabs that are not built yet.
function ComingSoon({ label }: { label?: ReactNode }) {
  return (
    <div className="flex items-center justify-center h-64 bg-[var(--surface)] rounded-xl"
      style={{ border: '1px solid var(--border)' }}>
      <p className="font-mono text-sm text-[var(--text-muted)]">{label} — komt eraan</p>
    </div>
  )
}

export default function Reports({ initialTab = 'candidates' }: { initialTab?: string }) {
  const renderTab = () => {
    switch (initialTab) {
      case 'candidates': return <CandidatesReport />
      default:           return <ComingSoon label={initialTab} />
    }
  }

  return (
    <div className="p-6">
      {renderTab()}
    </div>
  )
}