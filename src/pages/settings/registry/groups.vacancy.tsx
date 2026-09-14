// Settings registry — vacancy-domain groups: Vacancies, Tasks, Matches, Outreach.
// Extracted from registry.tsx (REGISTRY-SPLIT-1) in original array order; registry.tsx
// concatenates this with the other registry/groups.* modules to build NAV_GROUPS.
import {
  Briefcase, UserCheck, Target, BarChart2, BookOpen, Store, ClipboardList, Sparkles, Users,
  SlidersHorizontal, Palette, Clock, ListChecks, Tags, Flag, FileText, XCircle, Percent,
  EyeOff, Phone, CheckCircle, AlertTriangle,
} from 'lucide-react'
import type { NavGroup } from './types'

import { VacancyStatusSettings, VacancyPhaseSettings, VacancySenioritySettings, VacancyEducationSettings, VacancyChannelSettings, VacancyApplicationDefaultsSettings } from '../sections/VacancySettings'
import VacancyDefaultStatusSettings from '../sections/VacancyDefaultStatusSettings'
import VacancyMatchingSettings from '../sections/VacancyMatchingSettings'
import VacancyCandidateTabSettings from '../sections/VacancyCandidateTabSettings'
import MatchTemplatesSettings from '../sections/MatchTemplatesSettings'
import CatalogSection from '../sections/CatalogSection'
import { TaskStatusSettings, TaskTypeSettings, TaskPrioritySettings } from '../sections/TaskSettings'
import { MatchStatusSettings, ContractTypesSettings, MatchStopReasonSettings } from '../sections/MatchSettings'
import MatchRatesSettings from '../sections/MatchRatesSettings'
import MatchContractLineRateSideSettings from '../sections/MatchContractLineRateSideSettings'
import { OutreachStatusSettings, OutreachOutcomeSettings } from '../sections/OutreachSettings'
import EscalationReasonsSettings from '../sections/EscalationReasonsSettings'
import vacancyDisplay from '../schemas/vacancyDisplay'
import taskDisplay from '../schemas/taskDisplay'
import matchDisplay from '../schemas/matchDisplay'
import outreachDisplay from '../schemas/outreachDisplay'

