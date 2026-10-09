// Shared fetch-all options of the Shiftmanager mirror lists: the BE caps these
// endpoints at PageSize::from(request, 50, 200), so ask for 200 and stop at 20 pages.
export const SM_FETCH_ALL = { perPage: 200, maxPages: 20 } as const
