/**
 * reportStatusLookups — id-keyed status option lists for the reports right-panel
 * (RAPPORT-FILTERS-2, vacancies/tasks). The backend's `status[]` panel filter on
 * these two reports validates against the tenant lookup's RAW id (see
 * ReportController.php: `VacancyStatus::pluck('id')` / `TaskStatus::pluck('id')`),
 * never the slug — a different vocabulary than every OTHER consumer of these
 * lookups (VacancyLookupsContext/TaskLookupsContext both normalise to the stable
 * `value` slug for their own pickers/badges). Rather than bend those shared,
 * widely-consumed contexts to also carry the raw id, this file does one small,
 * dedicated fetch per lookup — cached via the same shared `useCachedLookup` every
 * other tenant lookup uses (one GET per session, deduped across mounts).
 */
import { useCachedLookup } from '@/lib/useCachedLookup'
import { unwrapList } from '@/lib/api'
import type { AxiosResponse } from 'axios'

export interface IdLookupOption { value: string; label: string }

// Stable empty-array fallback — a fresh `[]` literal per call would break the
// panel's "options must be a stable reference" contract (ReportsPage.test.tsx).
const EMPTY_ID_OPTIONS: IdLookupOption[] = []

// Maps a raw lookup row to {value: id, label} — the report filter's own vocabulary.
const mapIdOptions = (res: AxiosResponse): IdLookupOption[] | null => {
  const rows = unwrapList(res).rows as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length
    ? rows.map(r => ({ value: String(r.id ?? ''), label: String(r.label ?? r.name ?? r.value ?? '') }))
    : null
}

// Vacancy lifecycle statuses, keyed by id (matches `vacancy_status_id`).
export function useVacancyStatusIdOptions(): IdLookupOption[] {
  const { data } = useCachedLookup('/vacancy-statuses', mapIdOptions, EMPTY_ID_OPTIONS)
  return data
}

// Task board statuses, keyed by id (matches Task's `status_id`).
export function useTaskStatusIdOptions(): IdLookupOption[] {
  const { data } = useCachedLookup('/task-statuses', mapIdOptions, EMPTY_ID_OPTIONS)
  return data
}

// WAVE 1c: the tasks report panel's `type[]`/`priority[]` filters validate
// against task_types/task_priorities' raw uuid id too (TasksReport.php:335/338 —
// `where('type_id', $p['type'])` / `where('priority_id', $p['priority'])`), the
// same id-keyed vocabulary as the two lookups above.
export function useTaskTypeIdOptions(): IdLookupOption[] {
  const { data } = useCachedLookup('/task-types', mapIdOptions, EMPTY_ID_OPTIONS)
  return data
}

export function useTaskPriorityIdOptions(): IdLookupOption[] {
  const { data } = useCachedLookup('/task-priorities', mapIdOptions, EMPTY_ID_OPTIONS)
  return data
}
