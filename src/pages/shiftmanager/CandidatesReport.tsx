/**
 * Candidates report page — wraps the CandidatesReport component and switches
 * between tabs (candidates / coming-soon placeholders) based on initialTab.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import CandidatesReport from "@/components/reports/CandidatesReport";

// Placeholder shown for tabs that are not built yet (§5 — no hardcoded strings,
// even on an unreachable-today default branch: mirrors analytics.json's comingSoon).
function ComingSoon({ label }: { label?: ReactNode }) {
  const { t } = useTranslation('shiftmanager')
  return (
    <div className="flex items-center justify-center h-64 bg-[var(--surface)] rounded-xl"
      style={{ border: '1px solid var(--border)' }}>
      <p className="font-mono text-sm text-[var(--text-muted)]">{label} — {t('comingSoon')}</p>
    </div>
  )
}

// Route-level switch between the built candidates report and a coming-soon
// placeholder for every other (not-yet-built) shiftmanager report tab.
export default function Reports({ initialTab = 'candidates' }: { initialTab?: string }) {
  // Renders the tab named by initialTab, falling back to the placeholder for anything not yet built.
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