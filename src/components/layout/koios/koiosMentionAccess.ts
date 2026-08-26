/**
 * koiosMentionAccess — whether the current user may even see an "@" category
 * (KOIOS-SEARCH-1: "categories without *.view are hidden"). Two gates, matching
 * how the mirror HTTP route/page is actually gated (measured, not guessed):
 *   - `permission` categories (the real entities, 12 today) → AuthContext.hasPermission,
 *     the SAME `<entity>.view` permission their mirror route requires.
 *   - `pageGate` categories (aiagents/whatsapp — page/module-gated, not a plain
 *     Spatie `*.view` permission) → lib/access.ts canAccessPage, the exact gate
 *     the Sidebar itself uses for these two nav items.
 * A category with neither `permission` nor `pageGate` (none today — every
 * MENTION_CATEGORIES entry with `search` carries one) stays visible by
 * default; this is the defensive fallback for a future entry that doesn't.
 */
import { canAccessPage } from '@/lib/access'
import type { AuthContextValue } from '@/context/AuthContext'
import type { MentionCategoryConfig } from './koiosMentionCategories'

// Resolves whether a mention category is visible for this user: a page gate defers to the route permission check, a bare permission checks it directly, and a category with no gate configured stays visible by default.
export function isCategoryVisible(category: MentionCategoryConfig, auth: AuthContextValue | null): boolean {
  const cfg = category.search
  if (!cfg) return true
  if (cfg.pageGate) return canAccessPage(cfg.pageGate, auth ?? undefined)
  if (cfg.permission) return auth?.hasPermission(cfg.permission) ?? false
  return true
}
