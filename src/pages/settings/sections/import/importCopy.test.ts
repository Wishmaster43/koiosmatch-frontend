/**
 * The whole-customer-tree import screen shipped 21 new t() keys in zero locales —
 * the banner rendered literal key paths ("import.tree.rowGrain"), the result
 * subtitle read "import.result.subtitleSuccessWithRemarks", and the combined
 * template's nav heading fell back to the raw slug "customer_tree" with an empty
 * description. `ImporterenSettings.test.tsx` could not see any of this: it drives
 * the real i18n instance, so a MISSING key and its own expected value are both
 * just the key echoed back — the render and the assertion agree on the same wrong
 * string. Green tests, dead copy (mirrors `billingAddressCopy.test.ts`, which hit
 * the identical failure mode on the invoice-address block the same day).
 *
 * This test reads the real locale JSON instead of going through t() at all, so a
 * key that exists only as a path segment — never as an actual translated string —
 * fails here regardless of what any component-level test believes.
 */
import { describe, it, expect } from 'vitest'
import nl from '@/i18n/locales/nl/settings.json'
import en from '@/i18n/locales/en/settings.json'
import de from '@/i18n/locales/de/settings.json'
import fr from '@/i18n/locales/fr/settings.json'
import es from '@/i18n/locales/es/settings.json'

const LOCALES = { nl, en, de, fr, es } as Record<string, Record<string, unknown>>

// Every key the import screen (ImportEntityNav, WholeTreeBanner, ImportOrderBanner,
// ImportResultPanel, UploadStep, PreviewStep, ResultStep, ImporterenSettings) asks
// t() for — including the dynamic `import.entities.${entity}.*` / `import.order.
// ${entity}Hint` / `import.stats.${action}` lookups, resolved here for every entity
// slug and action the components actually pass in.
const USED_KEYS = [
  'import.title', 'import.subtitle',
  'import.loadingTemplates', 'import.loadTemplatesError', 'import.noTemplates',
  'import.downloadTemplate', 'import.downloadTemplateHint', 'import.downloadError',
  'import.noViewPermission', 'import.noImportPermission',
  'import.dropHere', 'import.selectCsv', 'import.acceptedTypes', 'import.wrongFileType',
  'import.fileSelected', 'import.replaceFile', 'import.runPreview', 'import.runningPreview',
  'import.previewErrorFallback',
  // Entity nav — one label + description per template, incl. the combined file.
  'import.groups.wholeTree', 'import.groups.perEntity',
  'import.entities.customers.label', 'import.entities.customers.desc',
  'import.entities.locations.label', 'import.entities.locations.desc',
  'import.entities.departments.label', 'import.entities.departments.desc',
  'import.entities.contacts.label', 'import.entities.contacts.desc',
  'import.entities.customer_tree.label', 'import.entities.customer_tree.desc',
  // The four-step order banner, incl. the per-entity hints and the tree alternative.
  'import.order.title', 'import.order.hint',
  'import.order.customersHint', 'import.order.locationsHint',
  'import.order.departmentsHint', 'import.order.contactsHint',
  'import.order.treeAlternative', 'import.order.switchToTree',
  // The combined-file banner (IMPORT-TREE-1) — replaces the order banner, never both.
  'import.tree.title', 'import.tree.replacesOrder', 'import.tree.rowGrain',
  'import.tree.levelTruncation', 'import.tree.allOrNothing',
  'import.tree.separateAlternative', 'import.tree.switchToSeparate',
  // Preview step.
  'import.preview.title', 'import.preview.subtitle', 'import.preview.nothingToImport',
  'import.preview.confirm', 'import.preview.running', 'import.preview.back',
  'import.preview.confirmError',
  // Result step — including the "clean except for a dropped field" subtitle.
  'import.result.title', 'import.result.subtitleSuccess',
  'import.result.subtitleSuccessWithRemarks', 'import.result.subtitlePartial',
  'import.result.newImport',
  // Summary chips, one per outcome the backend reports, plus the row-vs-record note.
  'import.stats.rows', 'import.stats.create', 'import.stats.update',
  'import.stats.skip', 'import.stats.error', 'import.stats.remarks',
  'import.stats.rowsAreRows', 'import.stats.rowsAreRowsTree',
  'import.unknownColumns.title', 'import.unknownColumns.hint',
  // Per-row detail — attention-only by default, full list on demand.
  'import.rows.allTitle', 'import.rows.attentionTitle', 'import.rows.showAll',
  'import.rows.showAttentionOnly', 'import.rows.noAttention', 'import.rows.row',
  'import.rows.remark',
] as const

// Walk a dotted path ("import.tree.title") into a nested locale object.
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[segment]
    return undefined
  }, obj)
}

describe('import screen copy — every key it asks for actually exists', () => {
  it.each(Object.keys(LOCALES))('%s carries every import.* string the screen uses', (locale) => {
    const catalogue = LOCALES[locale]
    for (const key of USED_KEYS) {
      const value = getPath(catalogue, key)
      expect(value, `${key} is missing in ${locale}/settings.json`).toBeTruthy()
      expect(typeof value, `${key} in ${locale} is not a string`).toBe('string')
      // The exact defect: a missing key falls back to the raw dotted path itself
      // (i18next's default missing-key behaviour), so a value that IS that exact
      // path — never just any string containing the word "import" — is the bug.
      expect(String(value), `${key} in ${locale} leaked the raw key as its value`).not.toBe(key)
    }
  })

  it('customer_tree never falls back to the bare slug with an empty description', () => {
    for (const locale of Object.keys(LOCALES)) {
      const entry = getPath(LOCALES[locale], 'import.entities.customer_tree') as { label?: string; desc?: string } | undefined
      expect(entry?.label, `customer_tree label missing in ${locale}`).toBeTruthy()
      expect(entry?.label).not.toBe('customer_tree')
      expect(entry?.desc, `customer_tree description missing in ${locale}`).toBeTruthy()
    }
  })
})
