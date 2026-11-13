/**
 * Shiftmanager UI row types — the mapped (camelCase) shapes the SM pages build
 * from the `sm_*` API and pass to their tables/drawers. Permissive (index sig)
 * since they mirror loosely-typed external data.
 */

// A mapped customer row (CustomersPage → CustomersTable/InsightsRow).
export interface SmCustomerRow {
  id?: string | number
  name?: string
  initials?: string
  debtorNumber?: string
  status?: string
  accountManager?: string
  amInitials?: string
  locations?: Array<{ departments?: unknown[] }>
  contacts?: unknown[]
  city?: string
  [k: string]: unknown
}

// A contact person row (ContactsPage → ContactDrawer).
export interface SmContactRow {
  id?: string | number
  firstname?: string
  lastname?: string
  function_title?: string
  planning?: boolean
  email?: string
  mobile?: string
  customer?: string
  location?: string
  [k: string]: unknown
}

// A department row (DepartmentsPage → DepartmentDrawer).
export interface SmDepartmentRow {
  id?: string | number
  name?: string
  status?: string
  customer?: string
  location?: string
  city?: string
  costCenter?: string
  employees?: number
  shifts?: number
  [k: string]: unknown
}

// One row in a report KPI drill-down drawer (EntityListDrawer-compatible).
export interface SmDrillItem { primary: string; secondary?: string; badge?: string; badgeColor?: string; badgeBg?: string }

// A location row (LocationsPage → LocationDrawer). `departments` is the list of
// department names; `shifts` a count.
export interface SmLocationRow {
  id?: string | number
  name?: string
  status?: string
  customer?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  departments?: string[]
  shifts?: number
  [k: string]: unknown
}

// ── Shifts charts + orders cluster (ShiftsChartsBlock / OrdersTable) ──────────

// The five Shiftmanager chart series, English ids (WIRE-IDS-ENGLISH-1): the Dutch
// wire ids exist only inside components/shiftmanager/shiftWire.ts.
export type SeriesKey = 'total' | 'unfilled' | 'no_candidate' | 'forecast' | 'actual'
// The hours twin of a series key as a per-month row carries it (`total_hours`, …).
export type SeriesHoursKey = `${SeriesKey}_hours`

// A chart series descriptor (key + colour; label resolved via i18n charts.series.<key>).
export interface ShiftSeries { key: SeriesKey; color: string }

// One selectable location in the shifts filter options.
interface ShiftLocationOption { id: string | number; name: string; customer?: string; [k: string]: unknown }

// The filter options returned by /sm_reports/shifts-filter-options.
export interface ShiftFilterOptions { job_types: string[]; locations: ShiftLocationOption[] }

// One NORMALISED per-month row from /sm_reports/shifts-per-month (shiftWire.normalizeShiftMonthRow):
// English keys only, every count and hours value a number (0 when the server omits it).
export type ShiftMonthRow = { month: string } & Record<SeriesKey | SeriesHoursKey, number>

// One candidate's per-month cell from /sm_reports/shifts-per-candidate, normalised to
// English keys (shiftWire.normalizeMatrixCell); a metric the server omits stays absent.
export type MatrixMetricKey = 'forecast_hours' | 'forecast_shifts' | 'actual_hours' | 'actual_shifts'
export type MatrixCell = Partial<Record<MatrixMetricKey, number>>

// A transformed chart entry — dynamic `${year}_${seriesKey}` numeric keys.
export interface ShiftsChartDatum { label: string; _quarter?: string; _monthIndex?: number; [k: string]: string | number | undefined }

// A bar descriptor for the shifts/hours bar chart.
export interface ShiftBar {
  dataKey: string
  name: string
  color: string
  // Plain series colour (rank 0 = most recent selected year) or a color-mix tint of it
  // for an older year (SM-2YR) — the actual Recharts `fill`, table swatch and legend
  // dot all read this instead of a separate SVG opacity.
  fill: string
  opacity: number
  legendType: 'square' | 'none'
  year: number
  seriesKey: string
}

