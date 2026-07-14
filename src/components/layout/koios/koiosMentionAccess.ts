/**
 * koiosMentionAccess — whether the current user may even see an "@" category
 * (KOIOS-SEARCH-1: "categories without *.view are hidden"). Two gates, matching
 * how the mirror HTTP route/page is actually gated (measured, not guessed):
 *   - `permission` categories (the 11 real entities) → AuthContext.hasPermission,
 *     the SAME `<entity>.view` permission their mirror route requires.
 *   - `pageGate` categories (aiagents/whatsapp — page/module-gated, not a plain
 *     Spatie `*.view` permission) → lib/access.ts canAccessPage, the exact gate
 *     the Sidebar itself uses for these two nav items.
 * A category with neither (today: `locations` — no search endpoint at all yet)
 * stays visible; it only ever inserts plain "@Label " text, nothing to gate.
 */
import { canAccessPage } from '@/lib/access'
import type { AuthContextValue } from '@/context/AuthContext'
import type { MentionCategoryConfig } from './koiosMentionCategories'

export function isCategoryVisible(category: MentionCategoryConfig, auth: AuthContextValue | null): boolean {
  const cfg = category.search
  if (!cfg) return true
  if (cfg.pageGate) return canAccessPage(cfg.pageGate, auth ?? undefined)
  if (cfg.permission) return auth?.hasPermission(cfg.permission) ?? false
  return true
}
