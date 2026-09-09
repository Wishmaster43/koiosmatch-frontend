/**
 * Guard: every StatusListEditor whose endpoint is served by a SlugLookupController /
 * CustomerLookupController subclass (store() validates `value` as REQUIRED) must pass
 * `withValueSlug`, or "+ toevoegen" 422s on every tenant while GET/PUT/DELETE keep
 * working — the fourth instance of this class (SMZ-05, FE-BE contract audit 09-09,
 * after CustomerPhases, OpportunityLookups and OutreachOutcomes) is what turned the
 * code comment into this test. The endpoint list is MEASURED on the backend
 * (grep `extends SlugLookupController|CustomerLookupController` → their routes);
 * extend it when a new slug-validating lookup lands.
 *
 * Plain .js — the walker needs node:fs (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Relative to the repo root, the way vitest runs (mirrors dropdownClear.houseStyle.test.js).
const SRC = join('src', 'pages', 'settings')

// Tenant lookup endpoints whose create validates the immutable `value` slug (backend
// SlugLookupController::store + CustomerLookupController::store, measured 09-09).
const SLUG_ENDPOINTS = [
  '/appointment-locations', '/appointment-types', '/cao', '/contract-types', '/customer-phases',
  '/emergency-contact-relations', '/last-contact-types', '/match-statuses', '/match-stop-reasons',
  '/message-purposes', '/note-types', '/outreach-outcomes', '/outreach-statuses',
  '/planning-cancellation-reasons', '/reference-relations', '/task-statuses', '/task-types',
  '/whatsapp-message-types', '/work-permit-types',
  '/settings/customer-lookups/statuses', '/settings/customer-lookups/location-statuses',
  '/settings/customer-lookups/department-statuses', '/settings/customer-lookups/contact-statuses',
]

// Every source file under settings (tests excluded).
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

// Each <StatusListEditor … /> element as one string (multi-line JSX, up to its closer).
function editorElements(source) {
  const out = []
  const re = /<StatusListEditor\b/g
  let m
  while ((m = re.exec(source))) {
    const end = source.indexOf('/>', m.index)
    const endOpen = source.indexOf('>', m.index)
    const close = end !== -1 && (endOpen === -1 || end <= endOpen) ? end + 2 : endOpen + 1
    out.push(source.slice(m.index, close))
  }
  return out
}

describe('StatusListEditor on a slug-validating endpoint passes withValueSlug (SMZ-05 guard)', () => {
  const offenders = []
  let walked = 0
  for (const f of walk(SRC)) {
    for (const el of editorElements(readFileSync(f, 'utf8'))) {
      const endpoint = el.match(/endpoint=["'`]([^"'`]+)["'`]/)?.[1]
      if (!endpoint) continue
      walked += 1
      if (SLUG_ENDPOINTS.includes(endpoint) && !/\bwithValueSlug\b/.test(el)) offenders.push(`${f} → ${endpoint}`)
    }
  }

  it('walked a meaningful number of editors (the scan is not silently empty)', () => {
    expect(walked).toBeGreaterThanOrEqual(30)
  })

  it('has no editor on a slug endpoint without withValueSlug', () => {
    expect(offenders).toEqual([])
  })
})
