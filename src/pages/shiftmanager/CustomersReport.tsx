/**
 * CustomersReport — customers overview report.
 * Top KPI blocks (customer counts/trends) above a shifts chart block, with
 * filters registered in the right panel. Clicking a KPI block opens a drill-down
 * drawer listing the underlying records.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ShiftsChartsBlock from '@/components/shiftmanager/ShiftsChartsBlock'
import { useSmCustomerTree } from '@/hooks/useSmCustomerTree'
import { useRightPanel } from '@/context/RightPanelContext'
import ModuleView       from '@/components/settings/ModuleView'
import EntityListDrawer  from '@/components/ui/EntityListDrawer'
import Spinner from '@/components/ui/Spinner'
import { PageTitle } from '@/components/ui/typography'
import type { SmDrillItem } from '@/types/shiftmanager'

// Renders the KPI blocks and shifts chart, registers filters into the right panel, and opens a drill-down drawer on KPI click.
export default function CustomersReport() {
  const { t } = useTranslation('shiftmanager')
  const { customers, loading } = useSmCustomerTree()
  const [drawer, setDrawer] = useState<{ title: string; items: SmDrillItem[] } | null>(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

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
    badgeColor: inactive.includes(c) ? 'var(--color-warning)' : 'var(--color-success)',
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
  // Distinct status values present in the loaded customers, sorted, for the status filter options.
  const statusOptions = useMemo(() =>
    [...new Set(customers.map(c => c.status).filter((x): x is string => Boolean(x)))].sort(), [customers])

  // Builds the single status filter definition, with live counts, handed to the shared right-panel filter UI; empty when no status value occurs at all.
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

  // Registers this report's filter groups with the shared right panel, and unregisters them on unmount so they do not leak into another page.
  useEffect(() => {
    registerFilters('customers-report', filterGroups)
    return () => unregisterFilters('customers-report')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <PageTitle style={{ flexShrink: 0 }}>
          {t('customersReport.title')}
        </PageTitle>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: 'var(--color-success-bg)', color: 'var(--color-on-success-bg)', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
                {active.length} {t('customersReport.activeWord')}
              </span>
              {inactive.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                               background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 999,
                               padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0 }} />
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
        {loading && <span style={{ color: 'var(--border)' }}><Spinner size={14} /></span>}
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
