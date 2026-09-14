// Settings registry — system/workflow groups: Action rules, Workflows, Planning,
// Reports, Views. Extracted from registry.tsx (REGISTRY-SPLIT-1) in original array
// order; registry.tsx concatenates this with the other registry/groups.* modules
// to build NAV_GROUPS.
import {
  Scale, History, CalendarDays, Clock, CalendarCheck, Sparkles, LayoutGrid, BarChart2,
  ListChecks, Building2,
} from 'lucide-react'
import type { NavGroup } from './types'

import ActionRulesSettings from '../sections/ActionRulesSettings'
import workflowRunHistory from '../schemas/workflowRunHistory'
import { ShiftTypesSettings, AvailabilitySettings, AutoMatchSettings, PlanningBoardSettings } from '../sections/PlanningSettings'
import ReportKpiSettings from '../sections/ReportKpiSettings'
import DashboardsSettings from '../sections/DashboardsSettings'
import ViewConfigEditor from '@/components/settings/ViewConfigEditor'

// Action rules, Workflows, Planning, Reports and Views groups, in original NAV_GROUPS order.
export const systemGroups: NavGroup[] = [
  {
    // Actieregels (AXIS-MATRIX-2) — the tenant-editable action×condition matrix behind
    // every guarded write, spanning both the candidate and customer domains (§B/§C).
    // Its own top-level group per SETTINGS-CLEAN-1 (other rule-ish settings — conversion
    // default status, required fields per phase, guard behaviour — consolidate here next).
    key: 'action_rules', icon: Scale,
    items: [
      { id: 'action_rules', icon: Scale, component: ActionRulesSettings },
    ],
  },
  {
    // Workflow run-history retention (WF-RUN-PRUNE-1, Danny 05-08): a tenant-level
    // pruning window for completed workflow runs. Its own top-level group — not
    // "AI-flavoured" (the `ai` group), not the superadmin central job queue, and
    // not roles/users, so it doesn't fit any existing category (mirrors the
    // action_rules single-item-group precedent above). Gated on the 'workflows'
    // page/module (mirrors 'whatsapp'/'shiftmanager' below) — a tenant without the
    // workflows module has nothing to retain, so the group auto-hides for them.
    key: 'workflows', icon: History,
    items: [
      { id: 'workflow_run_history', icon: History, schema: workflowRunHistory, requiresPage: 'workflows' },
    ],
  },
  // Planning lookups — each item gated on the 'plan' module (requiresPage → canAccessPage →
  // hasModule('plan')). All 4 filtered out when off → the whole group drops (super-admins too).
  {
    key: 'planning', icon: CalendarDays,
    items: [
      { id: 'shift_types', icon: Clock, component: ShiftTypesSettings, requiresPage: 'planning' },
      { id: 'availability', icon: CalendarCheck, component: AvailabilitySettings, requiresPage: 'planning' },
      { id: 'automatch', icon: Sparkles, component: AutoMatchSettings, requiresPage: 'planning' },
      { id: 'planning_board', icon: LayoutGrid, component: PlanningBoardSettings, requiresPage: 'planning' },
    ],
  },
  {
    // Reports settings — gated on the 'reports' module (requiresPage: 'reports'),
    // hidden entirely (menu included) until it is on; mirrors the 'planning'
    // group above exactly (RAPPORT-KPI-INSTELBAAR). Deliberately its own group
    // key/nav id ('report_kpis'), never the existing 'kpis' group — that one is
    // the unrelated dashboard KPI-TARGET editor (numeric goals), not this
    // report-card catalogue.
    key: 'reports', icon: BarChart2,
    items: [
      { id: 'report_kpis', icon: ListChecks, component: ReportKpiSettings, requiresPage: 'reports' },
    ],
  },
  {
    // A ViewConfigEditor sub-tab is offered ONLY for a module some screen actually
    // renders through <ModuleView> (§3 no fake affordances, 2026-07-31). Today the
    // single renderer is CustomersReport ("customers"); the planning/sales/candidates
    // editors saved `view.planning` / `view.sales` / `view.candidates` that nothing
    // ever read, so a tenant toggling blocks there got nothing, silently. They are NOT
    // offered. No tenant data is deleted: any saved `view.<module>` key stays in the
    // settings blob, and adding a <ModuleView module="planning"/> to a real dashboard
    // is what earns the tab back (the block catalogue is still in moduleRegistry.ts).
    key: 'views', icon: BarChart2,
    items: [
      { id: 'dashboards', icon: BarChart2, component: DashboardsSettings },
      // AF:orphans-7-5 — view_customers only exists for tenants with the shiftmanager page/module.
      { id: 'view_customers', icon: Building2, render: () => <ViewConfigEditor module="customers" />, requiresPage: 'shiftmanager' },
    ],
  },
]
