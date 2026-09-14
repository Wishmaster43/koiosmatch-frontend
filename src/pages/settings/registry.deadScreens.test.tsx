/**
 * Settings registry — no configurable screen without a consumer (§3).
 *
 * Groups that used to offer (or still offer) editors whose saved values nothing
 * ever read:
 *  • note_types      — nt_match / nt_task / nt_contact had no useNoteTypes() reader
 *                      (no /matches/{id}/notes route, the task Reacties tab was
 *                      removed, the contact drawer has no notes surface at all).
 *  • document_types  — dt_contact / dt_opportunity / dt_task / dt_call_list /
 *                      dt_match offered a StatusListEditor for an entity with NO
 *                      document-upload surface reading it at all (DOCTYPE-READERS-1,
 *                      2026-08-05 audit) — see registry.jsx's own per-entity comment.
 *  • views           — view_planning / view_sales / view_candidates saved a
 *                      `view.<module>` config that no <ModuleView> ever rendered.
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
import { NAV_GROUPS } from './registry'

// Walk the real src/ tree via Vite's import.meta.glob (no node:fs — this tsconfig
// carries no @types/node, and eager raw imports give tsc/vitest one agreeing view).
const SOURCE_MODULES = import.meta.glob('/src/**/*.{ts,tsx,js,jsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Collect the product source (tests excluded — a test double is not a consumer).
const SOURCES: string[] = Object.entries(SOURCE_MODULES)
  .filter(([full]) => !/\.test\.|\/test\//.test(full))
  .map(([, src]) => src)

// Every value X in a real `useNoteTypes('X')` call / `<ModuleView module="X">` render.
function matchAll(pattern: RegExp): Set<string> {
  const found = new Set<string>()
  SOURCES.forEach(src => { for (const m of src.matchAll(pattern)) found.add(m[1]) })
  return found
}
const NOTE_TYPE_READERS = matchAll(/useNoteTypes\(\s*['"]([a-z_]+)['"]/g)
const MODULE_VIEW_RENDERERS = matchAll(/<ModuleView\b[^>]*\bmodule="([a-z_]+)"/g)

// Direct literal `useDocumentTypes('x')` calls — candidate/customer/vacancy
// DocumentsTab.tsx all call the hook with their entity spelled out inline.
const DOC_TYPE_DIRECT_READERS = matchAll(/useDocumentTypes\(\s*['"]([a-z_]+)['"]/g)
// DOCTYPE-SCOPE-1: the customer DocumentsTab reads `useDocumentTypes(docTypeScope)`
// — a PROP, not a literal — so the generic scan above can't see 'customer_location'/
// 'customer_department' directly (ScopedDocumentsTab computes those two literals
// and forwards them). Verify the indirection itself is real from source instead of
// trusting the registry's own comment: (a) some file actually calls the hook with
// the `docTypeScope` identifier, and (b) some file actually assigns one of the two
// customer_location/customer_department literals to a `docTypeScope` variable/prop.
const SOME_READER_USES_DOC_TYPE_SCOPE_PROP = SOURCES.some(src => /useDocumentTypes\(\s*docTypeScope\s*\)/.test(src))
const DOC_TYPE_SCOPE_FORWARDED_LITERALS = new Set<string>()
SOURCES.forEach(src => {
  const assignments = src.match(/docTypeScope\s*=[^\n;]+/g) ?? []
  assignments.forEach(a => { for (const m of a.matchAll(/['"](customer_location|customer_department)['"]/g)) DOC_TYPE_SCOPE_FORWARDED_LITERALS.add(m[1]) })
})
const DOC_TYPE_READERS = new Set([
  ...DOC_TYPE_DIRECT_READERS,
  ...(SOME_READER_USES_DOC_TYPE_SCOPE_PROP ? DOC_TYPE_SCOPE_FORWARDED_LITERALS : []),
])

// NOTE-SCOPE-1: ScopedNotesTab reads `useNoteTypes(scope)` — a PROP, not a literal —
// so the generic scan above can't see 'location'/'department' directly. Verify the
// indirection: (a) some file calls the hook with the `scope` identifier, and (b) some
// file assigns one of the two literals to the `scope` parameter when calling
// ScopedNotesTab (mirroring DOCTYPE-SCOPE-1's pattern).
const SOME_READER_USES_NOTE_SCOPE_PROP = SOURCES.some(src => /useNoteTypes\(\s*scope\s*\)/.test(src))
const NOTE_SCOPE_FORWARDED_LITERALS = new Set<string>()
SOURCES.forEach(src => {
  const assignments = src.match(/<ScopedNotesTab[^>]*\bscope\s*=\s*[^\s>]+/g) ?? []
  assignments.forEach(a => { for (const m of a.matchAll(/['"](location|department)['"]/g)) NOTE_SCOPE_FORWARDED_LITERALS.add(m[1]) })
})
const NOTE_TYPE_READERS_WITH_SCOPE = new Set([
  ...NOTE_TYPE_READERS,
  ...(SOME_READER_USES_NOTE_SCOPE_PROP ? NOTE_SCOPE_FORWARDED_LITERALS : []),
])

// Item ids of one nav group; throws (loudly, not silently) if the group is missing.
function itemIds(key: string): string[] {
  const group = NAV_GROUPS.find(g => g.key === key)
  if (!group) throw new Error(`nav group not found: ${key}`)
  return group.items.map(i => i.id)
}

describe('settings registry offers no screen without a consumer', () => {
  it('measured the source tree (guards the regexes themselves against silent zero-matches)', () => {
    expect(SOURCES.length).toBeGreaterThan(100)
    expect(NOTE_TYPE_READERS.size).toBeGreaterThan(0)
    expect(SOME_READER_USES_NOTE_SCOPE_PROP).toBe(true) // ScopedNotesTab uses useNoteTypes(scope)
    expect(NOTE_SCOPE_FORWARDED_LITERALS.size).toBeGreaterThan(0) // 'location' and 'department' literals
    expect(MODULE_VIEW_RENDERERS.size).toBeGreaterThan(0)
    expect(DOC_TYPE_READERS.size).toBeGreaterThan(0)
  })

  it('every note-type sub-tab has an entity some screen actually reads', () => {
    // NOTE-TYPES-3 (02-09): 'general' is the entity-less tab (global rows, entity null)
    // that every reader merges in server-side — it has no reader of its own by design.
    const offered = itemIds('note_types').map(id => id.replace(/^nt_/, '')).filter(e => e !== 'general')
    expect(offered.length).toBeGreaterThan(0)
    const withoutReader = offered.filter(entity => !NOTE_TYPE_READERS_WITH_SCOPE.has(entity))
    expect(withoutReader).toEqual([])
  })

  it('every document-type sub-tab has an entity some screen actually reads', () => {
    const offered = itemIds('document_types').map(id => id.replace(/^dt_/, ''))
    expect(offered.length).toBeGreaterThan(0)
    const withoutReader = offered.filter(entity => !DOC_TYPE_READERS.has(entity))
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
    // document_types (DOCTYPE-READERS-1, 2026-08-05): contact has no document-level
    // concept at all (no customer_contact_id column) and opportunity/task/call_list/
    // match have no entity-scoped documents route yet — see registry.jsx's own
    // per-entity comment. None of them get a settings tab until a real reader lands.
    expect(all).not.toContain('dt_contact')
    expect(all).not.toContain('dt_opportunity')
    expect(all).not.toContain('dt_task')
    expect(all).not.toContain('dt_call_list')
    expect(all).not.toContain('dt_match')
  })
})
