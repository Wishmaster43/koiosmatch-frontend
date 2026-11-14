/**
 * mappingDomains — the one seam for integration mapping-domain ids (WIRE-IDS-ENGLISH-1 step 2).
 * The BE echoes the STORED domain spelling in mapping rows until its rename command runs
 * after this FE hash, so reads tolerate the Dutch ids. "cao" stays (a proper noun).
 */

// The English mapping domains shown as tabs, in display order.
export const MAPPING_DOMAINS = ['cao', 'scale', 'step', 'function'] as const

export type MappingDomain = typeof MAPPING_DOMAINS[number]

// Legacy Dutch spellings the BE may still echo in a response row. Retire this map (and withCanonicalDomain
// in integrationsApi) once CMBE has run integrations:rename-mapping-domains --fix and release B is live.
const LEGACY_MAPPING_DOMAIN: Record<string, MappingDomain> = {
  schaal: 'scale',
  trede: 'step',
  functie: 'function',
}

// Map a legacy id to its English twin; English and unknown ids pass through untouched.
export function canonicalMappingDomain(domain: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_MAPPING_DOMAIN, domain)
    ? LEGACY_MAPPING_DOMAIN[domain]
    : domain
}
