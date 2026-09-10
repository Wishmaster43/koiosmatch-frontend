import type { Id } from '@/types/common'

/**
 * mergeModalCallbacks — the onClose/onMerged wiring shared by Location/
 * DepartmentDetail's own MergeSubEntityModal (LOCATIE-/AFDELING-SAMENVOEGEN-1):
 * closing just hides the modal; a successful merge hides it AND forwards the
 * survivor id to the host's own `onMerged` prop, so the drawer can switch the
 * open record to the survivor (mirrors ContactDetail's identical inline pair).
 */
export function mergeModalCallbacks(setMerging: (open: boolean) => void, onMerged?: (survivorId: Id) => void) {
  return {
    onClose: () => setMerging(false),
    onMerged: (survivorId: Id) => { setMerging(false); onMerged?.(survivorId) },
  }
}
