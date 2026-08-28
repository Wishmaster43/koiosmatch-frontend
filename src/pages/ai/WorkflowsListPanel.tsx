/**
 * WorkflowsListPanel — the main content column: toolbar (add / count / archived
 * toggle / grid-list toggle) plus the loading/error/grid/list rendering of the
 * visible workflows. Extracted from WorkflowsPage (§3A thin-container split) —
 * purely presentational, all data/mutations come from useWorkflowsData /
 * useWorkflowsFilters.
 */
import { useState, type MutableRefObject } from 'react'
import ViewModeToggle from '@/components/ui/ViewModeToggle'
import { useTranslation } from 'react-i18next'
import { Plus, LayoutGrid, List, Archive, Trash2 } from 'lucide-react'
import WorkflowCard from './WorkflowCard'
import WorkflowListRow from './WorkflowListRow'
import WorkflowQueueView from './WorkflowQueueView'
import AIManagementView from './AIManagementView'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import Spinner from '@/components/ui/Spinner'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { Workflow } from '@/types/workflow'
import type { WorkflowFolder, FolderId } from './hooks/useWorkflowsData'
import type { ViewMode } from './hooks/useWorkflowsFilters'
import Button from '@/components/ui/Button'

// Props: everything needed to render the toolbar + the visible workflow list.
interface WorkflowsListPanelProps {
  loading: boolean
  error: boolean
  retryLoad: () => void
  visibleWorkflows: Workflow[]
  folders: WorkflowFolder[]
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  showArchived: boolean
  // Exclusive lifecycle toggles (TRASH-OVERAL-2) — the page owns the exclusivity.
  onToggleArchived: () => void
  showTrash: boolean
  onToggleTrash: () => void
  selectedFolder: FolderId
  dragWf: MutableRefObject<string | number | null>
  openEditor: (wf: Workflow, runId?: string | number | null) => void
  handleRun: (id?: string | number) => void | Promise<void>
  handleToggleStatus: (wf: Workflow) => void
  canManageFolders: boolean
  handleArchive: (wf: Workflow) => void
  handleRestore: (wf: Workflow) => void | Promise<void>
  // TRASH-OVERAL-2: mark (workflows.delete) / unmark (settings.update) — absent =
  // no permission, so the row/card buttons don't render (§7 no fake affordances).
  onMarkDeletion?: (wf: Workflow) => void
  onUnmark?: (wf: Workflow) => void | Promise<void>
  // Tenant grace window — feeds the rows' pending-erase note (DD-MM-YYYY).
  graceDays?: number | null
}

