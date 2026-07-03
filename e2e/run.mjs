/**
 * Smoke-suite runner — boots one logged-in session and runs every flow against the
 * REAL app + API. Red = a real finding (the whole point). Usage:
 *   npm run smoke            → all flows
 *   npm run smoke boards     → only flows whose name contains "boards"
 * Requires: Vite dev server on :5173 + Herd API + seeded dev DB.
 */
import { boot } from './lib.mjs'
import { pagesRender, drillDowns } from './flows/nav.mjs'
import { boardsDrag } from './flows/boards.mjs'
import { statusWithReason, archiveAndFindBack, noteWithChannel, superSearch } from './flows/candidates.mjs'

const FLOWS = [
  ['pages-render', pagesRender],
  ['drill-downs', drillDowns],
  ['boards-drag', boardsDrag],
  ['status-met-reden', statusWithReason],
  ['notitie-met-kanaal', noteWithChannel],
  ['super-search', superSearch],
  ['archiveren-terugvinden', archiveAndFindBack], // last: it mutates the list
]

const filter = process.argv[2]
const ctx = await boot()
const results = []

for (const [name, fn] of FLOWS) {
  if (filter && !name.includes(filter)) continue
  const t0 = Date.now()
  try {
    await fn(ctx)
    results.push([name, true, Date.now() - t0, ''])
    console.log(`✓ ${name} (${Date.now() - t0}ms)`)
  } catch (e) {
    results.push([name, false, Date.now() - t0, String(e.message ?? e)])
    console.log(`✗ ${name}\n    ${String(e.message ?? e).slice(0, 500)}`)
  }
  // Reset error window between flows so one failure doesn't bleed into the next.
  ctx.errors.length = 0
}

await ctx.browser.close()
const failed = results.filter(r => !r[1])
console.log(`\n===== SMOKE: ${results.length - failed.length}/${results.length} groen =====`)
process.exit(failed.length ? 1 : 0)
