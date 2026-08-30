/**
 * PRIJSMODEL-C contract fixed 30-08-2026 (docs/plans/PRIJSMODEL-C.md DEEL C);
 * BE not landed yet; hand-written, no 2xx schema. Split out of billingUsage.ts
 * to stay under the CLAUDE.md §3 file-size cap; re-exported there.
 */

// Shared meter state across the AI and workflow tier meters (= BE BudgetState).
export type BillingMeterState = 'ok' | 'warn' | 'blocked'

// Package keys — the ONE source for this vocabulary (billingUsage.ts re-exports it).
export type BillingPackageKey = 'core' | 'pro' | 'enterprise'

// A tier reference as it appears inside a meter (baseline_tier / tier) or in
// the admin tiers list — monthly_tokens for AI, monthly_runs for workflow.
// source: 'chosen' (tenant picked it) | 'baseline' (from the package) | null (no tier).
export interface BillingTierRef {
  key: string
  label?: string
  monthly_tokens?: number
  monthly_runs?: number
  price_cents?: number
  effective_from?: string
  source?: 'chosen' | 'baseline' | null
}

// Weights the server applies per activity and per flavour — read from here,
// never hardcoded in copy (§5 one source per value).
export type BillingUsageWeights = {
  activities?: Record<string, number>
  flavors?: { snel?: number; slim?: number; max?: number }
}

// upgrade_hint — presence-gated next-tier suggestion shown when a meter nears
// or exceeds its allowance; contact is a mailto/URL from PlatformSetting or null.
export interface BillingUpgradeHint {
  next_tier_key?: string
  next_tier_label?: string
  next_tier_tokens?: number
  next_tier_price_cents?: number
  contact?: string | null
}

// Fields both tier meters share (additive superset of the older
// BillingUsageSubscriptionMeter: budget/used/over/over_amount stay readable).
export interface BillingUsageTierMeterBase {
  tier?: BillingTierRef | null
  allowance?: number
  used?: number
  remaining?: number
  pct?: number
  over?: number
  overage_enabled?: boolean
  overage_price_cents?: number
  over_amount?: number
  state?: BillingMeterState
  warn_at_pct?: number
  upgrade_hint?: BillingUpgradeHint | null
  budget?: number
}

// subscription.ai — the AI meter: has a package baseline tier and the weights;
// its unit is always koios_ai_token.
export interface BillingUsageAiMeter extends BillingUsageTierMeterBase {
  unit?: 'koios_ai_token'
  baseline_tier?: BillingTierRef | null
  weights?: BillingUsageWeights
}

// subscription.workflow — the workflow meter: package runs are `included` and a
// chosen tier stacks on top (allowance = included + tier); unit workflow_run.
export interface BillingUsageWorkflowMeter extends BillingUsageTierMeterBase {
  unit?: 'workflow_run'
  included?: number
}

// Either meter — for components that render a meter generically (TierMeter).
export type BillingUsageTierMeter = BillingUsageAiMeter | BillingUsageWorkflowMeter

// GET /billing/usage — period block on subscription (from/to/resets_at, bureau clock).
export interface BillingUsagePeriod {
  from?: string
  to?: string
  resets_at?: string
}

// GET /billing/usage — subscription.users (K-167, unchanged shape, now typed).
export interface BillingUsageUsers {
  included?: number
  active?: number
  extra?: number
  price_per_extra_cents?: number
  extra_amount?: number
}

// GET|PUT /admin/billing-tiers — fixed tier keys, never add/remove tiers here.
export type BillingAiTierKey = 'assist' | 'start' | 'pro' | 'max' | 'max_pro'
export type BillingWorkflowTierKey = 'start' | 'pro' | 'max'

// One AI tier row of the platform catalog (label/tokens/price editable, key fixed).
export interface BillingAiTier {
  key: BillingAiTierKey
  label?: string
  monthly_tokens?: number
  price_cents?: number
  sort?: number
  active?: boolean
  // Server-computed count of tenants whose effective tier is this key — the
  // honest context next to the active toggle (no add/remove of tiers anyway).
  in_use?: number
}

// One workflow tier row of the platform catalog (same rules as the AI row).
export interface BillingWorkflowTier {
  key: BillingWorkflowTierKey
  label?: string
  monthly_runs?: number
  price_cents?: number
  sort?: number
  active?: boolean
  in_use?: number
}

// Platform overage toggles + prices per meter (off = block at 100% and hint an upgrade).
export interface BillingOverageConfig {
  ai_enabled?: boolean
  ai_price_cents?: number
  workflow_enabled?: boolean
  workflow_price_cents?: number
}

// What a package includes: the AI baseline tier (replaced by a higher choice)
// and the workflow runs (a chosen tier stacks on top).
export interface BillingPackageBaseline {
  ai_tier_key?: BillingAiTierKey | null
  workflow_runs?: number
}

// GET /admin/billing-tiers — the whole platform tier configuration in one read.
export interface AdminBillingTiersResponse {
  ai_tiers: BillingAiTier[]
  workflow_tiers: BillingWorkflowTier[]
  weights?: BillingUsageWeights
  overage?: BillingOverageConfig
  warn_at_pct?: number
  upgrade_contact?: string | null
  package_baselines?: Record<BillingPackageKey, BillingPackageBaseline>
}

// PUT body — all optional/partial (sometimes-validated server-side); NO tier
// add/remove and NO tenant block on this endpoint. A row always carries its key.
export interface AdminBillingTiersUpdate {
  ai_tiers?: Array<{ key: BillingAiTierKey } & Partial<Pick<BillingAiTier, 'label' | 'monthly_tokens' | 'price_cents' | 'sort' | 'active'>>>
  workflow_tiers?: Array<{ key: BillingWorkflowTierKey } & Partial<Pick<BillingWorkflowTier, 'label' | 'monthly_runs' | 'price_cents' | 'sort' | 'active'>>>
  weights?: BillingUsageWeights
  overage?: BillingOverageConfig
  warn_at_pct?: number
  upgrade_contact?: string | null
  package_baselines?: Partial<Record<BillingPackageKey, Partial<BillingPackageBaseline>>>
}

// One history row of a tenant's tier choices (DEEL C: tier_key, effective_from,
// created_by, created_at) — the superadmin "Sinds" + "door" columns read these.
export interface BillingTierHistoryEntry {
  tier_key: string | null
  effective_from: string
  created_by?: string | null
  created_at?: string
}

// GET /admin/tenants/{id}/billing-tiers — one tenant's effective tier + history per meter.
export interface AdminTenantBillingTiersResponse {
  ai: { effective?: BillingTierRef | null; history?: BillingTierHistoryEntry[] }
  workflow: { effective?: BillingTierRef | null; history?: BillingTierHistoryEntry[] }
  package_baseline?: BillingPackageBaseline
}

// PUT /admin/tenants/{id}/billing-tiers — effective_from is required per DEEL C
// (upgrade = today, downgrade = the 1st of a future month; server validates).
export interface AdminTenantBillingTiersUpdate {
  ai_tier?: string | null
  workflow_tier?: string | null
  effective_from: string
}
