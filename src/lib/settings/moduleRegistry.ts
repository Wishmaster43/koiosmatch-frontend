/**
 * moduleRegistry — the single source of truth for what each module can DISPLAY.
 *
 * Every module lists the "blocks" (KPI cards, and later charts/tables) it can show.
 * This one definition drives two things:
 *   1. the per-module view editor in Settings (toggle + reorder which blocks show)
 *   2. the actual <ModuleView> rendered on the dashboard/report
 *
 * Add a KPI/module here and it becomes available to configure AND to render —
 * no dashboard or settings code changes needed.
 */
import {
  Building2, MapPin, Layers, TrendingUp, Calendar, CheckCircle, AlertTriangle,
  Euro, Briefcase, Trophy, Percent, Users, UserCheck, UserPlus, Clock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// One configurable block in a module view (KPI card for now; charts/tables later).
// `labelKey` is an i18n key in the `settings` namespace, never a literal label (§5):
// the registry is a plain module and cannot hold a hook, so the RENDERER translates
// (ViewConfigEditor, ModuleView). One source per label — no English string alongside.
export interface ModuleBlock { id: string; type: 'kpi'; labelKey: string; icon: LucideIcon; color: string; bg: string }
export interface ModuleDef { labelKey: string; blocks: ModuleBlock[] }

// type: 'kpi' for now (charts/tables can be added later with their own renderers).
// Block colours mix design tokens with fixed module-category swatches (e.g. the violet/
// emerald pair also used in modules/filter.ts, modules/ai_agent.ts, messageParts.tsx) —
// DATA: extra category hues kept distinct from the core semantic tokens, not ad-hoc styling.
/* eslint-disable no-restricted-syntax -- DATA: module/KPI-block colour swatches, mirrors the module registry convention (src/modules/*.ts), not themeable UI colour */
export const MODULES: Record<string, ModuleDef> = {
  customers: {
    labelKey: 'moduleView.modules.customers',
    blocks: [
      { id: 'active_customers',           type: 'kpi', labelKey: 'moduleView.blocks.active_customers',           icon: Building2,  color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
      { id: 'total_locations',            type: 'kpi', labelKey: 'moduleView.blocks.total_locations',            icon: MapPin,     color: '#7C3AED',                bg: '#F5F3FF' },
      { id: 'total_departments',          type: 'kpi', labelKey: 'moduleView.blocks.total_departments',          icon: Layers,     color: '#059669',                bg: '#ECFDF5' },
      { id: 'customers_without_location', type: 'kpi', labelKey: 'moduleView.blocks.customers_without_location', icon: TrendingUp, color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)' },
    ],
  },
  // NOT exposed in Settings → Views (2026-07-31): no screen mounts <ModuleView
  // module="planning|sales|candidates"/> yet, so an editor for them would save a
  // config nothing reads. The catalogues stay here — they are inert DATA, and this
  // is the file you extend when such a dashboard lands (add the ModuleView, then
  // re-add the registry.jsx sub-tab). Keep every labelKey translated in all locales.
  planning: {
    labelKey: 'moduleView.modules.planning',
    blocks: [
      { id: 'open_shifts',   type: 'kpi', labelKey: 'moduleView.blocks.open_shifts',   icon: Calendar,      color: 'var(--color-primary)',   bg: 'var(--color-primary-bg)' },
      { id: 'filled_shifts', type: 'kpi', labelKey: 'moduleView.blocks.filled_shifts', icon: CheckCircle,   color: 'var(--color-success)',   bg: '#ECFDF5' },
      { id: 'fill_rate',     type: 'kpi', labelKey: 'moduleView.blocks.fill_rate',     icon: Percent,       color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
      { id: 'unfilled',      type: 'kpi', labelKey: 'moduleView.blocks.unfilled',      icon: AlertTriangle, color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)' },
    ],
  },
  sales: {
    labelKey: 'moduleView.modules.sales',
    blocks: [
      { id: 'revenue',    type: 'kpi', labelKey: 'moduleView.blocks.revenue',    icon: Euro,      color: 'var(--color-success)',   bg: '#ECFDF5' },
      { id: 'open_deals', type: 'kpi', labelKey: 'moduleView.blocks.open_deals', icon: Briefcase, color: 'var(--color-primary)',   bg: 'var(--color-primary-bg)' },
      { id: 'won_deals',  type: 'kpi', labelKey: 'moduleView.blocks.won_deals',  icon: Trophy,    color: '#7C3AED',                bg: '#F5F3FF' },
      { id: 'conversion', type: 'kpi', labelKey: 'moduleView.blocks.conversion', icon: Percent,   color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
    ],
  },
  candidates: {
    labelKey: 'moduleView.modules.candidates',
    blocks: [
      { id: 'total_candidates', type: 'kpi', labelKey: 'moduleView.blocks.total_candidates', icon: Users,     color: 'var(--color-primary)',   bg: 'var(--color-primary-bg)' },
      { id: 'available',        type: 'kpi', labelKey: 'moduleView.blocks.available',        icon: UserCheck, color: 'var(--color-success)',   bg: '#ECFDF5' },
      { id: 'new_candidates',   type: 'kpi', labelKey: 'moduleView.blocks.new_candidates',   icon: UserPlus,  color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
      { id: 'in_progress',      type: 'kpi', labelKey: 'moduleView.blocks.in_progress',      icon: Clock,     color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)' },
    ],
  },
}
/* eslint-enable no-restricted-syntax */
