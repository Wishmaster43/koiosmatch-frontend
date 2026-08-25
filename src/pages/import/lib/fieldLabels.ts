/**
 * fieldLabels — one i18n label per import column, for the mapping step's target-field
 * select. Reuses the CREATE MODALS' own labels wherever an equivalent field already
 * exists (CLAUDE.md §3A "one label per thing; grep before naming" — verified against
 * AddCustomerModal / AddLocationModal / AddDepartmentModal / AddContactPersonModal's
 * own t() calls) so the wizard never invents a second phrase for a field the app
 * already names. Only three columns have no existing equivalent (the customer LINK
 * column, and the two consent columns) — those get a NEW key under
 * settings:import.wizard.fields.*, listed in this delivery's i18n report.
 */
import type { TFunction } from 'i18next'

interface FieldLabelRef {
  ns: string
  key: string
  /** English fallback so a not-yet-translated NEW key never renders a raw key path. */
  defaultValue?: string
}

// `naam` ("name") means a different thing per entity (customer / location /
// department name), so it is the one column resolved with an entity override
// below; every other column means the same thing wherever it appears,
// including the three prefixed columns of the combined customer_tree file:
// klant_ (customer_), locatie_
// (location_), afdeling_ (department_).
const DEFAULT_LABELS: Record<string, FieldLabelRef> = {
  naam: { ns: 'customers', key: 'modal.fields.name' },
  email: { ns: 'customers', key: 'overview.email' },
  telefoon: { ns: 'customers', key: 'overview.phone' },
  plaats: { ns: 'customers', key: 'modal.fields.city' },
  kvk_nummer: { ns: 'customers', key: 'overview.coc' },
  btw_nummer: { ns: 'customers', key: 'overview.vat' },
  website: { ns: 'customers', key: 'overview.website' },
  branche: { ns: 'customers', key: 'modal.fields.industry' },
  straat: { ns: 'customers', key: 'subModal.street' },
  huisnummer: { ns: 'customers', key: 'subModal.houseNumber' },
  toevoeging: { ns: 'customers', key: 'subModal.houseNumberSuffix' },
  postcode: { ns: 'customers', key: 'subModal.postalCode' },
  land: { ns: 'customers', key: 'subModal.country' },
  kostenplaats: { ns: 'customers', key: 'subModal.costCenter' },
  omschrijving: { ns: 'customers', key: 'locations.detail.description' },
  voornaam: { ns: 'customers', key: 'subModal.firstName' },
  tussenvoegsel: { ns: 'customers', key: 'subModal.middleName' },
  achternaam: { ns: 'customers', key: 'subModal.lastName' },
  functie: { ns: 'customers', key: 'subModal.role' },
  mobiel: { ns: 'customers', key: 'subModal.mobile' },
  hoofdcontact: { ns: 'customers', key: 'subModal.isPrimary' },
  locatie_naam: { ns: 'customers', key: 'subModal.locationName' },
  afdeling_naam: { ns: 'customers', key: 'subModal.departmentName' },
  // NEW — no create modal exposes "which customer" as its own field (a modal is
  // always already scoped to one customer), so this cross-entity link column needs
  // its own label.
  klant_naam: { ns: 'settings', key: 'import.wizard.fields.customerName', defaultValue: 'Customer name' },
  // NEW — no consent toggle for these two channels exists anywhere in the app yet.
  whatsapp_toestemming: { ns: 'settings', key: 'import.wizard.fields.whatsappConsent', defaultValue: 'WhatsApp consent' },
  email_toestemming: { ns: 'settings', key: 'import.wizard.fields.emailConsent', defaultValue: 'Email consent' },
}

// Where the LINK meaning ("which location does this belong to") reads better than
// the OWN-NAME meaning ("the location's own name") — both existing keys already say
// exactly that in AddDepartmentModal / AddContactPersonModal.
const ENTITY_OVERRIDES: Record<string, Record<string, FieldLabelRef>> = {
  departments: {
    locatie_naam: { ns: 'customers', key: 'subModal.selectLocation' },
  },
  contacts: {
    locatie_naam: { ns: 'customers', key: 'subModal.selectLocation' },
    afdeling_naam: { ns: 'customers', key: 'subModal.selectDepartment' },
  },
}

const TREE_PREFIXES = ['klant_', 'locatie_', 'afdeling_'] as const

// Strip a tree-file level prefix so an unlisted prefixed column (klant_email,
// locatie_straat, …) still resolves via its base column's label.
function stripTreePrefix(column: string): string | null {
  for (const prefix of TREE_PREFIXES) {
    if (column.startsWith(prefix) && column !== `${prefix}naam`) return column.slice(prefix.length)
  }
  return null
}

function labelRefFor(entity: string, column: string): FieldLabelRef {
  const override = ENTITY_OVERRIDES[entity]?.[column]
  if (override) return override
  if (DEFAULT_LABELS[column]) return DEFAULT_LABELS[column]
  const base = stripTreePrefix(column)
  if (base && DEFAULT_LABELS[base]) return DEFAULT_LABELS[base]
  // A column this mirror doesn't know (a future backend addition) still needs a
  // label — the raw column name is honest and better than a blank select option.
  return { ns: 'settings', key: `import.wizard.fields.${column}`, defaultValue: column }
}

/** The label to show for one column, in the mapping step's target-field select. */
export function fieldLabel(t: TFunction, entity: string, column: string): string {
  const ref = labelRefFor(entity, column)
  return ref.defaultValue !== undefined
    ? t(ref.key, { ns: ref.ns, defaultValue: ref.defaultValue })
    : t(ref.key, { ns: ref.ns })
}
