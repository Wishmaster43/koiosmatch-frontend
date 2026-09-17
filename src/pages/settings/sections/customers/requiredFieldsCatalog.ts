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
  // AUDIT-BE-1-18: `tags` is a real input (the drawer header's tag editor) and is
  // now on the BE whitelist (CatalogRows) — reuses the drawer's own label.
  { key: 'tags', labelKey: 'customers:drawer.tags' },
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

/** Build a full `key -> labelKey` map from a catalog array + extra key/labelKey pairs. */
function labelMap(base: RequiredFieldDef[], extra: Record<string, string>): Record<string, string> {
  return { ...Object.fromEntries(base.map(f => [f.key, f.labelKey])), ...extra }
}

/**
 * Verifier fix (17-09): the live `GET /settings/field-inventory?entity=customer` serves
 * 20 writable keys the static CUSTOMER_FIELDS array above never had a row for (measured
 * against `RequiredFieldVocabulary::fieldsFor('customer')`), so the raw key fell back to
 * rendering verbatim on the Klant tab (§5 half-translated copy). Every entry below either
 * REUSES an existing label already shown elsewhere for that exact field (the invoice
 * address block carries its OWN "Factuuradres: …" labels, because a row must never
 * read identically to its visiting-address twin — verifier 17-09) or, where no existing label exists anywhere in
 * the app, adds a dedicated `customerRequiredFields.fieldLabels.*` key.
 */
export const CUSTOMER_FIELD_LABEL_KEYS: Record<string, string> = labelMap(CUSTOMER_FIELDS, {
  address_line_2: 'customers:address.addressLine2',
  billing_po_box: 'customers:overview.billingAddress.poBox',
  billing_street: 'settings:customerRequiredFields.fieldLabels.billing_street',
  billing_house_number: 'settings:customerRequiredFields.fieldLabels.billing_house_number',
  billing_house_number_suffix: 'settings:customerRequiredFields.fieldLabels.billing_house_number_suffix',
  billing_address_line_2: 'settings:customerRequiredFields.fieldLabels.billing_address_line_2',
  billing_postcode: 'settings:customerRequiredFields.fieldLabels.billing_postcode',
  billing_city: 'settings:customerRequiredFields.fieldLabels.billing_city',
  billing_province: 'settings:customerRequiredFields.fieldLabels.billing_province',
  billing_country: 'settings:customerRequiredFields.fieldLabels.billing_country',
  billing_branch_id: 'settings:customerRequiredFields.fieldLabels.billing_branch_id',
  branch_ids: 'settings:customerRequiredFields.fieldLabels.branch_ids',
  source: 'customers:overview.source',
  has_career_page: 'customers:overview.hasCareerPage',
  hide_company_name: 'customers:vacancySettings.fields.hideCompanyName',
  show_in_my_vacancies: 'customers:vacancySettings.fields.showInVacancies',
  exclude_from_sourcing: 'customers:vacancySettings.fields.excludeFromSourcing',
  custom_fields: 'candidates:drawer.customFields',
  // No existing screen names these two yet (KLANTVOORKEUR-CONTRACT-1 / KD10) — new keys.
  contract_types: 'settings:customerRequiredFields.fieldLabels.contractTypes',
  contract_end_date: 'settings:customerRequiredFields.fieldLabels.contractEndDate',
})

/** Verifier fix (17-09): 16 fields the inventory serves for `customer_contact` (WORKLIST row 34). */
export const CUSTOMER_CONTACT_FIELD_LABEL_KEYS: Record<string, string> = labelMap(CUSTOMER_CONTACT_FIELDS, {
  location_ids: 'settings:customerRequiredFields.fieldLabels.locationIds',
  department_ids: 'settings:customerRequiredFields.fieldLabels.departmentIds',
  linkedin_slug: 'candidates:modal.fields.linkedin',
  preferred_language: 'candidates:modal.fields.preferredLanguage',
  description: 'customers:overview.description',
  is_primary: 'settings:customerRequiredFields.fieldLabels.isPrimary',
  custom_fields: 'candidates:drawer.customFields',
  whatsapp_consent: 'candidates:communication.consentWhatsapp',
  email_consent: 'candidates:communication.consentEmail',
  newsletter_consent: 'candidates:communication.consentNewsletter',
  retention_consent: 'candidates:communication.consentRetentionOptIn',
  // The four evidentiary timestamps the consent flags stamp (write-`prohibited`, but
  // still a top-level Form Request rule key, so the live inventory serves them too).
  whatsapp_consent_at: 'settings:customerRequiredFields.fieldLabels.whatsappConsentAt',
  email_consent_at: 'settings:customerRequiredFields.fieldLabels.emailConsentAt',
  newsletter_consent_at: 'settings:customerRequiredFields.fieldLabels.newsletterConsentAt',
  retention_consent_at: 'settings:customerRequiredFields.fieldLabels.retentionConsentAt',
  retention_warned_at: 'settings:customerRequiredFields.fieldLabels.retentionWarnedAt',
})

/** Verifier fix (17-09): ~5 fields the inventory serves for `customer_location`. */
export const CUSTOMER_LOCATION_FIELD_LABEL_KEYS: Record<string, string> = labelMap(CUSTOMER_LOCATION_FIELDS, {
  address_line_2: 'customers:address.addressLine2',
  branch_id: 'customers:overview.branchField',
  branch_ids: 'customers:overview.branch',
  custom_fields: 'candidates:drawer.customFields',
  state: 'settings:customerRequiredFields.fieldLabels.state',
})

/** Verifier fix (17-09): 1 field (`custom_fields`) the inventory serves for `customer_department`. */
export const CUSTOMER_DEPARTMENT_FIELD_LABEL_KEYS: Record<string, string> = labelMap(CUSTOMER_DEPARTMENT_FIELDS, {
  custom_fields: 'candidates:drawer.customFields',
})

// The shared reason-text -> i18n-key translation, re-exported for this screen and its tests.
export { reasonI18nKey } from '@/pages/settings/requiredFieldsReason'
