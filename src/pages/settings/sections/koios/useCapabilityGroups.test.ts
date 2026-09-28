// useCapabilityGroups — SHARED-UNIT-TEST-1: domainOf grouping behaviour, incl.
// the KOIOS-EN-1 English call-list tool ids (verifier fix: 'call' token added).
import { describe, it, expect } from 'vitest'
import { domainOf } from './useCapabilityGroups'
import type { KoiosCapabilityTool } from '@/components/layout/koios/useKoiosToolCapabilities'

// Minimal tool factory — only `name`/`connection` drive domainOf.
const tool = (name: string, connection: KoiosCapabilityTool['connection'] = null): KoiosCapabilityTool => ({
  name,
  label_nl: name,
  confirm_required: false,
  enabled_for_me: true,
  enabled_for_tenant: true,
  default_enabled: true,
  connection_active: null,
  connection,
})

describe('domainOf', () => {
  it('groups the English call-list tool ids under calllists', () => {
    expect(domainOf(tool('create_call_list'))).toBe('calllists')
    expect(domainOf(tool('search_call_lists'))).toBe('calllists')
    expect(domainOf(tool('distribute_call_list'))).toBe('calllists')
    expect(domainOf(tool('add_to_call_list'))).toBe('calllists')
  })

  it('still groups the legacy Dutch call-list tool id under calllists', () => {
    expect(domainOf(tool('maak_bellijst'))).toBe('calllists')
  })
})
