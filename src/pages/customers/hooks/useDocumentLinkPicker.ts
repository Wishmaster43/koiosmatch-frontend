/**
 * useDocumentLinkPicker — the customer documents upload's "gekoppeld aan" level
 * picker state + derived option list (DOCS-LOC-DEPT-1). Extracted out of
 * DocumentsTab.tsx (§3 — a component's logic lives in a hook, and this kept that
 * file right at the ~400-line split trigger). Pure state/derivation, no API call.
 *
 * Mirrors CustomerNotesTab's own inline picker exactly (§11 — same encoding:
 * 'customer' or '<level>:<id>', same disabled-header-row grouping over ONE flat
 * SelectMenu) but over three levels, not four — customer_documents has no
 * customer_contact_id column (measured: EntityDocumentController only validates
 * customer_location_id/customer_department_id), so there is no Contactpersoon row.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Id } from '@/types/common'

// The 'gekoppeld aan' level picker state + option list (see the module doc above): pure state/derivation, extracted from DocumentsTab to keep it under the split trigger.
export function useDocumentLinkPicker(
  locations: { id: Id | undefined; name: string }[],
  departments: { id: Id | undefined; name: string; locationName?: string }[],
  lockedLevelFields?: Record<string, string>,
) {
  const { t } = useTranslation('customers')
  // 'customer' (default, no link) | 'location:<id>' | 'department:<id>'.
  const [uploadLink, setUploadLink] = useState('customer')
  const [uploadKind, uploadRecordId] = uploadLink.includes(':')
    ? (uploadLink.split(':') as [string, string]) : [uploadLink, '']

  const locationLinkOptions = locations.filter(l => l.id != null).map(l => ({ value: `location:${l.id}`, label: l.name }))
  const departmentLinkOptions = departments.filter(d => d.id != null)
    .map(d => ({ value: `department:${d.id}`, label: d.locationName ? `${d.name} — ${d.locationName}` : d.name }))
  // Klant, then one disabled header row per non-empty level — never a level with
  // zero options (a picker entry that always errors is a fake affordance, §3).
  const linkOptions = [
    { value: 'customer', label: t('notes.linkLevelOptions.customer') },
    ...(locationLinkOptions.length > 0 ? [{ value: '__hdr_location', label: t('notes.linkLevelOptions.location'), disabled: true }, ...locationLinkOptions] : []),
    ...(departmentLinkOptions.length > 0 ? [{ value: '__hdr_department', label: t('notes.linkLevelOptions.department'), disabled: true }, ...departmentLinkOptions] : []),
  ]
  // Hidden entirely once the scope is locked (ScopedDocumentsTab) or there is
  // nothing below Klant to link to.
  const showLinkPicker = !lockedLevelFields && (locationLinkOptions.length > 0 || departmentLinkOptions.length > 0)
  // The extra multipart fields every queued file uploads with — the locked
  // scope's fixed link wins; otherwise the picker's current choice (undefined
  // for 'customer', which means "send nothing extra", see useEntityDocuments).
  const uploadExtraFields: Record<string, string> | undefined = lockedLevelFields ?? (
    uploadKind === 'location' ? { customer_location_id: uploadRecordId }
      : uploadKind === 'department' ? { customer_department_id: uploadRecordId }
        : undefined
  )

  return { uploadLink, setUploadLink, linkOptions, showLinkPicker, uploadExtraFields }
}
