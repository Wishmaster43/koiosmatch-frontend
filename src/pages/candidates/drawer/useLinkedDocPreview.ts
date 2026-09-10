/**
 * useLinkedDocPreview — the linked-proof-document preview overlay + picker
 * options shared by every Achtergrond list tab that can link a document
 * (Certifications/Education/Skills): DOC-GELDIGHEID-1 / DOC-EDU-1 /
 * DOC-LANG-SKILL-LINK-1 all preview the same shared DocPreviewModal (never a
 * fork), and DOC-1-EIGENAAR-1 resolves the "Koppelen aan" picker options PER
 * ROW — only documents no other entry has claimed, plus this row's own pick.
 * Its own file, not sectionTabsShared.tsx: that file also exports components
 * (react-refresh/only-export-components), and neither export here is one
 * (DRY round 11, CANDTABS).
 */
import { useState } from 'react'
// DOC-1-EIGENAAR-1: the one shared "which document is still free" rule (measured 08-08).
import { linkedDocumentOptions } from './documentLinkRules'
import type { RelItem } from './sectionTabsShared'

export function useLinkedDocPreview(documents: RelItem[], items: RelItem[]) {
  const [previewDoc, setPreviewDoc] = useState<RelItem | null>(null)
  const documentOptions = linkedDocumentOptions(documents, items)
  return { previewDoc, openPreview: setPreviewDoc, closePreview: () => setPreviewDoc(null), documentOptions }
}

/**
 * linkedDocumentField — the optional "Gekoppeld document" field entry, offered
 * only once the candidate HAS documents (§3: an always-empty dropdown is a fake
 * affordance). `label` is resolved by the caller's own t() (rule C: a shared
 * unit never calls t() itself).
 */
export function linkedDocumentField(
  label: string, documents: RelItem[], documentOptions: ReturnType<typeof linkedDocumentOptions>,
): Array<{ key: 'document_id'; label: string; options: typeof documentOptions }> {
  return documents.length > 0 ? [{ key: 'document_id', label, options: documentOptions }] : []
}
