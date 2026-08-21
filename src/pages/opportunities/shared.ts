/**
 * opportunities — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { default as AddOpportunityModal } from './AddOpportunityModal'
export { mapOpportunity } from './data/mapOpportunity'
export { deriveOpportunityAdvice } from './data/opportunityAdvice'
export { formatOpportunityValue, opportunityValueOf } from './data/opportunityValue'
// K3+K5: the "Kanstekst" second-screen pop-out (TEKST-POPOUT-1) — the route
// dispatcher (pages/popout/TextPopoutPage.tsx) only imports it via this barrel.
export { default as OpportunityDescriptionPopout } from './popout/OpportunityDescriptionPopout'
