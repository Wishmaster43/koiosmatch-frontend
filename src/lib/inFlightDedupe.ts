/**
 * inFlightDedupe — the structural double-submit net (DOUBLE-SUBMIT-FE-1, Danny
 * 03-10 "Ga verder. FE ook" on the N-007 class): a non-GET call with the same
 * method + base URL + path + JSON body while an IDENTICAL call is still in flight
 * returns that call's promise instead of sending a second request. One place,
 * never 307 call sites. FormData/uploads are never compared (streams differ by
 * construction) and a settled call always leaves the map, so a later click is a
 * new request by design (a retry after failure, a deliberate second send).
 */

// A JSON string whose object keys are sorted at every depth, so {a,b} and {b,a} compare equal.
export function stableStringify(value: unknown): string {
  if (value === undefined) return ''
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map(k => [k, sort((v as Record<string, unknown>)[k])]))
    }
    return v
  }
  try { return JSON.stringify(sort(value)) } catch { return '' }
}

// True for bodies the net must never compare (multipart uploads, blobs, streams).
export function isOpaqueBody(data: unknown): boolean {
  if (data == null) return false
  if (typeof FormData !== 'undefined' && data instanceof FormData) return true
  if (typeof Blob !== 'undefined' && data instanceof Blob) return true
  if (typeof ArrayBuffer !== 'undefined' && (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) return true
  return false
}

// The identity of a write: method + base URL + path + stable body. `null` = never deduped.
export function requestKey(method: string, url: string, data: unknown, baseURL?: string): string | null {
  if (isOpaqueBody(data)) return null
  return `${method.toUpperCase()} ${baseURL ?? ''}${url} ${stableStringify(data)}`
}

const inFlight = new Map<string, Promise<unknown>>()

// Runs `send` once per key while it is in flight; concurrent identical calls share its promise.
export function dedupeInFlight<T>(key: string | null, send: () => Promise<T>): Promise<T> {
  if (key === null) return send()
  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T>
  const p = send().finally(() => { if (inFlight.get(key) === p) inFlight.delete(key) })
  inFlight.set(key, p)
  return p
}

// Test seam: how many identical writes are in flight right now.
export function inFlightCount(): number { return inFlight.size }
