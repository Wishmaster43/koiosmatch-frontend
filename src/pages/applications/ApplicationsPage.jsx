import { useState, useRef, useEffect, useMemo } from 'react'
import { LayoutList, Kanban, ChevronDown, Bot, X, FileText, Plus, Edit2, Zap } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'

// ── Drawer ────────────────────────────────────────────────────────────────────
const DRAWER_TABS = ['Sollicitatie','Kandidaat','Vacature','Interviews','Afspraken','Tijdlijn','Notities']

function AppDrawer({ item, onClose }) {
  const [tab, setTab] = useState('Sollicitatie')
  if (!item) return null
  const vac = VACATURES.find(v => v.id === item.vacatureId)
  const faseColor = FASE_COLORS[item.fase] || '#6B7280'

  const renderContent = () => {
    switch (tab) {
      case 'Sollicitatie': return (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)'][item.initials.charCodeAt(0) % 5],
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 700 }}>
              {item.initials}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{item.naam}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Fase</div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 99,
                background: faseColor + '20', color: faseColor }}>{item.fase}</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bron</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{item.bron}</div>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Taak</div>
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px',
              background: 'var(--color-primary-bg)', borderRadius: 8, border: '1px solid #C7D2FE' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <Zap size={11} color="var(--color-primary)" />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)' }}>AI</span>
              </div>
              <span style={{ fontSize: 13, color: '#3730A3', lineHeight: 1.5 }}>{item.taak}</span>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 20 }}>
            <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Recruiter</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{item.eigenaar}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Klant</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{item.klant}</div></div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Vacature</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{vac?.title || '—'}</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Afwijzing</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Reden</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--input-bg)', cursor: 'pointer' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selecteer reden</span>
                <ChevronDown size={13} color="var(--text-muted)" />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Toelichting</div>
              <textarea rows={3} style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <button style={{ padding: '7px 18px', fontSize: 13, fontWeight: 500, borderRadius: 8,
              border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              Afwijzen
            </button>
          </div>
        </div>
      )
      case 'Vacature': return (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, position: 'relative',
            background: 'linear-gradient(135deg,#F97316,#FBBF24)', height: 90 }}>
            <button style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 7,
              background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Edit2 size={12} />
            </button>
            <div style={{ position: 'absolute', bottom: -16, left: 16, width: 44, height: 44, borderRadius: 10,
              background: '#fff', border: '3px solid #fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
              <span style={{ fontSize: 7, fontWeight: 800, color: 'var(--color-success)' }}>RIVAS</span>
            </div>
          </div>
          <div style={{ marginTop: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{vac?.title}</div>
              <button style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                fontSize: 11, fontWeight: 500, borderRadius: 7, border: '1px solid var(--border)',
                background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
                <Edit2 size={11} /> Bewerken
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.klant}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 20 }}>
            {[['Vacature-ID','00065'],['Status','Open'],['Soort dienstverband','Vaste termijn'],['Locatie','Papendrecht'],
              ['Salaris','€ 2.643 – € 3.471/mnd'],['Wekelijkse uren','20–32 uur'],['Ervaring','1 jaar'],
              ['Senioriteit','Professional'],['Opleiding','MBO'],['Branche','Gezondheidszorg']].map(([l,v]) => (
              <div key={l}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
                {l==='Status'
                  ? <span style={{ fontSize:11,fontWeight:500,padding:'2px 10px',borderRadius:99,background:'var(--color-success-bg)',color:'var(--color-success)' }}>{v}</span>
                  : <div style={{ fontSize:13,color:'var(--text)' }}>{v}</div>}
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {['Verzorgende IG','Papendrecht','Gezondheidszorg','flex','goed betaald'].map(t => (
                <span key={t} style={{ fontSize:11,padding:'3px 9px',borderRadius:99,
                  background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      )
      case 'Notities': return (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, color: 'var(--text-muted)' }}>
            <FileText size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Nog geen notities</div>
            <div style={{ fontSize: 12, marginTop: 4, textAlign: 'center' }}>Voeg interne notities toe om je team op één lijn te houden</div>
          </div>
        </div>
      )
      default: return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
          <FileText size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>Geen {tab.toLowerCase()} beschikbaar</div>
        </div>
      )
    }
  }

  return (
    <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Sollicitatie</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)',
        flexShrink: 0, padding: '0 20px' }}>
        {DRAWER_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 10px', fontSize: 12, fontWeight: tab===t ? 600 : 400,
              whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer',
              color: tab===t ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: tab===t ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1 }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>{renderContent()}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gemaakt op {item.datum}</span>
        <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500,
          padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
          <FileText size={12} /> CV
        </button>
      </div>
    </div>
  )
}

