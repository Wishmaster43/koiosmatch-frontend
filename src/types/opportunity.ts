/**
 * Opportunity shapes — the UI model (`Opportunity`) and the raw API record
 * (`ApiOpportunity`), read defensively by mapOpportunity. Nested customer/stage/
 * owner arrive as objects; the flat *_id / *_name forms are tolerated as fallback.
 */
import type { Id } from './common'

/** The flat opportunity model rendered by the table/insights/drawer. */
export interface Opportunity {
  id: Id | undefined
  title: string
  initials: string
  client: string
  clientId: Id | null
  stage: string
  stageValue: string | number | null
  stageColor: string
  value: number | null
  currency: string
  owner: string
  ownerId: Id | null
  date: string
  expectedCloseAt: string | null
  // Deal-type unit (R-4): 'euro' | 'hours' | null — null counts in both pipelines.
  dealTypeUnit: string | null
  archived: boolean
  // Deal magnitude in hours (staffing) alongside the € value.
  hours: number | null
  hoursPeriod: string
  // Contract term as start/end dates (duration derives from these).
  startDate: string | null
  endDate: string | null
  // Service/sector + agreement type (tenant lookups).
  serviceType: string
  serviceTypeValue: string | null
  serviceTypeColor: string
  serviceTypeId: Id | null
  agreementType: string
  agreementTypeValue: string | null
  agreementTypeColor: string
  agreementTypeId: Id | null
  // Org hierarchy: customer → location → department → contact.
  location: string
  locationId: Id | null
  department: string
  departmentId: Id | null
  contact: string
  contactId: Id | null
}

/** Raw API opportunity record (read defensively). */
export interface ApiOpportunity {
  id?: Id
  customer?: { id?: Id; name?: string }
  client?: { id?: Id; name?: string }
  client_name?: string
  title?: string
  name?: string
  stage?: { value?: string | number; label?: string; color?: string } | string
  stage_value?: string | number
  stage_label?: string
  stage_color?: string
  status?: string
  customer_id?: Id
  client_id?: Id
  value?: number | null
  amount?: number | null
  deal_value?: number | null
  currency?: string
  owner?: { id?: Id; name?: string }
  owner_name?: string
  owner_id?: Id
  created_at?: string
  expected_close_at?: string | null
  deal_type?: { id?: string; value?: string; label?: string; color?: string; unit?: string } | null
  close_date?: string
  archived?: boolean
  deleted_at?: string | null
  hours?: number | string | null
  hours_period?: string
  start_date?: string | null
  end_date?: string | null
  service_type?: { id?: Id; value?: string; label?: string; color?: string } | string
  service_type_id?: Id
  agreement_type?: { id?: Id; value?: string; label?: string; color?: string } | string
  agreement_type_id?: Id
  // The tenant's OWN branch (C-41) — NOT the customer's location; see mapOpportunity.
  location?: { id?: Id; name?: string }
  location_id?: Id
  location_name?: string
  // OPP-LOC-1: the customer's own location/site (klantlocatie) — what the Klant tab reads.
  customer_location?: { id?: Id; name?: string }
  customer_location_id?: Id
  department?: { id?: Id; name?: string }
  department_id?: Id
  contact?: { id?: Id; name?: string }
  contact_id?: Id
  [k: string]: unknown
}
