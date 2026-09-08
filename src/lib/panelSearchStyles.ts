export const PANEL_SEARCH_WRAP = {
  // minWidth 0: a flex child's implicit min-width:auto would keep the input's ~170px
  // intrinsic width and push the add button off the 548px panel — search yields instead.
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  minWidth: 0,
  padding: '6px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
} as const

export const PANEL_SEARCH_INPUT = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  fontSize: 12,
  color: 'var(--text)',
} as const
