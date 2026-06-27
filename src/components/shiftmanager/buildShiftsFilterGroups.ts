/**
 * buildShiftsFilterGroups — pure builder for the right-panel filter groups of
 * ShiftsChartsBlock (period / years / months / series / job type / customer /
 * location). Customer + location groups are hidden when a fixed scope is set.
 * Receives the current selection + setters; returns the declarative group tree.
 */
import { monthAbbr, SERIES, YEAR_OPTIONS } from "./shiftsChartsConfig"
import type { BuildShiftsFilterGroupsArgs, ShiftFilterGroup } from '@/types/shiftmanager'

export function buildShiftsFilterGroups({
  t, seriesLabel, period, selectedYears, selectedMonths, visible,
  selectedJobTypes, selectedCustomers, selectedLocations, filterOptions,
  fixedCustomers, fixedLocationIds,
  setPeriod, toggleYear, setSelectedMonths, setVisible,
  setSelectedJobTypes, setSelectedCustomers, setSelectedLocations,
}: BuildShiftsFilterGroupsArgs): ShiftFilterGroup[] {
  const groups: ShiftFilterGroup[] = [
    {
      key:      "periode",
      label:    t('charts.filters.period'),
      selected: [period],
      options:  [
        { value: "month",   label: t('charts.filters.month') },
        { value: "quarter", label: t('charts.filters.quarter') },
      ],
      onToggle: (v) => setPeriod(v),
    },
    {
      key:      "jaren",
      label:    t('charts.filters.years'),
      selected: selectedYears.map(String),
      options:  YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) })),
      onToggle: toggleYear,
    },
  ]

  if (period === "month") {
    groups.push({
      key:      "maanden",
      label:    t('charts.filters.months'),
      selected: selectedMonths.length > 0
        ? selectedMonths.map(String)
        : Array.from({ length: 12 }, (_, i) => String(i + 1)),
      options:  Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthAbbr(i) })),
      onToggle: (v) =>
        setSelectedMonths((prev) =>
          prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]
        ),
    })
  }

  groups.push({
    key:      "reeksen",
    label:    t('charts.filters.series'),
    selected: visible,
    options:  SERIES.map((s) => ({ value: s.key, label: seriesLabel(s.key) })),
    onToggle: (v) =>
      setVisible((prev) =>
        prev.includes(v) ? prev.filter((k) => k !== v) : [...prev, v]
      ),
  })

  if (filterOptions.job_types.length > 0) {
    groups.push({
      key:      "functie",
      label:    t('charts.filters.jobType'),
      selected: selectedJobTypes,
      options:  filterOptions.job_types.map((j) => ({ value: j, label: j })),
      onToggle: (v) =>
        setSelectedJobTypes((prev) =>
          prev.includes(v) ? prev.filter((j) => j !== v) : [...prev, v]
        ),
    })
  }

  // Customer filter only when no fixed customer/location scope is set.
  if (fixedCustomers.length === 0 && fixedLocationIds.length === 0) {
    const customerOptions = [...new Set(
      filterOptions.locations.map(l => l.customer).filter((c): c is string => Boolean(c))
    )].sort().map(c => ({ value: c, label: c }))

    if (customerOptions.length > 0) {
      groups.push({
        key:      "klant",
        label:    t('charts.filters.customer'),
        type:     "search-select",
        selected: selectedCustomers,
        options:  customerOptions,
        onToggle: (v) =>
          setSelectedCustomers((prev) =>
            prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v]
          ),
      })
    }
  }

  // Location filter only when no fixed locations are set.
  if (fixedLocationIds.length === 0) {
    const locationOptions = filterOptions.locations
      .filter(l => {
        if (fixedCustomers.length > 0) return fixedCustomers.includes(l.customer ?? '')
        return selectedCustomers.length === 0 || selectedCustomers.includes(l.customer ?? '')
      })
      .map(l => ({ value: String(l.id), label: l.name }))

    if (locationOptions.length > 0) {
      groups.push({
        key:      "locatie",
        label:    t('charts.filters.location'),
        type:     "search-select",
        selected: selectedLocations,
        options:  locationOptions,
        onToggle: (v) =>
          setSelectedLocations((prev) =>
            prev.includes(v) ? prev.filter((l) => l !== v) : [...prev, v]
          ),
      })
    }
  }

  return groups
}
