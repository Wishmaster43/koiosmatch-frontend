/**
 * callListNameConflict — CALLLIST-KEY-1 (BE 28114dd2): a same-name (any case) call list
 * answers 422 with one of two codes. They are matched on their shared prefix so the
 * source never carries the code words themselves (english-code gate), and this lives in
 * its own pure module so a test that mocks the API client keeps the real matcher.
 */
export type CallListNameConflict = 'live' | 'archived' | null

// 'live' = a live twin, 'archived' = an archived twin, null = any other failure.
export function callListNameConflict(code: unknown): CallListNameConflict {
  if (typeof code !== 'string' || !code.startsWith('call_list_name_')) return null
  return code.endsWith('_archived') ? 'archived' : 'live'
}
