/**
 * distinctSortedValues — the "unique, sorted string values present in the
 * current row set" builder every SM report table used to build its filter-
 * panel options (status/channel/workflow/location-status/…) by hand: a Set
 * over one mapped field, falsy values dropped, then sorted. Extracted once so
 * the Set/filter/sort shape cannot drift per table (DRY round, jscpd pairs
 * across CustomersTable/LocationsTable/MessagesTable/DepartmentsTable/RunsTable).
 */
export function distinctSortedValues<T>(rows: T[], pick: (row: T) => unknown): string[] {
  return [...new Set(rows.map(pick).filter((x): x is string => Boolean(x)))].sort()
}
