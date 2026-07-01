/**
 * appPages — the page registry: lazy page imports, the route-key → breadcrumb
 * title map, and renderPage() that maps the active key to its page component.
 * Each page is its own lazy chunk so heavy deps (workflow canvas, PDF renderer,
 * recharts, tiptap) only download when that page is opened.
 */
import { lazy } from 'react'
import type { ReactNode } from 'react'

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
const ContactPersonsPage     = lazy(() => import('@/pages/shiftmanager/ContactPersonsPage'))
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
const ShiftmanagerDetailsPage = lazy(() => import('@/pages/shiftmanager/ShiftmanagerDetailsPage'))
const ShiftmanagerDashboard  = lazy(() => import('@/pages/shiftmanager/ShiftmanagerDashboard'))
const PlanningPage           = lazy(() => import('@/pages/planning/PlanningPage'))
const ApplicationsPage       = lazy(() => import('@/pages/applications/ApplicationsPage'))
const VacanciesPage          = lazy(() => import('@/pages/vacancies/VacanciesPage'))
const MatchesPage            = lazy(() => import('@/pages/matches/MatchesPage'))
const OpportunitiesPage      = lazy(() => import('@/pages/opportunities/OpportunitiesPage'))
const TasksPage              = lazy(() => import('@/pages/tasks/TasksPage'))

// Route key → breadcrumb label.
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
  customers:                    'Customers',

  // Reports hub (analytical)
  reports:                      'Reports',
  'reports.flow':               'Reports — Flow',
  'reports.recruiters':         'Reports — Recruiters',
  'reports.vacancies':          'Reports — Vacancies',
  'reports.matches':            'Reports — Matches',
  'customers.locations':        'Customers — Locations',
  'customers.departments':      'Customers — Departments',
  'customers.contacts':         'Customers — Contacts',
  planning:                     'Planning',

  // Shiftmanager module
  shiftmanager:                 'Shiftmanager',
  'shiftmanager.dashboard':     'Shiftmanager — Dashboard',
  'shiftmanager.candidates':    'Shiftmanager — Candidates',
  'shiftmanager.customers':     'Shiftmanager — Customers',
  'shiftmanager.locations':     'Shiftmanager — Locations',
  'shiftmanager.departments':   'Shiftmanager — Departments',
  'shiftmanager.contacts':      'Shiftmanager — Contacts',
  'shiftmanager.details':       'Shiftmanager — Details',
  'shiftmanager.customers-table':   'Shiftmanager — Klanten',
  'shiftmanager.locations-table':   'Shiftmanager — Locaties',
  'shiftmanager.departments-table': 'Shiftmanager — Afdelingen',
  'shiftmanager.contacts-table':    'Shiftmanager — Contactpersonen',

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
  return (
    <div className="flex items-center justify-center h-full">
      <p className="font-mono text-sm text-[var(--text-muted)]">{title} — komt eraan</p>
    </div>
  )
}

// Map the active route key to its page component. `goTo`/`navIntent` come from
// the layout (a page can navigate with a filter intent; plain nav clears it).
// navIntent is a dynamic payload fanned out to differently-typed page `intent`
// props, so it's typed loosely here on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderPage(activePage: string, { navIntent, goTo }: { navIntent?: any; goTo: (page: string, intent?: unknown) => void }) {
  switch (activePage) {

    // ── Core ──────────────────────────────────────────────────────────────
    case 'dashboard':   return <Dashboard onNavigate={goTo} />
    case 'profile':     return <ProfilePage />
    case 'users':       return <UsersPage />
    case 'settings':    return <SettingsPage />

    // ── ATS & CRM ─────────────────────────────────────────────────────────
    case 'candidates':             return <CandidatesPage intent={navIntent} />
    case 'applications':           return <ApplicationsPage />
    case 'vacancies':              return <VacanciesPage />
    case 'matches':                return <MatchesPage />
    case 'opportunities':          return <OpportunitiesPage />
    case 'tasks':                  return <TasksPage />
    case 'customers':              return <CustomersPage />
    case 'planning':               return <PlanningPage />

    // ── Reports hub (analytical) ──────────────────────────────────────────
    case 'reports':
    case 'reports.flow':           return <ReportsPage initialTab="flow" />
    case 'reports.recruiters':     return <ReportsPage initialTab="recruiters" />

    // ── Shiftmanager module ───────────────────────────────────────────────
    case 'shiftmanager':
    case 'shiftmanager.dashboard':   return <ShiftmanagerDashboard />
    // Reports
    case 'shiftmanager.candidates':  return <CandidatesReport initialTab="candidates" />
    case 'shiftmanager.customers':   return <CustomerReport />
    case 'shiftmanager.locations':   return <LocationsReport />
    case 'shiftmanager.departments': return <DepartmentsReport />
    case 'shiftmanager.contacts':    return <ContactPersonsPage />
    case 'shiftmanager.details':     return <ShiftmanagerDetailsPage />
    // Table pages (operational data tables)
    case 'shiftmanager.customers-table':   return <SmCustomersPage />
    case 'shiftmanager.locations-table':   return <LocationsPage />
    case 'shiftmanager.departments-table': return <DepartmentsPage />
    case 'shiftmanager.contacts-table':    return <ContactsPage />

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
    case 'aiagents':
    case 'workflows':           return <WorkflowsPage />
    case 'whatsapp':            return <WhatsAppPage />

    // AI & Workflow drill-down detail routes
    case 'details.runs':        return <RunsDetailPage />
    case 'details.messages':    return <MessagesDetailPage />

    default: return <PlaceholderPage title={PAGE_TITLES[activePage] || activePage} />
  }
}
