/**
 * fieldLabel — one label per import column: a mirrored column translates its create-modal
 * key directly; a column the mirror does not know shows the translated wizard key when it
 * exists, else the raw column name as data (never a blank option, never a key path).
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { fieldLabel } from './fieldLabels'

// Key-echo t that carries the namespace it was given, so a wrong-namespace lookup would show.
const t = ((key: string, o?: { ns?: string }) => `${o?.ns ?? ''}:${key}`) as unknown as TFunction

describe('fieldLabel', () => {
  it('translates a mirrored column through its own create-modal key and namespace', () => {
    expect(fieldLabel(t, { exists: () => false }, 'customers', 'naam')).toBe('customers:modal.fields.name')
  })

  it('translates an unknown column through the settings wizard key when that key exists', () => {
    const i18n = { exists: (_key: string, o?: { ns?: string }) => o?.ns === 'settings' }
    expect(fieldLabel(t, i18n, 'customers', 'future_column')).toBe('settings:import.wizard.fields.future_column')
  })

  it('shows the raw column name for an unknown column without a key, also without an i18n instance', () => {
    expect(fieldLabel(t, { exists: () => false }, 'customers', 'future_column')).toBe('future_column')
    expect(fieldLabel(t, {} as unknown as { exists: () => boolean }, 'customers', 'future_column')).toBe('future_column')
  })
})