// A right-panel filter group (shifts charts + orders table).
interface ShiftFilterOption { value: string; label: string; count?: number }
export interface ShiftFilterGroup {
  key: string
  label: string
  type?: string
  selected: string[]
  options: ShiftFilterOption[]
  onToggle: (value: string) => void
  // Index signature so the group is assignable to RightPanel's FilterGroup
  // (Record<string, unknown>) when registered.
  [k: string]: unknown
}

// An invited candidate on a shift/order row.
interface OrderInvite {
  id?: string | number
  candidate?: { first_name?: string; last_name?: string; email?: string; mobile?: string; [k: string]: unknown }
  status?: string
  scheduled_at?: string
  total_time_worked?: number
  contract_type?: string
  [k: string]: unknown
}

// A raw shift/order row from /sm_reports (loosely-typed external data).
export interface OrderRow {
  id?: string | number
  external_id?: string | number
  scheduled_id?: string | number
  schedule_id?: string | number
  own_status?: string
  job_type?: string
  start_time?: string
  end_time?: string
  number_persons?: number
  notes?: string
  hours_worked?: number | string | null
  billed_hours?: number | string | null
  worked_hours_candidate?: number | string | null
  worked_hours_customer?: number | string | null
  cost_center?: string | number | null
  cost_center_candidate?: string | number | null
  cost_center_customer?: string | number | null
  invites?: OrderInvite[]
  order?: {
    order_ref?: string
    cost_center?: string | number | null
    customer?: { name?: string }
    customerLocation?: { name?: string; address?: string; customer?: { name?: string } }
    [k: string]: unknown
  }
  [k: string]: unknown
}

// OrderRow enriched with the derived display/sort keys (useOrdersTable).
export interface EnrichedOrderRow extends OrderRow {
  customer_name: string
  location_name: string
  start_date: string
  cost_center_candidate: string | number | null
  cost_center_customer: string | number | null
  worked_hours_candidate: number | string | null
  worked_hours_customer: number | string | null
  order_ref: string
}

// ── Drill-down drawer (ShiftsDrillDownDrawer) — a different nested shape ──────

export interface ShiftInvite {
  id?: string | number
  candidate?: { first_name?: string; last_name?: string; email?: string; mobile?: string; [k: string]: unknown }
  scheduled_at?: string
  total_time_worked?: number
  contract_type?: string
  status?: string
  [k: string]: unknown
}
export interface ShiftRow {
  id?: string | number
  external_id?: string
  order_external_id?: string
  own_status?: string
  job_type?: string
  start_time?: string
  end_time?: string
  number_persons?: number
  customer_rate?: number | string
  pickup_place?: string
  invites?: ShiftInvite[]
  order?: {
    order_ref?: string
    subject?: string
    customer_location?: { name?: string; customer_external_id?: string | number; [k: string]: unknown }
    location_street?: string
    location_postal_code?: string
    location_place?: string
    [k: string]: unknown
  }
  [k: string]: unknown
}

// Arguments for the pure buildShiftsFilterGroups builder.
export interface BuildShiftsFilterGroupsArgs {
  t: (key: string, opts?: Record<string, unknown>) => string
  // Active app locale (DATUM-1/LANE-B) — feeds the month-abbreviation options.
  locale: string
  seriesLabel: (key: string) => string
  period: string
  selectedYears: number[]
  selectedMonths: string[]
  visible: string[]
  selectedJobTypes: string[]
  selectedCustomers: string[]
  selectedLocations: string[]
  filterOptions: ShiftFilterOptions
  fixedCustomers: string[]
  fixedLocationIds: string[]
  setPeriod: (v: string) => void
  toggleYear: (v: string) => void
  toggleMonth: (v: string) => void
  setVisible: (fn: (prev: string[]) => string[]) => void
  setSelectedJobTypes: (fn: (prev: string[]) => string[]) => void
  setSelectedCustomers: (fn: (prev: string[]) => string[]) => void
  setSelectedLocations: (fn: (prev: string[]) => string[]) => void
}
