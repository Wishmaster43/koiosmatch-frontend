import type { EntityTasksLabels } from './EntityTasksTab'

// taskTabLabels — the shared `labels` bag builder every EntityTasksTab caller
// resolves, byte-identical bar its own bound namespace (DRY round, CANDTABS
// package): each host's 'tasks.*' key names are the same, only the `t` passed
// in differs (already scoped to that host's own i18n namespace). Its own file
// (not EntityTasksTab.tsx itself): that file also exports the component, and
// react-refresh/only-export-components flags a second value export there.
export function taskTabLabels(t: (key: string) => string): EntityTasksLabels {
  return {
    newTask: t('tasks.newTask'),
    empty: t('tasks.empty'), loading: t('tasks.loading'), error: t('tasks.error'),
    openTask: t('tasks.openTask'), searchPlaceholder: t('tasks.searchPlaceholder'),
  }
}