// Vacancies, Tasks, Matches and Outreach groups, in original NAV_GROUPS order.
export const vacancyGroups: NavGroup[] = [
  {
    // WITHHELD (offered-iff-read registry rule, mirrors the note_types/document_types
    // comments above): the backend ships full tenant CRUD + reorder for
    // vacancy_employment_types (VacancyEmploymentTypeController extends LookupController,
    // routes/api/tenant/vacancies.php) — a value/label vocabulary for a vacancy's
    // employment type (permanent/temp/…). There is ZERO frontend consumer today:
    // MatchTemplatesSettings.tsx explicitly rejected wiring its own employment-type
    // filter to this single-value lookup in favour of a different multi-select, the
    // vacancy create/edit forms and VacancyDetailResource's employment_type field
    // still carry the FREE-TEXT column, and no picker anywhere reads
    // `/vacancy-employment-types`. Per §3 (no fake affordances) this does NOT get a
    // settings screen yet — a tenant would curate a vocabulary nothing ever applies.
    // No tenant data is at risk: the endpoint keeps serving vacancy_employment_types,
    // and re-adding a `vacancy_employment_types` item becomes a one-line change the
    // day a real vacancy-employment-type picker/reader lands (ticket VAC-EMPLOYMENT-1).
    key: 'vacancies', icon: Briefcase,
    items: [
      { id: 'vacancy_statuses', icon: Briefcase, component: VacancyStatusSettings, logName: 'vacancy_statuses' },
      // VACSTATUS-DEFAULT-1: which status a status-less vacancy create gets
      // (backend VacancyDefaultStatusResolver) — same UserCheck icon as the
      // candidate/customer conversion pickers, reads as "the same concept".
      { id: 'vacancy_default_status', icon: UserCheck, component: VacancyDefaultStatusSettings },
      { id: 'vacancy_phases', icon: Target, component: VacancyPhaseSettings },
      { id: 'vacancy_seniority', icon: BarChart2, component: VacancySenioritySettings, logName: 'vacancy_seniority_levels' },
      { id: 'vacancy_education', icon: BookOpen, component: VacancyEducationSettings, logName: 'vacancy_education_levels' },
      { id: 'vacancy_channels', icon: Store, component: VacancyChannelSettings, logName: 'vacancy_channels' },
      // Vacancy custom fields moved to the shared "Eigen velden" group below.
      { id: 'vacancy_app_defaults', icon: ClipboardList, component: VacancyApplicationDefaultsSettings },
      { id: 'vacancy_matching', icon: Sparkles, component: VacancyMatchingSettings },
      // Kandidaten zoeken-tab visibility + filter defaults (Danny 23-07): mirrors
      // candidate_vacancy_tab — see VacancyCandidateTabSettings + candidateTabVisibility.ts.
      { id: 'vacancy_candidate_tab', icon: Users, component: VacancyCandidateTabSettings },
      // Matchprofielen (MATCH-TEMPLATE-1) — reusable named weight presets the vacancy
      // Matching tab's picker reads (read-only there); managed here.
      { id: 'match_templates', icon: SlidersHorizontal, component: MatchTemplatesSettings },
      { id: 'vacancy_display', icon: Palette, schema: vacancyDisplay },
      // CATALOG-EMBED-1: the catalogue's "windows" section, vacancies group.
      { id: 'vacancy_windows', icon: Clock, render: () => <CatalogSection section="windows" group="vacancies" /> },
    ],
  },
  {
    // Task (activity) lookups — own top-level menu, one sub-tab per list (decision §3B).
    key: 'tasks', icon: ListChecks,
    items: [
      { id: 'task_statuses', icon: ListChecks, component: TaskStatusSettings, logName: 'task_statuses' },
      { id: 'task_types', icon: Tags, component: TaskTypeSettings, logName: 'task_types' },
      { id: 'task_priorities', icon: Flag, component: TaskPrioritySettings, logName: 'task_priorities' },
      { id: 'task_display', icon: Palette, schema: taskDisplay },
      // CATALOG-EMBED-1: the catalogue's "windows" section, tasks group.
      { id: 'task_windows', icon: Clock, render: () => <CatalogSection section="windows" group="tasks" /> },
    ],
  },
  {
    // Match lookups — statuses for the Matches feature (R-1; BE /match-statuses).
    key: 'matches', icon: Sparkles,
    items: [
      { id: 'match_statuses', icon: Tags, component: MatchStatusSettings, logName: 'match_statuses' },
      { id: 'contract_types', icon: FileText, component: ContractTypesSettings, logName: 'contract_types' },
      // Match stop reasons (audit finding, 04-08) — MatchStopReasonSettings was fully
      // built + tested in MatchSettings.jsx but never wired into the registry, so the
      // mandatory reason recorded on POST /matches/{id}/terminate (MATCH-TERMINATE-1)
      // had no settings screen at all.
      { id: 'match_stop_reasons', icon: XCircle, component: MatchStopReasonSettings, logName: 'match_stop_reasons' },
      // Appointment types/locations moved OUT to their own top-level `appointments`
      // group below (Danny 2026-08-04) — appointments span every entity, not just
      // matches, mirrors note_types/document_types.
      // Purchase→sale conversion factor (Danny 22-07) — moved here from Vacancies →
      // Matching: it's a match rate concept, not a per-vacancy one.
      { id: 'match_rates', icon: Percent, component: MatchRatesSettings },
      // TARIEF-ZIJDE-1 (Danny 15-08): which side of the money the CONTRACTREGELS
      // rate line means — sale (open) or purchase (gated behind matches.financial.view).
      { id: 'match_contract_line_rate_side', icon: EyeOff, component: MatchContractLineRateSideSettings },
      { id: 'match_display', icon: Palette, schema: matchDisplay },
      // CATALOG-EMBED-1: the catalogue's "windows" section, matches group.
      { id: 'match_windows', icon: Clock, render: () => <CatalogSection section="windows" group="matches" /> },
    ],
  },
  {
    // Outreach (call-list / bellijsten) lookups (R-1; BE /outreach-statuses).
    key: 'outreach', icon: Phone,
    items: [
      { id: 'outreach_statuses', icon: Tags, component: OutreachStatusSettings, logName: 'outreach_statuses' },
      // Outreach outcomes (OUTREACH-2, round-4 audit finding #6) — the RESULT of one
      // call attempt, a separate dimension from the pipeline status above.
      // OutreachOutcomeSettings was fully built + tested (OutreachOutcomeSettings.test.jsx)
      // but never registered here, so the /outreach-outcomes lookup had no editor at all.
      { id: 'outreach_outcomes', icon: CheckCircle, component: OutreachOutcomeSettings, logName: 'outreach_outcomes' },
      // Escalation reason lookup (audit finding ESCALATION-REASON-1) — call-list
      // escalation had no tenant-managed reason vocabulary.
      { id: 'escalation_reasons', icon: AlertTriangle, component: EscalationReasonsSettings, logName: 'escalation_reasons' },
      { id: 'outreach_display', icon: Palette, schema: outreachDisplay },
    ],
  },
]
