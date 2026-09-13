/**
 * provinceFlag — the flag asset for an ISO 3166-2 province code (Danny 13-09 row
 * 84: "Vlag van de provincie erbij"). Provinces have no emoji flag, so the 23 official
 * Dutch and Belgian flags ship as public-domain SVGs under public/flags/provinces/
 * (Wikimedia Commons, government symbols); a code outside that set resolves to null
 * and the row simply shows no flag. The BE serves `code` on the province lookup
 * (LOOKUP-CODES-1); the FE never guesses a code from a name.
 */
const SHIPPED_PROVINCE_FLAGS: ReadonlySet<string> = new Set([
  'NL-DR', 'NL-FL', 'NL-FR', 'NL-GE', 'NL-GR', 'NL-LI', 'NL-NB', 'NL-NH', 'NL-OV', 'NL-UT', 'NL-ZE', 'NL-ZH',
  'BE-VAN', 'BE-VBR', 'BE-VLI', 'BE-VOV', 'BE-VWV', 'BE-WBR', 'BE-WHT', 'BE-WLG', 'BE-WLX', 'BE-WNA', 'BE-BRU',
])

// Asset path for a shipped province code (case-insensitive), null when none ships.
export function provinceFlagSrc(code?: string | null): string | null {
  if (!code) return null
  const normalised = code.trim().toUpperCase()
  return SHIPPED_PROVINCE_FLAGS.has(normalised) ? `/flags/provinces/${normalised}.svg` : null
}
