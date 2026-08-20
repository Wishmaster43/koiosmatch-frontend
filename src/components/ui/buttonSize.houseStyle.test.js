/**
 * buttonSize ratchet (herhaal-audit r5, MAAT-1/2): Button's size="md" is the
 * page-toolbar "+ Nieuw" exception ONLY — drawers/settings ride the sm default,
 * and a raw-button→Button migration never carries its old 34px along (that is
 * exactly how two drawer/settings buttons regressed to md). An eslint selector
 * was tried first and reverted: written disables in nine legacy page files
 * dragged their whole pre-existing warning debt into the staged gate. This
 * frozen, shrink-only allowlist guards the same invariant without touching
 * those files. Runs in pre-commit beside the typography ratchet.
 *
 * Plain .js — the walker needs node:fs/node:path (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC_ROOT = 'src'
const SKIP = new Set(['node_modules', 'dist'])

function walkSourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { walkSourceFiles(full, out); continue }
    if (/\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

// The NINE legitimate page-toolbar "+ Nieuw" sites (maatwet: md beside the 34px
// search chrome) — frozen; a file may only DROP OFF this list, never grow.
const MD_ALLOWLIST = {
  'src/pages/applications/ApplicationsPage.tsx': 1,
  'src/pages/candidates/CandidatesToolbar.tsx': 1,
  'src/pages/customers/CustomersPage.tsx': 1,
  'src/pages/matches/MatchesPage.tsx': 1,
  'src/pages/opportunities/OpportunitiesPage.tsx': 1,
  'src/pages/outreach/OutreachPage.tsx': 1,
  'src/pages/tasks/TasksPage.tsx': 1,
  'src/pages/users/UsersPage.tsx': 1,
  'src/pages/vacancies/VacanciesToolbar.tsx': 1,
  // Doc mention, not a render: buttonMetrics' own docblock NAMES size="md" while
  // defining BTN_H (the simple text count cannot tell prose from JSX).
  'src/config/buttonMetrics.ts': 1,
}

describe('Button size ratchet (maatwet)', () => {
  it('size="md" appears only at the frozen page-toolbar sites, never more', () => {
    const offenders = []
    for (const file of walkSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8')
      const count = (content.match(/size="md"/g) ?? []).length
      if (count === 0) continue
      const allowed = MD_ALLOWLIST[file.replace(/\\/g, '/')] ?? 0
      if (count > allowed) offenders.push(`${file}: ${count} × size="md" (toegestaan: ${allowed})`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
