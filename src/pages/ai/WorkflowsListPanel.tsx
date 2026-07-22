/**
 * WorkflowsListPanel — the main content column: toolbar (add / count / archived
 * toggle / grid-list toggle) plus the loading/error/grid/list rendering of the
 * visible workflows. Extracted from WorkflowsPage (§3A thin-container split) —
 * purely presentational, all data/mutations come from useWorkflowsData /
 * useWorkflowsFilters.
 */
import type { MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Loader2, LayoutGrid, List, Archive } from 'lucide-react'
import WorkflowCard from './WorkflowCard'
import WorkflowListRow from './WorkflowListRow'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import type { Workflow } from '@/types/workflow'
import type { WorkflowFolder, FolderId } from './hooks/useWorkflowsData'
import type { ViewMode } from './hooks/useWorkflowsFilters'

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
  setShowArchived: (fn: (v: boolean) => boolean) => void
  selectedFolder: FolderId
  dragWf: MutableRefObject<string | number | null>
  openEditor: (wf: Workflow, runId?: string | number | null) => void
  handleRun: (id?: string | number) => void | Promise<void>
  handleToggleStatus: (wf: Workflow) => void
}

export default function WorkflowsListPanel({
  loading, error, retryLoad, visibleWorkflows, folders, viewMode, setViewMode,
  showArchived, setShowArchived, selectedFolder, dragWf, openEditor, handleRun, handleToggleStatus,
}: WorkflowsListPanelProps) {
  const { t } = useTranslation(['workflows', 'common'])
  return (
    <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
      {/* Toolbar — add on the LEFT, count + archived + view toggle on the RIGHT (mirror Kansen). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => openEditor({ name: t('page.newWorkflow'), trigger: 'Dagelijks 08:00', status: 'draft', last_run: null, steps: [], folder_id: selectedFolder === 'unassigned' ? null : (selectedFolder ?? null) })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'white', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          <Plus size={14} /> {t('page.newWorkflow')}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Visible count */}
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('page.countWorkflows', { n: visibleWorkflows.length })}</span>

          {/* Archived (soft-deleted) view — shared quick-view toggle (§4), never hand-rolled. */}
          <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
            label={t('page.archived')} title={t('page.archivedView')} icon={Archive} />

          {/* View mode toggle — icon-pair, persisted (list is the Make.com-style default) */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {([{ mode: 'list', Icon: List, label: t('page.viewList') }, { mode: 'grid', Icon: LayoutGrid, label: t('page.viewGrid') }] as const).map(({ mode, Icon, label }) => (
              <button key={mode} onClick={() => setViewMode(mode)} title={label} aria-label={label} aria-pressed={viewMode === mode}
                style={{ padding: '6px 10px', background: viewMode === mode ? 'var(--color-primary-bg)' : 'var(--surface)', color: viewMode === mode ? 'var(--color-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> {t('page.loading')}
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-danger)', fontSize: 13, padding: '24px 0' }}>
          <span>{t('page.error')}</span>
          <button onClick={retryLoad} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '4px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: 12 }}>{t('common:error.retry')}</button>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {visibleWorkflows.map(wf => (
            <div key={wf.id} draggable
              onDragStart={() => { dragWf.current = wf.id ?? null }}
              onDragEnd={() => { dragWf.current = null }}
              style={{ cursor: 'grab' }}
            >
              <WorkflowCard workflow={wf} onRun={handleRun} onEdit={() => openEditor(wf)} />
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
                folderName={folders.find(f => f.id === wf.folder_id)?.name}
                onRun={handleRun}
                onEdit={() => openEditor(wf)}
                onToggleStatus={() => handleToggleStatus(wf)}
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
