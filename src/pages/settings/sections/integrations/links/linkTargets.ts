/**
 * linkTargets — the ONE map from a link row to its drill-down hash (CEL-DOORKLIK-CANON:
 * these targets are an ASSUMPTION awaiting Danny's answer, so a change is one line here).
 * Location / department / contact rows carry no customer id, so they stay plain text.
 */
import type { LinkEntityType } from './linksApi'

// Entity type -> hash page; null = no deep link exists for that type.
export const LINK_TARGET_PAGE: Record<LinkEntityType, string | null> = {
  candidate: 'candidates',
  customer: 'customers',
  customer_location: null,
  customer_department: null,
  customer_contact: null,
  match: 'matches',
  // HF-CONTRACT-1 tokens: a branch and a cost center (department) have no drill-down page of their own;
  // a user row opens the users page.
  branch: null,
  user: 'users',
  cost_center: null,
}

// Permission that gates seeing a type in the filter (mirrors the BE row visibility).
export const LINK_TYPE_PERMISSION: Record<LinkEntityType, string> = {
  candidate: 'candidates.view',
  customer: 'customers.view',
  customer_location: 'customers.view',
  customer_department: 'customers.view',
  customer_contact: 'customers.view',
  match: 'matches.view',
  // MAPPING-TABLE-BE-1: branch and user rows list with settings.view, a cost center (a customer's
  // department) with customers.view; editing any row still needs settings.update (the PUT gate).
  branch: 'settings.view',
  user: 'settings.view',
  cost_center: 'customers.view',
}
