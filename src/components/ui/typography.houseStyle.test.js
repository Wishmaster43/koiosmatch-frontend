/**
 * typography.houseStyle.test.js — frozen house-style scan (HUISSTIJL slotaudit
 * T6/T7). Two inline-style patterns duplicate typography atoms this codebase
 * already has (SectionTitle = 13/600, Caption = 11/var(--text-muted)), but their
 * raw sizes are ALSO legitimate elsewhere (13px is ordinary body text, 11px shows
 * up on plenty of non-muted labels) — an eslint AST selector can't be scoped
 * tightly enough on size alone (that is exactly why T1/T3/T4/T5's fontSize:15
 * selector works and this one doesn't: 15px has no other legitimate use, 13/11px
 * do). A text scan with a FROZEN, SHRINK-ONLY allowlist is the guard instead:
 * today's count per file is the ceiling — a new file joining the list, or an
 * existing file's count rising, fails the test; a file migrated to the shared
 * atom drops out of (or shrinks in) the allowlist below. The allowlist is
 * MEASURED, not aspirational — it is exactly today's state (2026-08-20, after
 * fixing LogsPanel.tsx/T6 and EntityListDrawer.tsx/T7), so this test is green
 * on write and turns red the moment new drift is added anywhere in the tree.
 *
 * Plain .js (not .ts, checkJs is off project-wide): the walker needs `node:fs`/
 * `node:path`, and this repo has no @types/node dependency — adding one for a
 * single test file was out of this task's scope, so the scan logic stays JS.
 *
 * src/components/ui/** carries a HARDER rule for the SectionTitle pattern only:
 * the house typography map itself must contain ZERO hand-styled copies of its
 * own atom (typography.tsx excepted — it is SectionTitle's own canonical
 * definition, not a copy of it). That zero is achievable today without touching
 * anything outside this audit's named findings. The Caption pattern still rides
 * the shrink-only allowlist even inside components/ui/** — eight pre-existing
 * files there carry it (EntityNameCell, ErrorBoundary, EventTimeline,
 * ReferenceNumberChip, RichTextAssistBar, Slider, the two richtext/Assist*
 * cards), none of them named in this audit's 20 findings — a silent
 * zero-tolerance flip there would quietly expand this task's scope to files
 * nobody asked to fix. EntityListDrawer.tsx WAS finding #20 (its footer's
 * raw Caption-shaped span) and is now converted to <Caption>, dropped from
 * the allowlist below rather than carried forward as debt. The remaining
 * eight are a deliberate, documented follow-up, not an unannounced sweep.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Resolve from the repo root (vitest's cwd), not import.meta.url — vitest's
// module transform does not always hand back a plain file:// URL here.
const SRC_ROOT = join(process.cwd(), 'src')

// Walk src/**/*.{tsx,jsx}, excluding test files and the careersite subtree
// (a separate app with its own review cadence, out of this scan's scope).
function walkSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'careersite' || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) { walkSourceFiles(full, out); continue }
    if (/\.(tsx|jsx)$/.test(entry) && !/\.test\.(tsx|jsx)$/.test(entry)) out.push(full)
  }
  return out
}

