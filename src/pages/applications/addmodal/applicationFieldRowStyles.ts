// applicationFieldRowStyles — the one label-left row layout every picker/field in the
// applications add-modal family shares (CLONE-BY-CONSTRUCTION-1). Lives apart from
// ApplicationFieldRow so that component file exports components only (react-refresh).
import type { CSSProperties } from 'react'

// Label left, control right, one gap — the canon field row.
export const fieldRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
// The control column takes the remaining width and may shrink below its content.
export const fieldControl: CSSProperties = { flex: 1, minWidth: 0 }
