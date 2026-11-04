/**
 * Pure helpers for the career-site embed origins (CAREER-EMBED-FE-1): the websites
 * allowed to show the public career site in a frame. Mirrors the backend contract
 * (CMBE 04-11): a JSON list of bare https origins, at most 10, empty list = off.
 */

export const EMBED_ORIGINS_MAX = 10

export type EmbedOriginError = 'invalid' | 'notHttps' | 'hasPath' | 'duplicate' | 'tooMany'

// Reads the stored setting (JSON string or real array) into a clean list of strings.
export function parseEmbedOrigins(raw: unknown): string[] {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) } catch { return [] }
  }
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

// One hostname label: a-z0-9 and '-', never starting or ending with '-' (RFC 1123).
const LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

// Turns user input into a bare https origin, or names why it cannot be one.
export function normalizeEmbedOrigin(input: string): { origin: string } | { error: EmbedOriginError } {
  const trimmed = input.trim()
  if (trimmed.includes('*')) return { error: 'invalid' }
  let url: URL
  try { url = new URL(trimmed) } catch { return { error: 'invalid' } }
  if (url.protocol !== 'https:') return { error: 'notHttps' }
  if (url.username || url.password) return { error: 'invalid' }
  if (url.pathname !== '/' || url.search || url.hash) return { error: 'hasPath' }
  if (!url.hostname.toLowerCase().split('.').every(label => LABEL_RE.test(label))) return { error: 'invalid' }
  // A present port must be an integer 1..65535 (the parser keeps port 0).
  if (url.port !== '' && !(Number(url.port) >= 1 && Number(url.port) <= 65535)) return { error: 'invalid' }
  return { origin: url.origin }
}

// Appends a normalized origin to the list, enforcing the cap and uniqueness.
export function addEmbedOrigin(list: string[], input: string): { list: string[] } | { error: EmbedOriginError } {
  if (list.length >= EMBED_ORIGINS_MAX) return { error: 'tooMany' }
  const result = normalizeEmbedOrigin(input)
  if ('error' in result) return result
  if (list.includes(result.origin)) return { error: 'duplicate' }
  return { list: [...list, result.origin] }
}
