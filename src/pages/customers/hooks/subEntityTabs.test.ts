import { describe, it, expect } from 'vitest'
import { buildSubEntityTabs } from './subEntityTabs'

describe('buildSubEntityTabs', () => {
  it('orders first, then scoped, then timeline, then links — all conditional tails shown', () => {
    const tabs = buildSubEntityTabs({
      first: { id: 'data', label: 'Gegevens' },
      scoped: [{ id: 'contacts', label: 'Contactpersonen' }, { id: 'vacancies', label: 'Vacatures' }],
      timeline: { show: true, label: 'Tijdlijn' },
      links: { show: true, label: 'Koppelingen' },
    })

    expect(tabs.map(x => x.id)).toEqual(['data', 'contacts', 'vacancies', 'timeline', 'links'])
  })

  it('drops timeline and links when their own condition is false (DD-FE-6 — no empty tabs)', () => {
    const tabs = buildSubEntityTabs({
      first: { id: 'data', label: 'Gegevens' },
      scoped: [{ id: 'contacts', label: 'Contactpersonen' }],
      timeline: { show: false, label: 'Tijdlijn' },
      links: { show: false, label: 'Koppelingen' },
    })

    expect(tabs.map(x => x.id)).toEqual(['data', 'contacts'])
  })

  it('links can be shown unconditionally, independent of timeline (LocationDetail always shows Koppelingen)', () => {
    const tabs = buildSubEntityTabs({
      first: { id: 'address', label: 'Adres & gegevens' },
      scoped: [],
      timeline: { show: false, label: 'Tijdlijn' },
      links: { show: true, label: 'Koppelingen' },
    })

    expect(tabs.map(x => x.id)).toEqual(['address', 'links'])
  })
})
