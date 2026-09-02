/**
 * useFaqsData — FAQTab's data hook, built on the shared versioned-item
 * machinery (name+body+version-history against /ai/faqs).
 */
import { useVersionedAiItem } from './useVersionedAiItem'

export function useFaqsData() {
  return useVersionedAiItem({
    endpoint: '/ai/faqs',
    refreshVersionsOnSave: false,
    confirmDeleteKey: 'ai.faqs.confirmDelete',
  })
}
