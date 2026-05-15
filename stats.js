const PADEL_STORAGE_KEY = "padeltrack_current_set";

const CATEGORY_ORDER = [
  "SAQUE",
  "DERECHA",
  "REVES",
  "VOLEA DERECHA",
  "VOLEA REVES",
  "ESP FONDO",
  "ESP RED"
];

const CATEGORY_LABELS = {
  "SAQUE": "Saque",
  "DERECHA": "Derecha",
  "REVES": "Revés",
  "VOLEA DERECHA": "Volea derecha",
  "VOLEA REVES": "Volea revés",
  "ESP FONDO": "Golpes esp. fondo",
  "ESP RED": "Golpes esp. red",
  "": "Sin categoría"
};

const ZONE_LABELS = {
  "RED": "Pareja en red",
  "MEDIO": "Pareja en medio",
  "FONDO": "Pareja en fondo",
  "": "Sin zona"
};

function loadPadelState(){
  try{
    const raw = localStorage.getItem(PADEL_STORAGE_KEY);
    if(!raw){
      return {
        events: [],
        score: { ourGames:0, rivalGames:0, ourPoints:0, rivalPoints:0 },
        updated_at: ""
      };
    }

    const state = JSON.parse(raw);
    return {
      events: Array.isArray(state.events) ? state.events : [],
      score: state.score || { ourGames:0, rivalGames:0, ourPoints:0, rivalPoints:0 },
      updated_at: state.updated_at || ""
    };
  }catch(err){
    console.warn("No se pudo leer el estado", err);
    return {
      events: [],
      score: { ourGames:0, rivalGames:0, ourPoints:0, rivalPoints:0 },
      updated_at: ""
    };
  }
}

function pct(part, total){
  if(!total) return 0;
  return Math.round((part / total) * 100);
}

function esc(value){
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "'":"&#39;",
    '"':"&quot;"
  }[ch]));
}

function normalizeCategory(category){
  return String(category || "").trim().toUpperCase();
}

function labelCategory(category){
  const key = normalizeCategory(category);
  return CATEGORY_LABELS[key] || category || "Sin categoría";
}

function labelZone(zone){
  const key = String(zone || "").trim().toUpperCase();
  return ZONE_LABELS[key] || zone || "Sin zona";
}

