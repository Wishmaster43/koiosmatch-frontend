/**
 * makeFieldRenderer — the `field(key, label)` renderer shared by the Address
 * and Personal profile sub-tabs (Contact's own version carries an extra icon
 * param and a touched-validation errorText, so it stays local): wraps
 * FieldRow with the read/edit branch every field row on these tabs shares
 * (DRY round 11, CANDTABS). Its own file, not profileFieldShared.tsx: that
 * file only exports components (react-refresh/only-export-components), and
 * this factory is not one.
 */
import type { ReactNode } from 'react'
import { FieldRow } from './profileFieldShared'

export function makeFieldRenderer<K extends string>({ isReq, errors, editing, requiredText, renderInput, renderValue }: {
  isReq: (key: K) => boolean
  errors: Partial<Record<K, boolean>>
  editing: boolean
  requiredText: string
  renderInput: (key: K) => ReactNode
  renderValue: (key: K) => ReactNode
}) {
  return (key: K, label: string) => (
    <FieldRow key={key} label={label} required={isReq(key)} errorText={errors[key] ? requiredText : undefined}>
      {editing ? renderInput(key) : renderValue(key)}
    </FieldRow>
  )
}
