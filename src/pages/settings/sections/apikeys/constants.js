/**
 * API-key constants — the single source of truth for the section's enums.
 *
 * SCOPE_ENTITIES are the KoiosMatch domain objects an API key can be granted
 * access to (the "Access" tab). The backend re-enforces every scope on the API;
 * the toggles here are UX only. Labels are translated via apiKeys.scopes.<entity>.
 */

// Domain entities shown as rows in the Access tab (order = display order).
export const SCOPE_ENTITIES = [
  'candidates',
  'customers',
  'locations',
  'departments',
  'contact_persons',
  'vacancies',
  'applications',
  'orders',
  'shifts',
  'shift_schedulings',
  'contracts',
  'documents',
  'reporting',
]

// Permission level per scope. 'none' = the entity toggle is off (no access).
export const ACCESS_LEVELS = ['read', 'read_write']

// Key types mirror the SM model: one 'primary' key per tenant, others 'additional'.
export const KEY_TYPES = ['primary', 'additional']

// Shorten a GUID for the dense list column ("abcd…wxyz") without losing identity.
export function shortGuid(guid) {
  if (!guid || typeof guid !== 'string') return '—'
  return guid.length <= 16 ? guid : `${guid.slice(0, 8)}…${guid.slice(-6)}`
}

// Light client-side check for an IPv4/IPv6 address or CIDR block. UX only — the
// backend is the authority on what it accepts.
export function isValidIpOrCidr(value) {
  const v = String(value).trim()
  if (!v) return false
  const ipv4 = /^(\d{1,3})(\.\d{1,3}){3}(\/(3[0-2]|[12]?\d))?$/
  const ipv6 = /^[0-9a-fA-F:]+(\/(12[0-8]|1[01]\d|\d{1,2}))?$/
  if (ipv4.test(v)) {
    return v.split('/')[0].split('.').every(n => Number(n) >= 0 && Number(n) <= 255)
  }
  return ipv6.test(v) && v.includes(':')
}
