import CandidateStatusAnalysis from '../components/reports/CandidateStatusAnalysis'

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
      case 'candidates': return <CandidateStatusAnalysis />
      default:           return <ComingSoon label={initialTab} />
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="font-semibold text-gray-900" style={{ fontSize: 18 }}>Rapportages</h2>
        <p className="text-sm text-gray-400 mt-0.5">Inzichten in je data</p>
      </div>
      {renderTab()}
    </div>
  )
}