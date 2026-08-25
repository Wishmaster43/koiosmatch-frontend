/**
 * Registry-level coverage for the applicant_message FE orphan (CMBE 25-08):
 * hidden from MODULE_META's picker-facing flag, but its schema stays
 * registered so existing saved workflow nodes of this type keep editing.
 */
import { describe, it, expect } from 'vitest'
import { MODULE_META, MODULE_SCHEMAS } from './index'

describe('module registry · applicant_message hidden orphan', () => {
  it('marks applicant_message hidden in MODULE_META', () => {
    expect(MODULE_META.applicant_message.hidden).toBe(true)
  })

  it('keeps MODULE_SCHEMAS registered for applicant_message', () => {
    expect(MODULE_SCHEMAS.applicant_message).toBeDefined()
    expect(Array.isArray(MODULE_SCHEMAS.applicant_message)).toBe(true)
  })
})
