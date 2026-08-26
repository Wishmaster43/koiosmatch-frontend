/**
 * billingCardStyles — shared layout/style constants for the superadmin billing
 * cards (BillingBudgetsCard, BillingUsersCard): both edit rows of the same
 * GET/PUT /admin/billing-budgets response via an identical card/input chrome.
 */
import { monoStyle } from '@/components/ui/typography'
import type { BillingPackageKey } from '@/types/billingUsage'

// The three billing packages every card iterates over, in display order.
export const PACKAGE_KEYS: BillingPackageKey[] = ['core', 'pro', 'enterprise']

export const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 28, background: 'var(--surface)' }
export const sub = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }
export const label = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }
// Color lives on the WRAP, not the input — an <input> is not the BodyText/Mono
// text atoms, and splitting fontSize+color across two objects keeps that honest
// without re-approximating the atom's identity locally (§4 HUISSTIJL-1).
export const inputWrap = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--input-bg)', color: 'var(--text)' }
export const inputStyle = { border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%', ...monoStyle }