// ── Dummy vacatures ───────────────────────────────────────────────────────────
const VACATURES = [
  { id: 'v1', title: 'Verzorgende IG - Papendrecht - Ouderzorg (PG) - Flexibel & goed betaald', klant: 'Stichting Rivas Zorggroep (Hoofd)', bron: 'Werkzoeken' },
  { id: 'v2', title: 'Helpende Plus – Papendrecht | Dag, Avond & Weekend | Flexibel + bonus',   klant: 'Stichting Rivas Zorggroep (Hoofd)', bron: 'Werkzoeken' },
  { id: 'v3', title: 'Persoonlijk begeleider | LVB+ | Den Haag',                                klant: 'Yesway zorg',                      bron: 'Werkzoeken' },
  { id: 'v4', title: 'Verzorgende IG | Zuid-Holland | DUMMY',                                   klant: 'Yesway works',                     bron: 'Yesway Import' },
  { id: 'v5', title: 'Helpende (Plus) | Zuid-Holland | DUMMY',                                  klant: 'Yesway works',                     bron: 'Yesway Import' },
  { id: 'v6', title: 'Helpende Plus in Anna Paulowna',                                          klant: 'Stichting WoonzorgGroep Samen',     bron: 'Werkzoeken' },
  { id: 'v7', title: 'Helpende (Plus) | Noord-Holland | DUMMY',                                 klant: 'Yesway works',                     bron: 'Yesway Import' },
  { id: 'v8', title: 'Verzorgende IG – Rotterdam & omgeving | Flexibele diensten + bonus',      klant: 'Yesway zorg',                      bron: 'Werkzoeken' },
  { id: 'v9', title: 'Verzorgende IG PG – Rotterdam & omgeving | Flexibele diensten + bonus',   klant: 'Yesway zorg',                      bron: 'Werkzoeken' },
  { id: 'v10',title: 'Verzorgende IG – Revalidatiezorg | Rotterdam Zuid | Dag- en avonddiensten | 20–32 uur', klant: 'Yesway', bron: 'Werkzoeken' },
  { id: 'v11',title: 'Verzorgende IG | Begeleider - EMB – Rotterdam | Waar jij spreekt zonder woorden en voelt wat iemand nodig heeft', klant: 'Yesway zorg', bron: 'Werkzoeken' },
]

