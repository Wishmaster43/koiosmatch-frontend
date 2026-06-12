import { useState, useEffect, useMemo } from 'react'
import { MapPin, Layers, Building2, AlertCircle, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import ShiftsChartsBlock from '../../components/reports/ShiftsChartsBlock'
import { useRightPanel } from '../../context/RightPanelContext'

function KpiBlock({ label, value, sub, icon: Icon, color, bg, loading }) {
  return (
    <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 12,
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {loading ? <span style={{ color: '#E5E7EB' }}>—</span> : value}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{label}</div>
        {sub && !loading && (
          <div style={{ fontSize: 11, color, fontWeight: 500, marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}

export default function LocationsReport() {
  const [locations, setLocations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selectedStatuses, setSelectedStatuses] = useState([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/customers')
      .then(res => {
        const customers = res.data?.data ?? res.data ?? []
        setLocations(customers.flatMap(c =>
          (c.locations ?? []).map(l => ({
            ...l,
            customer_name: c.name,
            dept_count: l.departments?.length ?? 0,
          }))
        ))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const active   = locations.filter(l => l.status?.toLowerCase() === 'active')
  const inactive = locations.filter(l => l.status?.toLowerCase() !== 'active')
  const totalDep = locations.reduce((s, l) => s + (l.dept_count ?? 0), 0)
  const noDept   = locations.filter(l => !l.dept_count)
  const uniqueCustomers = [...new Set(locations.map(l => l.customer_name).filter(Boolean))]

  const statusOptions = useMemo(() =>
    [...new Set(locations.map(l => l.status).filter(Boolean))].sort(), [locations])

  const filterGroups = useMemo(() => statusOptions.length === 0 ? [] : [{
    key: 'status', label: 'Status locatie',
    selected: selectedStatuses,
    options: statusOptions.map(s => ({
      value: s,
      label: s === 'active' ? 'Actief' : s === 'inactive' ? 'Inactief' : s,
      count: locations.filter(l => l.status === s).length,
    })),
    onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [statusOptions, selectedStatuses, locations])

  useEffect(() => {
    registerFilters('locations-report', filterGroups)
    return () => unregisterFilters('locations-report')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', flexShrink: 0 }}>
          Locaties rapport
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: '#E5E7EB', flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F0FDF4', color: '#16A34A', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                {active.length} actief
              </span>
              {inactive.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                               background: '#FFF7ED', color: '#C2410C', borderRadius: 999,
                               padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C2410C' }} />
                  {inactive.length} inactief
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F9FAFB', color: '#6B7280', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                {locations.length} totaal
              </span>
            </div>
          </>
        )}
        {loading && <RefreshCw size={14} className="animate-spin" style={{ color: '#D1D5DB' }} />}
      </div>

      {/* KPI blokken */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiBlock label="Actieve locaties"  value={active.length}          icon={MapPin}      color="#2563EB" bg="#EFF6FF" loading={loading} />
        <KpiBlock label="Totaal afdelingen" value={totalDep}               icon={Layers}      color="#7C3AED" bg="#F5F3FF" loading={loading}
          sub={active.length > 0 ? `gem. ${(totalDep / Math.max(active.length, 1)).toFixed(1)} per locatie` : undefined} />
        <KpiBlock label="Unieke klanten"    value={uniqueCustomers.length} icon={Building2}   color="#059669" bg="#ECFDF5" loading={loading} />
        <KpiBlock label="Zonder afdeling"  value={noDept.length}           icon={AlertCircle} color="#D97706" bg="#FFFBEB" loading={loading}
          sub={noDept.length > 0 ? 'Nog niet ingericht' : 'Alles ingericht'} />
      </div>

      {/* Charts */}
      <ShiftsChartsBlock filterKey="locations-shifts-main" />

    </div>
  )
}