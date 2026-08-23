/**
 * textDiff — pure word-level LCS diff between two plain texts, used by
 * AssistTextPreview's old-vs-new comparison view (ASSIST-COMPARE-1, Danny
 * 23-08: "oude en nieuwe tekst kan je nu niet goed vergelijken"). Splits both
 * texts on whitespace, runs a classic longest-common-subsequence over the
 * word arrays, then walks the LCS table back to front to emit ordered
 * same/added/removed segments (each segment's `text` keeps its original
 * inter-word spacing so re-joining reads naturally).
 *
 * Performance guard: LCS is O(n*m) in time AND memory. Above 2500 words per
 * side that explodes (millions of cells) — return null so the caller can
 * fall back to a plain "new text only" view instead of freezing the tab.
 */

export type DiffSegmentType = 'same' | 'added' | 'removed'

export interface DiffSegment {
  type: DiffSegmentType
  text: string
}

const WORD_LIMIT = 2500

// Split on runs of whitespace, keeping the words only (spacing is re-inserted
// on join — the exact original whitespace is not preserved, which is fine for
// a prose comparison view).
const splitWords = (text: string): string[] => text.split(/\s+/).filter(Boolean)

// Word-level LCS diff. Returns null when either side exceeds the performance
// guard, or when both texts are empty (nothing to compare).
export function diffWords(oldText: string, newText: string): DiffSegment[] | null {
  const a = splitWords(oldText)
  const b = splitWords(newText)
  if (a.length > WORD_LIMIT || b.length > WORD_LIMIT) return null
  if (a.length === 0 && b.length === 0) return []

  // Classic LCS length table, (a.length+1) x (b.length+1).
  const rows = a.length + 1
  const cols = b.length + 1
  const table: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      table[i][j] = a[i - 1] === b[j - 1]
        ? table[i - 1][j - 1] + 1
        : Math.max(table[i - 1][j], table[i][j - 1])
    }
  }

  // Walk the table back to front, collecting per-word ops, then reverse.
  type Op = { type: DiffSegmentType; word: string }
  const ops: Op[] = []
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'same', word: a[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      ops.push({ type: 'added', word: b[j - 1] })
      j--
    } else {
      ops.push({ type: 'removed', word: a[i - 1] })
      i--
    }
  }
  ops.reverse()

  // Merge consecutive same-type ops into one segment, space-joined.
  const segments: DiffSegment[] = []
  for (const op of ops) {
    const last = segments[segments.length - 1]
    if (last && last.type === op.type) last.text += ' ' + op.word
    else segments.push({ type: op.type, text: op.word })
  }
  return segments
}
