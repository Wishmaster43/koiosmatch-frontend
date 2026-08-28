/**
 * VacancyDrawer — thin container (§3A blueprint): wires data (lookups +
 * onUpdate), declares the tab config (TABS below) and the header. See the
 * component docblock further down for the header's own decisions.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Edit2, Save, X } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import DetachedCountBadge from '@/components/ui/DetachedCountBadge'
import PdokCard from '@/components/drawer/PdokCard'
import { channelIcon } from './data/channelIcons'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './drawer/ChangelogTab'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import TrashLifecycleSection from '@/components/drawer/TrashLifecycleSection'
import type { TrashSectionConfig } from '@/components/drawer/TrashLifecycleSection'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { isCandidateTabVisible } from './lib/candidateTabVisibility'
import type { CandidateTabConfig } from './lib/candidateTabVisibility'
import { useDateFormat } from '@/lib/datetime'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'
import DetailsTab from './drawer/DetailsTab'
import DescriptionTab from './drawer/DescriptionTab'
import ApplicantsTab from './drawer/ApplicantsTab'
import AppointmentsTab from './drawer/AppointmentsTab'
import VacancyAgentTab from './drawer/VacancyAgentTab'
import PublishingTab from './drawer/PublishingTab'
import DocumentsTab from './drawer/DocumentsTab'
import TimelineTab from './drawer/TimelineTab'
import NotesTab from './drawer/NotesTab'
import VacancyTasksTab from './drawer/VacancyTasksTab'
import StatisticsTab from './drawer/StatisticsTab'
import MatchesTab from './drawer/MatchesTab'
import MatchingTab from './drawer/MatchingTab'
import CandidateSearchTab from './drawer/CandidateSearchTab'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useVacancyCustomFields } from '@/lib/useVacancyCustomFields'
import Button from '@/components/ui/Button'
// HUISSTIJL-1: the footer's 11px/muted meta line is the shared Caption atom.
import { Caption, PageTitle } from '@/components/ui/typography'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void
interface DrawerUser { id: Id; name: string }

// Tab list — config only; each renders one small component (one per tab/section).
// Details is the FIRST tab (Danny 2026-07-04 — reverses R-7's pinned-above-the-tabs
// layout: "Details moet gewoon eerste tabje zijn" — "Details should simply be the
// first tab", the pinned editor crowded the drawer).
// V-stats-1: render optionally receives the drawer's own setActiveTab so a tab
// (Statistics) can deep-link into a sibling tab without route hacks.
const TABS: { id: string; tKey: string; autoExpand?: boolean; render: (v: VacancyDetail, onUpdate?: UpdateFn, setActiveTab?: (id: string) => void) => ReactNode }[] = [
  { id: 'details',    tKey: 'details',    render: (v, onUpdate) => <DetailsTab vacancy={v} onUpdate={onUpdate} /> },
  // Beschrijving ("Description") — its OWN main tab now (Danny 21-07: moved out
  // of Details' sub-tabs,
  // right after Details so the vacancy text still reads next to the field grid).
  { id: 'description', tKey: 'description', render: (v, onUpdate) => <DescriptionTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'applicants', tKey: 'applicants', render: v => <ApplicantsTab vacancy={v} /> },
  // AFSPRAKEN-VACATURE-1: every appointment tied to this vacancy across ALL
  // candidates (GET /vacancies/{id}/appointments, permission:vacancies.view —
  // the route CMBE delivered 14-08). Read-only, right after Sollicitanten
  // ("Applicants") since
  // both surface candidate activity on this vacancy.
  { id: 'appointments', tKey: 'appointments', render: v => <AppointmentsTab vacancy={v} /> },
  { id: 'matching',   tKey: 'matching',   render: (v, onUpdate) => <MatchingTab vacancy={v} onUpdate={onUpdate} /> },
  // V-table-2: read-only Matches tab (mirrors the candidate/customer drawer's
  // own read-only MatchesTab anatomy) — the table's Matches count deep-links here.
  { id: 'matches',    tKey: 'matches',    render: v => <MatchesTab vacancyId={v.id} /> },
  // Match-zoeker fase 1 ("Match finder phase 1") (vacancy side, Danny 23-07): candidates matching this
  // vacancy's radius/function/status filters, map + list side by side.
  // autoExpand (Danny 23-07): the map+list layout is unusable in the narrow
  // drawer width, so this tab widens the drawer while active and restores on leave.
  { id: 'candidateSearch', tKey: 'candidateSearch', autoExpand: true, render: v => <CandidateSearchTab vacancy={v} /> },
  // VAC-AGENT-1 (Danny 21-07): its own tab — the agent picker + the read-only
  // interview flow that agent carries; placed right after matching (both feed the
  // application flow) and before publishing.
  { id: 'aiagent',    tKey: 'aiagent',    render: (v, onUpdate) => <VacancyAgentTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'publishing', tKey: 'publishing', render: (v, onUpdate) => <PublishingTab vacancy={v} onUpdate={onUpdate} /> },
  // Audit R1 item 1: the tenant custom-fields tab now goes through the ONE shared
  // CustomFieldsTab (§3A(f)) — the old bespoke ExtraTab (own fetch + a bare
  // <textarea> for textarea-type fields) is deleted; this hands entityType +
  // the vacancy's own customFieldValues map + a save callback that merges into
  // the existing customFieldValues patch path (buildVacancyPatch → custom_fields).
  { id: 'extra',      tKey: 'extra',      render: (v, onUpdate) => <CustomFieldsTab entityType="vacancy" values={v.customFieldValues ?? {}}
      onSave={patch => onUpdate?.(v.id, { customFieldValues: { ...(v.customFieldValues ?? {}), ...patch } })} /> },
  { id: 'documents',  tKey: 'documents',  render: v => <DocumentsTab vacancy={v} /> },
  // Tijdlijn ("Timeline") TAB (real lifecycle activity — created/status
  // changes/applications
  // received) is distinct BY DESIGN from the changelog ICON in the title row (raw
  { id: 'notes',      tKey: 'notes',      render: v => <NotesTab vacancy={v} /> },
  // V-tasks-1: mirrors the candidate drawer's own Taken ("Tasks") tab, via the shared
  // EntityTasksTab shell (see VacancyTasksTab's own header for why).
  { id: 'tasks',      tKey: 'tasks',      render: v => <VacancyTasksTab vacancy={v} /> },
  // Koppelingen ("Links") (Danny 28-07): PDOK left the title row, so the vacancy
  // gets the same
  // tab as every other entity. Vacancies are NOT in the backoffice sync registry
  // (no HelloFlex/Shiftmanager token), so this tab holds the geocoding card only —
  // showing empty link cards would suggest a coupling that does not exist.
  { id: 'koppelingen', tKey: 'backofficeLinks', render: v => (
    <PdokCard lat={v.lat} lng={v.lng} endpoint={`/vacancies/${v.id}/geocode`} permission="vacancies.update"
      disabled={!v.city && !v.street && !v.postalCode && !v.location} />
  ) },
  // TIJDLIJN-OVERAL (27-08): timeline sits SECOND-TO-LAST, Statistics stays last —
  // the canon order on every drilldown.
  // field-change audit, the shared ChangelogPopover) — §3A(d): tab = activiteit
  // ("activity"),
  // icon = veldwijzigingen ("field changes"). Live: VacancyDetailResource::timelineFor() feeds note/
  // application/match record events with link targets plus created/published/
  // updated lifecycle moments, newest-first.
  { id: 'timeline',   tKey: 'timeline',   render: v => <TimelineTab vacancy={v} /> },
  // Statistieken ("Statistics") last (Danny 28-07) — a read-only summary, not a
  // working tab.
  // V-stats-1: setActiveTab forwarded so the tab's own counts deep-link into
  // their source tab (Leads → Kandidaten zoeken ("Search candidates"),
  // Sollicitaties ("Applications") → applicants,
  // published channels → Publiceren ("Publishing")) instead of a route hack.
  { id: 'statistics', tKey: 'statistics', render: (v, _onUpdate, setActiveTab) => <StatisticsTab vacancy={v} onNavigateTab={setActiveTab} /> },
]

interface VacancyDrawerProps {
  vacancy: VacancyDetail | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: UpdateFn
  // VAC-RESTORE-1: page passes this only with vacancies.update permission.
  onRestore?: (id: Id | undefined) => void
  // TRASH-OVERAL-2: the shared trash-section wiring (mark/unmark, see TrashLifecycleSection).
  trash?: TrashSectionConfig
  users?: DrawerUser[]
  // VACANCY-MATCH-COUNT-1 (Danny 23-07): deep-link from the table's Leads count —
  // open straight on this tab id (mirrors CustomerDrawer's initialTab). Falls back
  // to the default tab below if the requested tab is gated away for this vacancy.
  initialTab?: string
}

/**
 * VacancyDrawer — thin container: wires data (lookups + onUpdate) and declares the
 * header config + tab list. No heavy JSX, no business logic (mirror CandidateDrawer).
 */
