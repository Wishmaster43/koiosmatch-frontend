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
export interface ModuleBlock { id: string; type: 'kpi'; label: string; icon: LucideIcon; color: string; bg: string }
export interface ModuleDef { label: string; blocks: ModuleBlock[] }

// type: 'kpi' for now (charts/tables can be added later with their own renderers).
export const MODULES: Record<string, ModuleDef> = {
  customers: {
    label: 'Customers',
    blocks: [
      { id: 'active_customers',           type: 'kpi', label: 'Active customers',          icon: Building2,    color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
      { id: 'total_locations',            type: 'kpi', label: 'Total locations',           icon: MapPin,       color: '#7C3AED',                bg: '#F5F3FF' },
      { id: 'total_departments',          type: 'kpi', label: 'Total departments',         icon: Layers,       color: '#059669',                bg: '#ECFDF5' },
      { id: 'customers_without_location', type: 'kpi', label: 'Customers without location', icon: TrendingUp,   color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)' },
    ],
  },
  planning: {
    label: 'Planning',
    blocks: [
      { id: 'open_shifts',   type: 'kpi', label: 'Open shifts',   icon: Calendar,      color: 'var(--color-primary)',   bg: 'var(--color-primary-bg)' },
      { id: 'filled_shifts', type: 'kpi', label: 'Filled shifts', icon: CheckCircle,   color: 'var(--color-success)',   bg: '#ECFDF5' },
      { id: 'fill_rate',     type: 'kpi', label: 'Fill rate',     icon: Percent,       color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
      { id: 'unfilled',      type: 'kpi', label: 'Unfilled',      icon: AlertTriangle, color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)' },
    ],
  },
  sales: {
    label: 'Sales',
    blocks: [
      { id: 'revenue',     type: 'kpi', label: 'Revenue',        icon: Euro,     color: 'var(--color-success)',   bg: '#ECFDF5' },
      { id: 'open_deals',  type: 'kpi', label: 'Open deals',     icon: Briefcase, color: 'var(--color-primary)',  bg: 'var(--color-primary-bg)' },
      { id: 'won_deals',   type: 'kpi', label: 'Won this month', icon: Trophy,   color: '#7C3AED',                bg: '#F5F3FF' },
      { id: 'conversion',  type: 'kpi', label: 'Conversion rate', icon: Percent, color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
    ],
  },
  candidates: {
    label: 'Candidates',
    blocks: [
      { id: 'total_candidates', type: 'kpi', label: 'Total candidates', icon: Users,    color: 'var(--color-primary)',   bg: 'var(--color-primary-bg)' },
      { id: 'available',        type: 'kpi', label: 'Available',        icon: UserCheck, color: 'var(--color-success)',  bg: '#ECFDF5' },
      { id: 'new_candidates',   type: 'kpi', label: 'New',              icon: UserPlus, color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
      { id: 'in_progress',      type: 'kpi', label: 'In progress',      icon: Clock,    color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)' },
    ],
  },
}

/** Modules exposed in the Settings → Views area (order matters for the nav). */
export const VIEW_MODULE_IDS = ['customers', 'planning', 'sales', 'candidates']
