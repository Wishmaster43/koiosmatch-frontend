/**
 * waDigits — normalise a phone number to bare E.164 digits for a wa.me link.
 * Strips everything but digits, then turns a Dutch national-format leading "0"
 * into the "31" country code (measured: candidate/contact phones arrive either
 * as "+31612345678" or "0612345678" — never anything stranger in this dataset).
 * Returns '' for anything too short to be a real MSISDN so a corrupted/partial
 * value never renders a dead WhatsApp link. Single shared implementation — was
 * duplicated across the candidate ProfileTab and the customers ContactDetail
 * (P1 follow-up, 2026-07-20).
 */
export function waDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountryCode = digits.startsWith('0') ? `31${digits.slice(1)}` : digits
  return withCountryCode.length >= 8 ? withCountryCode : ''
}