export default function VacancyDrawer({ vacancy: v, onClose, expanded, onToggleExpand, onUpdate, onRestore, trash, users = [], initialTab }: VacancyDrawerProps) {
  const { t } = useTranslation('vacancies')
  const { statuses } = useVacancyLookups()
  const { formatDate, formatDateTime } = useDateFormat()
  // The Extra tab only shows when the tenant has defined vacancy custom fields.
  const { fields: customFieldDefs } = useVacancyCustomFields()
  // Kandidaten zoeken ("Search candidates") tab visibility gate (Danny 23-07):
  // tenant-configurable per
  // vacancy status via Settings → Vacatures → Kandidaten zoeken-tabblad ("Vacancies
  // → Search candidates tab") (mirrors
  // the candidate side's candidate_vacancy_tab / vacancyTabVisibility.ts).
  const settingsValues = useAllSettings()
  const candidateTabCfg = getJsonSetting<CandidateTabConfig | null>(settingsValues, 'vacancy_candidate_tab', null)

  // Tags are edited inline; seed from the record and reset when a different
  // vacancy is shown (adjust state during render — React's recommended pattern).
  const [tags, setTags] = useState<string[] | null>(null)
  // V7: inline title edit — mirror OpportunityDrawer's pencil → input → save/cancel.
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [prevId, setPrevId] = useState<Id | undefined>(v?.id)
  if (v?.id !== prevId) { setPrevId(v?.id); setTags(null); setEditingTitle(false); setTitleDraft('') }

  // Inline-edit-cancel layer: the title input cancels edit mode on Escape.
  useEscapeLayer(editingTitle, () => setEditingTitle(false))

  if (!v) return null

  // Extra tab needs ≥1 tenant custom field; Kandidaten zoeken needs this vacancy's
  // status allowed by the tenant-configured gate (default = every status, always visible).
  const visibleTabs = TABS
    .filter(tab => tab.id !== 'extra' || customFieldDefs.length > 0)
    .filter(tab => tab.id !== 'candidateSearch' || isCandidateTabVisible(candidateTabCfg, { status: v.statusValue != null ? String(v.statusValue) : null }, statuses))

  // VACANCY-MATCH-COUNT-1: only honour the requested deep-link tab when it's
  // actually visible for this vacancy — a gated-away tab (e.g. candidateSearch
  // hidden by the status gate) falls back to EntityDrawer's own default (first tab),
  // never a blank pane.
  const safeInitialTab = initialTab && visibleTabs.some(tab => tab.id === initialTab) ? initialTab : undefined

  const currentTags = tags ?? (v.tags as string[]) ?? []
  const setTagsAndSave = (next: string[]) => { setTags(next); onUpdate?.(v.id, { tags: next }) }

  const startTitleEdit = () => { setTitleDraft(v.title); setEditingTitle(true) }
  const saveTitleEdit  = () => { const val = titleDraft.trim(); if (val && val !== v.title) onUpdate?.(v.id, { title: val }); setEditingTitle(false) }

  // V2: the channels this vacancy is actually published on (icon + label), read
  // from the publishing data the drawer already has (v.channels, PublishingTab's
  // own data source) — never a re-fetch.
  const publishedChannels = (v.channels ?? []).filter(c => c.published)

  // Owner picker — include the current owner so it shows even if not in `users`.
  const ownerOptions = [
    ...(users.some(u => String(u.id) === String(v.owner?.id)) || !v.owner?.name ? [] : [{ value: v.owner.id, label: v.owner.name }]),
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  return (
    <EntityDrawer
      entity={v}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      initialTab={safeInitialTab}
      // Two-sided footer (§3A(8)): created-at left, empty right (consistent spacing
      // with the candidate/other drawers even when there is no right-side content).
      footer={
        <Caption as="div" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(v.created) })}</span>
          <span />
        </Caption>
      }
      // Koppelingen reads the SHARED common:backofficeLinks.tabLabel key (§3A/§11) so
      // every entity's tab shows the exact same word.
      tabs={visibleTabs.map(tab => ({
        id: tab.id,
        // VAC-TEKST-TAB-1 (Danny 14-08 point 10): the Description tab is renamed
        // "Vacaturetekst" — reuses the EXISTING details.description key (already
        // "Vacancy text"/"Vacaturetekst" in all five locales, the popout's own
        // subtitle) instead of drawer.tabs.description, so no new locale edits.
        label: tab.id === 'koppelingen' ? t('common:backofficeLinks.tabLabel')
          : tab.id === 'description' ? t('details.description')
          : t(`drawer.tabs.${tab.tKey}`),
        // V-stats-1: EntityDrawer hands each tab its own setActiveTab — forward it
        // so Statistics can deep-link into a sibling tab without a route hack.
        autoExpand: tab.autoExpand, render: (setActiveTab?: (id: string) => void) => tab.render(v, onUpdate, setActiveTab),
      }))}
      header={({ setActiveTab }) => (
        <>
        <EntityHeader
          // TITEL-CHIP-1 (Danny 19-08): the title slot shows WHERE this vacancy is
          // published (the §4 success token pair per live channel) — or the calm
          // not-published affordance; both jump to the Publiceren ("Publishing") tab.
          label={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {publishedChannels.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {/* HUISSTIJL-1: left hand-styled — the §4 "aan/gelukt" success TOKEN
                  PAIR (--color-success-bg fill + full --color-success border) is a
                  deliberate exception to the soft-tint recipe, never a Button variant. */}
              {publishedChannels.map(c => {
                const Icon = channelIcon(c.icon, c.key)
                return (
                  <button key={String(c.value)} type="button" onClick={() => setActiveTab('publishing')}
                    title={t('drawer.publishedOnChannel', { channel: c.label })}
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- deliberate §4 "aan/gelukt" success token pair, not a Button variant (see comment above)
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
                      padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                      background: 'var(--color-success-bg)',
                      color: 'var(--color-on-success-bg)', border: '1px solid var(--color-success)' }}>
                    <Icon size={12} /> {c.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('publishing')} style={{ marginBottom: 12 }}>
              <Globe size={13} />
              {t('drawer.notPublished')}
            </Button>
          )}
          </span>}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: (v.clientName?.[0] ?? v.title?.[0] ?? '?').toUpperCase(), soft: true }}
          renderTitle={() => editingTitle ? (
            // V7: inline title edit — mirror OpportunityDrawer's renderTitle swap.
            <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitleEdit() }}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- an <input> matching the title's own size while editing, not a PageTitle render
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 15, fontWeight: 700,
                borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text)' }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <PageTitle as="span" style={{ fontWeight: 700 }}>{v.title}</PageTitle>
                {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
                <ReferenceNumberChip value={v.referenceNumber} />
                {/* ONTKOPPEL-TELLER-1: whole-history CURRENTLY-detached count, warning-only (hidden at 0). */}
                <DetachedCountBadge count={v.detachedCount} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.clientName || '—'}</div>
            </>
          )}
          // Changelog icon (§3A(d)) — GET /vacancies/{id}/activity exists (measured:
          // routes/api/tenant/candidates.php). Danny 27-07: now the shared house
          // ChangelogPopover shell, same as every other entity.
          titleActions={<>
            <ChangelogPopover><ChangelogTab vacancy={v} bare /></ChangelogPopover>
          </>}
          // V7: title pencil → save/cancel, same spot as the changelog icon's row.
          actions={editingTitle ? (
            <>
              <Button variant="primary" iconOnly size="sm" onClick={saveTitleEdit} title={t('common:save')} aria-label={t('common:save')}><Save size={14} /></Button>
              <Button variant="secondary" iconOnly size="sm" onClick={() => setEditingTitle(false)} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={14} /></Button>
            </>
          ) : (
            <Button variant="secondary" iconOnly size="sm" onClick={startTitleEdit} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>
          )}
          // Standard picker widths (§3A blueprint: Status ~160 + Eigenaar ~190).
          meta={[
            { key: 'status', label: t('drawer.status'), value: v.statusValue,
              options: statuses.map(s => ({ value: s.value, label: s.label })),
              onChange: val => onUpdate?.(v.id, { statusValue: val }), menuWidth: 170, width: 160 },
            // Client moved to the Details tab (P3: calm header — max status + owner,
            // mirror the candidate blueprint §3A(c)); the subtitle still shows it.
            { key: 'owner', label: t('drawer.owner'), value: v.owner?.id,
              options: ownerOptions, onChange: val => onUpdate?.(v.id, { ownerId: val }), menuWidth: 200, width: 190 },
          ]}
          tags={{ items: currentTags, onAdd: tag => setTagsAndSave([...currentTags, tag]),
            onRemove: tag => setTagsAndSave(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Archived banner (audit R1 item 8) — mirrors the application/candidate
              drawer's in-body archived state; the table already shows the soft chip,
              the drawer previously had no equivalent. Now the ONE shared
              components/drawer/ArchivedBanner (§3A — extend, never duplicate); the
              since-when/flag i18n keys are unchanged (drawer.archivedBanner.*, vacancies ns). */}
          {/* TRASH-OVERAL-2: hidden once the record sits in the trash — the trash
              banner (TrashLifecycleSection) takes over with unmark instead. */}
          {v.archived && v.lifecycle !== 'pending_erase' && (
            <ArchivedBanner id={v.id} onRestore={onRestore}
              message={v.archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(v.archivedAt) }) : t('drawer.archivedBanner.flag')}
              restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
          {/* TRASH-OVERAL-2: the shared mark/unmark surface (permission-gated in `trash`). */}
          {trash && (
            <TrashLifecycleSection entityPath="vacancies" id={v.id} entityLabel={v.title}
              lifecycle={v.lifecycle} pendingEraseAt={v.pendingEraseAt} {...trash} />
          )}
                  </EntityHeader>
        </>
      )}
    />
  )
}
