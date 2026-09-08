/**
 * Settings registry guard — every section id from the catalogue must have a
 * corresponding FE screen (a registry item). The FE mirrors the BE guard
 * (SettingsCatalogCompleteTest): a section without a screen is a guard failure.
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS, CATALOG_NAV_GROUP } from './registry'

describe('settings registry catalog sections', () => {
  it('every catalogue section id from the contract has a registry item', () => {
    // Section ids from DRAFT-SETTINGS-CATALOG-1 §2 — the complete fixed list.
    // Mapping: section id → expected registry item id(s).
    const sectionToItemMapping = {
      company: ['company'],
      numbering: ['numbering'],
      action_rules: ['action_rules'],
      required_fields: ['candidate_required_fields', 'application_required_fields', 'customer_required_fields'],
      windows: ['windows'],
      retention: ['retention'],
      messaging: ['messaging'],
      email: ['email'],
      matching: ['vacancy_matching'],
      vacancies: ['vacancy_statuses', 'vacancy_phases', 'vacancy_seniority', 'vacancy_education', 'vacancy_channels'],
      customers: ['customer_statuses', 'customer_phases'],
      kpi: ['kpi'],
    }

    // Collect all registry item ids.
    const registryItemIds = new Set()
    // The catalogue group is parked outside NAV_GROUPS until GET /settings/catalog is live.
    const allGroups = [...NAV_GROUPS, CATALOG_NAV_GROUP]
    allGroups.forEach(group => {
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
