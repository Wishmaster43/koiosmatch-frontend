import { describe, it, expect } from 'vitest'
import { reasonI18nKey, buildInventoryRows, togglePhaseKeyedField } from './requiredFieldsReason'

// SHARED-UNIT-TEST-1: the reason vocabulary, the row builder and the phase toggle each prove their own branches.
describe('reasonI18nKey', () => {
  it('maps every measured backend reason text to its category key', () => {
    expect(reasonI18nKey('relation — slice 2')).toBe('settings.fieldInventory.reason.relation')
    expect(reasonI18nKey('consent — not requirable this round')).toBe('settings.fieldInventory.reason.consent')
    expect(reasonI18nKey('financial data — a required IBAN would block every recruiter without the permission')).toBe('settings.fieldInventory.reason.financial')
    expect(reasonI18nKey('webhook-stamped by the Facebook-lead job — no create input exists')).toBe('settings.fieldInventory.reason.webhookStamped')
    expect(reasonI18nKey('custom fields carry their own required/required_phases mechanism on the field definition')).toBe('settings.fieldInventory.reason.customFields')
    expect(reasonI18nKey('relation — a write-only pivot-sync field the guard cannot read back, so requiring it would be a permanent 422')).toBe('settings.fieldInventory.reason.relation')
  })

  it('returns null for an unknown reason so the caller falls back to the raw text', () => {
    expect(reasonI18nKey('something new')).toBeNull()
  })
})

describe('buildInventoryRows', () => {
  const t = (k: string) => `T:${k}`
  it('hides permission-gated fields the caller lacks, resolves labels and translates known reasons', () => {
    const rows = buildInventoryRows([
      { key: 'name', requirable: true, requires_permission: null, reason: null },
      { key: 'iban', requirable: false, requires_permission: 'customers.financial.view', reason: 'financial data — a required IBAN would block every recruiter without the permission' },
      { key: 'branch_ids', requirable: false, requires_permission: null, reason: 'relation — a write-only pivot-sync field the guard cannot read back, so requiring it would be a permanent 422' },
      { key: 'mystery', requirable: false, requires_permission: null, reason: 'brand new reason' },
    ], { name: 'customers:overview.name' }, () => false, t)
    expect(rows.map(r => r.key)).toEqual(['name', 'branch_ids', 'mystery'])
    expect(rows[0]).toEqual({ key: 'name', labelKey: 'customers:overview.name', requirable: true, reason: null })
    expect(rows[1].reason).toBe('T:settings.fieldInventory.reason.relation')
    expect(rows[2]).toEqual({ key: 'mystery', labelKey: 'mystery', requirable: false, reason: 'brand new reason' })
  })
})

describe('togglePhaseKeyedField', () => {
  it('flips one field for one phase and strips non-requirable keys from every phase', () => {
    const next = togglePhaseKeyedField({ lead: ['email', 'iban'], customer: ['email'] }, 'customer', 'phone', new Set(['iban']))
    expect(next).toEqual({ lead: ['email'], customer: ['email', 'phone'] })
    expect(togglePhaseKeyedField(next, 'customer', 'phone', new Set())).toEqual({ lead: ['email'], customer: ['email'] })
  })
})
