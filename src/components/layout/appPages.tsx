/**
 * appPages — the page registry: lazy page imports, the route-key → breadcrumb
 * title map, and renderPage() that maps the active key to its page component.
 * Each page is its own lazy chunk so heavy deps (workflow canvas, PDF renderer,
 * recharts, tiptap) only download when that page is opened.
 */
import { lazy } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LEGACY_REPORT_ROUTE_ALIASES } from '@/pages/reports/shared'

const Dashboard              = lazy(() => import('@/pages/dashboard/Dashboard'))
const ReportsPage            = lazy(() => import('@/pages/reports/ReportsPage'))
const WorkflowsPage          = lazy(() => import('@/pages/ai/WorkflowsPage'))
const CandidatesReport       = lazy(() => import('@/pages/shiftmanager/CandidatesReport'))
const CandidatesPage         = lazy(() => import('@/pages/candidates/CandidatesPage'))
const CandidatesDetailPage   = lazy(() => import('@/pages/shiftmanager/CandidatesDetailPage'))
const CustomerReport         = lazy(() => import('@/pages/shiftmanager/CustomersReport'))
const CustomersDetailPage    = lazy(() => import('@/pages/shiftmanager/CustomersDetailPage'))
const OrdersReport           = lazy(() => import('@/pages/shiftmanager/OrdersReport'))
const SettingsPage           = lazy(() => import('@/pages/settings/SettingsPage'))
const LocationsDetailPage    = lazy(() => import('@/pages/shiftmanager/LocationsDetailPage'))
const LocationsReport        = lazy(() => import('@/pages/shiftmanager/LocationsReport'))
const DepartmentsDetailPage  = lazy(() => import('@/pages/shiftmanager/DepartmentsDetailPage'))
const DepartmentsReport      = lazy(() => import('@/pages/shiftmanager/DepartmentsReport'))
const ContactsDetailPage     = lazy(() => import('@/pages/shiftmanager/ContactsDetailPage'))
const CustomersPage          = lazy(() => import('@/pages/customers/CustomersPage'))
const SmCustomersPage        = lazy(() => import('@/pages/shiftmanager/CustomersPage'))
const ContactsPage           = lazy(() => import('@/pages/shiftmanager/ContactsPage'))
const LocationsPage          = lazy(() => import('@/pages/shiftmanager/LocationsPage'))
const DepartmentsPage        = lazy(() => import('@/pages/shiftmanager/DepartmentsPage'))
const ProfilePage            = lazy(() => import('@/pages/auth/ProfilePage'))
const UsersPage              = lazy(() => import('@/pages/users/UsersPage'))
const WhatsAppPage           = lazy(() => import('@/pages/whatsapp/WhatsAppPage'))
const RunsDetailPage         = lazy(() => import('@/pages/ai/RunsDetailPage'))
const MessagesDetailPage     = lazy(() => import('@/pages/ai/MessagesDetailPage'))
const ShiftmanagerDashboard  = lazy(() => import('@/pages/shiftmanager/ShiftmanagerDashboard'))
const ShiftAnalysisPage      = lazy(() => import('@/pages/shiftmanager/ShiftAnalysisPage'))
const PlanningPage           = lazy(() => import('@/pages/planning/PlanningPage'))
const ApplicationsPage       = lazy(() => import('@/pages/applications/ApplicationsPage'))
const VacanciesPage          = lazy(() => import('@/pages/vacancies/VacanciesPage'))
const MatchesPage            = lazy(() => import('@/pages/matches/MatchesPage'))
const OpportunitiesPage      = lazy(() => import('@/pages/opportunities/OpportunitiesPage'))
const TasksPage              = lazy(() => import('@/pages/tasks/TasksPage'))
const OutreachPage           = lazy(() => import('@/pages/outreach/OutreachPage'))
// IMPORT-WIZARD-1: the full-screen "upload -> match columns -> editable preview ->
// confirm -> result" wizard (Danny: "een nieuw scherm... soort wizard").
const ImportWizardPage       = lazy(() => import('@/pages/import/ImportWizardPage'))

