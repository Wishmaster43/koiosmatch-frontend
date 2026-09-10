// Map address fields from a UI patch object to API body keys. Used by both
// candidate and vacancy patch builders (DRY round 10, MISC). Only `country`
// ever clears on an empty string, and only when the caller opts in via
// `clearCountryOnEmpty` — every other field, `postalCode` included, passes
// through verbatim (empty string included, no clearing).
export function mapAddressPatch(
  patch: Record<string, unknown>,
  body: Record<string, unknown>,
  options: { clearCountryOnEmpty?: boolean } = {},
): void {
  const { clearCountryOnEmpty = true } = options

  if ('street' in patch) body.street = patch.street
  if ('houseNumber' in patch) body.house_number = patch.houseNumber
  if ('houseNumberSuffix' in patch) body.house_number_suffix = patch.houseNumberSuffix
  if ('addressLine2' in patch) body.address_line_2 = patch.addressLine2
  if ('postalCode' in patch) body.postcode = patch.postalCode
  if ('city' in patch) body.city = patch.city
  if ('province' in patch) body.province = patch.province
  // COUNTRY-1: home-address country (ISO-2 code); '' clears it only when the
  // caller opts in — candidates do (COUNTRY-1), vacancies don't (VAC-COUNTRY-1,
  // see the call sites in candidatesShared.ts / vacanciesShared.ts).
  if ('country' in patch) {
    body.country = clearCountryOnEmpty && patch.country === '' ? null : patch.country
  }
}
