/**
 * setHashParam — generic hash-query-string parameter setter, used to update
 * ?param=value in a hash string without touching the page-path portion (which
 * may be empty or contain its own slashes). Keeps page path untouched, preserves
 * other params, and accepts null to delete a param.
 */

/**
 * Rewrite a hash string's named param, keeping everything else untouched.
 * Returns the updated hash with the new param value, or deleted if value is null.
 */
export function setHashParam(hash: string, paramName: string, value: string | null): string {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  const path = qIdx === -1 ? raw : raw.slice(0, qIdx)
  const params = new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1))
  if (value != null) params.set(paramName, value)
  else params.delete(paramName)
  const query = params.toString()
  return `#${path}${query ? `?${query}` : ''}`
}