// Toolbar plus the loading/error/grid/list render of the visible workflows; purely presentational, all data/mutations arrive as props (see file header).
export default function WorkflowsListPanel({
  loading, error, retryLoad, visibleWorkflows, folders, viewMode, setViewMode,
  showArchived, onToggleArchived, showTrash, onToggleTrash, selectedFolder, dragWf, openEditor, handleRun, handleToggleStatus,
  canManageFolders, handleArchive, handleRestore, onMarkDeletion, onUnmark, graceDays = null,
}: WorkflowsListPanelProps) {
  const { t } = useTranslation(['workflows', 'common'])
  // WF-WACHTRIJ-FE-1: the page's own list⇄queue switch — mirrors the app-wide
  // SegmentedControl view switch (ReportSwitchBar's "compact + activeOnly"
  // idiom), since this page had no existing tab bar to reuse.
  const [mainView, setMainView] = useState<'list' | 'queue' | 'beheer'>('list')
  // LOOKUP-I18N-1: resolve + translate a workflow's folder for the row's meta line —
  // a seeded folder name renders in the user language, a tenant rename stays as typed.
  const seedLabel = useSeedLabel()
  const folderLabel = (folderId: Workflow['folder_id']): string | undefined => {
    const folder = folders.find(f => f.id === folderId)
    return folder ? seedLabel('workflowFolders', { label: folder.name }) : undefined
  }
  return (
    <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
      {/* Toolbar — add on the LEFT, count + archived + view toggle on the RIGHT (mirror Kansen). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Button variant="primary"
          onClick={() => openEditor({ name: t('page.newWorkflow'), trigger: 'Dagelijks 08:00', status: 'draft', last_run: null, steps: [], folder_id: selectedFolder === 'unassigned' ? null : (selectedFolder ?? null) })}
        >
          <Plus size={14} /> {t('page.newWorkflow')}
        </Button>

        <SegmentedControl size="compact" activeOnly ariaLabel={t('queue.switchLabel')}
          value={mainView} onChange={v => setMainView(v as 'list' | 'queue' | 'beheer')}
          options={[
            { value: 'list', label: t('page.viewWorkflows') },
            { value: 'queue', label: t('queue.tabLabel') },
            // r2: the AI-management family (agents/prompts/FAQ/tools/flows,
            // incl. the FLOW-EDITOR Danny GO'd) rendered NOWHERE — this view
            // is its home; placement itself is Danny-reviewable (WORKLIST).
            { value: 'beheer', label: t('page.viewManagement') },
          ]} />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {mainView === 'list' && (<>
            {/* Visible count */}
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('page.countWorkflows', { n: visibleWorkflows.length })}</span>

            {/* Archived (soft-deleted) view — shared quick-view toggle (§4), never
                hand-rolled; exclusive with the trash view (TRASH-OVERAL-2). */}
            <QuickViewToggle active={showArchived} onToggle={onToggleArchived}
              label={t('page.archived')} title={t('page.archivedView')} icon={Archive} />
            {/* Prullenbak (pending erase) — same shared toggle, candidates' trash colour. */}
            <QuickViewToggle active={showTrash} onToggle={onToggleTrash}
              label={t('common:trash.view')} color="var(--color-trash)" icon={Trash2} />

            {/* View mode toggle — THE shared icon-only switcher (§4: never a
                hand-rolled pair); list is the Make.com-style default. */}
            <ViewModeToggle value={viewMode} onChange={setViewMode} options={[
              { id: 'list', icon: List, label: t('page.viewList') },
              { id: 'grid', icon: LayoutGrid, label: t('page.viewGrid') },
            ]} />
          </>)}
        </div>
      </div>

      {mainView === 'beheer' ? (
        <AIManagementView />
      ) : mainView === 'queue' ? (
        <WorkflowQueueView />
      ) : loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <Spinner size={14} /> {t('page.loading')}
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-danger-text)', fontSize: 13, padding: '24px 0' }}>
          <span>{t('page.error')}</span>
          <Button variant="secondary" onClick={retryLoad}>{t('common:error.retry')}</Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {visibleWorkflows.map(wf => (
            <div key={wf.id} draggable
              onDragStart={() => { dragWf.current = wf.id ?? null }}
              onDragEnd={() => { dragWf.current = null }}
              style={{ cursor: 'grab' }}
            >
              <WorkflowCard workflow={wf} onRun={handleRun} onEdit={() => openEditor(wf)}
                canManageFolders={canManageFolders}
                onArchive={() => handleArchive(wf)}
                onRestore={() => handleRestore(wf)}
                onMarkDeletion={onMarkDeletion ? () => onMarkDeletion(wf) : undefined}
                onUnmark={onUnmark ? () => onUnmark(wf) : undefined}
                graceDays={graceDays}
              />
            </div>
          ))}
          {visibleWorkflows.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              {t('page.empty')}
            </div>
          )}
        </div>
      ) : (
        /* Make.com-style list — one row per workflow, no column chrome (R-3/AW-list). */
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {visibleWorkflows.map(wf => (
            <div key={wf.id} draggable
              onDragStart={() => { dragWf.current = wf.id ?? null }}
              onDragEnd={() => { dragWf.current = null }}>
              <WorkflowListRow workflow={wf}
                folderName={folderLabel(wf.folder_id)}
                onRun={handleRun}
                onEdit={() => openEditor(wf)}
                onToggleStatus={() => handleToggleStatus(wf)}
                canManageFolders={canManageFolders}
                onArchive={() => handleArchive(wf)}
                onRestore={() => handleRestore(wf)}
                onMarkDeletion={onMarkDeletion ? () => onMarkDeletion(wf) : undefined}
                onUnmark={onUnmark ? () => onUnmark(wf) : undefined}
                graceDays={graceDays}
              />
            </div>
          ))}
          {visibleWorkflows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              {t('page.empty')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
