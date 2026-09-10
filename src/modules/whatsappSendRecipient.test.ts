/**
 * whatsapp_send · recipient_field (WA-RECIPIENT-FIELD-1): the field holds a NAME
 * of the source record's field, so a literal phone number is flagged before the
 * backend's 422, and the picker inserts a bare field name.
 */
import { describe, it, expect } from 'vitest'
import whatsappSend from './whatsapp_send'
import type { WorkflowField } from '@/types/workflow'

const field = (whatsappSend.schema as WorkflowField[]).find(f => f.key === 'recipient_field') as WorkflowField

describe('whatsapp_send · recipient_field', () => {
  it('inserts picked variables as bare field names', () => {
    expect(field.insertMode).toBe('path')
  })

  it('flags a literal phone number (national or international) with the registry message', () => {
    expect(field.validate?.('0612345678')).toMatch(/telefoonnummer/)
    expect(field.validate?.('+31 6 1234 5678')).toMatch(/telefoonnummer/)
    expect(field.validate?.(' 06-12 34 56 78 ')).toMatch(/telefoonnummer/)
  })

  it('accepts an empty value, a field name and a token', () => {
    expect(field.validate?.('')).toBeNull()
    expect(field.validate?.(undefined)).toBeNull()
    expect(field.validate?.('mobile')).toBeNull()
    expect(field.validate?.('{{mobile}}')).toBeNull()
    expect(field.validate?.('candidate.phone')).toBeNull()
  })
})
