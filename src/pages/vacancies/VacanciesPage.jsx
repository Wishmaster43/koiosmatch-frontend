import { useState, useMemo, useEffect } from 'react'
import { Plus, Edit2, X, FileText, ChevronDown } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'

// ── Dummy data ────────────────────────────────────────────────────────────────
const VACATURES = [
  { id: '00101', titel: 'Verzorgende IG – Avond- en Nachtdiensten | PG-zorg Rotterdam Zuid | 24 uur per week',
    status: 'Open', leads: 0, sollicitaties: 0, gepubliceerd: ['career'], eigenaar: { naam: 'Wiktoria Opalenyk', initials: 'WO' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '2 jun 2026, 16:37',
    locatie: 'Rotterdam Zuid Rotterdam', dienstverband: 'Vaste termijn', salaris: '€ 2.643,00 – € 3.471,00 maandelijks',
    uren: 'Van 24 tot 24 uur', ervaring: '1 jaar', senioriteit: 'Professional',
    opleiding: 'MBO / Beroepssecundair onderwijs', branche: 'Gezondheidszorg', categorie: 'Zorg',
    beschrijving: 'Wanneer de rust op de afdeling terugkeert en de dag langzaam overgaat in de avond, ben jij op je best. Juist op een PG-afdeling maken aandacht, geduld en een vertrouwde aanwezigheid het verschil.\n\nVoor een warme zorglocatie in Rotterdam Zuid zijn wij op zoek naar een Verzorgende IG die graag werkt met bewoners met psychogeriatrische problematiek.',
    tags: ['Verzorgende IG', 'PG-zorg', 'Rotterdam', 'Nachtdienst', 'flex'],
    tijdlijn: [
      { naam: 'Wiktoria Opalenyk', initials: 'W', datum: '9 jun · 23:41', actie: 'Vacaturegegevens bijgewerkt' },
      { naam: 'Wiktoria Opalenyk', initials: 'W', datum: '9 jun · 23:41', actie: 'Vacaturegegevens bijgewerkt' },
      { naam: 'Wiktoria Opalenyk', initials: 'W', datum: '9 jun · 23:40', actie: 'Vacaturegegevens bijgewerkt' },
    ],
    recruiter: 'Wiktoria Opalenyk', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00100', titel: 'Verzorgende IG – Revalidatiezorg | Rotterdam Zuid | Dag- en avonddiensten | 20–32 uur',
    status: 'Open', leads: 0, sollicitaties: 1, gepubliceerd: ['career','werkzoeken'], eigenaar: { naam: 'Wiktoria Opalenyk', initials: 'WO' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '2 jun 2026, 16:13',
    locatie: 'Rotterdam Zuid', dienstverband: 'Vaste termijn', salaris: '€ 2.400,00 – € 3.100,00 maandelijks',
    uren: 'Van 20 tot 32 uur', ervaring: '1 jaar', senioriteit: 'Medior',
    opleiding: 'MBO', branche: 'Gezondheidszorg', categorie: 'Verpleging',
    beschrijving: 'Als Verzorgende IG in de revalidatiezorg help je patiënten bij hun herstel. Je werkt in dag- en avonddiensten op een dynamische afdeling.',
    tags: ['Verzorgende IG', 'Revalidatie', 'Rotterdam'],
    tijdlijn: [{ naam: 'Wiktoria Opalenyk', initials: 'W', datum: '2 jun · 16:13', actie: 'Vacature aangemaakt' }],
    recruiter: 'Wiktoria Opalenyk', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00099', titel: 'Teamleider (Zorg met bedrijfskundige power)',
    status: 'Open', leads: 63, sollicitaties: 0, gepubliceerd: ['career'], eigenaar: { naam: 'Kelly van Vliet', initials: 'KV' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '21 mei 2026, 15:43',
    locatie: 'Den Haag', dienstverband: 'Vaste termijn', salaris: '€ 3.500,00 – € 4.200,00 maandelijks',
    uren: 'Van 32 tot 40 uur', ervaring: '3 jaar', senioriteit: 'Senior',
    opleiding: 'HBO', branche: 'Gezondheidszorg', categorie: 'Management',
    beschrijving: 'Je combineert je zorghart met een scherp zakelijk inzicht. Als teamleider ben je verantwoordelijk voor een team van 15 medewerkers.',
    tags: ['Teamleider', 'Management', 'Zorg'],
    tijdlijn: [{ naam: 'Kelly van Vliet', initials: 'K', datum: '21 mei · 15:43', actie: 'Vacature aangemaakt' }],
    recruiter: 'Kelly van Vliet', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00098', titel: 'Verzorgende IG PG – Den Haag & omgeving | Flexibele diensten + bonus',
    status: 'Open', leads: 0, sollicitaties: 0, gepubliceerd: ['career','werkzoeken'], eigenaar: { naam: 'Kelly van Vliet', initials: 'KV' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '19 mei 2026, 13:55',
    locatie: 'Den Haag', dienstverband: 'Flexibel', salaris: '€ 2.643,00 – € 3.200,00 maandelijks',
    uren: 'Van 16 tot 32 uur', ervaring: '1 jaar', senioriteit: 'Professional',
    opleiding: 'MBO', branche: 'Gezondheidszorg', categorie: 'Zorg',
    beschrijving: 'Flexibele inzet op een PG-afdeling in de regio Den Haag. Bonus bij beschikbaarheid in weekenden.',
    tags: ['Verzorgende IG', 'PG', 'Den Haag', 'Flexibel'],
    tijdlijn: [{ naam: 'Kelly van Vliet', initials: 'K', datum: '19 mei · 13:55', actie: 'Vacature aangemaakt' }],
    recruiter: 'Kelly van Vliet', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00097', titel: 'Startende Verzorgende IG – Groei, begeleiding & zekerheid | Regio Den Haag',
    status: 'Open', leads: 0, sollicitaties: 0, gepubliceerd: ['career','werkzoeken'], eigenaar: { naam: 'Kelly van Vliet', initials: 'KV' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '19 mei 2026, 13:53',
    locatie: 'Den Haag', dienstverband: 'Vaste termijn', salaris: '€ 2.200,00 – € 2.800,00 maandelijks',
    uren: 'Van 20 tot 32 uur', ervaring: '0 jaar', senioriteit: 'Junior',
    opleiding: 'MBO', branche: 'Gezondheidszorg', categorie: 'Zorg',
    beschrijving: 'Net afgestudeerd of wisselend van richting? Wij begeleiden je naar een succesvolle start in de zorg.',
    tags: ['Starter', 'Verzorgende IG', 'Den Haag'],
    tijdlijn: [{ naam: 'Kelly van Vliet', initials: 'K', datum: '19 mei · 13:53', actie: 'Vacature aangemaakt' }],
    recruiter: 'Kelly van Vliet', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00096', titel: 'Verzorgende IG – Den Haag - Somatische zorg - Goed salaris + bonus',
    status: 'Open', leads: 37, sollicitaties: 0, gepubliceerd: ['career','werkzoeken'], eigenaar: { naam: 'Kelly van Vliet', initials: 'KV' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '19 mei 2026, 13:50',
    locatie: 'Den Haag', dienstverband: 'Flexibel', salaris: '€ 2.643,00 – € 3.471,00 maandelijks',
    uren: 'Van 16 tot 32 uur', ervaring: '1 jaar', senioriteit: 'Professional',
    opleiding: 'MBO', branche: 'Gezondheidszorg', categorie: 'Somatiek',
    beschrijving: 'Somatische zorg in het hart van Den Haag. Competitief salaris en bonus bij inzet in weekenden.',
    tags: ['Somatiek', 'Den Haag', 'bonus'],
    tijdlijn: [{ naam: 'Kelly van Vliet', initials: 'K', datum: '19 mei · 13:50', actie: 'Vacature aangemaakt' }],
    recruiter: 'Kelly van Vliet', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00095', titel: 'Persoonlijk begeleider | LVB+ | Den Haag',
    status: 'Open', leads: 155, sollicitaties: 1, gepubliceerd: ['career','werkzoeken'], eigenaar: { naam: 'Kelly van Vliet', initials: 'KV' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '11 mei 2026, 10:31',
    locatie: 'Den Haag', dienstverband: 'Vaste termijn', salaris: '€ 2.400,00 – € 3.100,00 maandelijks',
    uren: 'Van 24 tot 32 uur', ervaring: '2 jaar', senioriteit: 'Medior',
    opleiding: 'HBO / MBO', branche: 'Gezondheidszorg', categorie: 'Begeleiding',
    beschrijving: 'Als persoonlijk begeleider ondersteun je cliënten met een licht verstandelijke beperking bij hun dagelijks functioneren.',
    tags: ['LVB', 'Begeleider', 'Den Haag'],
    tijdlijn: [{ naam: 'Kelly van Vliet', initials: 'K', datum: '11 mei · 10:31', actie: 'Vacature aangemaakt' }],
    recruiter: 'Kelly van Vliet', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00094', titel: 'Verzorgende IG – Kleinschalig wonen | PG & Somatiek | Dag en avond',
    status: 'Open', leads: 0, sollicitaties: 0, gepubliceerd: ['career'], eigenaar: { naam: 'Wiktoria Opalenyk', initials: 'WO' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '8 mei 2026, 14:12',
    locatie: 'Utrecht', dienstverband: 'Vaste termijn', salaris: '€ 2.643,00 – € 3.200,00 maandelijks',
    uren: 'Van 20 tot 32 uur', ervaring: '1 jaar', senioriteit: 'Professional',
    opleiding: 'MBO', branche: 'Gezondheidszorg', categorie: 'Zorg',
    beschrijving: 'Kleinschalig wonen biedt een huiselijke omgeving voor bewoners met PG en somatische aandoeningen.',
    tags: ['Kleinschalig wonen', 'PG', 'Somatiek'],
    tijdlijn: [{ naam: 'Wiktoria Opalenyk', initials: 'W', datum: '8 mei · 14:12', actie: 'Vacature aangemaakt' }],
    recruiter: 'Wiktoria Opalenyk', vestiging: 'Yesway zorg B.V.',
  },
  { id: '00093', titel: 'Begeleider | Zuid-Holland | DUMMY',
    status: 'Open', leads: 0, sollicitaties: 197, gepubliceerd: ['career'], eigenaar: { naam: 'Kelly van Vliet', initials: 'KV' },
    klant: { naam: 'Yesway works', color: 'var(--color-primary)' }, datum: '7 mei 2026, 14:48',
    locatie: 'Zuid-Holland', dienstverband: 'Flexibel', salaris: '€ 2.000,00 – € 2.800,00 maandelijks',
    uren: 'Van 16 tot 32 uur', ervaring: '0 jaar', senioriteit: 'Junior',
    opleiding: 'MBO', branche: 'Zorg & Welzijn', categorie: 'Begeleiding',
    beschrijving: 'Dummy vacature voor test- en demonstratiedoeleinden.',
    tags: ['Begeleider', 'DUMMY'],
    tijdlijn: [{ naam: 'Kelly van Vliet', initials: 'K', datum: '7 mei · 14:48', actie: 'Vacature aangemaakt' }],
    recruiter: 'Kelly van Vliet', vestiging: 'Yesway works B.V.',
  },
  { id: '00092', titel: 'Verzorgende IG – Den Haag - Avond en Nachtdiensten',
    status: 'Open', leads: 37, sollicitaties: 0, gepubliceerd: ['career'], eigenaar: { naam: 'Kelly van Vliet', initials: 'KV' },
    klant: { naam: 'Yesway zorg', color: 'var(--color-warning)' }, datum: '1 mei 2026, 15:54',
    locatie: 'Den Haag', dienstverband: 'Flexibel', salaris: '€ 2.643,00 – € 3.471,00 maandelijks',
    uren: 'Van 16 tot 24 uur', ervaring: '1 jaar', senioriteit: 'Professional',
    opleiding: 'MBO', branche: 'Gezondheidszorg', categorie: 'Zorg',
    beschrijving: 'Avond- en nachtdiensten in Den Haag. Flexibele inzet met toeslag voor onregelmatige uren.',
    tags: ['Avond', 'Nacht', 'Den Haag'],
    tijdlijn: [{ naam: 'Kelly van Vliet', initials: 'K', datum: '1 mei · 15:54', actie: 'Vacature aangemaakt' }],
    recruiter: 'Kelly van Vliet', vestiging: 'Yesway zorg B.V.',
  },
]

const FASE_STATS = [
  { label: 'Gesolliciteerd', color: 'var(--color-warning)', count: 428 },
  { label: 'Geaccepteerd',   color: '#8B5CF6', count: 18 },
  { label: 'Uitgenodigd',    color: 'var(--color-secondary)', count: 12 },
  { label: 'Voorstel gedaan',color: '#9CA3AF', count: 7 },
  { label: 'Aangenomen',     color: 'var(--color-success)', count: 0 },
  { label: 'Afgewezen',      color: 'var(--color-danger)', count: 183 },
]

const AVATAR_COLORS = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6','#EC4899']
function ac(s) { return AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length] }

function Avatar({ initials, size = 26 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: ac(initials), display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#fff', fontSize: size * 0.38, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

function KlantLogo({ klant }) {
  return (
    <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0,
      background: klant.color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff' }}>
      {klant.naam.charAt(0)}
    </div>
  )
}

function PlatformIcon({ type }) {
  const icons = {
    career:    { label: '🌐', bg: '#1F2937' },
    werkzoeken:{ label: 'W',  bg: 'var(--color-danger)' },
    google:    { label: 'G',  bg: '#4285F4' },
    indeed:    { label: 'i',  bg: '#003A9B' },
  }
  const ic = icons[type] || { label: '?', bg: '#6B7280' }
  return (
    <div style={{ width: 18, height: 18, borderRadius: '50%', background: ic.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {ic.label}
    </div>
  )
}

function BarCell({ value, max = 200, color = 'var(--color-primary)', warning = false }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 16, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden', flexShrink: 0 }}>
        {value > 0 && (
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4,
            background: warning ? '#FCA5A5' : '#D1D5DB' }} />
        )}
      </div>
      {value > 0 && (
        <span style={{ fontSize: 12, color: warning ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: warning ? 600 : 400 }}>
          {value}
        </span>
      )}
      {value === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>0</span>}
    </div>
  )
}

// ── Toggle switch component ───────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? 'var(--color-warning)' : '#D1D5DB', position: 'relative', flexShrink: 0,
        transition: 'background 0.2s' }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18,
        borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s' }} />
    </button>
  )
}

// ── Vacature drawer ───────────────────────────────────────────────────────────
function VacatureDrawer({ vac, onClose }) {
  const [platforms, setPlatforms] = useState({ career: true, google: false, werkzoeken: false })

  if (!vac) return null

  const togglePlatform = (p) => setPlatforms(prev => ({ ...prev, [p]: !prev[p] }))

  return (
    <div style={{ width: 400, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Vacature</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', borderRadius: 6, padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Cover + logo */}
        <div style={{ position: 'relative', height: 120, flexShrink: 0,
          background: 'linear-gradient(135deg,#1F2937,#374151,#4B5563)',
          backgroundSize: 'cover' }}>
          <div style={{ position: 'absolute', bottom: -20, left: 20, width: 52, height: 52,
            borderRadius: 12, background: vac.klant.color, border: '3px solid var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{vac.klant.naam.charAt(0)}</span>
          </div>
          <button style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Edit2 size={12} color="#374151" />
          </button>
        </div>

        <div style={{ padding: '28px 20px 0' }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{vac.titel}</div>
            <button style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              fontSize: 11, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              <Edit2 size={11} /> Bewerken
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>{vac.klant.naam}</div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 18 }}>
            {[
              ['Vacature-ID', vac.id, false],
              ['Status', vac.status, true],
              ['Soort dienstverband', vac.dienstverband, false],
              ['Locatie', vac.locatie, false],
              ['Salaris', vac.salaris, false],
              ['Wekelijkse werktijden', vac.uren, false],
              ['Ervaring', vac.ervaring, false],
              ['Senioriteit', vac.senioriteit, false],
              ['Opleiding', vac.opleiding, false],
              ['Branche', vac.branche, false],
              ['Categorie', vac.categorie, false],
            ].map(([l, v, isStatus]) => (
              <div key={l}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
                {isStatus
                  ? <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 999,
                      background: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {v} <X size={9} />
                    </span>
                  : <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{v}</div>
                }
              </div>
            ))}
          </div>

          <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12,
            fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
            background: 'none', color: 'var(--text)', cursor: 'pointer', marginBottom: 20 }}>
            <Edit2 size={12} /> Bewerken
          </button>

          <Divider />

          {/* Vaardigheden */}
          <Section title="Vereiste vaardigheden">
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-primary)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Plus size={13} /> Vaardigheid toevoegen
            </button>
          </Section>

          <Divider />

          {/* Tags */}
          <Section title="Tags">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {vac.tags.map(t => (
                <span key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999,
                  background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {t}
                </span>
              ))}
              <button style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999,
                background: 'none', border: '1px dashed var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                +
              </button>
            </div>
          </Section>

          <Divider />

          {/* Beschrijving */}
          <Section title="Beschrijving">
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Opzoek naar jou!</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{vac.beschrijving}</div>
          </Section>

          <Divider />

          {/* Sollicitatie instellingen */}
          <Section title="Sollicitatie instellingen">
            {[['CV','Optioneel'],['Motivatiebrief','Optioneel'],['Foto','Optioneel'],
              ['Opmerkingen','Optioneel'],['Toestemming voor interviews','Verborgen']].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{l}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 13 }}>
                  {v} <ChevronDown size={13} />
                </div>
              </div>
            ))}
          </Section>

          <Divider />

          {/* Vacaturesites */}
          <Section title="Vacaturesites">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'career',     label: 'Carrière-pagina', ext: true },
                { key: 'google',     label: 'Google Jobs',      ext: false },
                { key: 'indeed',     label: 'Indeed',           ext: false, integreer: true },
                { key: 'werkzoeken', label: 'Werkzoeken',       ext: false },
              ].map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <PlatformIcon type={p.key} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                    {p.label} {p.ext && <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>↗</span>}
                  </span>
                  {p.integreer
                    ? <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 500 }}>Integreer</span>
                    : <>
                        <Toggle on={platforms[p.key]} onChange={() => togglePlatform(p.key)} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 90 }}>
                          {platforms[p.key] ? 'Gepubliceerd' : 'Niet gepubliceerd'}
                        </span>
                      </>
                  }
                </div>
              ))}
            </div>
          </Section>

          <Divider />

          {/* Sollicitaties teller */}
          <Section title="Sollicitaties">
            <div style={{ background: 'var(--hover-bg)', borderRadius: 6, padding: '8px 12px',
              fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>{vac.sollicitaties}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 0' }}>
              {FASE_STATS.map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </Section>

          <Divider />

          {/* Leads */}
          <Section title="Leads">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--hover-bg)', borderRadius: 6, padding: '8px 12px' }}>
              <span style={{ fontSize: 13, color: 'var(--color-warning)' }}>Totale leads</span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{vac.leads}</span>
            </div>
          </Section>

          <Divider />

          {/* Eigen velden */}
          <Section title="Eigen velden">
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12,
              fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              <Plus size={12} /> Eigen veld toevoegen
            </button>
          </Section>

          <Divider />

          {/* Documenten */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Documenten</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>0</span>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12,
              fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              <Plus size={12} /> Document toevoegen
            </button>
          </div>

          <Divider />

          {/* Tijdlijn */}
          <Section title="Tijdlijn">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {vac.tijdlijn.map((t, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0 }} />
                    <Avatar initials={t.initials} size={24} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.naam}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{t.datum}</span>
                  </div>
                  <div style={{ marginLeft: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    background: 'var(--hover-bg)', borderRadius: 8 }}>
                    <FileText size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{t.actie}</span>
                  </div>
                </div>
              ))}
              <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: 0 }}>
                ↓ Meer laden
              </button>
            </div>
          </Section>

          <Divider />

          {/* Notities */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Notities</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>0</span>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12,
              fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              <Plus size={12} /> Nieuwe notitie
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32,
            paddingBottom: 32, color: 'var(--text-muted)' }}>
            <FileText size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Nog geen notities</div>
            <div style={{ fontSize: 12, marginTop: 4, textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>
              Voeg interne notities toe om je team op één lijn te houden over deze kandidaat.
            </div>
          </div>

          <Divider />

          {/* Eigenaarschap */}
          <Section title="Eigenaarschap">
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Recruiter</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar initials="W" size={22} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{vac.recruiter}</span>
                </div>
                <ChevronDown size={13} color="var(--text-muted)" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Vestiging</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999,
                  background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {vac.vestiging}
                </span>
                <button style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)',
                  background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>+</button>
              </div>
            </div>
          </Section>

          <Divider />

          {/* Klantinformatie */}
          <Section title="Klantinformatie">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Klant</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selecteer een klant</span>
              <ChevronDown size={13} color="var(--text-muted)" />
            </div>
          </Section>

          <div style={{ height: 20 }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gemaakt op {vac.datum.split(',')[0]}</span>
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 0 20px' }} />
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VacanciesPage() {
  const [selected,        setSelected]        = useState(null)
  const [page,            setPage]            = useState(1)
  const [selStatuses,     setSelStatuses]     = useState([])
  const [selEigenaren,    setSelEigenaren]    = useState([])
  const [selKlanten,      setSelKlanten]      = useState([])
  const [selCategorieen,  setSelCategorieen]  = useState([])
  const pageSize = 10

  const { registerFilters, unregisterFilters } = useRightPanel()

  const toggle = setter => val =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const statusOptions    = useMemo(() => [...new Set(VACATURES.map(v => v.status))].sort(), [])
  const eigenaarOptions  = useMemo(() => [...new Set(VACATURES.map(v => v.eigenaar.naam))].sort(), [])
  const klantOptions     = useMemo(() => [...new Set(VACATURES.map(v => v.klant.naam))].sort(), [])
  const categorieOptions = useMemo(() => [...new Set(VACATURES.map(v => v.categorie))].sort(), [])

  const filterGroups = useMemo(() => [
    { key: 'status',    label: 'Status',
      options: statusOptions.map(s    => ({ value: s, label: s })),
      selected: selStatuses,    onToggle: toggle(setSelStatuses) },
    { key: 'eigenaar',  label: 'Eigenaar',
      options: eigenaarOptions.map(e  => ({ value: e, label: e })),
      selected: selEigenaren,   onToggle: toggle(setSelEigenaren) },
    { key: 'klant',     label: 'Klant',
      options: klantOptions.map(k     => ({ value: k, label: k })),
      selected: selKlanten,     onToggle: toggle(setSelKlanten) },
    { key: 'categorie', label: 'Categorie',
      options: categorieOptions.map(c => ({ value: c, label: c })),
      selected: selCategorieen, onToggle: toggle(setSelCategorieen) },
  ], [statusOptions, eigenaarOptions, klantOptions, categorieOptions,
      selStatuses, selEigenaren, selKlanten, selCategorieen])

  useEffect(() => {
    registerFilters('vacancies', filterGroups)
    return () => unregisterFilters('vacancies')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    let rows = VACATURES
    if (selStatuses.length)    rows = rows.filter(v => selStatuses.includes(v.status))
    if (selEigenaren.length)   rows = rows.filter(v => selEigenaren.includes(v.eigenaar.naam))
    if (selKlanten.length)     rows = rows.filter(v => selKlanten.includes(v.klant.naam))
    if (selCategorieen.length) rows = rows.filter(v => selCategorieen.includes(v.categorie))
    return rows
  }, [selStatuses, selEigenaren, selKlanten, selCategorieen])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI row */}
        <div style={{
          display: 'flex', gap: 10, padding: '20px 24px 16px', flexShrink: 0,
        }}>
          {[
            { label: 'Totaal open',     value: VACATURES.length,  color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
            ...FASE_STATS.map(f => ({ label: f.label, value: f.count, color: f.color, bg: f.color + '22' })),
          ].map(k => (
            <div key={k.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '13px 16px', flex: 1, minWidth: 0,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, background: k.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: k.color, display: 'block' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: 32, padding: '10px 12px' }}>
                    <input type="checkbox" style={{ cursor: 'pointer' }} />
                  </th>
                  {['Titel','#','Status','Leads','Sollicitaties','Gepubliceerd','Eigenaar','Klant','Gemaakt op'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                      letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((vac, i) => {
                  const isSel = selected?.id === vac.id
                  return (
                    <tr key={vac.id} onClick={() => setSelected(isSel ? null : vac)}
                      style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', background: isSel ? 'var(--color-primary-bg)' : 'transparent',
                        transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '11px 12px' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '11px 12px', maxWidth: 320 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {vac.titel}
                        </div>
                      </td>
                      <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {vac.id}
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                          background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>{vac.status}</span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <BarCell value={vac.leads} max={200} />
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <BarCell value={vac.sollicitaties} max={500} warning={vac.sollicitaties > 100} />
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {vac.gepubliceerd.map(p => <PlatformIcon key={p} type={p} />)}
                        </div>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar initials={vac.eigenaar.initials} size={22} />
                          <span style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>{vac.eigenaar.naam}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <KlantLogo klant={vac.klant} />
                          <span style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>{vac.klant.naam}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {vac.datum}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Resultaten per pagina</span>
              <select style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px',
                background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12 }}>
                <option>10</option><option>25</option><option>50</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>1–{Math.min(pageSize, filtered.length)} van {filtered.length}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: page > 1 ? 'pointer' : 'default',
                    color: page > 1 ? 'var(--text)' : 'var(--text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ‹
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: page < totalPages ? 'pointer' : 'default',
                    color: page < totalPages ? 'var(--text)' : 'var(--text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <VacatureDrawer vac={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
