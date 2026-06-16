/**
 * CustomersReport — customers overview report.
 * Top KPI blocks (customer counts/trends) above a shifts chart block, with
 * filters registered in the right panel. Clicking a KPI block opens a drill-down
 * drawer listing the underlying records.
 */
import { useState, useEffect, useMemo } from 'react'
import { Building2, MapPin, Layers, TrendingUp, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import ShiftsChartsBlock from '../../components/shiftmanager/ShiftsChartsBlock'
import { useRightPanel } from '../../context/RightPanelContext'
import KpiBlock          from '../../components/ui/KpiBlock'
import EntityListDrawer  from '../../components/ui/EntityListDrawer'

export default function CustomersReport() {
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [drawer,    setDrawer]    = useState(null) // { title, items }

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/customers')
      .then(res => {
        const data = res.data
        setCustomers(Array.isArray(data) ? data : (data?.data ?? []))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Derived KPI values
  const active   = customers.filter(c => c.status?.toLowerCase() === 'active')
  const inactive = customers.filter(c => c.status?.toLowerCase() !== 'active')
  const totalLoc = customers.reduce((s, c) => s + (c.locations?.length ?? 0), 0)
  const totalDep = customers.reduce((s, c) =>
    s + (c.locations ?? []).reduce((l, loc) => l + (loc.departments?.length ?? 0), 0), 0)
  const noLocation = customers.filter(c => !c.locations?.length)

  // Drill-down datasets
  const drillActive = active.map(c => ({
    primary:     c.name,
    secondary:   `${c.locations?.length ?? 0} locaties`,
    badge:       'actief',
    badgeColor:  '#16A34A',
    badgeBg:     '#F0FDF4',
  }))
  const drillLocations = customers.flatMap(c =>
    (c.locations ?? []).map(l => ({ primary: l.name, secondary: c.name }))
  )
  const drillDepartments = customers.flatMap(c =>
    (c.locations ?? []).flatMap(l =>
      (l.departments ?? []).map(d => ({
        primary:   d.name,
        secondary: `${l.name} — ${c.name}`,
      }))
    )
  )
  const drillNoLocation = noLocation.map(c => ({
    primary:   c.name,
    secondary: 'Geen locaties gekoppeld',
    badge:     `${inactive.includes(c) ? 'inactief' : 'actief'}`,
    badgeColor: inactive.includes(c) ? '#C2410C' : '#16A34A',
    badgeBg:   inactive.includes(c) ? '#FFF7ED' : '#F0FDF4',
  }))

  // Right-panel filter
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const statusOptions = useMemo(() =>
    [...new Set(customers.map(c => c.status).filter(Boolean))].sort(), [customers])

  const filterGroups = useMemo(() => statusOptions.length === 0 ? [] : [{
    key: 'status', label: 'Status klant',
    selected: selectedStatuses,
    options: statusOptions.map(s => ({
      value: s,
      label: s === 'active' ? 'Actief' : s === 'inactive' ? 'Inactief' : s,
      count: customers.filter(c => c.status === s).length,
    })),
    onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [statusOptions, selectedStatuses, customers])

  useEffect(() => {
    registerFilters('customers-report', filterGroups)
    return () => unregisterFilters('customers-report')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', flexShrink: 0 }}>
          Klanten rapport
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: '#E5E7EB', flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F0FDF4', color: '#16A34A', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                {active.length} actief
              </span>
              {inactive.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                               background: '#FFF7ED', color: '#C2410C', borderRadius: 999,
                               padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C2410C', flexShrink: 0 }} />
                  {inactive.length} inactief
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F9FAFB', color: '#6B7280', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                {customers.length} totaal
              </span>
            </div>
          </>
        )}
        {loading && <RefreshCw size={14} className="animate-spin" style={{ color: '#D1D5DB' }} />}
      </div>

      {/* KPI blokken */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiBlock
          label="Actieve klanten"
          value={active.length}
          sub={inactive.length > 0 ? `${inactive.length} inactief` : undefined}
          icon={Building2}
          color="#2563EB" bg="#EFF6FF"
          loading={loading}
          onClick={!loading ? () => setDrawer({ title: 'Actieve klanten', items: drillActive }) : undefined}
        />
        <KpiBlock
          label="Totaal locaties"
          value={totalLoc}
          sub={active.length > 0 ? `gem. ${(totalLoc / Math.max(active.length, 1)).toFixed(1)} per klant` : undefined}
          icon={MapPin}
          color="#7C3AED" bg="#F5F3FF"
          loading={loading}
          onClick={!loading ? () => setDrawer({ title: 'Alle locaties', items: drillLocations }) : undefined}
        />
        <KpiBlock
          label="Totaal afdelingen"
          value={totalDep}
          sub={totalLoc > 0 ? `gem. ${(totalDep / Math.max(totalLoc, 1)).toFixed(1)} per locatie` : undefined}
          icon={Layers}
          color="#059669" bg="#ECFDF5"
          loading={loading}
          onClick={!loading ? () => setDrawer({ title: 'Alle afdelingen', items: drillDepartments }) : undefined}
        />
        <KpiBlock
          label="Klanten zonder locatie"
          value={noLocation.length}
          sub="Nog niet gekoppeld"
          icon={TrendingUp}
          color="#D97706" bg="#FFFBEB"
          loading={loading}
          onClick={!loading && noLocation.length > 0
            ? () => setDrawer({ title: 'Klanten zonder locatie', items: drillNoLocation })
            : undefined}
        />
      </div>

      {/* Shift charts */}
      <ShiftsChartsBlock filterKey="customers-shifts-main" />

      {/* Drill-down drawer */}
      {drawer && (
        <EntityListDrawer
          title={drawer.title}
          items={drawer.items}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  )
}
