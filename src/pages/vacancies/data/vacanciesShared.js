/**
 * Vacancy page helpers — the single-value toggle, initials, the recharts key
 * picker, an optimistic-subset snapshot, and the UI-patch → API-body mapping
 * used when saving header/picker edits.
 */

// Set exactly one value in a multi-select, or clear when it's already the only one.
export const toggleOneValue = (set, value) =>
  set(p => (p.length === 1 && p[0] === value) ? [] : [value])

// Two-letter initials from the first two name parts.
export const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

// Recharts hands the clicked segment back at top level AND under `.payload`.
export const pickKey = (d) => d?.key ?? d?.payload?.key ?? d?.name

// Snapshot a subset of fields, for optimistic revert/reconcile.
export const subsetOf = (obj, keys) => keys.reduce((a, k) => { a[k] = obj[k]; return a }, {})

// Translate a drawer/header UI patch → the API body. The optimistic local fields
// (statusLabel/owner/clientName) are derived in the container; this is the persist body.
export const buildVacancyPatch = (patch) => {
  const body = {}
  if ('statusValue'         in patch) body.status               = patch.statusValue
  if ('ownerId'             in patch) body.owner_id             = patch.ownerId
  if ('clientId'            in patch) body.customer_id          = patch.clientId
  if ('tags'                in patch) body.tags                 = patch.tags
  if ('channels'            in patch) body.published_channels   = patch.channels
  if ('applicationSettings' in patch) body.application_settings = patch.applicationSettings
  if ('matchWeights'        in patch) body.match_weights        = patch.matchWeights
  return body
}
