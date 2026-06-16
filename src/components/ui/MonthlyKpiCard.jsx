/**
 * MonthlyKpiCard — KPI card for "new candidates this month" vs the configured
 * target (from useKpiSettings). Clicking it opens KpiDrillDownDrawer with the
 * underlying candidates. statusFilter limits which candidates count.
 */
import { useState } from 'react'
import KpiDrillDownDrawer from '../reports/KpiDrillDownDrawer'
import { useKpiSettings } from '../../lib/useKpiSettings'

export default function MonthlyKpiCard({ candidates = [], loading = false, statusFilter = ['actief'] }) {
  const { new_candidates_target: KPI_TARGET } = useKpiSettings()
  const [drill, setDrill] = useState(null) // { mode, title, candidates }

  if (loading) {
    return (
      <div className="p-5 bg-white rounded-xl" style={{ border: '1px solid #F3F4F6' }}>
        <div className="w-40 h-4 mb-4 bg-gray-100 rounded animate-pulse" />
        <div className="flex gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex-1">
              <div className="w-10 mx-auto mb-1 bg-gray-100 rounded h-7 animate-pulse" />
              <div className="w-16 h-3 mx-auto bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const now          = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()
  const monthLabel   = now.toLocaleString('nl-NL', { month: 'long', year: 'numeric' })

  const filtered = statusFilter.length > 0
    ? candidates.filter(c => statusFilter.includes((c.status || 'onbekend').toLowerCase()))
    : candidates

  // Nieuw deze maand
  const nieuweKandidaten = filtered.filter(c => {
    if (!c.registration_date) return false
    const d = new Date(c.registration_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
  const werkelijk = nieuweKandidaten.length

  // Gemiddelde per maand huidig jaar t/m huidige maand
  const grouped = {}
  filtered.forEach(c => {
    if (!c.registration_date) return
    const d = new Date(c.registration_date)
    if (d.getFullYear() !== currentYear) return
    const key = `${d.getMonth()}`
    grouped[key] = (grouped[key] || 0) + 1
  })
  const values    = Object.values(grouped)
  const gemiddeld = values.length
    ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
    : 0

  // Uitgeschreven deze maand
  const uitgeschrevenKandidaten = candidates.filter(c => {
    if (!c.end_date_employment) return false
    const d = new Date(c.end_date_employment)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
  const uitgeschreven = uitgeschrevenKandidaten.length

  const color = werkelijk >= KPI_TARGET ? '#16A34A'
              : werkelijk >= gemiddeld   ? '#D97706'
              : '#DC2626'

  const pctVsKpi = KPI_TARGET > 0 ? Math.round((werkelijk / KPI_TARGET) * 100) : 0

  const openDrill = (mode, title, list) => setDrill({ mode, title, candidates: list })

  const blockStyle = (clickable) => ({
    flex: 1, textAlign: 'center', cursor: clickable ? 'pointer' : 'default',
    padding: '4px 4px', borderRadius: 6, transition: 'background 0.1s',
  })

  return (
    <>
      <div className="flex flex-col gap-4 p-5 bg-white rounded-xl"
        style={{ border: '1px solid #F3F4F6' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-800" style={{ fontSize: 13 }}>
              Kandidaten overzicht
            </div>
            <div className="text-xs text-gray-400 mt-0.5 capitalize">{monthLabel}</div>
          </div>
          <div className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: color + '18', color }}>
            {pctVsKpi}% van KPI
          </div>
        </div>

        {/* Vier klikbare waarden */}
        <div className="flex" style={{ borderTop: '1px solid #F9FAFB', paddingTop: 14 }}>

          {/* Nieuw */}
          <div
            style={blockStyle(true)}
            onClick={() => openDrill('nieuw', `Nieuw in ${now.toLocaleString('nl-NL', { month: 'long' })}`, nieuweKandidaten)}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Klik voor details"
          >
            <div className="mb-1 font-semibold leading-none"
              style={{ fontSize: 26, color, letterSpacing: '-0.5px' }}>
              {werkelijk}
            </div>
            <div className="text-xs text-gray-400">Nieuw</div>
          </div>

          <div style={{ width: 1, background: '#F3F4F6', margin: '0 4px' }} />

          {/* Gemiddelde */}
          <div
            style={blockStyle(true)}
            onClick={() => openDrill('average', 'Gemiddelde berekening', candidates)}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Klik voor uitleg berekening"
          >
            <div className="mb-1 font-semibold leading-none"
              style={{ fontSize: 26, color: '#374151', letterSpacing: '-0.5px' }}>
              {gemiddeld}
            </div>
            <div className="text-xs text-gray-400">Gemiddelde</div>
          </div>

          <div style={{ width: 1, background: '#F3F4F6', margin: '0 4px' }} />

          {/* KPI doel */}
          <div
            style={blockStyle(true)}
            onClick={() => openDrill('average', 'KPI doel & voortgang', candidates)}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Klik voor KPI voortgang"
          >
            <div className="mb-1 font-semibold leading-none"
              style={{ fontSize: 26, color: '#9CA3AF', letterSpacing: '-0.5px' }}>
              {KPI_TARGET}
            </div>
            <div className="text-xs text-gray-400">KPI doel</div>
          </div>

          <div style={{ width: 1, background: '#F3F4F6', margin: '0 4px' }} />

          {/* Uitgeschreven */}
          <div
            style={blockStyle(uitgeschreven > 0)}
            onClick={uitgeschreven > 0
              ? () => openDrill('uitgeschreven', `Uitgeschreven in ${now.toLocaleString('nl-NL', { month: 'long' })}`, uitgeschrevenKandidaten)
              : undefined}
            onMouseEnter={e => { if (uitgeschreven > 0) e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title={uitgeschreven > 0 ? 'Klik voor details' : undefined}
          >
            <div className="mb-1 font-semibold leading-none"
              style={{ fontSize: 26, color: uitgeschreven > 0 ? '#EF4444' : '#9CA3AF', letterSpacing: '-0.5px' }}>
              {uitgeschreven}
            </div>
            <div className="text-xs text-gray-400">Uitgeschreven</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="overflow-hidden rounded-full" style={{ height: 4, background: '#F3F4F6' }}>
          <div className="h-full transition-all rounded-full"
            style={{ width: `${Math.min(pctVsKpi, 100)}%`, background: color }} />
        </div>
      </div>

      {drill && (
        <KpiDrillDownDrawer
          mode={drill.mode}
          title={drill.title}
          candidates={drill.candidates}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  )
}
