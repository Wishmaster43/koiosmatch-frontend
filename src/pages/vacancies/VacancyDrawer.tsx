import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Edit2, Save, X } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import GeocodeButton from '@/components/ui/GeocodeButton'
import { channelIcon } from './data/channelIcons'
import VacancyChangelogPopover from './drawer/VacancyChangelogPopover'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { isCandidateTabVisible } from './lib/candidateTabVisibility'
import type { CandidateTabConfig } from './lib/candidateTabVisibility'
import { useDateFormat } from '@/lib/datetime'
import DetailsTab from './drawer/DetailsTab'
import DescriptionTab from './drawer/DescriptionTab'
import ApplicantsTab from './drawer/ApplicantsTab'
import VacancyAgentTab from './drawer/VacancyAgentTab'
import PublishingTab from './drawer/PublishingTab'
import DocumentsTab from './drawer/DocumentsTab'
import TimelineTab from './drawer/TimelineTab'
import NotesTab from './drawer/NotesTab'
import StatisticsTab from './drawer/StatisticsTab'
import MatchingTab from './drawer/MatchingTab'
import CandidateSearchTab from './drawer/CandidateSearchTab'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useVacancyCustomFields } from '@/lib/useVacancyCustomFields'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void
interface DrawerUser { id: Id; name: string }

// Tab list — config only; each renders one small component (one per tab/section).
// Details is the FIRST tab (Danny 2026-07-04 — reverses R-7's pinned-above-the-tabs
// layout: "Details moet gewoon eerste tabje zijn", the pinned editor crowded the drawer).
const TABS: { id: string; tKey: string; autoExpand?: boolean; render: (v: VacancyDetail, onUpdate?: UpdateFn) => ReactNode }[] = [
  { id: 'details',    tKey: 'details',    render: (v, onUpdate) => <DetailsTab vacancy={v} onUpdate={onUpdate} /> },
  // Beschrijving — its OWN main tab now (Danny 21-07: moved out of Details' sub-tabs,
  // right after Details so the vacancy text still reads next to the field grid).
  { id: 'description', tKey: 'description', render: (v, onUpdate) => <DescriptionTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'applicants', tKey: 'applicants', render: v => <ApplicantsTab vacancy={v} /> },
  { id: 'matching',   tKey: 'matching',   render: (v, onUpdate) => <MatchingTab vacancy={v} onUpdate={onUpdate} /> },
  // Match-zoeker fase 1 (vacancy side, Danny 23-07): candidates matching this
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
  // Tijdlijn TAB (intended: real lifecycle activity — created/status changes/
  // applications received) is distinct BY DESIGN from the changelog ICON in the
  // title row (raw field-change audit, VacancyChangelogPopover) — §3A(d): tab =
  // activiteit, icon = veldwijzigingen. Currently a calm empty state: the backend
  // hardcodes `timeline: []` (no aggregator like ApplicationTimeline exists yet for
  // vacancies) — BE follow-up, not a reason to remove this tab.
  { id: 'timeline',   tKey: 'timeline',   render: v => <TimelineTab vacancy={v} /> },
  { id: 'notes',      tKey: 'notes',      render: v => <NotesTab vacancy={v} /> },
  { id: 'statistics', tKey: 'statistics', render: v => <StatisticsTab vacancy={v} /> },
]

interface VacancyDrawerProps {
  vacancy: VacancyDetail | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: UpdateFn
  // VAC-RESTORE-1: page passes this only with vacancies.update permission.
  onRestore?: (id: Id | undefined) => void
  users?: DrawerUser[]
  // VACANCY-MATCH-COUNT-1 (Danny 23-07): deep-link from the table's Leads count —
  // open straight on this tab id (mirrors CustomerDrawer's initialTab). Falls back
  // to the default tab below if the requested tab is gated away for this vacancy.
  initialTab?: string
}

const hdrBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0 }
const hdrGhost: CSSProperties = { ...hdrBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
const hdrPrimary: CSSProperties = { ...hdrBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }

/**
 * VacancyDrawer — thin container: wires data (lookups + onUpdate) and declares the
 * header config + tab list. No heavy JSX, no business logic (mirror CandidateDrawer).
 */
export default function VacancyDrawer({ vacancy: v, onClose, expanded, onToggleExpand, onUpdate, onRestore, users = [], initialTab }: VacancyDrawerProps) {
  const { t } = useTranslation('vacancies')
  const { statuses } = useVacancyLookups()
  const { formatDate, formatDateTime } = useDateFormat()
  // The Extra tab only shows when the tenant has defined vacancy custom fields.
  const { fields: customFieldDefs } = useVacancyCustomFields()
  // Kandidaten zoeken-tab visibility gate (Danny 23-07): tenant-configurable per
  // vacancy status via Settings → Vacatures → Kandidaten zoeken-tabblad (mirrors
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(v.created) })}</span>
          <span />
        </div>
      }
      tabs={visibleTabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), autoExpand: tab.autoExpand, render: () => tab.render(v, onUpdate) }))}
      header={({ setActiveTab }) => (
        <>
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: (v.clientName?.[0] ?? v.title?.[0] ?? '?').toUpperCase(), soft: true }}
          renderTitle={() => editingTitle ? (
            // V7: inline title edit — mirror OpportunityDrawer's renderTitle swap.
            <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitleEdit(); if (e.key === 'Escape') setEditingTitle(false) }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 15, fontWeight: 700,
                borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text)' }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{v.title}</span>
                {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
                <ReferenceNumberChip value={v.referenceNumber} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.clientName || '—'}</div>
            </>
          )}
          // Changelog icon (§3A(d)) — GET /vacancies/{id}/activity exists (measured:
          // routes/api/tenant/candidates.php), so this is the missing icon-popover, not a tab.
          titleActions={<>
            <VacancyChangelogPopover vacancy={v} />
            {/* GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" — queued + async, never
                claims "done" (see GeocodeButton). No bulk variant for vacancies (BE
                spec). Disabled when there's no address at all yet. */}
            <GeocodeButton endpoint={`/vacancies/${v.id}/geocode`} permission="vacancies.update"
              disabled={!v.city && !v.street && !v.postalCode && !v.location} />
          </>}
          // V7: title pencil → save/cancel, same spot as the changelog icon's row.
          actions={editingTitle ? (
            <>
              <button onClick={saveTitleEdit} title={t('common:save')} style={hdrPrimary}><Save size={14} /></button>
              <button onClick={() => setEditingTitle(false)} title={t('common:cancel')} style={hdrGhost}><X size={14} /></button>
            </>
          ) : (
            <button onClick={startTitleEdit} title={t('common:edit')} style={hdrGhost}><Edit2 size={13} /></button>
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
          {v.archived && (
            <ArchivedBanner id={v.id} onRestore={onRestore}
              message={v.archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(v.archivedAt) }) : t('drawer.archivedBanner.flag')}
              restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
          {/* V2: published indicator — per-channel icons for the channels this vacancy
              is ACTUALLY published on (icon + label, colour never the only signal);
              falls back to the generic globe + "not published" when none are. Click a
              channel to jump straight to the Publiceren tab. */}
          {publishedChannels.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {publishedChannels.map(c => {
                const Icon = channelIcon(c.icon, c.key)
                return (
                  <button key={String(c.value)} type="button" onClick={() => setActiveTab('publishing')}
                    title={t('drawer.publishedOnChannel', { channel: c.label })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
                      padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                      background: 'var(--color-success-bg, color-mix(in srgb, var(--color-success) 12%, transparent))',
                      color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)' }}>
                    <Icon size={12} /> {c.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <button type="button" onClick={() => setActiveTab('publishing')}
              style={{ fontSize: 11, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>
              <Globe size={13} />
              {t('drawer.notPublished')}
            </button>
          )}
        </EntityHeader>
        </>
      )}
    />
  )
}
