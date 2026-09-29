import type { CSSProperties } from 'react'

// The AI-management editor pane's chrome (AI-SETTINGS-FACE-1): shared by SideList's right pane
// and single-pane screens such as Memory. Lives outside shared.tsx so that file keeps exporting
// components only (react-refresh).
export const editorPaneStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, overflowY: 'auto', background: 'var(--surface)' }
