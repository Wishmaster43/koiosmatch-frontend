/**
 * endpointInputStyle — shared input styling for endpoint rows (webhooks + others).
 * Extracted to avoid duplication in WorkflowEndpointsCard.
 */

// Input styling shared by existing and new endpoint rows.
export const endpointInputStyle = (error?: boolean, isSaving?: boolean): React.CSSProperties => ({
  fontSize: 13,
  padding: '6px 8px',
  border: `1px solid ${error ? 'var(--color-danger)' : 'var(--border)'}`,
  borderRadius: 6,
  fontFamily: 'monospace',
  color: error ? 'var(--color-danger-text)' : 'var(--text)',
  backgroundColor: error ? 'var(--color-danger-bg)' : 'var(--bg)',
  cursor: isSaving ? 'not-allowed' : 'auto',
})
