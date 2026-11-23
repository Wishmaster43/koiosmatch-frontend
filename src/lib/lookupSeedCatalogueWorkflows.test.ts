/**
 * workflowFolders seed catalogue (CONNECTOR-VS-REPORTING-1): the catalogue id must equal
 * labelKey(label) or seedKeyFor never finds the row, every seeded label needs an English
 * i18n key, and the connector/reporting folders resolve while a renamed label no longer does.
 */
import { describe, it, expect } from 'vitest'
import { labelKey, seedKeyFor } from './lookupSeedI18n'
import { WORKFLOW_SEED_LABELS } from './lookupSeedCatalogueWorkflows'
import { SEED_LABEL_KEYS } from './lookupSeedCatalogueKeys'

describe('workflowFolders seed catalogue', () => {
  it('every catalogue id equals labelKey(label), so seedKeyFor can find the row', () => {
    for (const [id, label] of Object.entries(WORKFLOW_SEED_LABELS.workflowFolders)) {
      expect(labelKey(label)).toBe(id)
    }
  })

  it('every seeded folder label carries an English i18n key', () => {
    for (const label of Object.values(WORKFLOW_SEED_LABELS.workflowFolders)) {
      expect(SEED_LABEL_KEYS.workflowFolders[label]).toBeTruthy()
    }
  })

  it('the connector and reporting folders resolve to their English keys; the renamed labels no longer resolve', () => {
    expect(seedKeyFor('workflowFolders', { label: 'Koios ↔ HF' })).toBe('koiosHF')
    expect(seedKeyFor('workflowFolders', { label: 'Koios ↔ SM' })).toBe('koiosSM')
    expect(seedKeyFor('workflowFolders', { label: 'Rapportage SM' })).toBe('reportingSM')
    expect(seedKeyFor('workflowFolders', { label: 'Rapportage HF' })).toBe('reportingHF')
    expect(seedKeyFor('workflowFolders', { label: 'Koios ↔ Elanza' })).toBe('koiosElanza')
    expect(seedKeyFor('workflowFolders', { label: 'Koios ↔ Aelio' })).toBe('koiosAelio')
    expect(seedKeyFor('workflowFolders', { label: 'Koios ↔ Intus' })).toBe('koiosIntus')
    expect(seedKeyFor('workflowFolders', { label: 'Koios ↔ SDB' })).toBe('koiosSDB')
    expect(seedKeyFor('workflowFolders', { label: 'Shiftmanager Rapportage' })).toBeNull()
    expect(seedKeyFor('workflowFolders', { label: 'Koppeling Elanza' })).toBeNull()
  })
})

describe('workflowNames seed catalogue (HelloFlex templates, SEED-HF-TEMPLATE-LABELS-1)', () => {
  const templates = Object.entries(WORKFLOW_SEED_LABELS.workflowNames).filter(([, label]) => label.startsWith('HelloFlex: '))

  it('the 18 HelloFlex template ids equal labelKey(label)', () => {
    expect(templates).toHaveLength(18)
    for (const [id, label] of templates) expect(labelKey(label)).toBe(id)
  })

  it('every HelloFlex template label carries an English i18n key', () => {
    for (const [, label] of templates) expect(SEED_LABEL_KEYS.workflowNames[label]).toBeTruthy()
  })

  it('template labels resolve to their English keys; a renamed label does not', () => {
    expect(seedKeyFor('workflowNames', { label: 'HelloFlex: nieuwe match naar contract' })).toBe('helloflexNewMatchToContract')
    expect(seedKeyFor('workflowNames', { label: 'HelloFlex: vestigingen gewijzigd' })).toBe('helloflexAgenciesChanged')
    expect(seedKeyFor('workflowNames', { label: 'HelloFlex: eigen naam' })).toBeNull()
  })
})
