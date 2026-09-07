/**
 * Shared filter-group builders — the Opt type and pure factories for checkbox
 * groups (archived/trash) and period-range groups, extracted from the five
 * entity filter-groups files (candidates/applications/customers/opportunities/
 * outreach). A builder function takes i18n translation, category label, and
 * filter state, returns a complete filter-group config object ready for the
 * right-panel (or [] if the group is conditional and the condition is not met).
 */
import { ddmmyyyy } from '@/lib/localDate'

/**
 * Filter group option shape — label + value, with optional count (for tallies)
 * and colour (for status-code rendering). Most fields optional to tolerate
 * malformed option rows from stats feeds.
 */
export interface Opt {
  value?: string | number
  label?: string
  count?: number
  color?: string
}

/**
 * DD-MM-YYYY date formatter (DATUM-1) — converts an ISO string to the
 * zero-padded display format for period chips. Echoes the input if unparseable
 * (pure module, no i18n import — safe for sync contexts). Reusable across all
 * filter builders.
 */
export const fmtD = (s: string) => {
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : ddmmyyyy(d)
}

/**
 * Archived checkbox filter group — one checkbox. Renders a single
 * "Archived" option that toggles the showArchived boolean state.
 * `category` is the i18n-translated group label (e.g. catDisplay).
 * `labelKey` allows per-entity label i18n keys (default 'filters.archived').
 */
export function archivedCheckboxGroup(
  t: (key: string) => string,
  category: string,
  showArchived: boolean,
  setShowArchived: (fn: (v: boolean) => boolean) => void,
  labelKey = 'filters.archived',
) {
  const label = t(labelKey)
  return {
    key: 'archived',
    type: 'checkbox',
    category,
    label,
    selected: showArchived ? ['archived'] : [],
    options: [{ value: 'archived', label }],
    onToggle: () => setShowArchived((v) => !v),
  }
}

/**
 * Trash checkbox filter group — one checkbox. Renders a single "Trash" option
 * that toggles the showTrash boolean state. (Applications only; other entities
 * do not have a trash state distinct from archived).
 */
export function trashCheckboxGroup(
  t: (key: string) => string,
  category: string,
  showTrash: boolean,
  setShowTrash: (fn: (v: boolean) => boolean) => void,
) {
  const label = t('filters.trash')
  return {
    key: 'trash',
    type: 'checkbox',
    category,
    label,
    selected: showTrash ? ['trash'] : [],
    options: [{ value: 'trash', label }],
    onToggle: () => setShowTrash((v) => !v),
  }
}

/**
 * Period-created date-range filter group — a conditional group that renders
 * only when a dateRange is active (e.g. from a dashboard bar drill-down).
 * Returns [] if no dateRange; otherwise returns a one-item array with a
 * search-select showing the from–to date range.
 * `dateRange` must have { from, to } string fields (ISO or parseable dates).
 * `periodParam` is the i18n key for the group label (default 'filters.periodCreated').
 */
export function periodCreatedGroup(
  t: (key: string) => string,
  category: string,
  dateRange: { from: string; to: string } | null,
  setDateRange: (v: null) => void,
  periodParamKey = 'filters.periodCreated',
) {
  if (!dateRange) return []
  return [
    {
      key: 'period',
      type: 'search-select',
      category,
      label: t(periodParamKey),
      selected: [`${dateRange.from}|${dateRange.to}`],
      options: [
        {
          value: `${dateRange.from}|${dateRange.to}`,
          label: `${fmtD(dateRange.from)} – ${fmtD(dateRange.to)}`,
        },
      ],
      onToggle: () => setDateRange(null),
    },
  ]
}
