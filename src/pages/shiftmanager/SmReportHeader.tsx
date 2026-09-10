/**
 * SmReportHeader + SmKpiGrid — shared report-page header (title + divider +
 * caller-supplied meta content, or a loading spinner) and the 4-column KPI
 * grid, both duplicated verbatim across DepartmentsReport/LocationsReport
 * (DRY round 11, SHIFTMANAGER). The 24px page padding stays at each page (it
 * wraps the whole report, not just the header). The raw h2 style below is a
 * measured huisstijl exemption (20/700, not the 15/600 PageTitle atom
 * CustomersReport uses) — kept verbatim, not converted, per this lane's brief.
 */
import type { CSSProperties, ReactNode } from 'react'
import Spinner from '@/components/ui/Spinner'

// Measured huisstijl exemption (20/700, not the 15/600 PageTitle pattern the
// lint selectors watch for) — moved verbatim, not converted, per this lane's brief.
const REPORT_TITLE_STYLE: CSSProperties = { fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', flexShrink: 0 }

// Title + a vertical divider + caller-supplied meta content, or a loading spinner while the underlying data has not arrived yet.
export function SmReportHeader({ title, loading, children }: { title: string; loading: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <h2 style={REPORT_TITLE_STYLE}>{title}</h2>
      {!loading && (
        <>
          <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
          {children}
        </>
      )}
      {loading && <span style={{ color: 'var(--border)' }}><Spinner size={14} /></span>}
    </div>
  )
}

// The 4-column KPI-block grid shared by the department/location reports.
export function SmKpiGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>{children}</div>
}
