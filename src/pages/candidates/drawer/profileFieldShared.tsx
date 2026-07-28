/**
 * profileFieldShared — presentational atoms shared by the three Profile
 * sub-tabs (Personal / Address / Contact, Danny 28-07 split). Each sub-tab
 * owns its OWN field set + edit state (so one pencil never flips more than a
 * handful of fields, §3 size discipline) but they all render the same
 * label/value row shape and the same pencil→save/cancel control — kept here
 * once so the three tabs don't each hand-roll a slightly different copy.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'

// Shared input styling for text/date/combobox controls across all three tabs.
export const inputStyle: CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)',
  boxSizing: 'border-box', outline: 'none',
}

// Shared square icon-button sizing for the pencil/save/cancel controls.
export const iconBtn: CSSProperties = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, cursor: 'pointer',
}

const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

// Un-titled bordered card holding one sub-tab's field rows — no group title
// inside it (the SubTabBar's own active label already names the group, so a
// second in-content heading would just repeat it, mirroring the addendum-4
// convention already used by PreferencesZzpTabs).
export function GroupCard({ children }: { children: ReactNode }) {
  return <div style={{ ...blockStyle, padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
}

// One labelled field row: label-left (with optional required marker/icon),
// value-or-input right, optional error line below. Read vs. edit content is
// decided by the caller (children), since what renders differs per field type.
export function FieldRow({ label, required, errorText, labelIcon, children }: {
  label: ReactNode; required?: boolean; errorText?: ReactNode; labelIcon?: ReactNode; children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        {labelIcon}
        {label}{required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
        {errorText && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{errorText}</div>}
      </div>
    </div>
  )
}

// Pencil → save/cancel toggle, identical look across all three sub-tabs.
export function EditControls({ editing, onSave, onCancel, onStart }: {
  editing: boolean; onSave: () => void; onCancel: () => void; onStart: () => void
}) {
  const { t } = useTranslation('candidates')
  if (!editing) return (
    <button onClick={onStart} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      <Edit2 size={13} />
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={onSave} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
        <Save size={13} />
      </button>
      <button onClick={onCancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        <X size={13} />
      </button>
    </div>
  )
}
