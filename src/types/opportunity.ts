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
  close_date?: string
  [k: string]: unknown
}
