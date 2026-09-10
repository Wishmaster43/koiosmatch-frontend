/**
 * subEntityFrameProps — the prop block the three customer sub-entity modals
 * (contact person, department, location) hand SubEntityModalFrame identically:
 * the edit/add title on both aria-label and title, the import wiring with one
 * shared import title, the alert and import-card slots, and the footer's
 * cancel and save-or-create labels (DRY round 11, MODALS follow-up). Icon,
 * colours and persist key stay at each call site; every string resolves
 * through the caller's own t().
 */
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'

interface SubEntityFrameInput {
  t: TFunction
  isEdit: boolean
  editTitle: string
  addTitle: string
  entityLabel: string
  persistKey: string
  customerName?: string
  importOpen: boolean
  setImportOpen: (open: boolean) => void
  alert?: ReactNode
  importCard?: ReactNode
  onClose: () => void
  submit: () => void
  canSubmit: boolean
}

// Builds the identical prop block; the caller spreads it and adds icon/iconColor/iconBg.
export function subEntityFrameProps({
  t, isEdit, editTitle, addTitle, entityLabel, persistKey, customerName,
  importOpen, setImportOpen, alert, importCard, onClose, submit, canSubmit,
}: SubEntityFrameInput) {
  const title = isEdit ? editTitle : addTitle
  const importTitle = t('subModal.import.title', { entity: entityLabel })
  return {
    open: true, onClose, ariaLabel: title, persistKey, isEdit, title, subtitle: customerName,
    importOpen, setImportOpen, importButtonTitle: importTitle, importCardTitle: importTitle,
    alert, importCard, onCancel: onClose, onSubmit: submit,
    cancelLabel: t('subModal.cancel'), submitLabel: isEdit ? t('subModal.save') : t('subModal.create'),
    submitDisabled: !canSubmit,
  }
}
