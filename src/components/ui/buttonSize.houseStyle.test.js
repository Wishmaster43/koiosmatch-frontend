/**
 * buttonSize ratchet (herhaal-audit r5, MAAT-1/2): Button's size="md" is the
 * page-toolbar "+ Nieuw" exception ONLY — drawers/settings ride the sm default,
 * and a raw-button→Button migration never carries its old 34px along (that is
 * exactly how two drawer/settings buttons regressed to md). An eslint selector
 * was tried first and reverted: written disables in nine legacy page files
 * dragged their whole pre-existing warning debt into the staged gate. This
 * frozen, shrink-only allowlist guards the same invariant without touching
 * those files. Runs in pre-commit beside the typography ratchet.
 *
 * Plain .js — the walker needs node:fs/node:path (no @types/node in this repo).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC_ROOT = 'src'
const SKIP = new Set(['node_modules', 'dist'])

function walkSourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { walkSourceFiles(full, out); continue }
    if (/\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

// The NINE legitimate page-toolbar "+ Nieuw" sites (maatwet: md beside the 34px
// search chrome) — frozen; a file may only DROP OFF this list, never grow.
const MD_ALLOWLIST = {
  'src/pages/applications/ApplicationsPage.tsx': 1,
  'src/pages/candidates/CandidatesToolbar.tsx': 1,
  'src/pages/customers/CustomersPage.tsx': 1,
  'src/pages/matches/MatchesPage.tsx': 1,
  'src/pages/opportunities/OpportunitiesPage.tsx': 1,
  'src/pages/outreach/OutreachPage.tsx': 1,
  'src/pages/tasks/TasksPage.tsx': 1,
  'src/pages/users/UsersPage.tsx': 1,
  'src/pages/vacancies/VacanciesToolbar.tsx': 1,
  // Doc mention, not a render: buttonMetrics' own docblock NAMES size="md" while
  // defining BTN_H (the simple text count cannot tell prose from JSX).
  'src/config/buttonMetrics.ts': 1,
  // r8 MV-1 fix: the mobile settings category row — the search button pairs with
  // the FIELD_HEIGHT (34) picker beside it, the documented search-chrome case.
  'src/pages/settings/SettingsPage.jsx': 1,
}

describe('Button size ratchet (maatwet)', () => {
  it('size="md" appears only at the frozen page-toolbar sites, never more', () => {
    const offenders = []
    for (const file of walkSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8')
      const count = (content.match(/size="md"/g) ?? []).length
      if (count === 0) continue
      const allowed = MD_ALLOWLIST[file.replace(/\\/g, '/')] ?? 0
      if (count > allowed) offenders.push(`${file}: ${count} × size="md" (toegestaan: ${allowed})`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

// Second ratchet (r7 barrier 2): raw <button> heights OFF the 28/34 standard —
// the only gate that ever sees a bespoke 26/30/32. Frozen from the live tree
// (structural glyphs, mini-toggles and a few true drifts); shrink-only: a file
// may only lower or drop off, and a NEW off-standard height fails anywhere.
const OFF_STANDARD_HEIGHT_ALLOWLIST = {
  'src/components/ai/KoiosAdviceBlock.tsx': 1,
  'src/components/drawer/DrawerAddButton.tsx': 1,
  'src/components/drawer/tabs/NotesTab.tsx': 1,
  'src/components/forms/EditableFieldTable.tsx': 1,
  'src/components/insights/InsightsRow.tsx': 1,
  'src/components/layout/DashboardLayout.tsx': 3,
  'src/components/layout/KoiosPanel.tsx': 1,
  'src/components/layout/NotificationBell.tsx': 1,
  'src/components/layout/workflow/canvas.tsx': 4,
  'src/components/layout/workflow/fields.tsx': 1,
  'src/components/layout/workflow/ScheduleFields.tsx': 1,
  'src/components/layout/workflow/VariablePicker.tsx': 1,
  'src/components/layout/workflow/WorkflowEditorHeader.tsx': 1,
  'src/components/match/MatchScoreBlock.tsx': 2,
  'src/components/ui/ActionMenu.tsx': 1,
  'src/components/ui/CollapsibleRichText.tsx': 2,
  'src/components/ui/DataTableRow.tsx': 1,
  'src/components/ui/FloatingPanel.tsx': 1,
  'src/components/ui/QuickViewToggle.tsx': 1,
  'src/components/ui/RichTextEditor.tsx': 2,
  'src/components/ui/SelectAllRow.tsx': 1,
  'src/components/ui/Toggle.tsx': 1,
  'src/pages/ai/WorkflowListRow.tsx': 3,
  'src/pages/applications/drawer/ApplicationStatusStrip.tsx': 2,
  'src/pages/applications/drawer/propose/ProposalsBlock.tsx': 1,
  'src/pages/applications/drawer/propose/ProposeCandidateModal.tsx': 1,
  'src/pages/candidates/addmodal/CvEntryIcons.tsx': 1,
  'src/pages/candidates/drawer/ChangelogTab.tsx': 1,
  'src/pages/candidates/drawer/match/FinancialSection.tsx': 1,
  'src/pages/candidates/drawer/PlanningFavorites.tsx': 1,
  'src/pages/candidates/drawer/WorkTab.tsx': 2,
  'src/pages/customers/drawer/CustomerApplicationsList.tsx': 1,
  'src/pages/customers/drawer/OpportunitiesTab.tsx': 2,
  'src/pages/customers/drawer/ScopedVacanciesTab.tsx': 1,
  'src/pages/customers/drawer/VacanciesTab.tsx': 1,
  'src/pages/customers/drawer/VacancySettingsTab.tsx': 1,
  'src/pages/planning/AddShiftModal.tsx': 1,
  'src/pages/settings/components/SettingsControls.jsx': 2,
  'src/pages/settings/sections/actionrules/ActionRuleCell.tsx': 1,
  'src/pages/settings/sections/CvTemplateSettings.jsx': 1,
  'src/pages/settings/sections/DashboardsSettings.tsx': 1,
  'src/pages/settings/sections/IconPickerControl.jsx': 2,
  'src/pages/settings/sections/RoleDetail.tsx': 1,
  'src/pages/settings/sections/RolesSettings.tsx': 1,
  'src/pages/shiftmanager/CustomersInsightsRow.tsx': 1,
  'src/pages/tasks/addmodal/LinkCard.tsx': 1,
  'src/pages/tasks/drawer/LinksTab.tsx': 1,
  'src/pages/users/UserRolesModal.tsx': 1,
  'src/pages/users/usersParts.tsx': 2,
  'src/pages/users/UsersTable.tsx': 2,
  'src/pages/vacancies/drawer/AppointmentsTab.tsx': 2,
}

describe('raw <button> height ratchet (maatwet)', () => {
  it('off-standard heights never grow beyond the frozen allowlist', () => {
    const offenders = []
    for (const file of walkSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8')
      let count = 0
      for (const m of content.matchAll(/<button[\s\S]{0,400}?height:\s*(\d+)/g)) {
        const h = Number(m[1])
        if (h !== 28 && h !== 34) count++
      }
      if (count === 0) continue
      const allowed = OFF_STANDARD_HEIGHT_ALLOWLIST[file.replace(/\\/g, '/')] ?? 0
      if (count > allowed) offenders.push(`${file}: ${count} off-standard raw-button heights (toegestaan: ${allowed})`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

// Third ratchet (r8 MV-1): Button's OWN height overridden through the style prop
// — outside every selector (they only see raw <button> tags). Zero tolerance:
// there is no legitimate reason to restyle Button's size through style; the size
// comes from `size=`. The scanner walks the OPENING tag only (brace-depth aware,
// so an onClick arrow or a following sibling never false-positives the window).
function buttonOpeningTags(content) {
  const tags = []
  let i = content.indexOf('<Button')
  while (i !== -1) {
    // Skip <ButtonX…> lookalikes: next char must be whitespace, '>' or '/'.
    const after = content[i + 7]
    if (after && !/[\s/>]/.test(after)) { i = content.indexOf('<Button', i + 1); continue }
    let depth = 0
    let j = i
    for (; j < content.length; j++) {
      const ch = content[j]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
    }
    tags.push(content.slice(i, j))
    i = content.indexOf('<Button', j)
  }
  return tags
}

describe('Button height-through-style ratchet (maatwet)', () => {
  it('no <Button> opening tag carries a height in its style prop', () => {
    const offenders = []
    for (const file of walkSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8')
      if (!content.includes('<Button')) continue
      for (const tag of buttonOpeningTags(content)) {
        if (/height:\s*[\dF]/.test(tag)) offenders.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 120)}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
