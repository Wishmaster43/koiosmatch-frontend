/**
 * useMountAbortableLoad — runs `load` once on mount, aborting it on cleanup/id
 * change. Shared by useCustomerDepartments and usePriceAgreements, whose own
 * mount effects were byte-identical; useAbortableListLoad covers the same need
 * PLUS a cross-surface change-event listener for the hooks that need one.
 */
import { useEffect } from 'react'

export function useMountAbortableLoad(load: (signal?: AbortSignal) => void): void {
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])
}
