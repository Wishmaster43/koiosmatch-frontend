import { useState, useEffect, useMemo } from 'react'
import { useRightPanel } from '../../context/RightPanelContext'
import api from '../../lib/api'
import CandidateDrawer, { Avatar, StatusBadge } from './CandidateDrawer'
import AddCandidateModal from './AddCandidateModal'
import PaginationBar from '../../components/ui/PaginationBar'

// Map an API candidate record to the shape CandidateDrawer expects
function mapCandidate(c) {
  const name     = c.name ?? c.full_name ?? [c.firstname, c.lastname].filter(Boolean).join(' ') ?? [c.first_name, c.last_name].filter(Boolean).join(' ') ?? '?'
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

  const STATUS_COLORS = {
    actief:       '#22C55E',
    intake:       '#3B82F6',
    verwijderd:   '#EF4444',
    extern:       '#F59E0B',
    // Dutch status labels (legacy data)
    'Beschikbaar':      '#22C55E',
    'In procedure':     '#F59E0B',
    'Intake gepland':   '#3B82F6',
    'Nieuw kandidaat':  '#6366F1',
    'Niet beschikbaar': '#EF4444',
  }
  const status      = c.status ?? 'Onbekend'
  const statusColor = STATUS_COLORS[status] ?? '#9CA3AF'

  const ownerName     = c.owner?.name ?? c.recruiter?.name ?? c.owner_name ?? ''
  const ownerInitials = ownerName ? ownerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

  return {
    id:              c.id,
    name,
    initials,
    title:           c.function_title ?? c.title ?? '',
    status,
    statusColor,
    owner:           ownerName,
    ownerInitials,
    client:          c.client?.name ?? c.customer?.name ?? c.client_name ?? '',
    created:         c.created_at ? new Date(c.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    email:           c.email ?? '-',
    phone:           c.phone ?? c.mobile ?? '-',
    address:         [c.street, c.city].filter(Boolean).join(', ') || c.address || c.city || '-',
    gender:          c.gender ?? c.sex ?? '-',
    nationality:     c.nationality ?? '-',
    dob:             c.date_of_birth ?? c.dob ?? c.birthdate ?? '-',
    summary:         c.summary ?? c.bio ?? '',
    tags:            c.tags ?? [],
    vestiging:       c.branches ?? c.vestiging ?? [],
    ervaring:        c.experiences ?? c.work_experience ?? c.ervaring ?? [],
    opleiding:       c.educations ?? c.education ?? c.opleiding ?? [],
    talen:           c.languages ?? c.talen ?? [],
    certificeringen: c.certifications ?? c.certificeringen ?? [],
    vaardigheden:    c.skills ?? c.vaardigheden ?? [],
    documenten:      c.documents ?? c.documenten ?? [],
    sollicitaties:   c.applications ?? c.sollicitaties ?? [],
    notities:        c.notes ?? c.notities ?? [],
  }
}

// Temporary dummy data — replace once API returns candidates
const DUMMY_CANDIDATES = [
  { id: 1, name: 'Ismail Eddahchouri', initials: 'IE', title: 'Verzorgende IG', status: 'Beschikbaar', statusColor: '#22C55E', owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', client: 'Stichting Rivas Zorggroep', created: '12 jun 2026', email: 'i-s-m-a-i-l2007@outlook.com', phone: '+31624159406', address: 'Papendrecht', gender: 'Man', nationality: 'Marokkaans', dob: '15 maart 1995 (31 jaar)', summary: 'Verzorgende IG met ruime ervaring in de ouderenzorg.', tags: ['Papendrecht', 'Verzorging', 'IG', 'MBO'], vestiging: ['Koios flex B.V.', 'Koios zorg B.V.'], ervaring: [{ id: 1, title: 'Verzorgende IG', company: 'Stichting Rivas Zorggroep', location: 'Papendrecht', period: 'jan 2022–heden', desc: 'Via KoiosMatch' }, { id: 2, title: 'Helpende', company: 'Verpleeghuis Oudshoorn, Alrijne', location: 'Oudshoorn', period: 'jul 2020–dec 2021', desc: '' }], opleiding: [{ id: 1, title: 'MBO 4, Verzorgende IG', school: 'ROC Mondriaan', period: 'Uitgegeven jan 2022' }, { id: 2, title: 'VMBO Kader', school: 'Dongemond College', period: 'Uitgegeven jun 2018' }], talen: [{ id: 1, taal: 'Nederlands', mondeling: 'Goed', schriftelijk: 'Goed' }], certificeringen: [], vaardigheden: ['Rijbewijs B', 'BHV'], documenten: [{ name: 'CV_Ismail.pdf', size: '44856' }], sollicitaties: [], notities: [{ author: 'Wiktoria Opalenyk', ago: '1 week geleden', text: 'Kandidaat heeft interesse in vaste dienst.' }] },
  { id: 2, name: 'Merel Van Muijlwijk', initials: 'MV', title: 'Helpende', status: 'Beschikbaar', statusColor: '#22C55E', owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', client: 'Stichting Rivas Zorggroep', created: '12 jun 2026', email: 'merel.vm@gmail.com', phone: '+31612345678', address: 'Herenhof 12, 3500 AA, Utrecht', gender: 'Vrouw', nationality: 'Nederlands', dob: '22 juli 1998 (27 jaar)', summary: 'Helpende met ervaring in woonzorg.', tags: ['Utrecht', 'HR medewerker', 'MBO', 'Senior'], vestiging: ['Koios flex B.V.', 'Koios zorg B.V.', 'Koios works B.V.'], ervaring: [{ id: 1, title: 'ZZP Helpende', company: 'Verpleeghuis Oudshoorn, Alrijne', location: 'Oudshoorn', period: 'jul 2022–sep 2024', desc: 'Via Yesway' }], opleiding: [{ id: 1, title: 'MBO 2, Helpende Zorg & Welzijn', school: 'Regionaal Opleidingen Centrum Gouda', period: 'Uitgegeven jan 2015' }], talen: [{ id: 1, taal: 'Nederlands', mondeling: 'Goed', schriftelijk: 'Goed' }], certificeringen: [], vaardigheden: ['Rijbewijs B'], documenten: [{ name: 'Merel Van Muijlwijk - CV.pdf', size: '495516' }], sollicitaties: [], notities: [{ author: 'Danny Polak', ago: '2 maanden geleden', text: 'Beschikbaar vanaf: 16-08-2024\nUren per week: 24-32' }] },
  { id: 3,  name: 'Raginie Rasoelbaks',     initials: 'RR', title: 'Verpleegkundige',  status: 'In procedure',    statusColor: '#F59E0B', owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', client: '',                         created: '12 jun 2026', email: 'raginie.r@hotmail.com',   phone: '+31687654321', address: 'Rotterdam',  gender: 'Vrouw', nationality: 'Surinaams',   dob: '4 nov 1993 (32 jaar)',  summary: '', tags: ['Rotterdam'],          vestiging: ['Koios zorg B.V.'],  ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
  { id: 4,  name: 'Elif Akagündüz',         initials: 'EA', title: 'Gastvrouw',        status: 'Beschikbaar',     statusColor: '#22C55E', owner: 'Kelly van Vliet',   ownerInitials: 'KV', client: 'Yesway Zorg',            created: '12 jun 2026', email: 'elif.ak@gmail.com',       phone: '+31698765432', address: 'Amsterdam', gender: 'Vrouw', nationality: 'Turks',       dob: '30 mei 2000 (25 jaar)', summary: '', tags: ['Amsterdam', 'MBO'],   vestiging: ['Koios zorg B.V.'],  ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
  { id: 5,  name: 'Dina [Niet opgegeven]',  initials: 'DI', title: '',                 status: 'Beschikbaar',     statusColor: '#22C55E', owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', client: '',                         created: '12 jun 2026', email: '-',               phone: '-',            address: '-',         gender: '-',   nationality: '-',           dob: '-',                     summary: '', tags: [],                    vestiging: [],                   ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
  { id: 6,  name: 'Figen Ooijevaar',        initials: 'FO', title: 'Zorgmedewerker',  status: 'Nieuw kandidaat', statusColor: '#6366F1', owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', client: '',                         created: '11 jun 2026', email: 'figen.o@gmail.com',       phone: '+31645678901', address: 'Den Haag',  gender: 'Vrouw', nationality: 'Nederlands',  dob: '18 sep 1996 (29 jaar)', summary: '', tags: ['Den Haag'],          vestiging: ['Koios zorg B.V.'],  ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
  { id: 7,  name: 'Fernanda Vogel-Andrade', initials: 'FV', title: 'Helpende',         status: 'Beschikbaar',     statusColor: '#22C55E', owner: 'Wiktoria Opalenyk', ownerInitials: 'WO', client: '',                         created: '11 jun 2026', email: 'fernanda.va@gmail.com',   phone: '+31623456789', address: 'Eindhoven', gender: 'Vrouw', nationality: 'Braziliaans', dob: '11 feb 1994 (31 jaar)', summary: '', tags: ['Eindhoven', 'MBO'],  vestiging: [],                   ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
  { id: 8,  name: 'Rubina Rosella Milan',   initials: 'RM', title: 'Verzorgende',      status: 'Intake gepland',  statusColor: '#3B82F6', owner: 'Kelly van Vliet',   ownerInitials: 'KV', client: 'Stichting WoonzorgGroep', created: '11 jun 2026', email: 'rubina.rm@outlook.com',   phone: '+31678901234', address: 'Breda',     gender: 'Vrouw', nationality: 'Nederlands',  dob: '25 dec 1991 (34 jaar)', summary: '', tags: ['Breda', 'Verzorging'], vestiging: ['Koios zorg B.V.'],  ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
  { id: 9,  name: 'Priscilla Benjamin',     initials: 'PB', title: 'Verpleegkundige',  status: 'Nieuw kandidaat', statusColor: '#6366F1', owner: 'Bente de Jong',     ownerInitials: 'BD', client: '',                         created: '11 jun 2026', email: 'p.benjamin@gmail.com',    phone: '+31634567890', address: 'Tilburg',   gender: 'Vrouw', nationality: 'Surinaams',   dob: '7 aug 1997 (28 jaar)',  summary: '', tags: ['Tilburg'],           vestiging: [],                   ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
  { id: 10, name: 'Petra Kuiters',          initials: 'PK', title: 'Helpende',         status: 'Nieuw kandidaat', statusColor: '#6366F1', owner: 'Bente de Jong',     ownerInitials: 'BD', client: '',                         created: '11 jun 2026', email: 'petra.k@hotmail.com',     phone: '+31656789012', address: 'Groningen', gender: 'Vrouw', nationality: 'Nederlands',  dob: '14 apr 1989 (37 jaar)', summary: '', tags: ['Groningen', 'Senior'], vestiging: [],                   ervaring: [], opleiding: [], talen: [], certificeringen: [], vaardigheden: [], documenten: [], sollicitaties: [], notities: [] },
]

export default function CandidatesPage() {
  const [candidates,      setCandidates]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [page,            setPage]            = useState(1)
  const [pageSize,        setPageSize]        = useState(50)
  const [lastPage,        setLastPage]        = useState(1)
  const [total,           setTotal]           = useState(0)
  const [selected,        setSelected]        = useState(null)
  const [drawerExpanded,  setDrawerExpanded]  = useState(false)
  const [addOpen,         setAddOpen]         = useState(false)
  const [users,           setUsers]           = useState([])

  const [selectedStatus,      setSelectedStatus]      = useState([])
  const [selectedOwner,       setSelectedOwner]       = useState([])
  const [selectedVestiging,   setSelectedVestiging]   = useState([])
  const [selectedGeslacht,    setSelectedGeslacht]    = useState([])
  const [selectedNationaliteit, setSelectedNationaliteit] = useState([])
  const [selectedTitle,       setSelectedTitle]       = useState([])
  const [selectedTags,        setSelectedTags]        = useState([])
  const [globalSearch,        setGlobalSearch]        = useState('')
  const [locationCity,        setLocationCity]        = useState('')
  const [locationRadius,      setLocationRadius]      = useState('')

  const { registerFilters, unregisterFilters } = useRightPanel()

  const handlePageSizeChange = (newSize) => { setPageSize(newSize); setPage(1) }

  useEffect(() => {
    api.get('/candidates', { params: { page, per_page: pageSize } })
      .then(res => {
        const body = res.data
        const rows = Array.isArray(body) ? body : (body?.data ?? [])
        if (rows.length > 0) {
          setCandidates(rows.map(mapCandidate))
          setTotal(body?.meta?.total ?? body?.total ?? rows.length)
          setLastPage(body?.meta?.last_page ?? body?.last_page ?? 1)
        } else {
          setCandidates(DUMMY_CANDIDATES)
          setTotal(DUMMY_CANDIDATES.length)
          setLastPage(1)
        }
      })
      .catch(() => {
        setCandidates(DUMMY_CANDIDATES)
        setTotal(DUMMY_CANDIDATES.length)
        setLastPage(1)
      })
      .finally(() => setLoading(false))
  }, [page, pageSize])

  useEffect(() => {
    api.get('/users')
      .then(res => { const d = res.data; setUsers(Array.isArray(d) ? d : (d?.data ?? [])) })
      .catch(() => {})
  }, [])

  const statusOptions       = useMemo(() => [...new Set(candidates.map(c => c.status))].map(s => ({ value: s, label: s, count: candidates.filter(c => c.status === s).length })), [candidates])
  const ownerOptions        = useMemo(() => [...new Set(candidates.map(c => c.owner).filter(Boolean))].map(o => ({ value: o, label: o, count: candidates.filter(c => c.owner === o).length })), [candidates])
  const vestigingOptions    = useMemo(() => [...new Set(candidates.flatMap(c => c.vestiging ?? []))].map(v => ({ value: v, label: v, count: candidates.filter(c => (c.vestiging ?? []).includes(v)).length })), [candidates])
  const geslachtOptions     = useMemo(() => [...new Set(candidates.map(c => c.gender).filter(v => v && v !== '-'))].map(v => ({ value: v, label: v, count: candidates.filter(c => c.gender === v).length })), [candidates])
  const nationaliteitOptions= useMemo(() => [...new Set(candidates.map(c => c.nationality).filter(v => v && v !== '-'))].map(v => ({ value: v, label: v, count: candidates.filter(c => c.nationality === v).length })), [candidates])
  const titleOptions        = useMemo(() => [...new Set(candidates.map(c => c.title).filter(Boolean))].map(v => ({ value: v, label: v, count: candidates.filter(c => c.title === v).length })), [candidates])
  const tagOptions          = useMemo(() => [...new Set(candidates.flatMap(c => c.tags ?? []))].map(v => ({ value: v, label: v, count: candidates.filter(c => (c.tags ?? []).includes(v)).length })), [candidates])

  const tog = (set) => (v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  const filterGroups = useMemo(() => [
    { key: 'global-search', type: 'global-search', label: 'Zoeken', placeholder: 'Zoek kandidaat, notitie, document…', value: globalSearch, onChange: setGlobalSearch },
    { key: 'location',      type: 'location',      label: 'Straal', city: locationCity, radius: locationRadius, onCityChange: setLocationCity, onRadiusChange: setLocationRadius },
    { key: 'status',        label: 'Status',        selected: selectedStatus,        options: statusOptions,        onToggle: tog(setSelectedStatus) },
    { key: 'title',         label: 'Functietitel',  selected: selectedTitle,         options: titleOptions,         onToggle: tog(setSelectedTitle) },
    { key: 'owner',         label: 'Eigenaar',      selected: selectedOwner,         options: ownerOptions,         onToggle: tog(setSelectedOwner) },
    { key: 'vestiging',     label: 'Vestiging',     selected: selectedVestiging,     options: vestigingOptions,     onToggle: tog(setSelectedVestiging) },
    { key: 'geslacht',      label: 'Geslacht',      selected: selectedGeslacht,      options: geslachtOptions,      onToggle: tog(setSelectedGeslacht) },
    { key: 'nationaliteit', label: 'Nationaliteit', selected: selectedNationaliteit, options: nationaliteitOptions, onToggle: tog(setSelectedNationaliteit) },
    { key: 'tags',          label: 'Tags',          selected: selectedTags,          options: tagOptions,           onToggle: tog(setSelectedTags) },
  ], [globalSearch, locationCity, locationRadius,
      selectedStatus, selectedTitle, selectedOwner, selectedVestiging, selectedGeslacht, selectedNationaliteit, selectedTags,
      statusOptions, titleOptions, ownerOptions, vestigingOptions, geslachtOptions, nationaliteitOptions, tagOptions])

  useEffect(() => {
    registerFilters('candidates-page', filterGroups)
    return () => unregisterFilters('candidates-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    return candidates.filter(c => {
      if (selectedStatus.length        && !selectedStatus.includes(c.status))                             return false
      if (selectedTitle.length         && !selectedTitle.includes(c.title))                               return false
      if (selectedOwner.length         && !selectedOwner.includes(c.owner))                               return false
      if (selectedVestiging.length     && !selectedVestiging.some(v => (c.vestiging ?? []).includes(v))) return false
      if (selectedGeslacht.length      && !selectedGeslacht.includes(c.gender))                           return false
      if (selectedNationaliteit.length && !selectedNationaliteit.includes(c.nationality))                 return false
      if (selectedTags.length          && !selectedTags.some(t => (c.tags ?? []).includes(t)))           return false
      if (q) {
        const haystack = [
          c.name, c.title, c.email, c.phone, c.address, c.status, c.owner,
          c.gender, c.nationality, c.dob, c.summary,
          ...(c.tags ?? []),
          ...(c.vestiging ?? []),
          ...(c.notities ?? []).map(n => `${n.title ?? ''} ${n.text ?? n.body ?? ''}`),
          ...(c.documenten ?? []).map(d => d.name ?? d.file_name ?? ''),
          ...(c.ervaring ?? []).map(e => `${e.title ?? ''} ${e.company ?? ''}`),
          ...(c.opleiding ?? []).map(o => `${o.title ?? ''} ${o.school ?? ''}`),
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [candidates, globalSearch, selectedStatus, selectedTitle, selectedOwner, selectedVestiging, selectedGeslacht, selectedNationaliteit, selectedTags])

  const selectCandidate = (c) => { setSelected(c); setDrawerExpanded(false) }

  const kpis = useMemo(() => {
    const count = (s) => candidates.filter(c => c.status === s).length
    return [
      { label: 'Totaal',         value: total,                    sub: 'alle kandidaten',      color: '#6366F1', bg: '#EEF2FF' },
      { label: 'Beschikbaar',    value: count('Beschikbaar'),     sub: 'actief beschikbaar',   color: '#22C55E', bg: '#DCFCE7' },
      { label: 'Nieuw',          value: count('Nieuw kandidaat'), sub: 'deze week toegevoegd', color: '#3B82F6', bg: '#EFF6FF' },
      { label: 'In procedure',   value: count('In procedure'),    sub: 'lopende procedures',   color: '#F59E0B', bg: '#FEF3C7' },
      { label: 'Intake gepland', value: count('Intake gepland'),  sub: 'komende intakes',      color: '#8B5CF6', bg: '#F3E8FF' },
    ]
  }, [candidates, total])

  return (
    <>
      {addOpen && <AddCandidateModal onClose={() => setAddOpen(false)} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* Table area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* KPI row */}
          <div style={{ padding: '20px 24px 14px', display: 'flex', gap: 10, flexShrink: 0 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: k.bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.value > 99 ? '∞' : k.value}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{k.value.toLocaleString('nl-NL')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + Kandidaat toevoegen
            </button>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Laden…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Naam','Status','Eigenaar','Gemaakt op'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11,
                        fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} onClick={() => selectCandidate(c)}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer',
                        background: selected?.id === c.id ? 'var(--color-primary-bg)' : 'transparent' }}
                      onMouseEnter={e => { if (selected?.id !== c.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (selected?.id !== c.id) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar initials={c.initials} size={26} />
                          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px' }}><StatusBadge label={c.status} color={c.statusColor} /></td>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.ownerInitials !== '?' && <Avatar initials={c.ownerInitials} size={20} />}
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.owner || '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{c.created}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px 10px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        Geen kandidaten gevonden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

          </div>

          <PaginationBar
            page={page}
            totalPages={lastPage}
            totalRows={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>

        {/* Drawer */}
        <CandidateDrawer
          candidate={selected}
          onClose={() => { setSelected(null); setDrawerExpanded(false) }}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          users={users}
        />
      </div>
    </>
  )
}
