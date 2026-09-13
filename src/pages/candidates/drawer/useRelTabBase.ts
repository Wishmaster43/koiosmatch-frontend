/**
 * useRelTabBase — the boilerplate CertificationsTab/EducationTab both open
 * with: the 'candidates' translator, a `fmt` date formatter and the linked-
 * document preview state (DRY round, CANDTABS package). SkillsTab needs no
 * date formatting so it keeps calling useLinkedDocPreview directly — not a
 * third consumer here.
 * Its own file, not useLinkedDocPreview.ts: `useDateFormat` (`@/lib/datetime`)
 * imports the i18n module, which runs i18n.init() as a side effect at import
 * time (DATETIME-IMPORT-LES). Keeping that import out of useLinkedDocPreview.ts
 * lets SkillsTab and useLinkedDocPreview.test.ts stay free of that edge.
 */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useLinkedDocPreview } from './useLinkedDocPreview'
import type { RelItem } from './sectionTabsShared'

export function useRelTabBase(documents: RelItem[], items: RelItem[]) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  const { previewDoc, openPreview, closePreview, documentOptions } = useLinkedDocPreview(documents, items)
  return { t, fmt, previewDoc, openPreview, closePreview, documentOptions }
}
