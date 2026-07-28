/**
 * cvMovableContent — renders the inner content of every MOVABLE CV section
 * (contact, languages, skills, certificates, preferences), region-agnostic.
 *
 * Pulled out of CandidateCvTemplate because a tenant may relocate any of these
 * between the sidebar and the main column: the content must render identically
 * in both, so it lives in one place that only takes a Palette and never learns
 * which region it landed in. It returns null for an empty section on purpose —
 * the caller uses that to skip the section's label/wrapper entirely.
 */
import { View, Text } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type { CvLanguage, CvNamed } from './cvTypes'
import type { CvStyles, Palette } from './cvStyles'

// The candidate slices the movable sections draw from — already normalised and
// (for contact) already redaction-filtered by the document.
export interface CvMovableData {
  contact: Array<[string, string]>
  languages: CvLanguage[]
  skills: CvNamed[]
  certs: CvNamed[]
  preferredFunctions: string[]
  shiftType: string[]
}

// Contact key/value rows — shared by whichever region the section lands in.
function renderContactRows(contact: Array<[string, string]>, palette: Palette, S: CvStyles) {
  return contact.map(([k, v]) => (
    <View key={k} style={S.contactGroup}>
      <Text style={[S.contactSubLabel, { color: palette.label }]}>{k}</Text>
      <Text style={[S.contactVal, { color: palette.text }]}>{v}</Text>
    </View>
  ))
}

// Language + level rows — shared by whichever region the section lands in.
function renderLanguageRows(languages: CvLanguage[], palette: Palette, S: CvStyles) {
  return languages.map((lang, i) => {
    const langName = lang?.language ?? lang?.name ?? String(lang)
    const level = lang?.level ?? lang?.spoken ?? ''
    return (
      <View key={i} style={S.langRow}>
        <Text style={[S.langName, { color: palette.text }]}>{langName}</Text>
        {level ? <Text style={[S.langLevel, { color: palette.label }]}>{level}</Text> : null}
      </View>
    )
  })
}

// Certificate bullet rows — shared by whichever region the section lands in.
function renderCertificateRows(certs: CvNamed[], palette: Palette, S: CvStyles) {
  return certs.map((cert, i) => (
    <View key={i} style={S.certRow}>
      <Text style={[S.certBullet, { color: palette.bulletColor }]}>▸</Text>
      <Text style={[S.certText, { color: palette.text }]}>{cert?.name ?? String(cert)}</Text>
    </View>
  ))
}

/**
 * Renders one MOVABLE section's inner content (rows/chips), independent of
 * which region it lands in — the palette supplies light/dark colours so the
 * same content stays legible whether it sits on the tinted sidebar or the
 * white main column. `experience`/`education` are handled separately
 * (they are pinned to the main column and use the entry-card layout).
 */
export function renderMovableContent(id: string, palette: Palette, S: CvStyles, data: CvMovableData): ReactNode | null {
  const { contact, languages, skills, certs } = data
  switch (id) {
    case 'contact':
      return contact.length > 0 ? renderContactRows(contact, palette, S) : null
    case 'languages':
      return languages.length > 0 ? renderLanguageRows(languages, palette, S) : null
    case 'skills':
      return skills.length > 0 ? (
        <View style={S.tagRow}>
          {skills.map((v, i) => (
            <Text key={i} style={[S.tag, { backgroundColor: palette.chipBg, color: palette.chipText }]}>{v?.name ?? String(v)}</Text>
          ))}
        </View>
      ) : null
    case 'certificates':
      return certs.length > 0 ? renderCertificateRows(certs, palette, S) : null
    case 'preferences': {
      const funcs = data.preferredFunctions
      const shifts = data.shiftType
      if (funcs.length === 0 && shifts.length === 0) return null
      return (
        <>
          {funcs.length > 0 && (
            <View style={{ marginBottom: 6 }}>
              <View style={S.tagRow}>
                {funcs.map((f, i) => <Text key={i} style={[S.tag, { backgroundColor: palette.chipBg, color: palette.chipText }]}>{f}</Text>)}
              </View>
            </View>
          )}
          {shifts.length > 0 && (
            <View style={S.tagRow}>
              {shifts.map((d, i) => <Text key={i} style={[S.tag, { backgroundColor: palette.chipBg, color: palette.chipText }]}>{d}</Text>)}
            </View>
          )}
        </>
      )
    }
    default:
      return null
  }
}
