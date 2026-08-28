/**
 * Smoke flow: workflow-editor graph persistence (WORKLIST §C-27 — "the editor
 * persists a graph per step (position + connections[] = {target, filters}) and
 * step ids must stay stable across save/reload or Router branches collapse to a
 * straight line"). Unit tests cover the pure mapper (serialization.ts,
 * workflowMap.ts) but nothing today clicks save -> reload against the real API.
 * This flow does: it creates a draft workflow with >=2 non-AI steps, saves it,
 * reloads the page, reopens the SAME workflow, saves again unchanged, and
 * compares the two persisted graphs read straight from the API (not from the
 * editor's own state or localStorage) — step ids, connections and positions
 * must be byte-identical across the round trip.
 *
 * API-CREDITS-1 guard: only entity modules (customers/candidates_fetch) are
 * used, the workflow is never run/activated, and a request collector asserts
 * no call to /api/ai/ happened during the whole flow.
 */
import { go, expect, sleep } from '../lib.mjs'

// Marker name so the probe workflow is unambiguous in the list and cleanup can find it.
const PROBE_NAME = 'E2E-GRAPH-PROBE'

// Two non-AI, non-trigger entity modules (src/modules/customers.ts, candidates_fetch.ts) —
// their tile titles in the module picker (nl locale, the app's default fallbackLng).
const MODULE_TILES = ['Klanten', 'Koios Match kandidaten']

// nl-locale UI strings this flow depends on (see e2e/lib.mjs boot(): fresh browser,
// no km-language in localStorage, so i18n falls back to 'nl').
const L = {
  newWorkflow: 'Nieuwe Workflow',
  addModule: 'Module toevoegen',
  save: 'Opslaan',
  nameInput: 'Naam workflow',
}

// In-page fetch through the app's own Vite proxy + cookie session (a bare Playwright
// APIRequestContext request 401s — Sanctum's stateful guard needs the Origin/Referer
// an actual in-page fetch sends, same measured fact as naad-contract.mjs).
async function apiFetch(page, method, path, body) {
  return page.evaluate(async ([m, p, b]) => {
    const r = await fetch(`/api${p}`, {
      method: m,
      headers: { 'X-Tenant': 'demo', Accept: 'application/json', ...(b ? { 'Content-Type': 'application/json' } : {}) },
      credentials: 'include',
      body: b ? JSON.stringify(b) : undefined,
    })
    let json = null
    try { json = await r.json() } catch { /* no/empty json body */ }
    return { status: r.status, json }
  }, [method, path, body ?? null])
}

// Reads one workflow's persisted graph straight from the API (bypasses the editor's
// in-memory state and any localStorage cache).
async function fetchGraph(page, id) {
  const { status, json } = await apiFetch(page, 'GET', `/workflows/${id}`)
  expect(status >= 200 && status < 300, `GET /workflows/${id} failed: ${status}`)
  const wf = json?.data ?? json
  const steps = Array.isArray(wf.steps) ? wf.steps : []
  return steps.map(s => ({
    id: String(s.id),
    type: s.module_type ?? s.type,
    position: s.position ?? null,
    connections: (s.connections ?? s.next ?? []).map(n => ({ target: String(n.target) })),
  }))
}

