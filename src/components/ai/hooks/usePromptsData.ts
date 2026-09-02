/**
 * usePromptsData — PromptsTab's data hook, built on the shared versioned-item
 * machinery (name+body+version-history against /ai/prompts).
 */
import { useVersionedAiItem } from './useVersionedAiItem'

export function usePromptsData() {
  return useVersionedAiItem({
    endpoint: '/ai/prompts',
    refreshVersionsOnSave: true,
    confirmDeleteKey: 'ai.prompts.confirmDelete',
  })
}
