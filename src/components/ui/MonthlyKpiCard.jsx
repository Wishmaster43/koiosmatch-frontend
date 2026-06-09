const KPI_TARGET = 15 // Later instelbaar via instellingen

export default function MonthlyKpiCard({ candidates = [], loading = false, statusFilter = ['actief'] }) {
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

  // Status filter toepassen
  const filtered = statusFilter.length > 0
    ? candidates.filter(c => statusFilter.includes((c.status || 'onbekend').toLowerCase()))
    : candidates

  // Werkelijk: nieuwe kandidaten huidige maand
  const werkelijk = filtered.filter(c => {
    if (!c.registration_date) return false
    const d = new Date(c.registration_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  // Gemiddelde: alle maanden huidig jaar (inclusief huidige maand, consistent met grafiek)
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

  // Uitgeschreven: huidige maand op basis van end_date_employment
  const uitgeschreven = candidates.filter(c => {
    if (!c.end_date_employment) return false
    const d = new Date(c.end_date_employment)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  // Kleurcodering
  const color = werkelijk >= KPI_TARGET ? '#16A34A'
              : werkelijk >= gemiddeld   ? '#D97706'
              : '#DC2626'

  const pctVsKpi = KPI_TARGET > 0 ? Math.round((werkelijk / KPI_TARGET) * 100) : 0

  return (
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

      {/* Vier waarden */}
      <div className="flex" style={{ borderTop: '1px solid #F9FAFB', paddingTop: 14 }}>

        {/* Werkelijk */}
        <div className="flex-1 text-center">
          <div className="mb-1 font-semibold leading-none"
            style={{ fontSize: 26, color, letterSpacing: '-0.5px' }}>
            {werkelijk}
          </div>
          <div className="text-xs text-gray-400">Nieuw</div>
        </div>

        <div style={{ width: 1, background: '#F3F4F6', margin: '0 6px' }} />

        {/* Gemiddelde */}
        <div className="flex-1 text-center">
          <div className="mb-1 font-semibold leading-none"
            style={{ fontSize: 26, color: '#374151', letterSpacing: '-0.5px' }}>
            {gemiddeld}
          </div>
          <div className="text-xs text-gray-400">Gemiddelde</div>
        </div>

        <div style={{ width: 1, background: '#F3F4F6', margin: '0 6px' }} />

        {/* KPI doel */}
        <div className="flex-1 text-center">
          <div className="mb-1 font-semibold leading-none"
            style={{ fontSize: 26, color: '#9CA3AF', letterSpacing: '-0.5px' }}>
            {KPI_TARGET}
          </div>
          <div className="text-xs text-gray-400">KPI doel</div>
        </div>

        <div style={{ width: 1, background: '#F3F4F6', margin: '0 6px' }} />

        {/* Uitgeschreven */}
        <div className="flex-1 text-center">
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
  )
}