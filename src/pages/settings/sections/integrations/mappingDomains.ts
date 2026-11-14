/**
 * mappingDomains: the one seam for integration mapping-domain ids (WIRE-IDS-ENGLISH-1). The BE serves
 * and accepts the English ids only since WIRE-IDS-ENGLISH-2; "cao" stays (a proper noun).
 */

// The English mapping domains shown as tabs, in display order.
export const MAPPING_DOMAINS = ['cao', 'scale', 'step', 'function'] as const

export type MappingDomain = typeof MAPPING_DOMAINS[number]