// Route key → breadcrumb label.
// NECESSITY, not scope: extracting PlaceholderPage (this file's only component
// export) into its own file was TRIED and reverted — it does not fix this, it
// multiplies it (2 warnings -> 35, one per unexported `const XPage = lazy(...)`
// route import, since the rule then treats every capitalized lazy() binding in
// this JSX-returning dispatcher as an unexported component). A real fix needs
// PAGE_TITLES/renderPage split off this file's 30+ lazy imports — out of reach
// for this change.
// eslint-disable-next-line react-refresh/only-export-components
export const PAGE_TITLES: Record<string, string> = {
  // Core
  dashboard:                    'Dashboard',
  settings:                     'Settings',
  users:                        'Users',
  profile:                      'Profile',

  // ATS & CRM
  candidates:                   'Candidates',
  applications:                 'Applications',
  vacancies:                    'Vacancies',
  matches:                      'Matches',
  opportunities:                'Opportunities',
  tasks:                        'Tasks',
  outreach:                     'Call lists',
  customers:                    'Customers',
  'import-wizard':              'Import wizard',

  // Reports hub (analytical) — one key per report sub-page (RAPPORTEN-OMBOUW-1,
  // consolidated RAPPORTEN-CONSOLIDATIE-1 2026-08-14). The thirteen CANONICAL
  // routes come first; the legacy ids below them are RETIRED routes kept
  // resolvable forever (house rule: a rename must never break a deep link) —
  // renderPage() maps each to the merged page + its right switch position via
  // reportIds.ts's LEGACY_REPORT_ROUTE_ALIASES.
  reports:                      'Reports',
  'reports.candidates':         'Reports — Inflow',
  'reports.applications':       'Reports — Applications',
  'reports.customers':          'Reports — Customers',
  'reports.customerstructure':  'Reports — Customer structure',
  'reports.flow':               'Reports — Flow',
  'reports.people':             'Reports — People',
  'reports.vacancies':          'Reports — Vacancies',
  'reports.opportunities':      'Reports — Opportunities',
  'reports.tasks':              'Reports — Tasks',
  'reports.matches':            'Reports — Matches',
  'reports.intakes':            'Reports — Intakes',
  'reports.outreach':           'Reports — Outreach',
  'reports.usage':              'Reports — Usage',
  // Legacy (retired as their own route — RAPPORTEN-CONSOLIDATIE-1)
  'reports.leads':              'Reports — Leads',
  'reports.sources':            'Reports — Sources',
  'reports.recruiters':         'Reports — Recruiters',
  'reports.accountmanagers':    'Reports — Account managers',
  'reports.contacts':           'Reports — Contacts',
  'reports.locations':          'Reports — Locations',
  'reports.departments':        'Reports — Departments',
  'reports.ai':                 'Reports — AI usage',
  'reports.workflows':          'Reports — Workflow runs',
  'customers.locations':        'Customers — Locations',
  'customers.departments':      'Customers — Departments',
  'customers.contacts':         'Customers — Contacts',
  planning:                     'Planning',

  // Shiftmanager module
  shiftmanager:                 'Shiftmanager',
  'shiftmanager.dashboard':     'Shiftmanager — Dashboard',
  'shiftmanager.candidates':    'Shiftmanager — Candidates',
  'shiftmanager.candidate-shifts': 'Shiftmanager — Candidate Shifts',
  'shiftmanager.customers':     'Shiftmanager — Customers',
  'shiftmanager.locations':     'Shiftmanager — Locations',
  'shiftmanager.departments':   'Shiftmanager — Departments',
  'shiftmanager.details':       'Shiftmanager — Messages',
  'shiftmanager.candidates-table':  'Shiftmanager — Candidates',
  'shiftmanager.customers-table':   'Shiftmanager — Customers',
  'shiftmanager.locations-table':   'Shiftmanager — Locations',
  'shiftmanager.departments-table': 'Shiftmanager — Departments',
  'shiftmanager.contacts-table':    'Shiftmanager — Contacts',
  'shiftmanager.orders-table':      'Shiftmanager — Shifts',
  'shiftmanager.runs-table':        'Shiftmanager — Runs',

  // Shiftmanager detail drill-downs (navigated to from SM reports)
  'details.candidates':         'SM Details — Candidates',
  'details.customers':          'SM Details — Customers',
  'details.locations':          'SM Details — Locations',
  'details.departments':        'SM Details — Departments',
  'details.contacts':           'SM Details — Contacts',
  'details.orders':             'SM Details — Shifts',

  // HelloFlex module
  helloflex:                    'HelloFlex',
  'helloflex.dashboard':        'HelloFlex — Dashboard',

  // AI & Workflow module
  aiagents:                     'AI Agents',
  workflows:                    'Workflows',
  whatsapp:                     'WhatsApp',
  'details.runs':               'AI Details — Runs',
  'details.messages':           'AI Details — Messages',
}