function countBy(events, keyFn){
  return events.reduce((acc, event) => {
    const key = keyFn(event) || "SIN_DATO";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(obj, limit = 5){
  return Object.entries(obj)
    .filter(([, value]) => value > 0)
    .sort((a,b) => b[1] - a[1])
    .slice(0, limit);
}

function categoryCounts(events){
  const counts = {};
  CATEGORY_ORDER.forEach(category => { counts[category] = 0; });

  events.forEach(event => {
    const category = normalizeCategory(event.stroke_category);
    if(!category) return;
    counts[category] = (counts[category] || 0) + 1;
  });

  return counts;
}

function zoneCounts(events){
  const counts = { RED: 0, MEDIO: 0, FONDO: 0 };
  events.forEach(event => {
    const zone = String(event.court_zone || "").trim().toUpperCase();
    if(zone) counts[zone] = (counts[zone] || 0) + 1;
  });
  return counts;
}

function serviceStats(events, mode, serverFilter = null){
  const filtered = events.filter(event => {
    const ownServe = ["J1", "J2"].includes(event.server);
    const isMode = mode === "serve" ? ownServe : !ownServe;
    const serverOk = serverFilter ? event.server === serverFilter : true;
    return isMode && serverOk;
  });

  const won = filtered.filter(event => event.point_result === "WON").length;
  const lost = filtered.length - won;

  const byServeNumber = ["1", "2"].map(num => {
    const rows = filtered.filter(event => String(event.serve_number) === num);
    const rowWon = rows.filter(event => event.point_result === "WON").length;
    const rowLost = rows.length - rowWon;

    return {
      serve_number: num,
      played: rows.length,
      played_pct: pct(rows.length, filtered.length),
      won: rowWon,
      lost: rowLost,
      win_pct: pct(rowWon, rows.length),
      lost_pct: pct(rowLost, rows.length)
    };
  });

  return {
    total: filtered.length,
    won,
    lost,
    win_pct: pct(won, filtered.length),
    lost_pct: pct(lost, filtered.length),
    byServeNumber
  };
}

function outcomeSplit(events, positiveOutcome, negativeOutcome){
  const positive = events.filter(event => event.outcome === positiveOutcome).length;
  const negative = events.filter(event => event.outcome === negativeOutcome).length;
  const total = positive + negative;
  return {
    total,
    positive,
    negative,
    positive_pct: pct(positive, total),
    negative_pct: pct(negative, total)
  };
}

function playerStats(events, playerId){
  const rows = events.filter(event => event.player_id === playerId);
  const wonRows = rows.filter(event => event.point_result === "WON");
  const lostRows = rows.filter(event => event.point_result === "LOST");
  const winnerForcedRows = rows.filter(event => event.outcome === "WINNER_OR_FORCED");
  const ownNFRows = rows.filter(event => event.outcome === "OWN_UNFORCED_ERROR");
  const rivalWFRows = rows.filter(event => event.outcome === "RIVAL_WINNER_OR_OWN_FORCED");

  return {
    playerId,
    label: playerId === "J1" ? "Revés / J1" : "Derecha / J2",
    rows,
    total: rows.length,
    won: wonRows.length,
    lost: lostRows.length,
    win_pct: pct(wonRows.length, rows.length),
    lost_pct: pct(lostRows.length, rows.length),
    winnerForced: winnerForcedRows.length,
    ownNF: ownNFRows.length,
    lostWF: rivalWFRows.length,
    wonSplit: outcomeSplit(rows.filter(event => event.point_result === "WON"), "WINNER_OR_FORCED", "RIVAL_UNFORCED_ERROR"),
    lostSplit: outcomeSplit(rows.filter(event => event.point_result === "LOST"), "RIVAL_WINNER_OR_OWN_FORCED", "OWN_UNFORCED_ERROR"),
    wonWFByCategory: categoryCounts(winnerForcedRows),
    ownNFByCategory: categoryCounts(ownNFRows),
    lostWFByCategory: categoryCounts(rivalWFRows),
    winnerForcedStrokes: countBy(winnerForcedRows, event => event.stroke_type),
    ownNFStrokes: countBy(ownNFRows, event => event.stroke_type),
    lostWFStrokes: countBy(rivalWFRows, event => event.stroke_type),
    allStrokes: countBy(rows, event => event.stroke_type)
  };
}

function pairStats(events){
  const won = events.filter(event => event.point_result === "WON");
  const lost = events.filter(event => event.point_result === "LOST");
  const rivalNF = events.filter(event => event.outcome === "RIVAL_UNFORCED_ERROR");
  const ownWF = events.filter(event => event.outcome === "WINNER_OR_FORCED");
  const ownNF = events.filter(event => event.outcome === "OWN_UNFORCED_ERROR");
  const rivalWF = events.filter(event => event.outcome === "RIVAL_WINNER_OR_OWN_FORCED");

  return {
    won: won.length,
    lost: lost.length,
    rivalNF: rivalNF.length,
    ownWF: ownWF.length,
    ownNF: ownNF.length,
    rivalWF: rivalWF.length,
    wonSplit: {
      total: won.length,
      positive: rivalNF.length,
      negative: ownWF.length,
      positive_pct: pct(rivalNF.length, won.length),
      negative_pct: pct(ownWF.length, won.length)
    },
    lostSplit: {
      total: lost.length,
      positive: ownNF.length,
      negative: rivalWF.length,
      positive_pct: pct(ownNF.length, lost.length),
      negative_pct: pct(rivalWF.length, lost.length)
    },
    rivalNFByZone: zoneCounts(rivalNF),
    ownWFByCategory: categoryCounts(ownWF),
    ownNFByCategory: categoryCounts(ownNF),
    rivalWFByCategory: categoryCounts(rivalWF)
  };
}

function buildStats(events){
  const total = events.length;
  const won = events.filter(event => event.point_result === "WON").length;
  const lost = total - won;
  const service = serviceStats(events, "serve");
  const rest = serviceStats(events, "rest");
  const serviceJ1 = serviceStats(events, "serve", "J1");
  const serviceJ2 = serviceStats(events, "serve", "J2");
  const restR1 = serviceStats(events, "rest", "R1");
  const restR2 = serviceStats(events, "rest", "R2");
  const j1 = playerStats(events, "J1");
  const j2 = playerStats(events, "J2");
  const pair = pairStats(events);
  const zones = zoneCounts(events.filter(event => event.outcome === "RIVAL_UNFORCED_ERROR"));
  const categories = categoryCounts(events.filter(event => event.stroke_category));
  const rally = countBy(events, event => event.rally);

  return {
    total,
    won,
    lost,
    win_pct: pct(won, total),
    lost_pct: pct(lost, total),
    service,
    rest,
    serviceJ1,
    serviceJ2,
    restR1,
    restR2,
    j1,
    j2,
    pair,
    zones,
    categories,
    rally
  };
}
