// The one cell style of the required-fields matrix (table body + the callers' header cells);
// lives beside the component so the component file exports components only (react-refresh).
import type { CSSProperties } from 'react'

export const REQUIRED_FIELDS_CELL: CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'center' }
