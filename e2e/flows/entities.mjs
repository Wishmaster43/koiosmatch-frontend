/**
 * entities — the ONE roster of entity list-pages shared by the pagination,
 * drill-down-render and API-contract smoke flows (pagination.mjs,
 * drilldown-render.mjs, naad-contract.mjs), so "every list page" lives in exactly
 * one place instead of being copy-pasted three times (§11 — one source, not three
 * hand-kept copies). `nav` is the exact sidebar button label (see lib.mjs's `go`);
 * `endpoint` is the list route the page's data hook calls (verified against each
 * hook's `api.get(...)` call, 2026-08-05).
 */
export const ENTITIES = [
  { nav: 'Kandidaten',    endpoint: '/candidates' },
  { nav: 'Sollicitaties', endpoint: '/applications' },
  { nav: 'Vacatures',     endpoint: '/vacancies' },
  { nav: 'Matches',       endpoint: '/matches' },
  { nav: 'Kansen',        endpoint: '/opportunities' },
  { nav: 'Taken',         endpoint: '/tasks' },
  { nav: 'Bellijsten',    endpoint: '/outreach-campaigns' },
  { nav: 'Klanten',       endpoint: '/customers' },
]
