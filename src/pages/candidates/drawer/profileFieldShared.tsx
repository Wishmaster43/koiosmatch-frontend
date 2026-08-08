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
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

// Shared input styling for text/date/combobox controls across all three tabs
// (G33/fieldMetrics canon — was its own padding-7/font-12/radius-6 copy).
export const inputStyle: CSSProperties = fieldInputStyle

// Shared square icon-button sizing for the pencil/save/cancel controls.
export const iconBtn: CSSProperties = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, cursor: 'pointer',
}

const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

// Bordered card holding one group's field rows. The group NAME is not in here — it sits
// on the header row above the card, next to the pencil, exactly like the profile-text
// block does (Danny 28-07: "kopjes horen er buiten te staan, kijk maar naar profiel
// txt"). See GroupHeader below; one heading convention for the whole tab.
export function GroupCard({ children }: { children: ReactNode }) {
  return <div style={{ ...blockStyle, padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
}

// The row above a card: group title on the left, its own pencil/save/cancel on the
// right — the same shape the profile-text block already uses.
export function GroupHeader({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{title}</span>
      {children}
    </div>
  )
}

// One labelled field row: label-left (with optional required marker/icon),
// value-or-input right, optional error line below. Read vs. edit content is
// decided by the caller (children), since what renders differs per field type.
export function FieldRow({ label, required, errorText, labelIcon, children }: {
  label: ReactNode; required?: boolean; errorText?: ReactNode; labelIcon?: ReactNode; children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      {/* Canon width/color/size (fieldRowCanon) + the flex/gap this row alone needs to seat an optional labelIcon next to the label text. */}
      <span style={{ ...CANON_LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 5 }}>
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
      <button onClick={onSave} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }}>
        <Save size={13} />
      </button>
      <button onClick={onCancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        <X size={13} />
      </button>
    </div>
  )
}
