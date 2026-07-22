import { Link } from 'react-router-dom'
import type { VacancySummary } from '../types'
import { formatHours, formatSalary } from '../lib/format'

interface VacancyCardProps {
  tenant: string
  vacancy: VacancySummary
}

// One vacancy summary card in the list — a link to the detail/apply page.
export function VacancyCard({ tenant, vacancy }: VacancyCardProps) {
  return (
    <Link to={`/${tenant}/vacatures/${vacancy.reference_number}`} className="vacancy-card">
      <h2 className="vacancy-card__title">{vacancy.title}</h2>
      <p className="vacancy-card__meta">
        {vacancy.city} · {vacancy.province} · {formatHours(vacancy.hours)}
      </p>
      <ul className="vacancy-card__chips">
        {vacancy.contract_types.map((label) => (
          <li key={label} className="chip">{label}</li>
        ))}
      </ul>
      <p className="vacancy-card__salary">{formatSalary(vacancy.salary)}</p>
      <p className="vacancy-card__intro">{vacancy.intro}</p>
    </Link>
  )
}
