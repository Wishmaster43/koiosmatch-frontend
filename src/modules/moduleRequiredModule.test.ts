import { describe, it, expect } from 'vitest'
import { MODULE_REQUIRED_MODULE, MODULE_APP_MAP } from './index'

// SM-WRITE-GATE-1 (api d36a4406): WorkflowWriter::MODULE_REQUIRES gates these step types on the sm
// package; the registry mirrors it so the picker says "requires Shiftmanager" instead of a 422 on save.
describe('MODULE_REQUIRED_MODULE · Shiftmanager package gate', () => {
  it.each(['sm_employees', 'sm_candidates', 'sm_employee_create', 'sm_employee_update', 'message_lookup'])(
    '%s requires the sm module', (type) => {
      expect(MODULE_REQUIRED_MODULE[type]).toBe('sm')
    })

  // CONNECTOR-VS-REPORTING-1: the backoffice link step is gated on the connector apps only (BE ConnectorRequirements).
  it('backoffice_sync carries no package gate, only the two connector apps', () => {
    expect(MODULE_REQUIRED_MODULE['backoffice_sync']).toBeUndefined()
    expect(MODULE_APP_MAP['backoffice_sync']).toEqual(['hf', 'shiftmanager'])
  })
  it('a plain Koios entity module carries no package gate', () => {
    expect(MODULE_REQUIRED_MODULE['candidates']).toBeUndefined()
  })
})
