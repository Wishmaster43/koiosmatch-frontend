/**
 * invoiceTypes — Shared Invoice response types derived from the API spec
 * (openapi-generated). Types are extracted from endpoints:
 * - AdminInvoice: getAdminInvoices 200 response
 * - GenerateResult: postAdminInvoicesGenerate 200 response
 * - TenantInvoice: getBillingInvoices 200 response
 */
import type { operations } from '@/types/api-generated'

/**
 * Admin invoice row shape from GET /admin/invoices response. `Required` because
 * the generated type marks every field optional while the backend always populates
 * them for a real invoice.
 */
export type AdminInvoice = Required<
  NonNullable<
    operations['getAdminInvoices']['responses'][200]['content']['application/json']['data']
  >[number]
> & {
  // CLAIM-RESOLVE-1: the generated spec's row shape does not carry this yet
  // (hand-written: BE ships it on `/admin/invoices` and the finalize response,
  // contract CONTRACT-CHANGELOG.md 2026-10-04) — ISO 8601 while a mail claim is
  // stuck, else null. Optional so an older payload still types.
  sending_at?: string | null
}

/**
 * Generate result from POST /admin/invoices/generate. Includes generated and
 * any skipped invoice ids.
 */
export type GenerateResult =
  operations['postAdminInvoicesGenerate']['responses'][200]['content']['application/json']

/**
 * Tenant invoice row shape from GET /billing/invoices response. Final invoices
 * only (drafts never leave superadmin console). `Required` because the generated
 * type marks every field optional while the backend always populates them.
 */
export type TenantInvoice = Required<
  NonNullable<
    operations['getBillingInvoices']['responses'][200]['content']['application/json']['data']
  >[number]
>
