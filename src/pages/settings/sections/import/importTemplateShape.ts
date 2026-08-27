/**
 * importTemplateShape — tells a WHOLE-CUSTOMER template apart from a single-entity
 * one, and splits the API's template list into the two groups the wizard shows.
 *
 * The decision is made on the COLUMNS GET /imports/templates already returns, never
 * on the entity slug: the four single-entity templates carry `klant_naam` /
 * `locatie_naam` / `afdeling_naam` only as LINK columns to a parent that must already
 * exist, while the combined file (backend: CustomerTreeImporter, entity
 * `customer_tree`) is the only one that also carries the customer's OWN detail columns
 * (`klant_email`, `klant_kvk_nummer`, …) next to the contact columns — because that
 * one row DEFINES the customer instead of pointing at one. A backend that renames the
 * slug therefore still lands in the right group.
 */
import type { ImportTemplateSummary } from './importApi'

// `klant_naam` is the LINK column every child template has; any OTHER klant_-prefixed
// column means the file supplies the customer itself.
const CUSTOMER_LINK_COLUMN = 'klant_naam'
const CUSTOMER_DETAIL_PREFIX = 'klant_'
// A contact's surname — present only in a file that also builds people.
const CONTACT_COLUMN = 'achternaam'

/** Does this template build the whole customer tree from one flat row? */
export function isWholeTreeTemplate(columns: readonly string[] | undefined | null): boolean {
  if (!columns || columns.length === 0) return false
  const definesCustomer = columns.some((col) => col.startsWith(CUSTOMER_DETAIL_PREFIX) && col !== CUSTOMER_LINK_COLUMN)
  return definesCustomer && columns.includes(CONTACT_COLUMN)
}

/**
 * The two groups of the entity sub-nav, in display order. The combined file comes
 * first because it is the right answer for a NEW customer; the four single-entity
 * files keep the API's own order, which is also their dependency order.
 */
export interface TemplateGroups {
  wholeTree: ImportTemplateSummary[]
  perEntity: ImportTemplateSummary[]
}

// Split the API's template list into the whole-tree vs. per-entity groups the
// wizard's sub-nav shows (see isWholeTreeTemplate for the column-based test).
export function groupTemplates(templates: readonly ImportTemplateSummary[]): TemplateGroups {
  const wholeTree = templates.filter((tpl) => isWholeTreeTemplate(tpl.columns))
  const perEntity = templates.filter((tpl) => !isWholeTreeTemplate(tpl.columns))
  return { wholeTree, perEntity }
}

/** Display order = every group flattened; the first entry is what the wizard lands on. */
export function orderedTemplates(templates: readonly ImportTemplateSummary[]): ImportTemplateSummary[] {
  const { wholeTree, perEntity } = groupTemplates(templates)
  return [...wholeTree, ...perEntity]
}

/**
 * The permission pair the SELECTED entity actually needs, mirroring
 * routes/api/tenant/exports.php 1:1: vacancies and candidates each carry their
 * own vacancies.view/create and candidates.view/create right (K6c, least
 * privilege); every other entity
 * (customers, locations, departments, contacts, the combined customer_tree
 * file, …) is a customer-tree sub-entity and shares customers.view/
 * customers.create. This was previously hardcoded to the customers pair
 * regardless of the selected entity, so a user with e.g. vacancies.create but
 * not customers.create saw the button and then hit a dead upload step — a fake
 * affordance (§3B). CAND-IMPORT-FE-1 (23-08): candidates joined the same pattern
 * (koiosmatch-api CandidateImporter, routes under candidates.create/view).
 */
export function importPermissionsFor(entity: string | null | undefined): { view: string; create: string } {
  if (entity === 'vacancies') return { view: 'vacancies.view', create: 'vacancies.create' }
  if (entity === 'candidates') return { view: 'candidates.view', create: 'candidates.create' }
  return { view: 'customers.view', create: 'customers.create' }
}
