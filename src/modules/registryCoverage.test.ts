/**
 * Registry coverage guard (audit r2-tests-1). Twice a module FILE shipped without being
 * added to the ONE registry (a7ff72e1 → fixed in 021c2447) and the suite stayed green,
 * because the only reconcile test checked a hand-maintained whitelist. This test globs
 * the real module files instead: every file that exports a module definition (a default
 * object with a `type`) must be in MODULES, MODULE_META and MODULE_SCHEMAS, or be an
 * engine-internal type. A new or renamed module file that is never registered fails here.
 */
import { describe, it, expect } from 'vitest'
import MODULES, { MODULE_META, MODULE_SCHEMAS, ENGINE_INTERNAL_TYPES } from '@/modules/index'

// Every sibling .ts file in src/modules (helpers without a `type` are skipped below).
const files = import.meta.glob('./*.ts', { eager: true }) as Record<string, { default?: { type?: string } }>

const moduleTypes = Object.entries(files)
  .filter(([path]) => !/\/(index|.*\.test)\.ts$/.test(path))
  .map(([path, mod]) => ({ path, type: mod.default?.type }))
  .filter((m): m is { path: string; type: string } => typeof m.type === 'string' && m.type.length > 0)

describe('workflow module registry covers every module file', () => {
  it('finds module files to check (the glob itself must not silently go empty)', () => {
    expect(moduleTypes.length).toBeGreaterThan(10)
  })

  it.each(moduleTypes)('$path ($type) is registered in MODULES, MODULE_META and MODULE_SCHEMAS', ({ type }) => {
    if ((ENGINE_INTERNAL_TYPES as readonly string[]).includes(type)) return
    expect(MODULES.some(m => m.type === type)).toBe(true)
    expect(MODULE_META[type]).toBeDefined()
    expect(MODULE_SCHEMAS[type]).toBeDefined()
  })

  it('has no registered type without a module file behind it', () => {
    const fileTypes = new Set(moduleTypes.map(m => m.type))
    const orphans = MODULES.map(m => m.type).filter(t => !fileTypes.has(t) && !(ENGINE_INTERNAL_TYPES as readonly string[]).includes(t))
    expect(orphans).toEqual([])
  })
})
