// Behaviour test for the shared Shiftmanager schema-field builders.
import { describe, it, expect } from 'vitest'
import { SM_CONNECTION_FIELD, smLimitField } from './_smFields'

describe('_smFields', () => {
  it('defines the connection_id lookup field with the planning-connections endpoint', () => {
    expect(SM_CONNECTION_FIELD).toEqual({
      key: 'connection_id',
      label: 'Shiftmanager-account',
      type: 'lookup_select',
      endpoint: '/planning-connections',
    })
  })

  it('builds a limit field carrying the given default and matching placeholder', () => {
    expect(smLimitField(500)).toEqual({
      key: 'limit', label: 'Max. items', type: 'number', default: 500, placeholder: '500',
    })
    expect(smLimitField(10000)).toEqual({
      key: 'limit', label: 'Max. items', type: 'number', default: 10000, placeholder: '10000',
    })
  })
})
