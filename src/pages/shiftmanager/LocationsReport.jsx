/**
 * LocationsReport — locations overview report.
 * KPI blocks (location/shift metrics) above a shifts chart block, with filters
 * in the right panel. Clicking a KPI block opens a drill-down drawer.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Layers, Building2, AlertCircle, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import ShiftsChartsBlock from '../../components/shiftmanager/ShiftsChartsBlock'
import { useRightPanel } from '../../context/RightPanelContext'
import KpiBlock         from '../../components/ui/KpiBlock'
import EntityListDrawer from '../../components/ui/EntityListDrawer'

export default function LocationsReport() {
  const { t } = useTranslation('shiftmanager')
  const [locations, setLocations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [drawer,    setDrawer]    = useState(null) // { title, items }
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

  // Drill-down datasets
  const drillActive = active.map(l => ({
    primary:    l.name,
    secondary:  l.customer_name,
    badge:      t('locationsReport.badge.active'),
    badgeColor: 'var(--color-success)',
    badgeBg:    '#F0FDF4',
  }))
  const drillDepartments = locations.flatMap(l =>
    (l.departments ?? []).map(d => ({ primary: d.name, secondary: l.name }))
  )
  const drillCustomers = uniqueCustomers.map(name => ({ primary: name }))
  const drillNoDept = noDept.map(l => ({
    primary:    l.name,
    secondary:  l.customer_name,
    badge:      t('locationsReport.badge.noDepartments'),
    badgeColor: 'var(--color-warning)',
    badgeBg:    'var(--color-warning-bg)',
  }))

  const statusOptions = useMemo(() =>
    [...new Set(locations.map(l => l.status).filter(Boolean))].sort(), [locations])

  const filterGroups = useMemo(() => statusOptions.length === 0 ? [] : [{
    key: 'status', label: t('locationsReport.filterStatus'),
    selected: selectedStatuses,
    options: statusOptions.map(s => ({
      value: s,
      label: s === 'active' ? t('common:status.active') : s === 'inactive' ? t('common:status.inactive') : s,
      count: locations.filter(l => l.status === s).length,
    })),
    onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [t, statusOptions, selectedStatuses, locations])

  useEffect(() => {
    registerFilters('locations-report', filterGroups)
    return () => unregisterFilters('locations-report')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', flexShrink: 0 }}>
          {t('locationsReport.title')}
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: '#E5E7EB', flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F0FDF4', color: 'var(--color-success)', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
                {active.length} {t('locationsReport.activeWord')}
              </span>
              {inactive.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                               background: '#FFF7ED', color: '#C2410C', borderRadius: 999,
                               padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C2410C' }} />
                  {inactive.length} {t('locationsReport.inactiveWord')}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F9FAFB', color: '#6B7280', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                {locations.length} {t('locationsReport.totalWord')}
              </span>
            </div>
          </>
        )}
        {loading && <RefreshCw size={14} className="animate-spin" style={{ color: '#D1D5DB' }} />}
      </div>

      {/* KPI blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiBlock
          label={t('locationsReport.kpi.activeLocations')}
          value={active.length}
          icon={MapPin} color="var(--color-secondary)" bg="var(--color-secondary-bg)"
          loading={loading}
          onClick={!loading ? () => setDrawer({ title: t('locationsReport.drill.activeLocations'), items: drillActive }) : undefined}
        />
        <KpiBlock
          label={t('locationsReport.kpi.totalDepartments')}
          value={totalDep}
          icon={Layers} color="#7C3AED" bg="#F5F3FF"
          loading={loading}
          sub={active.length > 0 ? t('locationsReport.sub.avgPerLocation', { n: (totalDep / Math.max(active.length, 1)).toFixed(1) }) : undefined}
          onClick={!loading ? () => setDrawer({ title: t('locationsReport.drill.allDepartments'), items: drillDepartments }) : undefined}
        />
        <KpiBlock
          label={t('locationsReport.kpi.uniqueCustomers')}
          value={uniqueCustomers.length}
          icon={Building2} color="#059669" bg="#ECFDF5"
          loading={loading}
          onClick={!loading ? () => setDrawer({ title: t('locationsReport.drill.customers'), items: drillCustomers }) : undefined}
        />
        <KpiBlock
          label={t('locationsReport.kpi.withoutDepartment')}
          value={noDept.length}
          icon={AlertCircle} color="var(--color-warning)" bg="var(--color-warning-bg)"
          loading={loading}
          sub={noDept.length > 0 ? t('locationsReport.sub.notConfigured') : t('locationsReport.sub.allConfigured')}
          onClick={!loading && noDept.length > 0
            ? () => setDrawer({ title: t('locationsReport.drill.locationsWithoutDepartment'), items: drillNoDept })
            : undefined}
        />
      </div>

      {/* Charts */}
      <ShiftsChartsBlock filterKey="locations-shifts-main" />

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