export async function workflowEditorGraph({ page, errors }) {
  // AI-credits guard: collect every request URL; assert none hit /api/ai/ (API-CREDITS-1).
  const requestUrls = []
  const onRequest = req => requestUrls.push(req.url())
  page.on('request', onRequest)

  let workflowId = null
  try {
    // 1. Navigate to the AI & Workflows page.
    await go(page, 'AI & Workflows')

    // 2. Create a new DRAFT workflow (never activated) with the probe marker name.
    await page.locator('button', { hasText: L.newWorkflow }).first().click()
    await sleep(600)
    await page.getByLabel(L.nameInput).fill(PROBE_NAME)

    // 3. Add two non-AI entity modules via the floating "Module toevoegen" FAB —
    //    each click appends a new step; the picker's tile title attribute matches
    //    the module's translated label exactly (ModulePicker.tsx renderTile).
    for (const tile of MODULE_TILES) {
      await page.locator('button', { hasText: L.addModule }).first().click()
      await sleep(300)
      await page.locator(`[role="dialog"] button[title="${tile}"]`).first().click()
      await sleep(300)
    }

    // 4. Save (without closing) — creates the workflow and assigns a real id.
    await page.locator('button', { hasText: L.save }).first().click()
    await sleep(1200)

    // Recover the assigned id from the workflows list via the API (the editor
    // patches its own id in-place, so reading the list is the honest external check).
    const { status: listStatus, json: listBody } = await apiFetch(page, 'GET', '/workflows')
    expect(listStatus >= 200 && listStatus < 300, `GET /workflows failed: ${listStatus}`)
    const list = Array.isArray(listBody?.data) ? listBody.data : listBody
    const probe = list.find(w => w.name === PROBE_NAME)
    expect(!!probe, 'saved probe workflow not found via GET /workflows')
    workflowId = probe.id

    const graphBeforeReload = await fetchGraph(page, workflowId)
    expect(graphBeforeReload.length >= 2, `expected >=2 persisted steps, got ${graphBeforeReload.length}`)

    // 5. Reload the page — the hash already carries `?open=<id>` (WF-EDITOR-
    //    DEEPLINK-1: saving wrote it there), so a real reload's mount-time hash
    //    read reopens the SAME workflow deep-link. (A `page.goto()` to that exact
    //    same URL is a same-document no-op in Chromium — no reload happens — so
    //    `reload()` is the only way to actually exercise the round trip.)
    await page.reload()
    await sleep(1800)
    await page.locator('button', { hasText: L.save }).first().click()
    await sleep(1200)

    const graphAfterReload = await fetchGraph(page, workflowId)

    // 6. The id-stability contract: same step count, identical ids (set + per-step
    //    order), identical connections, positions preserved.
    expect(graphAfterReload.length === graphBeforeReload.length,
      `step count changed on reload: ${graphBeforeReload.length} -> ${graphAfterReload.length}`)
    const idsBefore = graphBeforeReload.map(s => s.id)
    const idsAfter = graphAfterReload.map(s => s.id)
    expect(JSON.stringify(idsBefore) === JSON.stringify(idsAfter),
      `step ids regenerated on reload: ${JSON.stringify(idsBefore)} -> ${JSON.stringify(idsAfter)}`)
    for (let i = 0; i < graphBeforeReload.length; i++) {
      const before = graphBeforeReload[i]
      const after = graphAfterReload.find(s => s.id === before.id)
      expect(!!after, `step ${before.id} missing after reload`)
      expect(JSON.stringify(before.connections) === JSON.stringify(after.connections),
        `connections changed for step ${before.id}: ${JSON.stringify(before.connections)} -> ${JSON.stringify(after.connections)}`)
      expect(JSON.stringify(before.position) === JSON.stringify(after.position),
        `position changed for step ${before.id}: ${JSON.stringify(before.position)} -> ${JSON.stringify(after.position)}`)
    }

    // AI-credits guard: no request in this whole flow touched an AI endpoint.
    const aiHits = requestUrls.filter(u => u.includes('/api/ai/'))
    expect(aiHits.length === 0, `AI endpoint(s) called during workflow-editor flow: ${aiHits.join(', ')}`)
  } finally {
    // 7. Cleanup: sweep EVERY row named PROBE_NAME, not only the recovered id —
    //    a failure between the POST and the list-read leaves workflowId null,
    //    and an id-keyed delete would orphan that row (verify-les 28-08).
    const { status: listStatus, json: listBody } = await apiFetch(page, 'GET', '/workflows')
    if (listStatus >= 200 && listStatus < 300) {
      const list = Array.isArray(listBody?.data) ? listBody.data : listBody
      for (const w of list.filter(w => w.name === PROBE_NAME)) {
        await apiFetch(page, 'DELETE', `/workflows/${w.id}`)
      }
      const { status: checkStatus, json: checkBody } = await apiFetch(page, 'GET', '/workflows')
      if (checkStatus >= 200 && checkStatus < 300) {
        const after = Array.isArray(checkBody?.data) ? checkBody.data : checkBody
        expect(!after.some(w => w.name === PROBE_NAME), 'probe workflow(s) survived cleanup')
      }
    }
    page.off('request', onRequest)
  }
}