// Temporary placeholder for pages that are not built yet.
export function PlaceholderPage({ title }: { title?: ReactNode }) {
  // "Coming soon" suffix — this route has no real feature behind it yet.
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center justify-center h-full">
      <p className="font-mono text-sm text-[var(--text-muted)]">{title} — {t('comingSoon')}</p>
    </div>
  )
}

// Map the active route key to its page component. `goTo`/`navIntent` come from
// the layout (a page can navigate with a filter intent; plain nav clears it).
// navIntent is a dynamic payload fanned out to differently-typed page `intent`
// props, so it's typed loosely here on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, react-refresh/only-export-components -- see PAGE_TITLES above for the react-refresh reason (same file, same necessity)
export function renderPage(activePage: string, { navIntent, goTo, dashView }: { navIntent?: any; goTo: (page: string, intent?: unknown) => void; dashView?: string }) {
  switch (activePage) {

    // ── Core ──────────────────────────────────────────────────────────────
    case 'dashboard':   return <Dashboard onNavigate={goTo} viewType={dashView} />
    case 'profile':     return <ProfilePage />
    case 'users':       return <UsersPage />
    case 'settings':    return <SettingsPage />

    // ── ATS & CRM ─────────────────────────────────────────────────────────
    case 'candidates':             return <CandidatesPage intent={navIntent} />
    case 'applications':           return <ApplicationsPage intent={navIntent} />
    case 'vacancies':              return <VacanciesPage intent={navIntent} />
    case 'matches':                return <MatchesPage intent={navIntent} />
    case 'opportunities':          return <OpportunitiesPage intent={navIntent} />
    case 'tasks':                  return <TasksPage intent={navIntent} />
    case 'outreach':               return <OutreachPage />
    case 'customers':              return <CustomersPage intent={navIntent} />
    // PDF-VACATURES-2026-08-14 point 7: forward the nav intent so a caller (the
    // vacancies toolbar's Excel-upload button) can preselect an entity on arrival.
    case 'import-wizard':          return <ImportWizardPage intent={navIntent} />
    case 'planning':               return <PlanningPage />

    // ── Reports hub (analytical) ──────────────────────────────────────────
    // Bare #reports is now its own KPI overview dashboard (RAPPORTEN-DASHBOARD-1,
    // Danny 14-08) — it no longer forwards to the first sub-report, so it gets NO
    // reportId prop and ReportsPage renders the dashboard branch.
    case 'reports':                return <ReportsPage />
    // Thirteen CANONICAL routes (RAPPORTEN-CONSOLIDATIE-1) — each lands on that
    // page's own default switch position (no initialView needed).
    case 'reports.candidates':     return <ReportsPage reportId="candidates" />
    case 'reports.applications':   return <ReportsPage reportId="applications" />
    case 'reports.customers':      return <ReportsPage reportId="customers" />
    case 'reports.customerstructure': return <ReportsPage reportId="customerstructure" />
    case 'reports.flow':           return <ReportsPage reportId="flow" />
    case 'reports.people':         return <ReportsPage reportId="people" />
    case 'reports.vacancies':      return <ReportsPage reportId="vacancies" />
    case 'reports.opportunities':  return <ReportsPage reportId="opportunities" />
    case 'reports.tasks':          return <ReportsPage reportId="tasks" />
    case 'reports.matches':        return <ReportsPage reportId="matches" />
    case 'reports.intakes':        return <ReportsPage reportId="intakes" />
    case 'reports.outreach':       return <ReportsPage reportId="outreach" />
    case 'reports.usage':          return <ReportsPage reportId="usage" />
    // Legacy routes — nine sidebar entries retired into the pages above
    // (RAPPORTEN-CONSOLIDATIE-1); every one keeps resolving, landing on the
    // merged page with the right switch position via the SAME map reportIds.ts
    // documents (LEGACY_REPORT_ROUTE_ALIASES) — never a second, hand-copied list.
    case 'reports.leads':
    case 'reports.sources':
    case 'reports.recruiters':
    case 'reports.accountmanagers':
    case 'reports.contacts':
    case 'reports.locations':
    case 'reports.departments':
    case 'reports.ai':
    case 'reports.workflows': {
      const legacyId = activePage.slice('reports.'.length)
      const alias = LEGACY_REPORT_ROUTE_ALIASES[legacyId]
      return <ReportsPage reportId={alias.reportId} initialView={alias.view} />
    }

    // ── Shiftmanager module ───────────────────────────────────────────────
    case 'shiftmanager':
    case 'shiftmanager.dashboard':   return <ShiftmanagerDashboard />
    // Reports
    case 'shiftmanager.candidates':  return <CandidatesReport initialTab="candidates" />
    case 'shiftmanager.candidate-shifts': return <ShiftAnalysisPage />
    case 'shiftmanager.customers':   return <CustomerReport />
    case 'shiftmanager.locations':   return <LocationsReport />
    case 'shiftmanager.departments': return <DepartmentsReport />
    // SM messages (WhatsApp) — the Details route is now this single page
    case 'shiftmanager.details':     return <MessagesDetailPage />
    // Table pages (operational data tables)
    case 'shiftmanager.candidates-table':  return <CandidatesDetailPage />
    case 'shiftmanager.customers-table':   return <SmCustomersPage />
    case 'shiftmanager.locations-table':   return <LocationsPage />
    case 'shiftmanager.departments-table': return <DepartmentsPage />
    case 'shiftmanager.contacts-table':    return <ContactsPage />
    case 'shiftmanager.runs-table':        return <RunsDetailPage />
    case 'shiftmanager.orders-table':      return <OrdersReport />

    // Shiftmanager drill-down detail routes (navigated to from SM reports)
    case 'details.candidates':  return <CandidatesDetailPage />
    case 'details.customers':   return <CustomersDetailPage />
    case 'details.locations':   return <LocationsDetailPage />
    case 'details.departments': return <DepartmentsDetailPage />
    case 'details.contacts':    return <ContactsDetailPage />
    case 'details.orders':      return <OrdersReport />

    // ── HelloFlex module ──────────────────────────────────────────────────
    case 'helloflex':
    case 'helloflex.dashboard': return <PlaceholderPage title="HelloFlex Dashboard" />

    // ── AI & Workflow module ──────────────────────────────────────────────
    // WF-EDITOR-DEEPLINK-1: forward the nav intent so a cross-entity
    // openEntity('aiagents', id) jump (WorkflowRefs/result cards) opens that
    // workflow's editor, same contract as every other entity page above.
    case 'aiagents':
    case 'workflows':           return <WorkflowsPage intent={navIntent} />
    case 'whatsapp':            return <WhatsAppPage intent={navIntent} />

    // AI & Workflow drill-down detail routes
    case 'details.runs':        return <RunsDetailPage />
    case 'details.messages':    return <MessagesDetailPage />

    default: return <PlaceholderPage title={PAGE_TITLES[activePage] || activePage} />
  }
}
