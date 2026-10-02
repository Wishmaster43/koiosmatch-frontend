/**
 * OutputTreeBundle — the trailing "bundle order position" / "total number of
 * bundles" leaf pair Make appends under each bundle item's own fields, shown
 * when OutputTree's `bundles` option is on. Presentational only.
 */
import type { TFunction } from 'i18next'
import { LeafRow, type OutputTreeOptions } from './OutputTree'

// Renders the two position/total leaf rows for one bundle item (n is 1-based).
// `opts` is forwarded so these rows carry the same typed glyph column as their siblings.
export default function OutputTreeBundle({ n, total, depth, opts, t }: {
  n: number; total: number; depth: number; opts?: OutputTreeOptions; t: TFunction
}) {
  return (
    <>
      <LeafRow label={t('inspector.bundlePosition')} value={n} depth={depth} opts={opts} t={t} />
      <LeafRow label={t('inspector.bundleTotal')} value={total} depth={depth} opts={opts} t={t} />
    </>
  )
}
