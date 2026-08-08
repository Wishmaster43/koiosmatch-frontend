/**
 * publicUrls — pure-function tests: the exact URLs the backend contract promises
 * (routes/api/career.php), the /site vs. gated-route split, and the "no tenant yet"
 * empty-list fallback.
 */
import { describe, it, expect } from 'vitest'
import { buildCareerSitePublicUrls } from './publicUrls'

const API_BASE = 'http://koiosmatch-api.test/api'

describe('buildCareerSitePublicUrls', () => {
  it('returns an empty list when no tenant id is known yet', () => {
    expect(buildCareerSitePublicUrls(null, API_BASE)).toEqual([])
    expect(buildCareerSitePublicUrls(undefined, API_BASE)).toEqual([])
    expect(buildCareerSitePublicUrls('', API_BASE)).toEqual([])
  })

  it('builds every route from the measured contract, scoped to the tenant id', () => {
    const urls = buildCareerSitePublicUrls('yesway', API_BASE)
    expect(urls).toEqual([
      { id: 'site', url: 'http://koiosmatch-api.test/api/public/yesway/site', gatedByActive: false },
      { id: 'vacancies', url: 'http://koiosmatch-api.test/api/public/yesway/vacancies', gatedByActive: true },
      { id: 'sitemap', url: 'http://koiosmatch-api.test/api/public/yesway/sitemap.xml', gatedByActive: true },
      { id: 'indeedFeed', url: 'http://koiosmatch-api.test/api/public/yesway/feeds/indeed.xml', gatedByActive: true },
      { id: 'werkzoekenFeed', url: 'http://koiosmatch-api.test/api/public/yesway/feeds/werkzoeken.xml', gatedByActive: true },
    ])
  })

  it('only the site-info route is reachable while the career site is off', () => {
    const urls = buildCareerSitePublicUrls('yesway', API_BASE)
    const gated = urls.filter(u => u.gatedByActive).map(u => u.id)
    const ungated = urls.filter(u => !u.gatedByActive).map(u => u.id)
    expect(ungated).toEqual(['site'])
    expect(gated).toEqual(['vacancies', 'sitemap', 'indeedFeed', 'werkzoekenFeed'])
  })
})
