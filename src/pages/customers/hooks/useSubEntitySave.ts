/**
 * Shared error handling and state for customer sub-entity create/edit modals
 * (AddDepartmentModal, AddLocationModal, AddContactPersonModal). Manages
 * field-level 422 errors, generic failures, and the import wizard effect.
 * Each modal provides its own API_TO_FORM mapping to translate snake_case backend
 * field names back to camelCase form fields.
 */
import { useState, useEffect, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useImportWizard } from '@/pages/settings/shared'
import { extractApiError } from '@/lib/extractApiError'
import { extractFormErrorsWithMessages, unmappedFormErrors } from '@/lib/extractFormErrors'
// ONIX N-005: a 422 key no rendered field maps to still lands somewhere.
import { formatUnmappedErrors } from '@/lib/formatUnmappedErrors'
import { useSubEntityImportPermissions } from './useSubEntityImportPermissions'

// Shared state/effect management for customer sub-entity modals: import wizard
// and error handling. The modal manages its own form state via useState.
export function useSubEntitySave({
  initial, apiToFormMap, t, onImported, onClose, importEntity,
}: {
  initial: unknown
  apiToFormMap: Record<string, string>
  t: TFunction
  onImported?: () => void
  onClose: () => void
  importEntity: string // e.g. 'departments', 'locations', 'contacts'
}) {
  const isEdit = Boolean(initial)
  const importWizard = useImportWizard(importEntity)
  // DRY-11: the import-affordance gate rides along with the import wizard it
  // gates — a sibling sub-entity modal needs both together every time.
  const { canViewImportTemplate, canRunImport } = useSubEntityImportPermissions()
  const [importOpen, setImportOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Server message per dotted 422 key (e.g. `custom_fields.vog`), so the
  // required-custom-fields card can show the server's own text, not a generic flag.
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>({})
  const [createError, setCreateError] = useState<string | null>(null)

  // SUBENTITY-IMPORT-1: a real run that landed at least one row closes the modal
  // so the untouched manual form below can never fire a second, duplicate create.
  // The callbacks ride in refs: the effect reacts to the run RESULT only, never to
  // a parent re-render handing in a new onClose/onImported identity.
  const onImportedRef = useRef(onImported)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onImportedRef.current = onImported; onCloseRef.current = onClose })
  useEffect(() => {
    if (importWizard.run.status !== 'success') return
    const { summary } = importWizard.run.result
    if (summary.create + summary.update === 0) return
    onImportedRef.current?.()
    onCloseRef.current()
  }, [importWizard.run])

  // Handle 422 field errors: translate API snake_case keys back to camelCase form fields.
  // `renderedKeys` (optional) names the dotted keys an actual field renders (e.g.
  // required custom fields) so those never ALSO trigger the unmapped-error banner.
  const handleApiError = (err: unknown, renderedKeys?: string[]) => {
    const mapped = extractFormErrorsWithMessages(err, apiToFormMap)
    if (mapped) {
      setErrors(mapped.errors)
      setFieldMessages(mapped.messages)
      // A bag key no rendered field maps to would otherwise silently fail — surface it.
      const unmapped = unmappedFormErrors(err, apiToFormMap, renderedKeys)
      const banner = formatUnmappedErrors(unmapped, t)
      if (banner) setCreateError(banner)
    } else {
      setCreateError(extractApiError(err, t('common:errorGeneric')))
    }
  }

  return {
    isEdit, importWizard, importOpen, setImportOpen, errors, setErrors, fieldMessages, setFieldMessages,
    createError, setCreateError, handleApiError, canViewImportTemplate, canRunImport,
  }
}
