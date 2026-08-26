/**
 * CvSectionShells — the two labelled containers a CV section renders inside:
 * SideSection (tinted sidebar column) and MainSection (white main column, with
 * the rule line).
 *
 * Pulled out of CandidateCvTemplate because they are the shared primitive every
 * other section file wraps its content in; they know nothing about the
 * candidate, so keeping them separate stops the layout file from re-declaring
 * chrome that three call sites depend on.
 */
import { View, Text } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type { CvStyles } from './cvStyles'

// Tinted sidebar column shell; `first` swaps in the top-most label's own style.
export function SideSection({ label, first, S, children }: { label: ReactNode; first?: boolean; S: CvStyles; children?: ReactNode }) {
  return (
    <View style={S.sideBlock}>
      <Text style={first ? S.sideLabelFirst : S.sideLabel}>{label}</Text>
      {children}
    </View>
  )
}

// White main-column section shell, with the title + underline rule.
export function MainSection({ label, S, children }: { label: ReactNode; S: CvStyles; children?: ReactNode }) {
  return (
    <View style={S.mainBlock}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{label}</Text>
        <View style={S.sectionLine} />
      </View>
      {children}
    </View>
  )
}
