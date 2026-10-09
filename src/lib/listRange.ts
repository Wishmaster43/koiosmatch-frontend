// Server-reported row range of a list page (meta.from/to); null until a response carries it.
export interface ListRange { rangeFrom: number | null; rangeTo: number | null }

// Pick the footer range out of a cached list result so the footer never derives it from the requested page size.
export function pickListRange(data: { rangeFrom?: number | null; rangeTo?: number | null } | undefined): ListRange {
  return { rangeFrom: data?.rangeFrom ?? null, rangeTo: data?.rangeTo ?? null }
}

// Pick total and last page out of a cached list result, defaulting to an empty single page until the first response.
export function pickListPaging(data: { total?: number; lastPage?: number } | undefined): { total: number; lastPage: number } {
  return { total: data?.total ?? 0, lastPage: data?.lastPage ?? 1 }
}
