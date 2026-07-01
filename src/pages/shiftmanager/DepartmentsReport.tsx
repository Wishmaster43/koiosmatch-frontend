/**
 * DepartmentsReport — departments overview report.
 * KPI blocks (department/shift metrics) above a shifts chart block, with filters
 * in the right panel. KpiBlock below = one small KPI card.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, MapPin, Building2, Hash, RefreshCw } from 'lucide-react'
import ShiftsChartsBlock from '@/components/shiftmanager/ShiftsChartsBlock'
import { useRightPanel } from '@/context/RightPanelContext'
import KpiBlock from '@/components/ui/KpiBlock'  // shared KPI card
import { useSmCustomerTree } from '@/hooks/useSmCustomerTree'

export default function DepartmentsReport() {
  const { t } = useTranslation('shiftmanager')
  const { customers, loading } = useSmCustomerTree()
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Flatten the customer tree to departments (+ location/customer context).
  const departments = useMemo(() => customers.flatMap(c =>
    (c.locations ?? []).flatMap(l =>
      (l.departments ?? []).map(d => ({
        ...d,
        location_name:  l.name,
        location_status: l.status,
        customer_name:  c.name,
        customer_id:    c.id,
      }))
    )
  ), [customers])

  const uniqueCustomers = useMemo(() =>
    [...new Set(departments.map(d => d.customer_name).filter((x): x is string => Boolean(x)))], [departments])
  const uniqueLocations = useMemo(() =>
    [...new Set(departments.map(d => d.location_name).filter((x): x is string => Boolean(x)))], [departments])

  const filterGroups = useMemo(() => uniqueCustomers.length === 0 ? [] : [{
    key: 'klant', label: t('departmentsReport.filterCustomer'), type: 'search-select',
    selected: selectedCustomers,
    options: uniqueCustomers.map(c => ({
      value: c, label: c,
      count: departments.filter(d => d.customer_name === c).length,
    })),
    onToggle: (v: string) => setSelectedCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [t, uniqueCustomers, selectedCustomers, departments])

  useEffect(() => {
    registerFilters('departments-report', filterGroups)
    return () => unregisterFilters('departments-report')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', flexShrink: 0 }}>
          {t('departmentsReport.title')}
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                           background: 'var(--hover-bg)', color: 'var(--text-muted)', borderRadius: 999,
                           padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
              {t('departmentsReport.count', { count: departments.length })}
            </span>
          </>
        )}
        {loading && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--border)' }} />}
      </div>

      {/* KPI blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiBlock label={t('departmentsReport.kpi.totalDepartments')}  value={departments.length}        icon={Layers}    color="#7C3AED" bg="#F5F3FF" loading={loading} />
        <KpiBlock label={t('departmentsReport.kpi.uniqueLocations')}   value={uniqueLocations.length}    icon={MapPin}    color="var(--color-secondary)" bg="var(--color-secondary-bg)" loading={loading}
          sub={uniqueLocations.length > 0 ? t('departmentsReport.sub.avgPerLocation', { n: (departments.length / Math.max(uniqueLocations.length, 1)).toFixed(1) }) : undefined} />
        <KpiBlock label={t('departmentsReport.kpi.uniqueCustomers')}   value={uniqueCustomers.length}    icon={Building2} color="#059669" bg="#ECFDF5" loading={loading} />
        <KpiBlock label={t('departmentsReport.kpi.withCostCenter')}
          value={departments.filter(d => d.cost_center).length}
          icon={Hash} color="var(--color-warning)" bg="var(--color-warning-bg)" loading={loading}
          sub={departments.length > 0
            ? t('departmentsReport.sub.linkedPct', { pct: Math.round(departments.filter(d => d.cost_center).length / departments.length * 100) })
            : undefined} />
      </div>

      {/* Charts */}
      <ShiftsChartsBlock filterKey="departments-shifts-main" />

    </div>
  )
}