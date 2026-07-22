/**
 * WorkflowFolderSidebar — the left folder-navigation column: "All workflows" /
 * "Unassigned" + the tenant's folders, each a drag-and-drop target for moving
 * a workflow between folders. Extracted from WorkflowsPage (§3A thin-container
 * split) — purely presentational, all data/mutations come from useWorkflowsData.
 */
import { useState } from 'react'
import type { ReactNode, DragEvent, MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { Zap, Folder, FolderPlus, Trash2 } from 'lucide-react'
import type { WorkflowFolder, FolderId } from './hooks/useWorkflowsData'

// One row in the folder sidebar (built-in "All"/"Unassigned" or a tenant folder).
function SidebarRow({ label, icon, active, isDragOver, onClick, onDragOver, onDragLeave, onDrop, onDelete }: {
  label?: ReactNode; icon?: ReactNode; active?: boolean; isDragOver?: boolean
  onClick?: () => void; onDragOver?: (e: DragEvent) => void; onDragLeave?: () => void; onDrop?: () => void; onDelete?: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div {...interactive(onClick)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        cursor: 'pointer', borderRadius: 6, margin: '1px 6px',
        background: isDragOver ? 'var(--color-secondary-bg)' : active ? 'var(--color-primary-bg)' : hover ? 'var(--hover-bg)' : 'transparent',
        border: isDragOver ? '1.5px dashed var(--color-secondary)' : '1.5px solid transparent',
        color: active ? 'var(--color-primary)' : 'var(--text)',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ color: isDragOver ? 'var(--color-secondary)' : active ? 'var(--color-primary)' : 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, flex: 1, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {onDelete && hover && (
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 2, display: 'flex', flexShrink: 0 }}>
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

// Props: folder data + navigation/drag state from useWorkflowsData, passed through as-is.
interface WorkflowFolderSidebarProps {
  folders: WorkflowFolder[]
  canManageFolders: boolean
  selectedFolder: FolderId
  setSelectedFolder: (id: FolderId) => void
  dragOverFolder: FolderId
  setDragOverFolder: (id: FolderId) => void
  dragWf: MutableRefObject<string | number | null>
  createFolder: (name: string) => void
  deleteFolder: (folder: WorkflowFolder) => void
  moveToFolder: (workflowId: string | number | null, folderId: FolderId) => void
}

export default function WorkflowFolderSidebar({
  folders, canManageFolders, selectedFolder, setSelectedFolder,
  dragOverFolder, setDragOverFolder, dragWf, createFolder, deleteFolder, moveToFolder,
}: WorkflowFolderSidebarProps) {
  const { t } = useTranslation(['workflows', 'common'])
  return (
    <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('page.folders')}</span>
        {canManageFolders && (
          <button onClick={() => {
            const name = prompt(t('page.folderNamePrompt'))
            if (name?.trim()) createFolder(name.trim())
          }} title={t('page.newFolder')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
            <FolderPlus size={15} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[
          { id: null,          label: t('page.allWorkflows'),  icon: <Zap size={13} /> },
          { id: 'unassigned',  label: t('page.unassigned'), icon: <Folder size={13} /> },
        ].map(item => (
          <SidebarRow key={String(item.id)} label={item.label} icon={item.icon}
            active={selectedFolder === item.id}
            isDragOver={dragOverFolder === item.id}
            onClick={() => setSelectedFolder(item.id)}
            onDragOver={e => { e.preventDefault(); setDragOverFolder(item.id) }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={() => { moveToFolder(dragWf.current, item.id === 'unassigned' ? null : item.id); setDragOverFolder(null) }}
          />
        ))}
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 12px' }} />
        {[...folders].sort((a, b) => a.name.localeCompare(b.name, 'nl')).map(f => (
          <SidebarRow key={f.id} label={f.name} icon={<Folder size={13} />}
            active={selectedFolder === f.id}
            isDragOver={dragOverFolder === f.id}
            onClick={() => setSelectedFolder(f.id)}
            onDragOver={e => { e.preventDefault(); setDragOverFolder(f.id) }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={() => { moveToFolder(dragWf.current, f.id); setDragOverFolder(null) }}
            onDelete={canManageFolders ? () => deleteFolder(f) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
