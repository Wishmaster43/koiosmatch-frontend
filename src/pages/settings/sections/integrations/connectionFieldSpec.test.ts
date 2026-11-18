/**
 * connectionFieldSpec.test — the Shiftmanager spec carries both credential
 * groups (SM-CREDS-2), both always rendered (no feature-detection flag);
 * HelloFlex/Werkzoeken stay ungrouped (regression guard for those two faces).
 */
import { describe, it, expect } from 'vitest'
import { FIELD_SPEC } from './connectionFieldSpec'

describe('FIELD_SPEC.shiftmanager', () => {
  it('groups subdomain + api_key under token_api', () => {
    const subdomain = FIELD_SPEC.shiftmanager.find((f) => f.key === 'subdomain')
    const apiKey = FIELD_SPEC.shiftmanager.find((f) => f.key === 'api_key')
    expect(subdomain?.group?.id).toBe('token_api')
    expect(apiKey?.group?.id).toBe('token_api')
  })

  it('groups company + auth_token under company_api', () => {
    const company = FIELD_SPEC.shiftmanager.find((f) => f.key === 'company')
    const authToken = FIELD_SPEC.shiftmanager.find((f) => f.key === 'auth_token')
    expect(company?.group?.id).toBe('company_api')
    expect(authToken?.group?.id).toBe('company_api')
  })

  it('keeps base_url and two_way ungrouped', () => {
    const baseUrl = FIELD_SPEC.shiftmanager.find((f) => f.key === 'base_url')
    const twoWay = FIELD_SPEC.shiftmanager.find((f) => f.key === 'two_way')
    expect(baseUrl?.group).toBeUndefined()
    expect(twoWay?.group).toBeUndefined()
  })
})

describe('FIELD_SPEC.helloflex / werkzoeken', () => {
  it('stay ungrouped and untouched by SM-CREDS-2', () => {
    expect(FIELD_SPEC.helloflex.every((f) => f.group === undefined)).toBe(true)
    expect(FIELD_SPEC.werkzoeken.every((f) => f.group === undefined)).toBe(true)
  })
})
