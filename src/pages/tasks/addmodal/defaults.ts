/**
 * addmodal/defaults — smart defaults for a NEW task's planning fields
 * (TASK-SMART-DEFAULTS-1, Danny: "+ Nieuwe taak is minder mooi en intelligent
 * dan + match — de datum is netjes gevuld etc."). +Match proposes today for
 * its start date (match/helpers' todayISO) but has no time-of-day field to
 * mirror; tasks do (`dueTime`, TASK-DUE-TIME-1), so the planning-date default
 * pairs today's date with the next round hour. Kept local rather than
 * importing match/helpers (CLAUDE.md §2: an entity page never reaches into
 * another entity's internals) — both are tiny, injectable-`now` pure
 * functions, same shape as lib/datetime's calcAge.
 */

// Today as an input[type=date] value (YYYY-MM-DD), in LOCAL time — never
// toISOString() (UTC), which flips the date near midnight for most of Europe.
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// The next full hour as an input[type=time] value (HH:00) — a calm, round
// proposal rather than the exact current minute. Wraps past 23:00 to 00:00;
// the date itself stays "today" (an acceptable simplification for a PROPOSAL
// the recruiter can freely change, never a hard default).
export function nextRoundHour(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad((now.getHours() + 1) % 24)}:00`
}
