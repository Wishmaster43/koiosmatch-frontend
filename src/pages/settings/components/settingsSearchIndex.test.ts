/**
 * buildSettingsSearchEntries — the search index pulls group and token synonyms from the
 * settingsSearch namespace only when a key exists; a missing synonym contributes nothing,
 * never a key path (the two former '' defaultValue sites).
 */
import { describe, it, expect } from 'vitest'
import { buildSettingsSearchEntries, type SettingsTranslate } from './settingsSearchIndex'
import type { SettingsNavGroup } from './settingsSearchIndex'

// Echo t that carries the namespace it was given, so a wrong-namespace lookup would show.
const t = ((key: string, o?: { ns?: string }) => (o?.ns ? `${o.ns}:${key}` : key)) as SettingsTranslate
const groups = [{ key: 'integrations', items: [{ id: 'email_customers' }] }] as unknown as SettingsNavGroup[]

describe('buildSettingsSearchEntries', () => {
  it('adds the group and token synonyms from the settingsSearch namespace when their keys exist', () => {
    const entries = buildSettingsSearchEntries(groups, t, { exists: (_k: string, o?: { ns?: string }) => o?.ns === 'settingsSearch' })
    // Terms are normalised (lowercase, non-alphanumerics dropped), so the echo keys fold to one run each.
    const terms = entries[0].terms
    expect(terms).toContain('settingssearchgroupsintegrations')
    expect(terms).toContain('settingssearchtermsemail')
    expect(terms).toContain('settingssearchtermscustomers')
  })

  it('adds no synonym and no key path when the keys do not exist', () => {
    const entries = buildSettingsSearchEntries(groups, t, { exists: () => false })
    const terms = entries[0].terms
    expect(terms.some(x => x.startsWith('settingssearch'))).toBe(false)
    expect(terms).toContain('integrations')
    expect(terms).toContain('email')
  })
})
