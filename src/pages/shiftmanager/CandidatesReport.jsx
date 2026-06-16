/**
 * Candidates report page — wraps the CandidatesReport component and switches
 * between tabs (candidates / coming-soon placeholders) based on initialTab.
 */
import CandidatesReport from "../../components/reports/CandidatesReport";

// Placeholder shown for tabs that are not built yet.
function ComingSoon({ label }) {
  return (
    <div className="flex items-center justify-center h-64 bg-white rounded-xl"
      style={{ border: '1px solid #F3F4F6' }}>
      <p className="font-mono text-sm text-gray-300">{label} — komt eraan</p>
    </div>
  )
}

export default function Reports({ initialTab = 'candidates' }) {
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