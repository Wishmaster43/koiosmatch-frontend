/**
 * mocks — dummy datasets for the candidate drawer's planning tab. Kept separate so
 * production component files stay clean; swap these for API calls later.
 */
export const AGENDA_SHIFTS = [
  { date: '2026-06-16', start: 7,  end: 15, client: 'Thuiszorg Noord',  function: 'Verzorgende IG', color: '#1B60A9', location: 'Amsterdam', workedBefore: 4, address: 'Amstelveenseweg 220' },
  { date: '2026-06-18', start: 13, end: 17, client: 'Zorggroep West',   function: 'Helpende Plus',  color: '#8B5CF6', location: 'Haarlem',   workedBefore: 0, address: 'Kennemerplein 10'    },
  { date: '2026-06-19', start: 8,  end: 12, client: 'Thuiszorg Noord',  function: 'Verzorgende IG', color: '#1B60A9', location: 'Amsterdam', workedBefore: 4, address: 'Amstelveenseweg 220' },
  { date: '2026-06-20', start: 10, end: 13, client: 'Zorggroep Oost',   function: 'Helpende',       color: '#16A34A', location: 'Utrecht',   workedBefore: 1, address: 'Maliebaan 50'        },
  { date: '2026-06-23', start: 7,  end: 15, client: 'Thuiszorg Noord',  function: 'Verzorgende IG', color: '#1B60A9', location: 'Amsterdam', workedBefore: 4, address: 'Amstelveenseweg 220' },
  { date: '2026-06-25', start: 14, end: 18, client: 'Zorggroep West',   function: 'Helpende Plus',  color: '#8B5CF6', location: 'Haarlem',   workedBefore: 0, address: 'Kennemerplein 10'    },
  { date: '2026-06-26', start: 7,  end: 11, client: 'Thuiszorg Noord',  function: 'Verzorgende IG', color: '#1B60A9', location: 'Amsterdam', workedBefore: 4, address: 'Amstelveenseweg 220' },
]

export const DUMMY_SHIFTS_LIST = [
  { date: 'ma 16 jun', time: '07:00–15:00', client: 'Thuiszorg Noord',  function: 'Verzorgende IG', location: 'Amsterdam', color: '#1B60A9', workedBefore: 4, favorite: true,  address: 'Amstelveenseweg 220', remarks: 'Vaste begeleider voor mevrouw De Vries.' },
  { date: 'wo 18 jun', time: '13:00–17:00', client: 'Zorggroep West',   function: 'Helpende Plus',  location: 'Haarlem',   color: '#8B5CF6', workedBefore: 0, favorite: false, address: 'Kennemerplein 10',    remarks: 'Eerste dienst bij deze client.'          },
  { date: 'do 19 jun', time: '08:00–12:00', client: 'Thuiszorg Noord',  function: 'Verzorgende IG', location: 'Amsterdam', color: '#1B60A9', workedBefore: 4, favorite: true,  address: 'Amstelveenseweg 220', remarks: 'Ochtendrondes department 3.'               },
  { date: 'vr 20 jun', time: '10:00–13:00', client: 'Zorggroep Oost',   function: 'Helpende',       location: 'Utrecht',   color: '#16A34A', workedBefore: 1, favorite: false, address: 'Maliebaan 50',        remarks: ''                                        },
  { date: 'ma 23 jun', time: '07:00–15:00', client: 'Thuiszorg Noord',  function: 'Verzorgende IG', location: 'Amsterdam', color: '#1B60A9', workedBefore: 4, favorite: true,  address: 'Amstelveenseweg 220', remarks: 'Vaste begeleider voor mevrouw De Vries.' },
  { date: 'do 25 jun', time: '14:00–18:00', client: 'Zorggroep West',   function: 'Helpende Plus',  location: 'Haarlem',   color: '#8B5CF6', workedBefore: 0, favorite: false, address: 'Kennemerplein 10',    remarks: ''                                        },
  { date: 'vr 26 jun', time: '07:00–11:00', client: 'Thuiszorg Noord',  function: 'Verzorgende IG', location: 'Amsterdam', color: '#1B60A9', workedBefore: 4, favorite: true,  address: 'Amstelveenseweg 220', remarks: 'Ochtendrondes department 3.'               },
]

