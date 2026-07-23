import { useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useVacancies } from '../hooks/useVacancies'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Filters } from '../components/Filters'
import { VacancyList } from '../components/VacancyList'
import { Pagination } from '../components/Pagination'
import { strings } from '../strings'

const PER_PAGE = 12
const FILTER_DEBOUNCE_MS = 400

// Query param names — Dutch, matching the site's own Dutch route segment
// (/vacatures) so a shared/bookmarked URL reads naturally for a Dutch visitor.
const PARAM_CITY = 'stad'
const PARAM_HOURS = 'uren'
const PARAM_PAGE = 'pagina'

// Merges partial updates into a copy of the current query params, dropping empty
// values so the URL never carries a stray `?stad=` for an unset filter.
function mergeParams(current: URLSearchParams, updates: Record<string, string>): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

// Reads the page number from the URL, clamped to a sane positive integer so a
// tampered/stale `?pagina=` value can never reach the API as 0 or negative.
function readPage(searchParams: URLSearchParams): number {
  const raw = Math.floor(Number(searchParams.get(PARAM_PAGE)) || 1)
  return Math.max(1, raw)
}

// Vacancy list container: filters + page live in the URL query string (not local
// state) so sharing, refreshing or navigating back all reproduce the same view —
// the actual fetch still debounces the free-text filters before hitting the API.
export function VacancyListPage() {
  const { tenant } = useParams<{ tenant: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const city = searchParams.get(PARAM_CITY) ?? ''
  const hours = searchParams.get(PARAM_HOURS) ?? ''
  const page = readPage(searchParams)

  const debouncedCity = useDebouncedValue(city, FILTER_DEBOUNCE_MS)
  const debouncedHours = useDebouncedValue(hours, FILTER_DEBOUNCE_MS)

  // A changed filter always restarts at page 1 — but skip the very first run so a
  // deep link like `?stad=Utrecht&pagina=3` keeps its page instead of resetting it.
  const isFirstFilterRun = useRef(true)
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false
      return
    }
    setSearchParams((prev) => mergeParams(prev, { [PARAM_PAGE]: '' }), { replace: true })
  }, [debouncedCity, debouncedHours, setSearchParams])

  const { status, vacancies, meta, refetch } = useVacancies(tenant, {
    page,
    per_page: PER_PAGE,
    city: debouncedCity || undefined,
    hours: debouncedHours ? Number(debouncedHours) : undefined,
  })

  // Filter/page changes go through `replace` — typing or paging never floods the
  // browser history with one entry per keystroke/page.
  const handleCityChange = (value: string) =>
    setSearchParams((prev) => mergeParams(prev, { [PARAM_CITY]: value }), { replace: true })
  const handleHoursChange = (value: string) =>
    setSearchParams((prev) => mergeParams(prev, { [PARAM_HOURS]: value }), { replace: true })
  const handlePageChange = (nextPage: number) =>
    setSearchParams(
      (prev) => mergeParams(prev, { [PARAM_PAGE]: nextPage > 1 ? String(nextPage) : '' }),
      { replace: true },
    )

  return (
    <div className="vacancy-list-page">
      <h1>{strings.list.title}</h1>
      {/* Danny 23-07: filters live in a LEFT sidebar on desktop (stacked above the
          list on mobile) — the two-column grid lives in .vacancy-list-layout. */}
      <div className="vacancy-list-layout">
        <aside className="vacancy-list-side" aria-label={strings.list.filtersLabel}>
          <Filters city={city} hours={hours} onCityChange={handleCityChange} onHoursChange={handleHoursChange} />
        </aside>
        <div className="vacancy-list-main">
          <VacancyList tenant={tenant ?? ''} status={status} vacancies={vacancies} onRetry={refetch} />
          {meta ? (
            <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onPageChange={handlePageChange} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
