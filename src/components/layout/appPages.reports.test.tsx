/**
 * appPages · reports routing (RAPPORTEN-CONSOLIDATIE-1) — a rename must never
 * break a deep link (§0.1). This asserts `renderPage()` resolves EVERY retired
 * `reports.<id>` route to the merged page + the exact switch position
 * `LEGACY_REPORT_ROUTE_ALIASES` promises, and every canonical route to its own
 * page with no forced position. `renderPage()` only builds a React element (the
 * pages themselves are lazy chunks) — reading `.props` off it is enough to prove
 * the wiring without mounting/resolving a dozen lazy imports.
 */
import { describe, it, expect } from 'vitest'
import type { ReactElement } from 'react'
import { renderPage, PAGE_TITLES } from './appPages'
import { REPORT_IDS, LEGACY_REPORT_ROUTE_ALIASES } from '@/pages/reports/reportIds'

const noop = () => {}
function elementProps(activePage: string): Record<string, unknown> {
  const el = renderPage(activePage, { goTo: noop }) as ReactElement<Record<string, unknown>>
  return el.props
}

describe('appPages — reports routing', () => {
  it('every canonical reports.<id> route renders ReportsPage with that id and no forced position', () => {
    for (const id of REPORT_IDS) {
      const props = elementProps(`reports.${id}`)
      expect(props.reportId).toBe(id)
      expect(props.initialView).toBeUndefined()
    }
  })

  it('every legacy reports.<id> route still resolves — landing on the merged page + its exact switch position', () => {
    for (const [legacyId, alias] of Object.entries(LEGACY_REPORT_ROUTE_ALIASES)) {
      const props = elementProps(`reports.${legacyId}`)
      expect(props.reportId).toBe(alias.reportId)
      expect(props.initialView).toBe(alias.view)
    }
  })

  it('the bare #reports root renders ReportsPage with no reportId (the KPI overview dashboard)', () => {
    const props = elementProps('reports')
    expect(props.reportId).toBeUndefined()
  })

  // RAPPORTEN-DANNY10-1: routes retired by the ten-page decision (and old
  // aliases whose merged host page retired with it) must resolve to the hub
  // root — never a placeholder or a dead screen (§0.1: a removed route never
  // breaks a deep link).
  it('every reports.<id> route retired by the ten-page decision falls back to the hub root', () => {
    for (const retired of ['flow', 'people', 'customerstructure', 'usage', 'intakes', 'recruiters', 'accountmanagers', 'contacts', 'locations', 'departments', 'ai', 'workflows']) {
      const el = renderPage(`reports.${retired}`, { goTo: noop }) as ReactElement<Record<string, unknown>>
      // The fallback hands out the bare hub: a ReportsPage element without a
      // reportId — the same element the #reports root renders.
      expect(el.type).toBe((renderPage('reports', { goTo: noop }) as ReactElement).type)
      expect(el.props.reportId).toBeUndefined()
    }
  })

  it('PAGE_TITLES keeps a breadcrumb title for every canonical AND every legacy route — a boot-from-hash / back-forward check depends on this key existing', () => {
    for (const id of REPORT_IDS) {
      expect(PAGE_TITLES[`reports.${id}`]).toBeTruthy()
    }
    for (const legacyId of Object.keys(LEGACY_REPORT_ROUTE_ALIASES)) {
      expect(PAGE_TITLES[`reports.${legacyId}`]).toBeTruthy()
    }
  })
})
