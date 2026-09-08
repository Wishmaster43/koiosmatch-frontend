/**
 * Registry-level coverage for the applicant_message FE orphan (CMBE 25-08):
 * hidden from MODULE_META's picker-facing flag, but its schema stays
 * registered so existing saved workflow nodes of this type keep editing.
 */
import { describe, it, expect } from 'vitest'
import { MODULE_META, MODULE_SCHEMAS, START_MODULE_TYPES } from './index'

describe('module registry · applicant_message hidden orphan', () => {
  it('marks applicant_message hidden in MODULE_META', () => {
    expect(MODULE_META.applicant_message.hidden).toBe(true)
  })

  it('keeps MODULE_SCHEMAS registered for applicant_message', () => {
    expect(MODULE_SCHEMAS.applicant_message).toBeDefined()
    expect(Array.isArray(MODULE_SCHEMAS.applicant_message)).toBe(true)
  })
})

// B-10 (golf 3): the `appointments` entity node is a valid point of origin
// (VERTREKMODULE-1 — the seeded appointment_meeting_link template starts on it)
// and the calendar_invite step's config keys mirror the backend module exactly.
describe('module registry · appointments start + calendar_invite step (B-10)', () => {
  it('lists appointments as a valid start module', () => {
    expect(START_MODULE_TYPES.has('appointments')).toBe(true)
    expect(MODULE_SCHEMAS.appointments).toBeTruthy()
  })

  it('calendar_invite carries exactly the backend config keys appointment_id + title', () => {
    const keys = (MODULE_SCHEMAS.calendar_invite as Array<{ key: string }>).map(f => f.key)
    expect(keys).toEqual(['appointment_id', 'title'])
    expect(START_MODULE_TYPES.has('calendar_invite')).toBe(false)
  })
})