export const FAV_SEARCH_DATA = [
  { type: 'clients',    label: 'Klant',    items: ['Thuiszorg Noord','Zorggroep West','Zorggroep Oost','Woonzorg Centrum','Revalidatiekliniek Zuid','Verpleeghuis De Linde','GGZ Amsterdam','Sophia Ziekenhuis','Thuiszorg Rotterdam','Zorgcentrum De Bron'] },
  { type: 'locations',   label: 'Locatie',  items: ['Amsterdam','Amsterdam Noord','Amsterdam ZO','Amsterdam West','Haarlem','Utrecht','Rotterdam','Den Haag','Amstelveen','Zaandam'] },
  { type: 'departments', label: 'Afdeling', items: ['Afdeling 1','Afdeling 2','Afdeling 3','Afdeling 4','Nachtdienst','Dementiezorg','Revalidatie','Dagzorg','Spoedeisende Hulp','Oncologie','Geriatrie'] },
]

export const DUMMY_OPEN_SHIFTS = [
  { id:1, date:'di 17 jun', time:'13:00–21:00', client:'Thuiszorg Noord',         function:'Verzorgende IG',  level:5, location:'Amsterdam',        distance:8,  pool:'Zorg',        shiftType:'Avond', color:'#3B82F6', department:'Afdeling 3',   openSpots:1 },
  { id:2, date:'wo 18 jun', time:'21:00–07:00', client:'Zorggroep West',          function:'Helpende Plus',   level:3, location:'Haarlem',           distance:22, pool:'Zorg',        shiftType:'Nacht', color:'#8B5CF6', department:'Nachtdienst',  openSpots:2 },
  { id:3, date:'do 19 jun', time:'07:00–15:00', client:'Zorggroep Oost',          function:'Helpende',        level:2, location:'Utrecht',           distance:42, pool:'Zorg',        shiftType:'Dag',   color:'#22C55E', department:'Dagzorg',      openSpots:3 },
  { id:4, date:'vr 20 jun', time:'07:00–15:00', client:'Thuiszorg Noord',         function:'Verzorgende IG',  level:5, location:'Amsterdam',        distance:8,  pool:'Zorg',        shiftType:'Dag',   color:'#3B82F6', department:'Afdeling 1',   openSpots:1 },
  { id:5, date:'ma 23 jun', time:'13:00–21:00', client:'Woonzorg Centrum',        function:'Verzorgende',     level:4, location:'Amsterdam',        distance:12, pool:'Zorg',        shiftType:'Avond', color:'#F59E0B', department:'Dementiezorg', openSpots:2 },
  { id:6, date:'di 24 jun', time:'21:00–07:00', client:'Thuiszorg Noord',         function:'Verzorgende IG',  level:5, location:'Amsterdam',        distance:8,  pool:'Zorg',        shiftType:'Nacht', color:'#3B82F6', department:'Nachtdienst',  openSpots:1 },
  { id:7, date:'wo 25 jun', time:'07:00–15:00', client:'Revalidatiekliniek Zuid', function:'Helpende Plus',   level:3, location:'Amsterdam ZO',     distance:18, pool:'Revalidatie', shiftType:'Dag',   color:'#0EA5E9', department:'Revalidatie',  openSpots:4 },
  { id:8, date:'do 26 jun', time:'07:00–15:00', client:'Zorggroep West',          function:'Verzorgende IG',  level:5, location:'Haarlem',           distance:22, pool:'Zorg',        shiftType:'Dag',   color:'#8B5CF6', department:'Afdeling 2',   openSpots:2 },
  { id:9, date:'vr 27 jun', time:'13:00–21:00', client:'Woonzorg Centrum',        function:'Verzorgende IG',  level:5, location:'Amsterdam',        distance:12, pool:'Zorg',        shiftType:'Avond', color:'#F59E0B', department:'Afdeling 4',   openSpots:1 },
]