// ── Dummy sollicitaties ───────────────────────────────────────────────────────
const INIT_SOLLICITATIES = [
  { id: 1,  naam: 'Ismail Eddahchouri',    initials: 'I',  vacatureId: 'v1',  match: null, taak: 'Beoordeel de sollicitatie en plan een kennismakingsgesprek', fase: 'Gesolliciteerd', bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Stichting Rivas Zorggroep (Hoofd)', kandidaatStatus: 'Available',       statusColor: 'var(--color-success)', datum: '12 jun 2026', isNew: true  },
  { id: 2,  naam: 'Merel Van Muijlwijk',   initials: 'M',  vacatureId: 'v2',  match: null, taak: 'Nodig de kandidaat uit voor een kennismakingsgesprek',       fase: 'Gesolliciteerd', bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Stichting Rivas Zorggroep (Hoofd)', kandidaatStatus: 'Available',       statusColor: 'var(--color-success)', datum: '12 jun 2026', isNew: true  },
  { id: 3,  naam: 'Elif Akagündüz',        initials: 'E',  vacatureId: 'v3',  match: null, taak: 'Beoordeel of Elif uitgenodigd kan worden voor gesprek',       fase: 'Gesolliciteerd', bron: 'Werkzoeken',    eigenaar: 'Kelly van Vliet',   eigenaarInitials: 'K', klant: 'Yesway zorg',                      kandidaatStatus: 'Available',       statusColor: 'var(--color-success)', datum: '12 jun 2026', isNew: false },
  { id: 4,  naam: 'Figen Ooijevaar',       initials: 'F',  vacatureId: 'v4',  match: 78,   taak: 'Plan een kennismakingsgesprek met Figen',                    fase: 'Gesolliciteerd', bron: 'Yesway Import', eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '11 jun 2026', isNew: false },
  { id: 5,  naam: 'Fernanda Vogel-Andrade',initials: 'F',  vacatureId: 'v4',  match: 78,   taak: 'Bel Fernanda volgende week voor h...',                       fase: 'Uitgenodigd',    bron: 'Yesway Import', eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '11 jun 2026', isNew: false },
  { id: 6,  naam: 'Rubina Rosella Milan',  initials: 'R',  vacatureId: 'v6',  match: 65,   taak: 'Kandidaat is uitgenodigd beoordeel de match voor vervolgstap', fase: 'Uitgenodigd',    bron: 'Werkzoeken',    eigenaar: 'Kelly van Vliet',   eigenaarInitials: 'K', klant: 'Stichting WoonzorgGroep Samen',    kandidaatStatus: 'Intake gepland',  statusColor: 'var(--color-secondary)', datum: '11 jun 2026', isNew: true  },
  { id: 7,  naam: 'Priscilla Benjamin',    initials: 'P',  vacatureId: 'v5',  match: 68,   taak: 'Plan intakegesprek voor Priscilla Be...',                    fase: 'Gesolliciteerd', bron: 'Yesway Import', eigenaar: 'Bente de Jong',     eigenaarInitials: 'B', klant: 'Yesway works',                     kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '11 jun 2026', isNew: false },
  { id: 8,  naam: 'Petra Kuiters',         initials: 'P',  vacatureId: 'v5',  match: 67,   taak: 'Beoordeel kandidaat voor de volgende stap',                  fase: 'Gesolliciteerd', bron: 'Yesway Import', eigenaar: 'Bente de Jong',     eigenaarInitials: 'B', klant: 'Yesway works',                     kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '11 jun 2026', isNew: false },
  { id: 9,  naam: 'Fenicia Uiterloo',      initials: 'F',  vacatureId: 'v4',  match: 78,   taak: 'Beoordeel de match en nodig kandidaat uit',                  fase: 'Gesolliciteerd', bron: 'Yesway Import', eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '11 jun 2026', isNew: false },
  { id: 10, naam: 'Felicia Meijer',        initials: 'F',  vacatureId: 'v4',  match: 78,   taak: 'Beoordeel kandidaat voor uitnodiging',                       fase: 'Gesolliciteerd', bron: 'Yesway Import', eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '11 jun 2026', isNew: false },
  { id: 11, naam: 'Shemion Kuwas',         initials: 'S',  vacatureId: 'v9',  match: 35,   taak: 'Beoordeel kandidaat voor de volgende stap',                  fase: 'Geaccepteerd',   bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway zorg',                      kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '8 jun 2026',  isNew: true  },
  { id: 12, naam: 'Monica Vogel',          initials: 'M',  vacatureId: 'v5',  match: 70,   taak: 'Nodig kandidaat uit voor gesprek',                           fase: 'Geaccepteerd',   bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '8 jun 2026',  isNew: false },
  { id: 13, naam: 'Esther Boer',           initials: 'E',  vacatureId: 'v4',  match: 78,   taak: 'Nodig de kandidaat uit voor een kennismakingsgesprek',       fase: 'Geaccepteerd',   bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '8 jun 2026',  isNew: false },
  { id: 14, naam: 'Emi Soliano',           initials: 'E',  vacatureId: 'v7',  match: 100,  taak: 'Evalueer sollicitatie voor vervolgstap',                     fase: 'Geaccepteerd',   bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '8 jun 2026',  isNew: false },
  { id: 15, naam: 'Marish Tewari',         initials: 'M',  vacatureId: 'v5',  match: 55,   taak: 'Suur kandidaat uitnodiging voor ko...',                      fase: 'Uitgenodigd',    bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '11 jun 2026', isNew: false },
  { id: 16, naam: 'Nema Kamwanda',         initials: 'N',  vacatureId: 'v4',  match: 81,   taak: 'Plan gesprek met Nema',                                      fase: 'Uitgenodigd',    bron: 'Werkzoeken',    eigenaar: 'Bente de Jong',     eigenaarInitials: 'B', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '11 jun 2026', isNew: true  },
  { id: 17, naam: 'Nadia Tahtah',          initials: 'N',  vacatureId: 'v11', match: 82,   taak: 'Nodig Nadia uit voor een kennismakingsgesprek',              fase: 'Voorstel gedaan',bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway zorg',                      kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '7 jun 2026',  isNew: true  },
  { id: 18, naam: 'Manike Basnayaka',      initials: 'M',  vacatureId: 'v5',  match: 72,   taak: 'Stuur kandidaat een uitnodiging vo...',                      fase: 'Voorstel gedaan',bron: 'Werkzoeken',    eigenaar: 'Bente de Jong',     eigenaarInitials: 'B', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '5 jun 2026',  isNew: false },
  { id: 19, naam: 'Chantal Wagemakers',    initials: 'C',  vacatureId: 'v10', match: 72,   taak: 'Plan een kennismakingsgesprek me...',                        fase: 'Voorstel gedaan',bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway',                           kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '2 jun 2026',  isNew: true  },
  { id: 20, naam: 'Genevieve Nyanda',      initials: 'G',  vacatureId: 'v5',  match: 50,   taak: 'Bevestig afwijzing wegens geen interesse',                   fase: 'Afgewezen',      bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '26 mei 2026', isNew: false },
  { id: 21, naam: 'Joehna Hous',           initials: 'J',  vacatureId: 'v4',  match: 73,   taak: 'Plan gesprek met Joehna',                                    fase: 'Voorstel gedaan',bron: 'Werkzoeken',    eigenaar: 'Kelly van Vliet',   eigenaarInitials: 'K', klant: 'Yesway works',                     kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '4 jun 2026',  isNew: false },
  { id: 22, naam: 'Amara Diallo',          initials: 'A',  vacatureId: 'v8',  match: 61,   taak: 'Beoordeel de sollicitatie',                                  fase: 'Gesolliciteerd', bron: 'Werkzoeken',    eigenaar: 'Kelly van Vliet',   eigenaarInitials: 'K', klant: 'Yesway zorg',                      kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '10 jun 2026', isNew: false },
  { id: 23, naam: 'Rosa Tijssen',          initials: 'R',  vacatureId: 'v5',  match: 84,   taak: 'Nodig Rosa uit voor gesprek',                                fase: 'Geaccepteerd',   bron: 'Yesway Import', eigenaar: 'Bente de Jong',     eigenaarInitials: 'B', klant: 'Yesway works',                     kandidaatStatus: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)', datum: '7 jun 2026',  isNew: false },
  { id: 24, naam: 'Layla Mansour',         initials: 'L',  vacatureId: 'v3',  match: 77,   taak: 'Beoordeel sollicitatie Layla',                               fase: 'Gesolliciteerd', bron: 'Werkzoeken',    eigenaar: 'Kelly van Vliet',   eigenaarInitials: 'K', klant: 'Yesway zorg',                      kandidaatStatus: 'Beschikbaar',     statusColor: 'var(--color-success)', datum: '11 jun 2026', isNew: false },
  { id: 25, naam: 'Yara Fontein',          initials: 'Y',  vacatureId: 'v1',  match: 69,   taak: 'Plan kennismakingsgesprek Yara',                             fase: 'Gesolliciteerd', bron: 'Werkzoeken',    eigenaar: 'Wiktoria Opalenyk', eigenaarInitials: 'W', klant: 'Stichting Rivas Zorggroep (Hoofd)', kandidaatStatus: 'Available',       statusColor: 'var(--color-success)', datum: '10 jun 2026', isNew: false },
]

const FASES = ['Gesolliciteerd', 'Geaccepteerd', 'Uitgenodigd', 'Voorstel gedaan', 'Aangenomen', 'Afgewezen']

const FASE_COLORS = {
  'Gesolliciteerd':  'var(--color-primary)',
  'Geaccepteerd':    '#8B5CF6',
  'Uitgenodigd':     'var(--color-secondary)',
  'Voorstel gedaan': 'var(--color-warning)',
  'Aangenomen':      'var(--color-success)',
  'Afgewezen':       'var(--color-danger)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ initials, size = 26 }) {
  const colors = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', '#8B5CF6', '#EC4899']
  const color  = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.38, fontWeight: 700,
    }}>{initials}</div>
  )
}

function MatchCircle({ pct }) {
  const color = pct >= 75 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color }}>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" fill="none" stroke={color + '33'} strokeWidth="2" />
        <circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 6 * pct / 100} 100`}
          strokeLinecap="round" transform="rotate(-90 7 7)" />
      </svg>
      {pct}%
    </span>
  )
}

function KandidaatStatusBadge({ label, color }) {
  const bg = color + '22'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function FaseBadge({ fase }) {
  const color = FASE_COLORS[fase] || '#6B7280'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
      background: color + '18', color, whiteSpace: 'nowrap' }}>
      {fase}
    </span>
  )
}

// ── Table View ────────────────────────────────────────────────────────────────
function TableView({ items, selected, onSelect }) {
  const cols = [
    { key: 'naam',      label: 'Naam',                    w: 160 },
    { key: 'vacature',  label: 'Vacature',                w: 340 },
    { key: 'match',     label: 'Match',                   w: 80  },
    { key: 'taak',      label: 'Taak',                    w: 220 },
    { key: 'fase',      label: 'Fase',                    w: 130 },
    { key: 'bron',      label: 'Bron',                    w: 110 },
    { key: 'eigenaar',  label: 'Eigenaar',                w: 140 },
    { key: 'klant',     label: 'Klant',                   w: 200 },
    { key: 'status',    label: 'Status van de sollicitant',w: 160 },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <th style={{ width: 36, padding: '10px 12px' }}>
              <input type="checkbox" />
            </th>
            {cols.map(c => (
              <th key={c.key} style={{ width: c.w, padding: '10px 12px', textAlign: 'left',
                fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => {
            const vac = VACATURES.find(v => v.id === s.vacatureId)
            const isSelected = selected?.id === s.id
            return (
              <tr key={s.id} onClick={() => onSelect(isSelected ? null : s)}
                style={{ borderBottom: '1px solid var(--border)',
                  background: isSelected ? 'var(--color-primary-bg)' : i % 2 === 0 ? 'var(--surface)' : 'var(--hover-bg)',
                  cursor: 'pointer' }}>
                <td style={{ padding: '10px 12px' }}><input type="checkbox" /></td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar initials={s.initials} />
                    <span style={{ fontWeight: 500, color: 'var(--text)' }}>{s.naam}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text)', maxWidth: 340 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {vac?.title || '-'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {s.match ? <MatchCircle pct={s.match} /> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                    background: 'var(--color-primary-bg)', color: 'var(--color-primary)', padding: '3px 8px', borderRadius: 6,
                    fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <Bot size={12} />
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 180 }}>
                      {s.taak}
                    </span>
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}><FaseBadge fase={s.fase} /></td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{s.bron}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar initials={s.eigenaarInitials} size={22} />
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{s.eigenaar}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.klant}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <KandidaatStatusBadge label={s.kandidaatStatus} color={s.statusColor} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ item, onDragStart }) {
  const vac = VACATURES.find(v => v.id === item.vacatureId)
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, item.id)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 8,
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* Header: avatar + naam + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Avatar initials={item.initials} size={28} />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}>{item.naam}</span>
        {item.isNew
          ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)', flexShrink: 0 }} />
          : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
        }
      </div>

      {/* Match */}
      {item.match && (
        <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <MatchCircle pct={item.match} />
          <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>
            {item.match >= 75 ? 'Sterke match' : item.match >= 55 ? 'Goede match' : 'Redelijke match'}
          </span>
        </div>
      )}

      {/* Vacature */}
      {vac && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>📋</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {vac.title}
          </span>
        </div>
      )}

      {/* Klant */}
      {item.klant && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏢</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.klant}</span>
        </div>
      )}

      {/* AI Taak */}
      <div style={{ background: 'var(--color-primary-bg)', borderRadius: 6, padding: '5px 8px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
          <Bot size={11} style={{ color: 'var(--color-primary)', marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 500,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.taak}
          </span>
        </div>
      </div>

      {/* Footer: eigenaar + datum */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Avatar initials={item.eigenaarInitials} size={18} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.datum}</span>
      </div>
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ fase, items, onDragStart, onDrop, onDragOver }) {
  const color = FASE_COLORS[fase] || '#6B7280'
  return (
    <div
      style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={e => onDrop(e, fase)}
      onDragOver={onDragOver}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{fase}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
          background: color + '20', color,
        }}>{items.length}</span>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, minHeight: 60 }}>
        {items.map(item => (
          <KanbanCard key={item.id} item={item} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  )
}

// ── Kanban View ───────────────────────────────────────────────────────────────
function KanbanView({ items, onMove }) {
  const dragId = useRef(null)

  function handleDragStart(e, id) {
    dragId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e, fase) {
    e.preventDefault()
    if (dragId.current != null) {
      onMove(dragId.current, fase)
      dragId.current = null
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
      <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', paddingBottom: 8 }}>
        {FASES.map(fase => (
          <KanbanColumn
            key={fase}
            fase={fase}
            items={items.filter(i => i.fase === fase)}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ApplicationsPage() {
  const [view,          setView]          = useState('table')
  const [tab,           setTab]           = useState('actief')
  const [selected,      setSelected]      = useState(null)
  const [sollicitaties, setSollicitaties] = useState(INIT_SOLLICITATIES)
  const [selectedFase,  setSelectedFase]  = useState([])
  const [selectedVac,   setSelectedVac]   = useState([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  const faseOptions = useMemo(() => [...new Set(sollicitaties.map(s => s.fase))].map(f => ({ value: f, label: f, count: sollicitaties.filter(s => s.fase === f).length })), [sollicitaties])
  const vacOptions  = useMemo(() => VACATURES.map(v => ({ value: String(v.id), label: v.title, count: sollicitaties.filter(s => s.vacatureId === v.id).length })), [sollicitaties])

  const filterGroups = useMemo(() => [
    { key: 'fase',     label: 'Fase',     selected: selectedFase, options: faseOptions, onToggle: v => setSelectedFase(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'vacature', label: 'Vacature', selected: selectedVac,  options: vacOptions,  onToggle: v => setSelectedVac(p  => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [selectedFase, selectedVac, faseOptions, vacOptions])

  useEffect(() => {
    registerFilters('applications-page', filterGroups)
    return () => unregisterFilters('applications-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => sollicitaties.filter(s => {
    const isAfgewezen = s.fase === 'Afgewezen'
    if (tab === 'actief'    && isAfgewezen)  return false
    if (tab === 'afgewezen' && !isAfgewezen) return false
    if (selectedFase.length && !selectedFase.includes(s.fase))              return false
    if (selectedVac.length  && !selectedVac.includes(String(s.vacatureId))) return false
    return true
  }), [sollicitaties, tab, selectedFase, selectedVac])

  function handleMove(id, newFase) {
    setSollicitaties(prev => prev.map(s => s.id === id ? { ...s, fase: newFase } : s))
  }

  const kpis = useMemo(() => {
    const all    = sollicitaties
    const actief = all.filter(s => s.fase !== 'Afgewezen')
    const count  = (fase) => all.filter(s => s.fase === fase).length
    return [
      { label: 'Totaal actief',    value: actief.length,                    color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
      { label: 'Gesolliciteerd',   value: count('Gesolliciteerd'),           color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
      { label: 'Geaccepteerd',     value: count('Geaccepteerd'),            color: '#8B5CF6', bg: '#F3E8FF' },
      { label: 'Uitgenodigd',      value: count('Uitgenodigd'),             color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
      { label: 'Voorstel gedaan',  value: count('Voorstel gedaan'),         color: '#9CA3AF', bg: '#F3F4F6' },
      { label: 'Afgewezen',        value: count('Afgewezen'),               color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
    ]
  }, [sollicitaties])

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      {/* ── KPI row ── */}
      <div style={{
        display: 'flex', gap: 10, padding: '20px 20px 12px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--bg)', border: '1px solid var(--border)',
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

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
        padding: '8px 20px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {['actief', 'afgewezen'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '5px 14px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
            background: tab === t ? 'var(--color-primary)' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text)',
            border: tab === t ? 'none' : '1px solid var(--border)',
            borderRadius: 7, cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setView('table')} title="Lijstweergave" style={{
            padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
            background: view === 'table' ? 'var(--color-primary)' : 'var(--surface)',
            color: view === 'table' ? '#fff' : 'var(--text)',
          }}>
            <LayoutList size={16} />
          </button>
          <button onClick={() => setView('kanban')} title="Kanban-weergave" style={{
            padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
            background: view === 'kanban' ? 'var(--color-primary)' : 'var(--surface)',
            color: view === 'kanban' ? '#fff' : 'var(--text)',
          }}>
            <Kanban size={16} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {view === 'table'
        ? <TableView items={filtered} selected={selected} onSelect={setSelected} />
        : <KanbanView items={filtered} onMove={handleMove} />
      }

      {/* ── Footer (table only) ── */}
      {view === 'table' && (
        <div style={{
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '10px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Resultaten per pagina</span>
            <select style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px',
              background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13 }}>
              <option>10</option><option>25</option><option>50</option>
            </select>
          </div>
          <span>1-{Math.min(10, filtered.length)} van {filtered.length}</span>
        </div>
      )}
    </div>
    <AppDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
