import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useVacancies } from '../hooks/useVacancies'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Filters } from '../components/Filters'
import { VacancyList } from '../components/VacancyList'
import { Pagination } from '../components/Pagination'
import { strings } from '../strings'

const PER_PAGE = 12
const FILTER_DEBOUNCE_MS = 400

// Vacancy list container: owns filter/page state, wires the fetch hook, and hands
// the four UI states down to the dumb <VacancyList /> renderer.
export function VacancyListPage() {
  const { tenant } = useParams<{ tenant: string }>()
  const [city, setCity] = useState('')
  const [hours, setHours] = useState('')
  const [page, setPage] = useState(1)

  const debouncedCity = useDebouncedValue(city, FILTER_DEBOUNCE_MS)
  const debouncedHours = useDebouncedValue(hours, FILTER_DEBOUNCE_MS)

  // A changed filter always restarts at page 1 — a stale page number could
  // otherwise sit past the new, narrower result set.
  useEffect(() => {
    setPage(1)
  }, [debouncedCity, debouncedHours])

  const { status, vacancies, meta, refetch } = useVacancies(tenant, {
    page,
    per_page: PER_PAGE,
    city: debouncedCity || undefined,
    hours: debouncedHours ? Number(debouncedHours) : undefined,
  })

  return (
    <div className="vacancy-list-page">
      <h1>{strings.list.title}</h1>
      <Filters city={city} hours={hours} onCityChange={setCity} onHoursChange={setHours} />
      <VacancyList tenant={tenant ?? ''} status={status} vacancies={vacancies} onRetry={refetch} />
      {meta ? (
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onPageChange={setPage} />
      ) : null}
    </div>
  )
}
