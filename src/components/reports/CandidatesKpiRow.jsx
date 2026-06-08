import { Users, UserCheck, UserX, UserPlus } from 'lucide-react'
import KpiCard from '../ui/KpiCard'

const count = (candidates, status) =>
  candidates.filter(c => (c.status || 'onbekend').toLowerCase() === status).length

export default function CandidatesKpiRow({ candidates = [], loading = false, onDrillDown }) {
  const drill = (label, statusFilter) => {
    if (!onDrillDown) return undefined
    return () => {
      const items = statusFilter
        ? candidates.filter(c => (c.status || 'onbekend').toLowerCase() === statusFilter)
        : candidates
      onDrillDown(label, items)
    }
  }

  return (
    <div className="grid gap-4 mb-6"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
      <KpiCard label="Passive kandidaten"      value={candidates.length}               icon={Users}     iconBg="#EEF2FF" iconColor="#534AB7" loading={loading} onClick={drill('Alle kandidaten', null)} /> 
      {/* // Status actief en nieuw Nieuw kleiner dan 30 dagen en geen planned shifts */}
      <KpiCard label="Actieve kandidaten"      value={count(candidates, 'actief')}     icon={UserCheck} iconBg="#F0FDF4" iconColor="#16A34A" loading={loading} onClick={drill('Actief', 'actief')} />

{/* - Gepland vs actief (plast planned shift in toekomst) */}

      <KpiCard label="Niet actieve kandidaten" value={count(candidates, 'nietactief')} icon={UserX}     iconBg="#FFF7ED" iconColor="#C2410C" loading={loading} onClick={drill('Niet actief', 'nietactief')} />
      <KpiCard label="Intake kandidaten"      value={count(candidates, 'intake')}     icon={UserPlus}  iconBg="#FAF5FF" iconColor="#7C3AED" loading={loading} onClick={drill('Intake', 'intake')} />
    </div>
  )
}