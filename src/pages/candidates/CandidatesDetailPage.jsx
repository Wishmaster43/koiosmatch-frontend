import { useState, useEffect } from 'react'
import api from '../../lib/api'
import CandidatesTable from '../../components/reports/CandidatesTable'

export default function CandidatesDetailPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/candidates?per_page=500')
      .then(res => {
        const body = res.data
        setCandidates(Array.isArray(body) ? body : (body?.data ?? []))
      })
      .catch(err => console.error('Fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CandidatesTable candidates={candidates} loading={loading} />
    </div>
  )
}