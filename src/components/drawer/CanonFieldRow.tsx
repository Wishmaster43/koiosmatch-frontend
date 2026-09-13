// CanonFieldRow — the shared label-LEFT/value-RIGHT drawer row (DRILLDOWN-VOLGORDE-CANON):
// mirrors ApplicationStatusStrip's and CvBlock's own Row byte-for-byte, so both keep the
// canon label width/style even where one needs top-aligned wrapping text and the other a
// centered icon+label. `align` picks that vertical alignment; the rest never varies.
import type { ReactNode } from 'react'
import { CANON_LABEL_STYLE } from './fieldRowCanon'

export function CanonFieldRow({ label, children, align = 'center', labelStyle }: {
  label: ReactNode
  children: ReactNode
  // 'flex-start' for a wrapping multi-line value, 'center' for a single-line row.
  align?: 'center' | 'flex-start'
  // Extra style merged onto the label span (e.g. an icon+label flex row).
  labelStyle?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: align, gap: 12, minHeight: 26 }}>
      <span style={{ ...CANON_LABEL_STYLE, ...(align === 'flex-start' ? { marginTop: 2 } : {}), ...labelStyle }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}
