/**
 * Customer list display preferences — how the customer table AND its drill-down
 * sub-entity tables (Locaties/Afdelingen/Contactpersonen) render. Labels/descriptions
 * live in i18n under `customerDisplay.*` in the settings namespace. Mirrors candidateDisplay.
 *
 * SUB-TABS-1 (Danny 02-08): the registry no longer renders this schema flat — it is
 * split into per-entity sub-tabs by `CustomerDisplaySettings` (component entry), which
 * filters this SAME field list by `group` and mounts one `<SchemaSection>` per tab.
 * `group` is presentational metadata only — it changes nothing about how a field
 * loads/saves, so an absent group never affects behaviour. Keys/defaults are UNCHANGED.
 *
 * Chip-colour placement (`customer_location_chip_color` / `customer_department_chip_color`):
 * each colours a chip rendered on OTHER entities' tables (the location chip shows on the
 * Afdelingen + Contactpersonen tables; the department chip shows only on Contactpersonen).
 * Grouped with the entity they NAME, not with where they render, because the location
 * colour alone already renders in two different places — "where you see it" has no single
 * answer, while "the entity it names" always resolves to exactly one tab. The field
 * description says explicitly which table(s) it colours so a tenant is never guessing.
 */
export default {
  i18nKey: 'customerDisplay',
  fields: [
    // Status carries meaning → coloured chip ON by default; Koios advice OFF.
    { key: 'customer_table_color_status', type: 'toggle', default: true, group: 'customer_table' },
    { key: 'customer_table_color_koios',  type: 'toggle', default: false, group: 'customer_table' },
    // Owner avatar: account-manager colour (on, default) vs. neutral grey (off).
    { key: 'customer_table_color_owner',  type: 'toggle', default: true, group: 'customer_table' },
    // CHIPKLEUR-INSTELBAAR-1: the ONE colour used for every Locatie / Afdeling contact
    // chip (ContactsPanel). Defaults mirror the backend's documented fallback exactly
    // (SettingController@store's ChipColor block) — absent/cleared keeps today's look.
    { key: 'customer_location_chip_color',   type: 'color', default: 'var(--color-secondary)', group: 'locations' },
    { key: 'customer_department_chip_color', type: 'color', default: 'var(--color-violet)', group: 'departments' },
    // CHIPKLEUR-INSTELBAAR-1: five colour-on/off flags — one per coloured column across
    // the contact/department/location tables. All default ON, so an absent setting keeps
    // today's look (ContactsPanel/DepartmentsPanel/LocationsTab all default `true` too).
    { key: 'customer_contact_table_color_location',    type: 'toggle', default: true, group: 'contacts' },
    { key: 'customer_contact_table_color_department',  type: 'toggle', default: true, group: 'contacts' },
    { key: 'customer_contact_table_color_status',      type: 'toggle', default: true, group: 'contacts' },
    { key: 'customer_department_table_color_location', type: 'toggle', default: true, group: 'departments' },
    { key: 'customer_location_table_color_status',     type: 'toggle', default: true, group: 'locations' },
    { key: 'customer_department_table_color_status',   type: 'toggle', default: true, group: 'departments' },
    // TAKEN/KANSEN-STYLE-1 (Danny, this task): the Taken and Kansen sub-tabs picked up
    // the same colour-on/off convention as the other drill-down tables — Taken colours
    // its status chip, Kansen its stage chip. Both default ON so an absent setting
    // keeps today's always-coloured look unchanged.
    { key: 'customer_task_table_color_status',        type: 'toggle', default: true, group: 'tasks' },
    { key: 'customer_opportunity_table_color_stage',  type: 'toggle', default: true, group: 'opportunities' },
  ],
}