// Both property orderings count as the same drift — a dev may type either.
const SECTION_TITLE_PATTERN = /fontSize:\s*13,\s*fontWeight:\s*600|fontWeight:\s*600,\s*fontSize:\s*13/g
const CAPTION_PATTERN = /fontSize:\s*11,\s*color:\s*['"]var\(--text-muted\)['"]|color:\s*['"]var\(--text-muted\)['"],\s*fontSize:\s*11/g

// Occurrence count per file (path relative to src/), for one pattern.
function countByFile(pattern) {
  const out = {}
  for (const file of walkSourceFiles(SRC_ROOT)) {
    const content = readFileSync(file, 'utf8')
    const matches = content.match(pattern)
    if (matches?.length) {
      out[relative(SRC_ROOT, file).split(sep).join('/')] = matches.length
    }
  }
  return out
}

// Frozen SectionTitle (13px/600) allowlist — measured 2026-08-20. Shrink-only.
const SECTION_TITLE_ALLOWLIST = {
  'components/auth/MfaSetupWizard.tsx': 1,
  'components/charts/LineChartCard.tsx': 1,
  'components/drawer/DocPreviewModal.tsx': 1,
  'components/drawer/EntityHeader.tsx': 1,
  'components/layout/NotificationBell.tsx': 1,
  'components/layout/Sidebar.jsx': 1,
  'components/layout/workflow/ConfigPanel.tsx': 1,
  'components/layout/workflow/ScheduleModal.tsx': 1,
  'components/match/MatchScoreBlock.tsx': 4,
  'components/reports/CandidateDetailDrawer.tsx': 1,
  'components/reports/CustomerDetailDrawer.tsx': 1,
  'components/shiftmanager/ShiftsDrillDownDrawer.tsx': 1,
  'components/shiftmanager/ShiftsDrillDownTotals.tsx': 1,
  // typography.tsx is SectionTitle's own canonical 13/600 DEFINITION, not a copy.
  'components/ui/typography.tsx': 1,
  'pages/ai/WorkflowTemplateLibrary.tsx': 1,
  'pages/applications/ApplicationsBoard.tsx': 1,
  'pages/applications/ApplicationsBulkBar.tsx': 1,
  'pages/applications/PhaseChangeAppointmentWarning.tsx': 1,
  'pages/applications/drawer/ApplicationHeaderTitle.tsx': 3,
  'pages/applications/drawer/RejectionSummary.tsx': 2,
  'pages/auth/ProfileDetailsTab.tsx': 1,
  'pages/auth/ProfileEmailConnect.tsx': 2,
  'pages/auth/profileParts.tsx': 1,
  'pages/candidates/CandidatesBulkBar.tsx': 1,
  'pages/candidates/addmodal/ModalFooter.tsx': 1,
  'pages/candidates/drawer/CandidateHeaderBits.tsx': 3,
  'pages/candidates/drawer/VacancySearchTab.tsx': 2,
  'pages/customers/AddContactPersonModal.tsx': 1,
  'pages/customers/AddDepartmentModal.tsx': 1,
  'pages/customers/AddLocationModal.tsx': 1,
  'pages/customers/CustomersBulkBar.tsx': 1,
  'pages/dashboard/DashboardPrimitives.tsx': 1,
  'pages/dashboard/KoiosForYouCard.tsx': 1,
  'pages/dashboard/blocks/AttentionCandidates.tsx': 1,
  'pages/dashboard/blocks/FunnelConversion.tsx': 1,
  'pages/dashboard/blocks/ShiftsSummary.tsx': 1,
  'pages/dashboard/blocks/TouchpointsFeed.tsx': 1,
  'pages/matches/MatchesBoard.tsx': 2,
  'pages/matches/MatchesBulkBar.tsx': 1,
  'pages/opportunities/AddOpportunityModal.tsx': 1,
  'pages/opportunities/OpportunitiesBoard.tsx': 1,
  'pages/outreach/OutreachBoard.tsx': 1,
  'pages/outreach/OutreachBulkBar.tsx': 1,
  'pages/planning/AddOrderModal.tsx': 1,
  'pages/planning/AddShiftModal.tsx': 1,
  'pages/planning/OrdersPanel.tsx': 2,
  'pages/planning/views.tsx': 1,
  'pages/reports/FlowReport.tsx': 1,
  'pages/reports/ReportChartWithDrillList.tsx': 1,
  'pages/settings/sections/AppsSettings.jsx': 1,
  'pages/settings/sections/CandidateLookupItemModal.jsx': 1,
  'pages/settings/sections/EmailSettings.jsx': 1,
  'pages/settings/sections/ProposalSettings.jsx': 1,
  'pages/settings/sections/WhatsAppSettings.jsx': 2,
  'pages/settings/sections/actionrules/ActionRuleDetailPanel.tsx': 1,
  'pages/settings/sections/apikeys/ApiKeyGeneralTab.jsx': 1,
  'pages/settings/sections/jobs/QueueOverviewTab.jsx': 1,
  'pages/settings/sections/koios/KoiosPricingCard.jsx': 1,
  'pages/settings/sections/koios/KoiosStatusCard.jsx': 1,
  'pages/settings/sections/webhooks/IncomingWebhooks.jsx': 1,
  'pages/shiftmanager/ContactDrawer.tsx': 2,
  'pages/shiftmanager/DepartmentDrawer.tsx': 4,
  'pages/shiftmanager/LocationDrawer.tsx': 2,
  'pages/shiftmanager/ShiftAnalysisPage.tsx': 1,
  'pages/tasks/AddTaskModal.tsx': 1,
  'pages/tasks/TasksBoard.tsx': 2,
  'pages/tasks/TasksBulkBar.tsx': 1,
  'pages/vacancies/AddVacancyModal.tsx': 1,
  'pages/vacancies/VacanciesBulkBar.tsx': 1,
  'pages/vacancies/drawer/CandidateSearchTab.tsx': 2,
  'pages/whatsapp/QueueTab.tsx': 2,
  'pages/whatsapp/components.tsx': 3,
}

// Frozen Caption (11px/text-muted) allowlist — measured 2026-08-20. Shrink-only.
const CAPTION_ALLOWLIST = {
  'components/ai/AIManagementTabs.tsx': 1,
  'components/ai/management/AgentForm.tsx': 2,
  'components/ai/management/InterviewFlowSection.tsx': 1,
  'components/ai/management/shared.tsx': 1,
  'components/auth/MfaSetupWizard.tsx': 1,
  'components/charts/BarChartCard.tsx': 1,
  'components/charts/MiniDonut.tsx': 1,
  'components/drawer/ConversationAssistSection.tsx': 1,
  'components/drawer/ConversationsSection.tsx': 3,
  'components/drawer/DocPreviewModal.tsx': 1,
  'components/drawer/DrawerFilterMenu.tsx': 2,
  'components/drawer/EntityChangelog.tsx': 1,
  'components/drawer/EntityHeader.tsx': 1,
  'components/drawer/PdokCard.tsx': 2,
  'components/drawer/TemplateComposer.tsx': 4,
  'components/drawer/backofficeLinkCards.tsx': 2,
  'components/drawer/tabs/EntityTasksTab.tsx': 1,
  'components/drawer/tabs/NotesTab.tsx': 2,
  'components/drawer/tabs/StatsTab.tsx': 1,
  'components/drawer/tabs/notes/NoteAssistSection.tsx': 1,
  'components/drawer/tabs/notes/NoteFields.tsx': 2,
  'components/import/EntityImportCard.tsx': 1,
  'components/layout/NotificationBell.tsx': 1,
  'components/layout/koios/KoiosMentionMenu.tsx': 2,
  'components/layout/koios/KoiosSteps.tsx': 1,
  'components/layout/workflow/AgentTestPanel.tsx': 1,
  'components/layout/workflow/ConfigPanel.tsx': 5,
  'components/layout/workflow/LogsPanel.tsx': 3,
  'components/layout/workflow/ScheduleFields.tsx': 2,
  'components/layout/workflow/ScheduleModal.tsx': 3,
  'components/layout/workflow/StepOutputSlice.tsx': 3,
  'components/layout/workflow/VariablePicker.tsx': 1,
  'components/layout/workflow/WhatsappTemplateField.tsx': 2,
  'components/layout/workflow/WorkflowHistoryView.tsx': 1,
  'components/layout/workflow/fieldControls.tsx': 1,
  'components/map/RadiusMapPanel.tsx': 1,
  'components/match/MatchScoreBlock.tsx': 1,
  'components/reports/CandidateDetailDrawer.tsx': 3,
  'components/reports/ContactPersonsTable.tsx': 1,
  'components/reports/CustomerDetailDrawer.tsx': 2,
  'components/reports/KpiDrillDownDrawer.tsx': 5,
  'components/reports/LocationDrawer.tsx': 2,
  'components/reports/MessagesTable.tsx': 2,
  'components/reports/RunDetailDrawer.tsx': 1,
  'components/reports/RunStepList.tsx': 4,
  'components/reports/RunsTable.tsx': 1,
  'components/reports/filter/PeriodGroup.tsx': 1,
  'components/reports/filter/SearchSelectGroup.tsx': 2,
  'components/shiftmanager/OrderDetailDrawer.tsx': 2,
  'components/shiftmanager/OrdersTable.tsx': 3,
  'components/shiftmanager/ShiftsChartsBlock.tsx': 2,
  'components/shiftmanager/ShiftsDrillDownDrawer.tsx': 2,
  // Pre-existing components/ui/** debt (HUISSTIJL slotaudit T7 closing note): not
  // named in this audit's 20 findings — a deliberate, documented follow-up, not a
  // silent scope expansion. See the file-header comment above. EntityListDrawer.tsx
  // WAS finding #20 and is fixed, so it no longer carries an entry here.
  'components/ui/EntityNameCell.tsx': 1,
  'components/ui/ErrorBoundary.tsx': 1,
  'components/ui/EventTimeline.tsx': 1,
  'components/ui/ReferenceNumberChip.tsx': 1,
  'components/ui/RichTextAssistBar.tsx': 1,
  'components/ui/Slider.tsx': 3,
  'components/ui/richtext/AssistActionItemCard.tsx': 1,
  'components/ui/richtext/AssistActionsResultsPanel.tsx': 1,
  'pages/ai/WorkflowTemplateLibrary.tsx': 1,
  'pages/applications/ApplicationsTable.tsx': 1,
  'pages/applications/drawer/ApplicationStatusStrip.tsx': 1,
  'pages/applications/drawer/DetachReasonModal.tsx': 1,
  'pages/applications/drawer/cvproposal/CvProposalDiffTable.tsx': 1,
  'pages/applications/drawer/propose/ProposeCandidateModal.tsx': 1,
  'pages/auth/ProfileDisplayTab.tsx': 1,
  'pages/candidates/addmodal/BranchesCard.tsx': 1,
  'pages/candidates/addmodal/CvEntryIcons.tsx': 1,
  'pages/candidates/addmodal/CvUploadCard.tsx': 6,
  'pages/candidates/addmodal/DuplicateNotice.tsx': 1,
  'pages/candidates/addmodal/PasteCvCard.tsx': 2,
  'pages/candidates/drawer/ApplicationRow.tsx': 2,
  'pages/candidates/drawer/AvailabilityEditor.tsx': 2,
  'pages/candidates/drawer/CandidateTasks.tsx': 2,
  'pages/candidates/drawer/ChangelogTab.tsx': 3,
  'pages/candidates/drawer/CommunicationTab.tsx': 3,
  'pages/candidates/drawer/DetachApplicationModal.tsx': 1,
  'pages/candidates/drawer/DocumentRow.tsx': 1,
  'pages/candidates/drawer/IntegrationsTab.tsx': 4,
  'pages/candidates/drawer/ReferencesTab.tsx': 1,
  'pages/candidates/drawer/SectionTabs.tsx': 1,
  'pages/candidates/drawer/VacancySearchTab.tsx': 4,
  'pages/customers/MergeCustomerModal.tsx': 2,
  'pages/customers/addmodal/CustomerBranchesCard.tsx': 1,
  'pages/customers/drawer/MergeContactModal.tsx': 1,
  'pages/customers/drawer/MergeSubEntityModal.tsx': 1,
  'pages/customers/drawer/PriceAgreementsTab.tsx': 1,
  'pages/dashboard/Dashboard.tsx': 1,
  'pages/dashboard/DashboardPrimitives.tsx': 1,
  'pages/dashboard/KoiosForYouCard.tsx': 2,
  'pages/dashboard/blocks/ActivityListsRow.tsx': 6,
  'pages/dashboard/blocks/AttentionCandidates.tsx': 1,
  'pages/dashboard/blocks/RecentListsRow.tsx': 4,
  'pages/dashboard/blocks/ShiftsSummary.tsx': 2,
  'pages/dashboard/blocks/TouchpointsFeed.tsx': 2,
  'pages/dashboard/blocks/WidgetListBlock.tsx': 2,
  'pages/import/steps/MapColumnsStep.tsx': 2,
  'pages/import/steps/UploadStep.tsx': 1,
  'pages/matches/MatchDrawer.tsx': 2,
  'pages/matches/MatchesBoard.tsx': 2,
  'pages/matches/drawer/ChangelogTab.tsx': 1,
  'pages/matches/drawer/MatchApprovalActions.tsx': 1,
  'pages/matches/drawer/MatchContractSection.tsx': 1,
  'pages/matches/drawer/MatchDurationBar.tsx': 1,
  'pages/matches/drawer/MatchRemarksBlock.tsx': 1,
  'pages/matches/drawer/OverviewTab.tsx': 2,
  'pages/matches/drawer/RenewMatchModal.tsx': 1,
  'pages/matches/drawer/TerminateMatchModal.tsx': 3,
  'pages/opportunities/OpportunitiesBoard.tsx': 3,
  'pages/opportunities/OpportunityDrawer.tsx': 2,
  'pages/opportunities/drawer/ChangelogTab.tsx': 1,
  'pages/opportunities/drawer/CustomerRelationTab.tsx': 1,
  'pages/outreach/OutreachBoard.tsx': 3,
  'pages/outreach/OutreachCreate.tsx': 1,
  'pages/outreach/OutreachDrawer.tsx': 1,
  'pages/outreach/drawer/ChangelogTab.tsx': 1,
  'pages/outreach/drawer/TargetNoteField.tsx': 1,
  'pages/outreach/drawer/TargetsTab.tsx': 3,
  'pages/planning/AddShiftModal.tsx': 1,
  'pages/planning/OrdersPanel.tsx': 2,
  'pages/planning/ShiftStaffingDrawer.tsx': 4,
  'pages/planning/views.tsx': 4,
  'pages/popout/PopoutShell.tsx': 1,
  'pages/reports/FlowReport.tsx': 1,
  'pages/reports/ReportChartWithDrillList.tsx': 2,
  'pages/settings/components/LookupChipSelect.jsx': 1,
  'pages/settings/components/SettingsSearch.tsx': 1,
  'pages/settings/sections/AuditDrawer.jsx': 1,
  'pages/settings/sections/AuditLogTable.jsx': 1,
  'pages/settings/sections/CandidateLookupsSettings.jsx': 1,
  'pages/settings/sections/CustomFieldsSettings.jsx': 2,
  'pages/settings/sections/CvTemplateSettings.jsx': 1,
  'pages/settings/sections/MatchTemplatesSettings.jsx': 2,
  'pages/settings/sections/ProposalSettings.jsx': 1,
  'pages/settings/sections/ReportKpiSettings.tsx': 1,
  'pages/settings/sections/RoleBranchTemplate.tsx': 2,
  'pages/settings/sections/TenantUsageSettings.jsx': 1,
  'pages/settings/sections/VacancyCandidateTabSettings.jsx': 3,
  'pages/settings/sections/VacancyGenerationProfileEditor.jsx': 1,
  'pages/settings/sections/apikeys/ApiKeyCreate.jsx': 1,
  'pages/settings/sections/apikeys/ApiKeyGeneralTab.jsx': 1,
  'pages/settings/sections/customers/IdentifierValidationSettings.tsx': 1,
  'pages/settings/sections/cvTemplate/CvSectionList.jsx': 1,
  'pages/settings/sections/importeren/ImportResultPanel.tsx': 1,
  'pages/settings/sections/importeren/UploadStep.tsx': 1,
  'pages/settings/sections/jobs/QueueOverviewTab.jsx': 1,
  'pages/settings/sections/jobs/RecentJobsTab.jsx': 1,
  'pages/settings/sections/locations/LocationFormModal.jsx': 1,
  'pages/settings/sections/usageCardStyles.jsx': 1,
  'pages/settings/sections/webhooks/EventCatalog.jsx': 3,
  'pages/settings/sections/webhooks/IncomingWebhooks.jsx': 1,
  'pages/settings/sections/whatsapp/WaConversationPanel.tsx': 1,
  'pages/shiftmanager/ContactDrawer.tsx': 4,
  'pages/shiftmanager/ContactsPage.tsx': 1,
  'pages/shiftmanager/ContactsTable.tsx': 1,
  'pages/shiftmanager/DepartmentDrawer.tsx': 3,
  'pages/shiftmanager/DepartmentsPage.tsx': 1,
  'pages/shiftmanager/LocationDrawer.tsx': 6,
  'pages/shiftmanager/LocationsPage.tsx': 1,
  'pages/shiftmanager/LocationsTable.tsx': 1,
  'pages/shiftmanager/ShiftMatrixTable.tsx': 1,
  'pages/shiftmanager/SmCandidatesTable.tsx': 2,
  'pages/tasks/TaskDrawer.tsx': 1,
  'pages/tasks/TasksBoard.tsx': 1,
  'pages/tasks/addmodal/LinkCard.tsx': 1,
  'pages/tasks/drawer/ActivityTab.tsx': 1,
  'pages/tasks/drawer/RelatedTasks.tsx': 1,
  'pages/tasks/drawer/SubtasksSection.tsx': 2,
  'pages/users/EditUserModal.tsx': 2,
  'pages/users/NewUserModal.tsx': 1,
  'pages/users/UserTransferDeleteModal.tsx': 1,
  'pages/vacancies/addmodal/AiAgentCard.tsx': 2,
  'pages/vacancies/addmodal/MatchProfileCard.tsx': 1,
  'pages/vacancies/drawer/CandidateSearchTab.tsx': 2,
  'pages/vacancies/drawer/ChangelogTab.tsx': 3,
  'pages/vacancies/drawer/MatchingTab.tsx': 2,
  'pages/vacancies/drawer/VacancyAgentTab.tsx': 4,
  'pages/whatsapp/QueueTab.tsx': 5,
  'pages/whatsapp/components.tsx': 3,
}

describe('typography house-style scan (frozen, shrink-only)', () => {
  it('SectionTitle (13/600) never grows beyond the frozen allowlist', () => {
    const actual = countByFile(SECTION_TITLE_PATTERN)
    for (const [file, count] of Object.entries(actual)) {
      const allowed = SECTION_TITLE_ALLOWLIST[file] ?? 0
      expect(count, `${file}: new/grown 13px+600 hit outside the frozen allowlist — use <SectionTitle as='…'> from components/ui/typography, or lower this file's allowlist entry if it genuinely shrank`)
        .toBeLessThanOrEqual(allowed)
    }
  })

  it("SectionTitle (13/600) is ZERO inside components/ui/** (its own atom's definition excepted)", () => {
    const actual = countByFile(SECTION_TITLE_PATTERN)
    for (const [file, count] of Object.entries(actual)) {
      if (!file.startsWith('components/ui/') || file === 'components/ui/typography.tsx') continue
      expect(count, `${file}: the house typography map itself must not hand-style SectionTitle's own 13/600 — use <SectionTitle as='…'>`)
        .toBe(0)
    }
  })

  it('Caption (11/text-muted) never grows beyond the frozen allowlist', () => {
    const actual = countByFile(CAPTION_PATTERN)
    for (const [file, count] of Object.entries(actual)) {
      const allowed = CAPTION_ALLOWLIST[file] ?? 0
      expect(count, `${file}: new/grown 11px+text-muted hit outside the frozen allowlist — use <Caption as='…'> from components/ui/typography, or lower this file's allowlist entry if it genuinely shrank`)
        .toBeLessThanOrEqual(allowed)
    }
  })
})
