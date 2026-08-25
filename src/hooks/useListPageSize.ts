/**
 * useListPageSize — the ONE page-size state for every entity list page
 * (candidates/applications/vacancies/matches/opportunities/tasks/outreach/customers).
 * Kills the per-page divergence audit found 2026-08-05: each page re-implemented its
 * own `useState(() => user?.default_per_page ?? 50)` (or, worse, a bare hardcoded 50 —
 * VacanciesPage/CustomersPage), so the tenant's saved "rows per page" preference
 * (default_per_page) silently applied on some pages and not others.
 *
 * Two things this hook fixes at the root:
 *  1. STICKINESS — every other piece of page state (page number, filters, view mode)
 *     already survives the shell's unmount-on-navigate via usePageMemory; pageSize was
 *     the one exception, so a user's explicit pick reverted to the seeded default the
 *     moment they navigated away and back (measured root cause of a bug reported,
 *     verbatim, as "…op 50 gezet worden" — i.e. "Applications: rows per
 *     page can't be set to 50" — the shell unmounts ApplicationsPage on every
 *     navigation, and pageSize alone wasn't behind usePageMemory).
 *  2. HONESTY — `serverCap` clamps both the seeded default AND the offered dropdown
 *     options to what the endpoint actually accepts, so picking the tenant's 500
 *     preference on an endpoint capped lower (e.g. Vacancies/Customers at 200) can
 *     never 422 (the measured bug: "vacatures klapt eruit", i.e. "vacancies crash out"
 *     — VacancyQuery::rules() caps at 200, but the page sent the raw pageSize straight
 *     through). The control shows the honestly-in-effect state, never a promise
 *     the backend can't keep (house style, §4).
 */
import { usePageMemory } from '@/lib/usePageMemory'
import { useAuth } from '@/context/AuthContext'
import { PAGE_SIZE_OPTIONS } from '@/components/ui/PaginationBar'

// Canonical fallback when the user has no saved preference (mirrors the reference
// implementation, MatchesPage.tsx: `user?.default_per_page ?? 50`).
const FALLBACK_PAGE_SIZE = 50

export function useListPageSize(memoryKey: string, serverCap: number = PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1]) {
  const auth = useAuth()
  const rawDefault = Number(auth?.user?.default_per_page) || FALLBACK_PAGE_SIZE

  // Never OFFER a size the endpoint would reject — an honest, per-endpoint list.
  const options = PAGE_SIZE_OPTIONS.filter(n => n <= serverCap)

  // Sticky across the shell's unmount-on-navigate (mirrors every other page-level
  // `usePageMemory` field); seeded once from the user's clamped preference.
  const [pageSizeStored, setPageSizeRaw] = usePageMemory<number>(
    `${memoryKey}.pageSize`,
    () => Math.min(rawDefault, serverCap),
  )
  // A value STORED before this hook existed (e.g. a remembered 500 on a 200-cap
  // page) must clamp on READ too — the seed only runs when nothing is stored.
  const pageSize = Math.min(pageSizeStored, serverCap)
  // Defensive re-clamp on every explicit change too — a caller can never push the
  // state above the endpoint's real ceiling, whatever the dropdown offered.
  const setPageSize = (n: number) => setPageSizeRaw(Math.min(n, serverCap))

  return { pageSize, setPageSize, options }
}
