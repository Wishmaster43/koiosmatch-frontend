/**
 * requiredFieldsCatalog — the frontend mirror of the backend's WHITELIST
 * (`App\Services\Customer\RequiredFieldsCatalog`, KLANT-VERPLICHT-1): exactly the
 * built-in fields each customer-domain entity may declare required. Kept in this one
 * file so a backend catalog change (whitelist add/remove) has one obvious spot to
 * follow on the frontend, rather than a field list buried inside a component.
 *
 * `labelKey` is a fully-qualified `namespace:path` i18n key REUSED from wherever that
 * exact field already has a label today (create modals / drawer detail views) — this
 * screen never mints a second translated copy of e.g. "KvK-nummer". Where no entity-
 * specific label exists (billing_email on location/department — that field has no
 * input there since 2026-07-22, only the generic concept), the closest existing
 * generic label is reused instead of inventing a new one.
 */
export interface RequiredFieldDef {
  /** Backend field key — must match RequiredFieldsCatalog::FIELDS exactly. */
  key: string
  /** Existing i18n key (`ns:path`) this field is already labelled with elsewhere. */
  labelKey: string
}

// Customer (phase-aware) — CustomerRequiredFieldsGuard reads `customer_required_fields`.
export const CUSTOMER_FIELDS: RequiredFieldDef[] = [
  { key: 'name', labelKey: 'customers:modal.fields.name' },
  { key: 'coc_number', labelKey: 'customers:overview.coc' },
  { key: 'vat_number', labelKey: 'customers:overview.vat' },
  { key: 'debtor_number', labelKey: 'customers:overview.debtorNumber' },
  { key: 'status_id', labelKey: 'customers:drawer.status' },
  { key: 'industry_id', labelKey: 'customers:modal.fields.industry' },
  { key: 'owner_id', labelKey: 'customers:modal.fields.accountManager' },
  { key: 'location_id', labelKey: 'customers:overview.branch' },
  { key: 'website', labelKey: 'customers:overview.website' },
  { key: 'employee_count', labelKey: 'customers:overview.employeeCount' },
  { key: 'description', labelKey: 'customers:overview.description' },
  { key: 'street', labelKey: 'customers:locations.detail.street' },
  { key: 'house_number', labelKey: 'customers:locations.detail.houseNumber' },
  { key: 'house_number_suffix', labelKey: 'customers:locations.detail.houseNumberSuffix' },
  { key: 'postcode', labelKey: 'customers:locations.detail.postalCode' },
  { key: 'city', labelKey: 'customers:modal.fields.city' },
  { key: 'province', labelKey: 'customers:locations.detail.state' },
  { key: 'country', labelKey: 'customers:locations.detail.country' },
  { key: 'email', labelKey: 'customers:overview.email' },
  { key: 'phone', labelKey: 'customers:overview.phone' },
  { key: 'cost_center', labelKey: 'customers:overview.costCenter' },
  { key: 'billing_email', labelKey: 'customers:overview.billingEmail' },
]

// Contactpersoon (flat) — FlatRequiredFieldsGuard('customer_contact') reads `customer_contact_required_fields`.
export const CUSTOMER_CONTACT_FIELDS: RequiredFieldDef[] = [
  { key: 'first_name', labelKey: 'customers:subModal.firstName' },
  { key: 'middle_name', labelKey: 'customers:subModal.middleName' },
  { key: 'last_name', labelKey: 'customers:subModal.lastName' },
  { key: 'gender', labelKey: 'customers:subModal.gender' },
  { key: 'email', labelKey: 'customers:subModal.email' },
  { key: 'phone', labelKey: 'customers:subModal.phone' },
  { key: 'mobile', labelKey: 'customers:subModal.mobile' },
  { key: 'function', labelKey: 'customers:subModal.role' },
  { key: 'status_id', labelKey: 'customers:subModal.status' },
  { key: 'customer_location_id', labelKey: 'customers:subModal.selectLocation' },
  { key: 'customer_department_id', labelKey: 'customers:subModal.selectDepartment' },
]

// Locatie (flat) — FlatRequiredFieldsGuard('customer_location') reads `customer_location_required_fields`.
export const CUSTOMER_LOCATION_FIELDS: RequiredFieldDef[] = [
  { key: 'name', labelKey: 'customers:locations.detail.name' },
  { key: 'street', labelKey: 'customers:locations.detail.street' },
  { key: 'house_number', labelKey: 'customers:locations.detail.houseNumber' },
  { key: 'house_number_suffix', labelKey: 'customers:locations.detail.houseNumberSuffix' },
  { key: 'postcode', labelKey: 'customers:locations.detail.postalCode' },
  { key: 'city', labelKey: 'customers:locations.detail.city' },
  { key: 'province', labelKey: 'customers:locations.detail.state' },
  { key: 'country', labelKey: 'customers:locations.detail.country' },
  { key: 'coc_number', labelKey: 'customers:locations.detail.coc' },
  { key: 'vat_number', labelKey: 'customers:locations.detail.vat' },
  { key: 'contact_name', labelKey: 'customers:locations.detail.contactName' },
  { key: 'email', labelKey: 'customers:locations.detail.email' },
  { key: 'phone', labelKey: 'customers:locations.detail.phone' },
  { key: 'description', labelKey: 'customers:locations.detail.description' },
  { key: 'cost_center', labelKey: 'customers:locations.detail.costCenter' },
  // No location-specific "billing email" label exists (the input was removed 2026-07-22) —
  // reuse the customer's own generic billing-email label for the same concept.
  { key: 'billing_email', labelKey: 'customers:overview.billingEmail' },
  { key: 'status_id', labelKey: 'customers:locations.detail.status' },
]

// Afdeling (flat) — FlatRequiredFieldsGuard('customer_department') reads `customer_department_required_fields`.
export const CUSTOMER_DEPARTMENT_FIELDS: RequiredFieldDef[] = [
  { key: 'name', labelKey: 'customers:departments.detail.name' },
  { key: 'description', labelKey: 'customers:departments.detail.description' },
  { key: 'location_id', labelKey: 'customers:departments.detail.location' },
  // No department-detail "status" label exists yet — reuse the table column label.
  { key: 'status_id', labelKey: 'customers:departments.col.status' },
  { key: 'cost_center', labelKey: 'customers:departments.detail.costCenter' },
  { key: 'billing_email', labelKey: 'customers:overview.billingEmail' },
]
