/**
 * CustomersReport — customers overview report.
 * Top KPI blocks (customer counts/trends) above a shifts chart block, with
 * filters registered in the right panel. Clicking a KPI block opens a drill-down
 * drawer listing the underlying records.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import ShiftsChartsBlock from '@/components/shiftmanager/ShiftsChartsBlock'
import { useRightPanel } from '@/context/RightPanelContext'
import ModuleView       from '@/components/settings/ModuleView'
import EntityListDrawer  from '@/components/ui/EntityListDrawer'
import type { ReportCustomer } from '@/types/reports'
import type { SmDrillItem } from '@/types/shiftmanager'

export default function CustomersReport() {
  const { t } = useTranslation('shiftmanager')
  const [customers, setCustomers] = useState<ReportCustomer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [drawer,    setDrawer]    = useState<{ title: string; items: SmDrillItem[] } | null>(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/sm_customers')
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
  const drillActive: SmDrillItem[] = active.map(c => ({
    primary:     c.name ?? '',
    secondary:   t('customersReport.sub.locations', { count: c.locations?.length ?? 0 }),
    badge:       t('customersReport.activeWord'),
    badgeColor:  'var(--color-success)',
    badgeBg:     'var(--color-success-bg)',
  }))
  const drillLocations: SmDrillItem[] = customers.flatMap(c =>
    (c.locations ?? []).map(l => ({ primary: l.name ?? '', secondary: c.name }))
  )
  const drillDepartments: SmDrillItem[] = customers.flatMap(c =>
    (c.locations ?? []).flatMap(l =>
      (l.departments ?? []).map(d => ({
        primary:   d.name ?? '',
        secondary: `${l.name} — ${c.name}`,
      }))
    )
  )
  const drillNoLocation: SmDrillItem[] = noLocation.map(c => ({
    primary:   c.name ?? '',
    secondary: t('customersReport.sub.noLocationsLinked'),
    badge:     inactive.includes(c) ? t('customersReport.inactiveWord') : t('customersReport.activeWord'),
    badgeColor: inactive.includes(c) ? '#C2410C' : 'var(--color-success)',
    badgeBg:   inactive.includes(c) ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
  }))

  // Values for the configurable "customers" module view (keyed by block id).
  const moduleData = {
    active_customers: {
      value: active.length,
      sub: inactive.length > 0 ? `${inactive.length} ${t('customersReport.inactiveWord')}` : undefined,
      onClick: !loading ? () => setDrawer({ title: t('customersReport.drill.activeCustomers'), items: drillActive }) : undefined,
    },
    total_locations: {
      value: totalLoc,
      sub: active.length > 0 ? t('customersReport.sub.avgPerCustomer', { n: (totalLoc / Math.max(active.length, 1)).toFixed(1) }) : undefined,
      onClick: !loading ? () => setDrawer({ title: t('customersReport.drill.allLocations'), items: drillLocations }) : undefined,
    },
    total_departments: {
      value: totalDep,
      sub: totalLoc > 0 ? t('customersReport.sub.avgPerLocation', { n: (totalDep / Math.max(totalLoc, 1)).toFixed(1) }) : undefined,
      onClick: !loading ? () => setDrawer({ title: t('customersReport.drill.allDepartments'), items: drillDepartments }) : undefined,
    },
    customers_without_location: {
      value: noLocation.length,
      sub: t('customersReport.sub.notLinked'),
      onClick: !loading && noLocation.length > 0 ? () => setDrawer({ title: t('customersReport.drill.customersWithoutLocation'), items: drillNoLocation }) : undefined,
    },
  }

  // Right-panel filter
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const statusOptions = useMemo(() =>
    [...new Set(customers.map(c => c.status).filter((x): x is string => Boolean(x)))].sort(), [customers])

  const filterGroups = useMemo(() => statusOptions.length === 0 ? [] : [{
    key: 'status', label: t('customersReport.filterStatus'),
    selected: selectedStatuses,
    options: statusOptions.map(s => ({
      value: s,
      label: s === 'active' ? t('common:status.active') : s === 'inactive' ? t('common:status.inactive') : s,
      count: customers.filter(c => c.status === s).length,
    })),
    onToggle: (v: string) => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [t, statusOptions, selectedStatuses, customers])

  useEffect(() => {
    registerFilters('customers-report', filterGroups)
    return () => unregisterFilters('customers-report')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', flexShrink: 0 }}>
          {t('customersReport.title')}
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
                {active.length} {t('customersReport.activeWord')}
              </span>
              {inactive.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                               background: 'var(--color-warning-bg)', color: '#C2410C', borderRadius: 999,
                               padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C2410C', flexShrink: 0 }} />
                  {inactive.length} {t('customersReport.inactiveWord')}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: 'var(--hover-bg)', color: 'var(--text-muted)', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                {customers.length} {t('customersReport.totalWord')}
              </span>
            </div>
          </>
        )}
        {loading && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--border)' }} />}
      </div>

      {/* KPI blocks — layout configurable in Settings → Views → Klanten */}
      <div style={{ marginBottom: 28 }}>
        <ModuleView module="customers" data={moduleData} loading={loading} />
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
