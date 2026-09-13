/**
 * Settings registry guard — CATALOG-EMBED-1 (Danny 13-09: "Whatsapp hoort bij
 * Whatsapp · Inbox mail hoort bij email instellingen", "Hoort bij kandidaten en
 * systemen", "Hoort bij email!", "Hoort onderdeel te zijn bij alle
 * instellingen!!"). The four generic catalogue nav screens (windows/retention/
 * messaging/email) are retired; every non-empty group of those sections must be
 * hosted under its own entity's screen instead — CATALOG_GROUP_HOSTS is that map
 * (section → group → registry `group/id`). Fixture below mirrors the live
 * catalogue (version 34eb93dcaec0, measured 13-09) closely enough to catch a
 * group silently losing its host or a nav group id going stale.
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS, CATALOG_GROUP_HOSTS } from './registry'

// The FE mirrors the BE guard (SettingsCatalogCompleteTest): every catalogue section
// id from the contract must have a corresponding FE screen — a section without one
// is a guard failure. F2 (Opus review 13-09): CATALOG-EMBED-1's rewrite dropped this
// describe entirely; restored next to the new CATALOG_GROUP_HOSTS guard below, both
// must pass. windows/retention/messaging/email now map to their group-hosting items
// (CATALOG_GROUP_HOSTS) rather than a single dedicated screen.
describe('settings registry catalog sections', () => {
  it('every catalogue section id from the contract has a registry item', () => {
    // Section ids from DRAFT-SETTINGS-CATALOG-1 §2 — the complete fixed list.
    // Mapping: section id → expected registry item id(s).
    const sectionToItemMapping = {
      company: ['company'],
      numbering: ['numbering'],
      action_rules: ['action_rules'],
      required_fields: ['candidate_required_fields', 'application_required_fields', 'customer_required_fields'],
      // CATALOG-EMBED-1: these four sections now live as per-group hosts (below).
      windows: ['candidate_windows', 'contact_windows', 'customer_windows', 'vacancy_windows', 'application_windows', 'match_windows', 'task_windows'],
      retention: ['candidate_retention', 'system'],
      messaging: ['whatsapp', 'email_general'],
      email: ['email_general'],
      matching: ['vacancy_matching'],
      vacancies: ['vacancy_statuses', 'vacancy_phases', 'vacancy_seniority', 'vacancy_education', 'vacancy_channels'],
      customers: ['customer_statuses', 'customer_phases'],
      // kpi is `hidden` on the BE (SETTINGS-CATALOG-1): its rows live on the dedicated KPI screens.
      kpi: ['kpis_leads', 'kpi'],
    }

    // Collect all registry item ids.
    const registryItemIds = new Set()
    NAV_GROUPS.forEach(group => {
      group.items.forEach(item => {
        registryItemIds.add(item.id)
      })
    })

    // Every catalogue section must have at least one corresponding registry item.
    Object.entries(sectionToItemMapping).forEach(([sectionId, expectedItemIds]) => {
      const hasAtLeastOne = expectedItemIds.some(itemId => registryItemIds.has(itemId))
      expect(hasAtLeastOne, `Section "${sectionId}" has no registry item (expected one of: ${expectedItemIds.join(', ')})`).toBe(true)
    })
  })
})

// section id → { hidden, groups: { <group>: <generic row count> } } — counts only
// matter as zero vs non-zero (a zero-count group has nothing to host, e.g.
// windows/opportunities and retention/contacts today).
const FIXTURE_SECTIONS = {
  windows: {
    hidden: false,
    groups: { candidates: 7, contacts: 1, customers: 10, vacancies: 2, applications: 2, matches: 1, tasks: 2, conversations: 1, opportunities: 0 },
  },
  retention: { hidden: false, groups: { candidates: 2, contacts: 0, system: 4 } },
  messaging: { hidden: false, groups: { whatsapp_limits: 5, inbox: 1 } },
  email: { hidden: false, groups: { mail: 1 } },
}

describe('registry — CATALOG_GROUP_HOSTS (CATALOG-EMBED-1)', () => {
  it('hosts every non-empty group of every non-hidden fixture section', () => {
    Object.entries(FIXTURE_SECTIONS).forEach(([sectionId, section]) => {
      if (section.hidden) return
      Object.entries(section.groups).forEach(([group, count]) => {
        if (count === 0) return // nothing to host — e.g. windows/opportunities, retention/contacts
        const host = CATALOG_GROUP_HOSTS[sectionId]?.[group]
        expect(host, `${sectionId}/${group} (${count} generic rows) has no host in CATALOG_GROUP_HOSTS`).toBeTruthy()
      })
    })
  })

  it('every host id resolves to a real registry item in NAV_GROUPS', () => {
    const groupById = new Map(NAV_GROUPS.map(g => [g.key, g]))
    Object.entries(CATALOG_GROUP_HOSTS).forEach(([sectionId, groups]) => {
      Object.entries(groups).forEach(([group, host]) => {
        const [navGroupKey, itemId] = host.split('/')
        const navGroup = groupById.get(navGroupKey)
        expect(navGroup, `${sectionId}/${group} → "${host}": no NAV_GROUPS entry "${navGroupKey}"`).toBeTruthy()
        const item = navGroup?.items.find(i => i.id === itemId)
        expect(item, `${sectionId}/${group} → "${host}": no item "${itemId}" in group "${navGroupKey}"`).toBeTruthy()
      })
    })
  })

  it('no top-level nav group named "catalog" remains', () => {
    expect(NAV_GROUPS.some(g => g.key === 'catalog')).toBe(false)
  })
})
