/**
 * Candidates report page — hosts the shared CandidatesReport component.
 */
import CandidatesReport from "@/components/reports/CandidatesReport";

// Route-level wrapper around the candidates report (the only built shiftmanager report tab).
export default function Reports() {
  return (
    <div className="p-6">
      <CandidatesReport />
    </div>
  )
}
