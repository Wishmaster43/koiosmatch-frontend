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
>

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
