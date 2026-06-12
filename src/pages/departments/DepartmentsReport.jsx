import { useState, useEffect, useMemo } from 'react'
import { Layers, MapPin, Building2, Hash, RefreshCw } from 'lucide-react'
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

export default function DepartmentsReport() {
  const [departments, setDepartments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selectedCustomers, setSelectedCustomers] = useState([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/customers')
      .then(res => {
        const customers = res.data?.data ?? res.data ?? []
        setDepartments(customers.flatMap(c =>
          (c.locations ?? []).flatMap(l =>
            (l.departments ?? []).map(d => ({
              ...d,
              location_name:  l.name,
              location_status: l.status,
              customer_name:  c.name,
              customer_id:    c.id,
            }))
          )
        ))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const uniqueCustomers = useMemo(() =>
    [...new Set(departments.map(d => d.customer_name).filter(Boolean))], [departments])
  const uniqueLocations = useMemo(() =>
    [...new Set(departments.map(d => d.location_name).filter(Boolean))], [departments])

  const filterGroups = useMemo(() => uniqueCustomers.length === 0 ? [] : [{
    key: 'klant', label: 'Klant', type: 'search-select',
    selected: selectedCustomers,
    options: uniqueCustomers.map(c => ({
      value: c, label: c,
      count: departments.filter(d => d.customer_name === c).length,
    })),
    onToggle: v => setSelectedCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [uniqueCustomers, selectedCustomers, departments])

  useEffect(() => {
    registerFilters('departments-report', filterGroups)
    return () => unregisterFilters('departments-report')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', flexShrink: 0 }}>
          Afdelingen rapport
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: '#E5E7EB', flexShrink: 0 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                           background: '#F9FAFB', color: '#6B7280', borderRadius: 999,
                           padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
              {departments.length} afdelingen
            </span>
          </>
        )}
        {loading && <RefreshCw size={14} className="animate-spin" style={{ color: '#D1D5DB' }} />}
      </div>

      {/* KPI blokken */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiBlock label="Totaal afdelingen"  value={departments.length}        icon={Layers}    color="#7C3AED" bg="#F5F3FF" loading={loading} />
        <KpiBlock label="Unieke locaties"    value={uniqueLocations.length}    icon={MapPin}    color="#2563EB" bg="#EFF6FF" loading={loading}
          sub={uniqueLocations.length > 0 ? `gem. ${(departments.length / Math.max(uniqueLocations.length, 1)).toFixed(1)} per locatie` : undefined} />
        <KpiBlock label="Unieke klanten"     value={uniqueCustomers.length}    icon={Building2} color="#059669" bg="#ECFDF5" loading={loading} />
        <KpiBlock label="Met kostenplaats"
          value={departments.filter(d => d.cost_center).length}
          icon={Hash} color="#D97706" bg="#FFFBEB" loading={loading}
          sub={departments.length > 0
            ? `${Math.round(departments.filter(d => d.cost_center).length / departments.length * 100)}% gekoppeld`
            : undefined} />
      </div>

      {/* Charts */}
      <ShiftsChartsBlock filterKey="departments-shifts-main" />

    </div>
  )
}