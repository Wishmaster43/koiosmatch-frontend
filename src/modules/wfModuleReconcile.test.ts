/**
 * WF-MODULE-RECONCILE-FE-1 — registry coverage guard. The eight engine modules
 * (task_create, appointment_create, calllist_add, webhook_send,
 * candidate_archive, experience_add, sm_employee_create, workflow_call) must
 * each have a registry card (MODULE_META entry) whose label resolves via
 * `t('modules.<type>')` in every shipped locale — a missing entry is exactly
 * what made saved workflows render "Onbekende module" (canvas.tsx). 'trigger'
 * is the engine-internal counter-case: it must stay off MODULE_META entirely.
 */
import { describe, it, expect } from 'vitest'
import MODULES, { MODULE_META, ENGINE_INTERNAL_TYPES } from '@/modules/index'

// Every shipped locale's workflows.json, loaded the same way registryI18n.test.ts does.
const files = import.meta.glob('../i18n/locales/*/workflows.json', { eager: true, import: 'default' }) as Record<string, {
  modules?: Record<string, string>
}>
const LOCS = ['nl', 'en', 'de', 'fr', 'es']

const RECONCILED_TYPES = [
  'task_create', 'appointment_create', 'calllist_add', 'webhook_send',
  'candidate_archive', 'experience_add', 'sm_employee_create', 'workflow_call',
]

describe('WF-MODULE-RECONCILE-FE-1 · the eight engine modules get a registry card', () => {
  it.each(RECONCILED_TYPES)('%s is registered in the MODULES array', (type) => {
    expect(MODULES.some(m => m.type === type)).toBe(true)
  })

  it.each(RECONCILED_TYPES)('%s has a MODULE_META entry with a non-empty label/icon/category', (type) => {
    const meta = MODULE_META[type]
    expect(meta).toBeDefined()
    expect(meta.label).toBeTruthy()
    expect(meta.Icon).toBeTruthy()
    expect(meta.category).toBeTruthy()
  })

  for (const loc of LOCS) {
    it(`${loc}/workflows.json resolves modules.* for all eight types`, () => {
      const file = Object.entries(files).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/workflows.json not found`).toBeTruthy()
      const missing = RECONCILED_TYPES.filter(type => !(file?.modules ?? {})[type])
      expect(missing, `missing modules.* in ${loc}: ${missing.join(', ')}`).toEqual([])
    })
  }

  it("'trigger' is marked engine-internal and never registered as a pickable module", () => {
    expect(ENGINE_INTERNAL_TYPES).toContain('trigger')
    expect(MODULE_META.trigger).toBeUndefined()
    expect(MODULES.some(m => m.type === 'trigger')).toBe(false)
  })
})
