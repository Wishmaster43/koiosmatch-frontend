/**
 * publicUrls — builds this tenant's public career-site + job-board feed URLs from
 * the MEASURED backend contract (koiosmatch-api routes/api/career.php): every
 * route sits under `/public/{tenant}/…`, resolved by InitializeTenancyByParameter
 * from the SAME tenant id the app already uses as X-Tenant (AuthContext.activeTenant.id,
 * lib/api.getActiveTenantId). GET `/public/{tenant}/site` is always reachable (it
 * carries the `active` flag so a public app can render a branded "site off" state);
 * every other route in that file sits behind the EnsureCareerSiteActive middleware
 * and 404s while `career_site_active` is off — `gatedByActive` flags that so the UI
 * can show an honest notice instead of a link that silently fails (§3 no fake
 * affordances). Pure/no React, so it is unit-tested without mounting anything.
 */

export type CareerSitePublicUrlId = 'site' | 'vacancies' | 'sitemap' | 'indeedFeed' | 'werkzoekenFeed'

export interface CareerSitePublicUrl {
  /** Stable id — doubles as the i18n key suffix under `careerSite.urls.<id>`. */
  id: CareerSitePublicUrlId
  url: string
  /** True when EnsureCareerSiteActive 404s this route while the career site is off. */
  gatedByActive: boolean
}

/**
 * Builds the ordered list of public URLs for one tenant. Returns an empty list
 * when no tenant id is known yet (e.g. a super-admin who hasn't picked a tenant) —
 * callers render an honest empty state rather than a URL built on "undefined".
 */
export function buildCareerSitePublicUrls(tenantId: string | null | undefined, apiBase: string): CareerSitePublicUrl[] {
  if (!tenantId) return []
  const base = `${apiBase}/public/${tenantId}`
  return [
    { id: 'site', url: `${base}/site`, gatedByActive: false },
    { id: 'vacancies', url: `${base}/vacancies`, gatedByActive: true },
    { id: 'sitemap', url: `${base}/sitemap.xml`, gatedByActive: true },
    { id: 'indeedFeed', url: `${base}/feeds/indeed.xml`, gatedByActive: true },
    { id: 'werkzoekenFeed', url: `${base}/feeds/werkzoeken.xml`, gatedByActive: true },
  ]
}
