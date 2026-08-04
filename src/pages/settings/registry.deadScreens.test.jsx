/**
 * Settings registry — no configurable screen without a consumer (§3).
 *
 * Two groups used to offer editors whose saved values nothing ever read:
 *  • note_types  — nt_match / nt_task / nt_contact had no useNoteTypes() reader
 *                  (no /matches/{id}/notes route, the task Reacties tab was
 *                  removed, the contact drawer has no notes surface at all).
 *  • views       — view_planning / view_sales / view_candidates saved a
 *                  `view.<module>` config that no <ModuleView> ever rendered.
 *
 * Rather than freeze today's list, this test DERIVES the consumers from the source
 * tree: a tab is legitimate iff some non-test file actually reads it. So it fails
 * the day a dead tab is re-added, and it goes green by itself the day the missing
 * reader lands — no test edit needed.
 *
 * 2026-08-04 re-measure (Danny's full note-type wish list): nt_contact and
 * nt_vacancy both grew real readers — CustomerNotesTab always called
 * useNoteTypes('contact') (only the tab was missing) and the vacancy drawer's
 * NotesTab now calls useNoteTypes('vacancy') (VACANCY-NOTE-TYPE-1 gave it a real
 * backend-validated `type`). Both moved off the "stays gone" list below.
 * nt_match and nt_task graduated the same day (NT-MATCH-1 / NT-TASK-1: the match
 * drawer's Notities tab and the task drawer's reinstated notes tab both read
 * useNoteTypes(<entity>)) — the whole note-types wish list is now live except
 * bellijsten, which waits on its backend token/route (NOTE-CALLLIST-1).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NAV_GROUPS } from './registry'

// Walk the real src/ tree (ESM-safe path, no __dirname) to measure consumers.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// Collect the product source (tests excluded — a test double is not a consumer).
function sourceFiles(dir = SRC, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { sourceFiles(full, acc); continue }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue
    if (/\.test\.|\/test\//.test(full)) continue
    acc.push(fs.readFileSync(full, 'utf8'))
  }
  return acc
}
const SOURCES = sourceFiles()

// Every value X in a real `useNoteTypes('X')` call / `<ModuleView module="X">` render.
function matchAll(pattern) {
  const found = new Set()
  SOURCES.forEach(src => { for (const m of src.matchAll(pattern)) found.add(m[1]) })
  return found
}
const NOTE_TYPE_READERS = matchAll(/useNoteTypes\(\s*['"]([a-z_]+)['"]/g)
const MODULE_VIEW_RENDERERS = matchAll(/<ModuleView\b[^>]*\bmodule="([a-z_]+)"/g)

const itemIds = key => NAV_GROUPS.find(g => g.key === key).items.map(i => i.id)

describe('settings registry offers no screen without a consumer', () => {
  it('measured the source tree (guards the regexes themselves against silent zero-matches)', () => {
    expect(SOURCES.length).toBeGreaterThan(100)
    expect(NOTE_TYPE_READERS.size).toBeGreaterThan(0)
    expect(MODULE_VIEW_RENDERERS.size).toBeGreaterThan(0)
  })

  it('every note-type sub-tab has an entity some screen actually reads', () => {
    const offered = itemIds('note_types').map(id => id.replace(/^nt_/, ''))
    expect(offered.length).toBeGreaterThan(0)
    const withoutReader = offered.filter(entity => !NOTE_TYPE_READERS.has(entity))
    expect(withoutReader).toEqual([])
  })

  it('every view-config sub-tab has a module some screen actually renders', () => {
    const offered = itemIds('views').filter(id => id.startsWith('view_')).map(id => id.replace(/^view_/, ''))
    expect(offered.length).toBeGreaterThan(0)
    const withoutRenderer = offered.filter(module => !MODULE_VIEW_RENDERERS.has(module))
    expect(withoutRenderer).toEqual([])
  })

  it('the screens still missing a consumer stay gone until one lands', () => {
    const all = NAV_GROUPS.flatMap(g => g.items.map(i => i.id))
    // The whole nt_* family graduated 2026-08-04 (contact/vacancy/match/task) —
    // only screens with a still-missing consumer remain below.
    expect(all).not.toContain('view_planning')
    expect(all).not.toContain('view_sales')
    expect(all).not.toContain('view_candidates')
  })
})
