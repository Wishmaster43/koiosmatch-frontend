/**
 * safeUrl — guard for rendering API-provided URLs as anchors (AUDIT-2, 15-07):
 * record fields like vacancy URLs are tenant-entered data, so a crafted
 * `javascript:` value would execute on click. Only http(s) may become a link;
 * everything else renders as plain text at the call site.
 */
export function isSafeUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
