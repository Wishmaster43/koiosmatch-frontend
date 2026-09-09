/**
 * csp — builds the production Content-Security-Policy string injected into
 * index.html at build time (vite.config.js). Pure function of the resolved
 * VITE_* env, so it is unit-testable without spinning up Vite. Dev never gets
 * this meta tag: Vite's HMR client needs an inline websocket/eval-ish runtime
 * that a strict CSP would break; the Vite dev server itself serves no data,
 * it only proxies /api and /sanctum to the local backend (vite.config.js).
 */

// Env shape this builder reads — a subset of import.meta.env, passed in so the
// function stays pure and testable outside the Vite build pipeline.
interface CspEnv {
  VITE_API_URL?: string
  VITE_WORKFLOW_API_URL?: string
  VITE_CSRF_URL?: string
}

// Extracts the origin (scheme+host+port) from an absolute URL; a relative
// value (the dev proxy shape, e.g. "/api") carries no separate origin and is
// skipped — it already resolves against 'self'.
function originOf(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.origin
  } catch {
    return null
  }
}

/**
 * Builds the CSP directive string from the resolved env. Collects the API,
 * workflow-engine and CSRF origins (when absolute) alongside every fixed host
 * this app is known to call: Google Fonts (stylesheet + font files), OSM tiles
 * (RadiusMap.tsx), and Facebook's SDK script/graph/frame hosts (facebookSdk.ts,
 * useEmbeddedSignup.ts). OpenCage geocoding goes through the backend proxy
 * (GEO-GEOCODE-SEARCH-1), so it never reaches the browser.
 */
export function buildCsp(env: CspEnv): string {
  // De-duplicate extra connect-src origins gathered from env + fixed hosts.
  const connectOrigins = Array.from(
    new Set(
      [originOf(env.VITE_API_URL), originOf(env.VITE_WORKFLOW_API_URL), originOf(env.VITE_CSRF_URL)].filter(
        (o): o is string => o !== null,
      ),
    ),
  )
  // graph.facebook.com is allowed for Meta's own SDK internals (its script,
  // loaded below, calls its own graph host during Embedded Signup); no
  // first-party fetch to it is measured in src/ today (useEmbeddedSignup.ts
  // exchanges the login code against our own backend, not this host directly).
  // blob: is required for pdf.js's own fetch of the in-memory PDF blob URL
  // (DocPreviewModal.tsx:145/206 builds `blobUrl`, PdfPreview.tsx:68 passes it
  // to pdfjsLib.getDocument({ url }) — pdf.js issues a fetch against it, which
  // connect-src governs; Chrome does not match blob: against 'self').
  const connectSrc = [
    "'self'",
    'https://graph.facebook.com',
    'blob:',
    ...connectOrigins,
  ].join(' ')
  // img-src includes the API origin(s) too (uploaded avatars/logos/documents),
  // plus OSM's tile subdomains — every RadiusMap/leaflet surface loads tiles
  // from https://{a,b,c}.tile.openstreetmap.org (RadiusMap.tsx).
  const imgSrc = ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', ...connectOrigins].join(' ')

  const directives = [
    "default-src 'self'",
    // Facebook's JS SDK (facebookSdk.ts, §7-documented exception) is injected
    // for WhatsApp Business Embedded Signup — without this host the script
    // load fails and the onboarding flow breaks (useEmbeddedSignup.ts).
    "script-src 'self' https://connect.facebook.net",
    // Vite/React inject inline <style> tags at runtime (CSS-in-JS-free but styled
    // components still set style attributes) — 'unsafe-inline' is required here.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src ${imgSrc}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    // Facebook's SDK opens hidden xd_arbiter/staticxx iframes for its login flow.
    // This deliberately narrows what default-src 'self' used to allow for frames:
    // grep -rn '<iframe' src turned up no in-app <iframe> today (PdfPreview /
    // DocPreviewModal intentionally use <canvas>, AUDIT-3), so nothing measured
    // breaks. The next same-origin or blob: iframe (a document viewer, an email
    // preview) needs its own entry added here.
    "frame-src https://staticxx.facebook.com https://www.facebook.com",
    "object-src 'none'",
    "base-uri 'self'",
    // frame-ancestors cannot be set via a <meta http-equiv> CSP tag (the spec
    // ignores it there) — clickjacking protection for this app is an infra/nginx
    // response-header follow-up, not something this file can express.
  ]
  return directives.join('; ')
}
