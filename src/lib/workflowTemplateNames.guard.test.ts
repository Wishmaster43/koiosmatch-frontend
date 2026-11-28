/**
 * workflowTemplateNames guard (WORKFLOW-SEED-NAMES-TEMPLATE-KEY-FE-1): the generated BE mirror of the seeded workflow
 * template names and the FE catalogue move TOGETHER. Red here means the BE renamed a Dutch seed name, seeded a template
 * the FE has no label for, or a locale lost a translation; the nl and en values stay byte-identical to the seed so a
 * bureau in either language sees exactly the stored name.
 */
import { describe, it, expect } from 'vitest'
import { TEMPLATE_SEED_NAMES } from './workflowTemplateNames.generated'
import { WORKFLOW_SEED_LABELS } from './lookupSeedCatalogueWorkflows'
import { SEED_LABEL_KEYS } from './lookupSeedCatalogueKeys'
import { labelKey } from './lookupSeedI18n'
import nl from '@/i18n/locales/nl/common.json'
import en from '@/i18n/locales/en/common.json'
import de from '@/i18n/locales/de/common.json'
import fr from '@/i18n/locales/fr/common.json'
import es from '@/i18n/locales/es/common.json'
import it_ from '@/i18n/locales/it/common.json'
import pt from '@/i18n/locales/pt/common.json'

type Bundle = { lookupSeeds: { workflowNames: Record<string, string> } }
const LOCALES: Record<string, Bundle> = { nl, en, de, fr, es, it: it_, pt } as unknown as Record<string, Bundle>
const namesOf = (loc: string) => LOCALES[loc].lookupSeeds.workflowNames
const templates = Object.entries(TEMPLATE_SEED_NAMES)

describe('the generated template-name mirror', () => {
  it('is a non-empty, key-sorted map of snake_case keys with four non-empty names each', () => {
    expect(templates.length).toBeGreaterThan(0)
    expect(templates.map(([k]) => k)).toEqual([...templates.map(([k]) => k)].sort())
    for (const [key, names] of templates) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/)
      for (const lang of ['nl', 'en', 'it', 'pt'] as const) expect(names[lang].trim(), `${key}.${lang}`).not.toBe('')
    }
  })
})

describe('every seeded template has its FE catalogue entry', () => {
  it('the Dutch seed name is a catalogue label whose id equals labelKey(name)', () => {
    const catalogue = WORKFLOW_SEED_LABELS.workflowNames
    for (const [key, names] of templates) {
      expect(catalogue[labelKey(names.nl)], `${key}: ${names.nl}`).toBe(names.nl)
    }
  })

  it('the Dutch seed name maps to an English i18n key that every locale translates', () => {
    for (const [key, names] of templates) {
      const i18nKey = SEED_LABEL_KEYS.workflowNames[names.nl]
      expect(i18nKey, `${key}: ${names.nl}`).toBeTruthy()
      for (const loc of Object.keys(LOCALES)) {
        const value = namesOf(loc)[i18nKey]
        expect(typeof value === 'string' && value.trim() !== '', `${loc}: lookupSeeds.workflowNames.${i18nKey}`).toBe(true)
      }
    }
  })

  it('the nl and en locale values are byte-identical to the seed, so a bureau in either language sees its stored name', () => {
    for (const [key, names] of templates) {
      const i18nKey = SEED_LABEL_KEYS.workflowNames[names.nl]
      expect(namesOf('nl')[i18nKey], `${key} nl`).toBe(names.nl)
      expect(namesOf('en')[i18nKey], `${key} en`).toBe(names.en)
    }
  })

  it('every catalogue workflowNames label carries an English key (no untranslated template is left)', () => {
    for (const label of Object.values(WORKFLOW_SEED_LABELS.workflowNames)) {
      expect(SEED_LABEL_KEYS.workflowNames[label], label).toBeTruthy()
    }
  })
})
