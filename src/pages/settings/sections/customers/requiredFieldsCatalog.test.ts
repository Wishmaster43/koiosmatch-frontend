/**
 * requiredFieldsCatalog — AUDIT-BE-1-18: `tags` is now on the backend whitelist
 * (CatalogRows customer_required_fields options) and has a real input (the
 * customer drawer's tag editor), so it must be a selectable required field.
 */
import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'
import { CUSTOMER_FIELDS } from './requiredFieldsCatalog'

describe('requiredFieldsCatalog · CUSTOMER_FIELDS', () => {
  it('includes tags with a resolving label in nl and en', () => {
    const tags = CUSTOMER_FIELDS.find((f) => f.key === 'tags')
    expect(tags).toBeDefined()
    const [ns, path] = tags!.labelKey.split(':')
    expect(i18n.t(path, { ns, lng: 'nl' })).not.toBe(path)
    expect(i18n.t(path, { ns, lng: 'en' })).not.toBe(path)
  })
})
