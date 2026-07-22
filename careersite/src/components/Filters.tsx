import { strings } from '../strings'

interface FiltersProps {
  city: string
  hours: string
  onCityChange: (value: string) => void
  onHoursChange: (value: string) => void
}

// City + minimum-hours filter bar — fully controlled, no local/debounce logic
// (debouncing is the caller's concern, CLAUDE.md §3: logic in hooks, not components).
export function Filters({ city, hours, onCityChange, onHoursChange }: FiltersProps) {
  return (
    <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <label className="filters__field">
        <span>{strings.list.filters.cityLabel}</span>
        <input
          type="text"
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          placeholder={strings.list.filters.cityPlaceholder}
        />
      </label>
      <label className="filters__field">
        <span>{strings.list.filters.hoursLabel}</span>
        <input
          type="number"
          min={0}
          value={hours}
          onChange={(event) => onHoursChange(event.target.value)}
          placeholder={strings.list.filters.hoursPlaceholder}
        />
      </label>
    </form>
  )
}
