const STROKES = {
  "SAQUE": ["SAQUE T", "SAQUE CRISTAL", "RESTO"],
  "DERECHA": ["CRUZADA", "PARALELA", "CENTRO", "GLOBO SIN CRISTAL"],
  "REVES": ["CRUZADA", "PARALELA", "CENTRO", "GLOBO SIN CRISTAL"],
  "VOLEA DERECHA": ["ALTA CRUZADA", "ALTA PARALELA", "BAJA CRUZADA", "BAJA PARALELA"],
  "VOLEA REVES": ["ALTA CRUZADA", "ALTA PARALELA", "BAJA CRUZADA", "BAJA PARALELA"],
  "ESP RED": ["BANDEJA CRUZADA", "BANDEJA PARALELA", "X3", "REMATE", "RULO", "DEJADA", "BA", "BD"],
  "ESP FONDO": ["BAJADA DERECHA", "BAJADA REVES", "CHIQUITA CRUZADA", "CHIQUITA PARALELA", "CONTRARREMATE", "GLOBO CON CRISTAL"]
};

const PANEL_CONFIG = {
  "j1-win": {
    player_id: "J1",
    point_result: "WON",
    outcome: "WINNER_OR_FORCED",
    cause_key: "G_WF_J1"
  },
  "j1-nf": {
    player_id: "J1",
    point_result: "LOST",
    outcome: "OWN_UNFORCED_ERROR",
    cause_key: "P_NF_J1"
  },
  "j1-lost": {
    player_id: "J1",
    point_result: "LOST",
    outcome: "RIVAL_WINNER_OR_OWN_FORCED",
    cause_key: "P_WF_RIVAL_J1"
  },
  "j2-win": {
    player_id: "J2",
    point_result: "WON",
    outcome: "WINNER_OR_FORCED",
    cause_key: "G_WF_J2"
  },
  "j2-nf": {
    player_id: "J2",
    point_result: "LOST",
    outcome: "OWN_UNFORCED_ERROR",
    cause_key: "P_NF_J2"
  },
  "j2-lost": {
    player_id: "J2",
    point_result: "LOST",
    outcome: "RIVAL_WINNER_OR_OWN_FORCED",
    cause_key: "P_WF_RIVAL_J2"
  }
};

class PadelEventTracker {
  constructor() {
    this.events = [];
    this.pointId = 1;
    this.currentStrokeCategory = "SAQUE";

    this.score = {
      ourGames: 0,
      rivalGames: 0,
      ourPoints: 0,
      rivalPoints: 0
    };

    this.cronoSegundos = 0;
    this.cronoInterval = null;
    this.cronoRunning = false;

    this.init();
  }

  init() {
    this.renderCategoryButtons();
    this.renderAllStrokePanels();
    this.initToggles();
    this.initCourtZones();
    this.initCrono();
    this.initBottomButtons();
    this.initDeuceMode();
    this.renderScore();
    this.updateUI();
  }

  initToggles() {
    this.setupToggleButton("server-toggle", ["J1", "J2", "R1", "R2"], value => `Saca ${value}`);
    this.setupToggleButton("serve-number-toggle", ["1", "2"], value => `${value}º`);
    this.setupToggleButton("rally-toggle", ["MENOS_3", "ENTRE_3_6", "MAS_6"], value => {
      if (value === "MENOS_3") return "R:<3";
      if (value === "ENTRE_3_6") return "R:3-6";
      return "R:>6";
    });
  }

  setupToggleButton(id, values, formatter) {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
      const current = btn.dataset.value;
      const index = values.indexOf(current);
      const next = values[(index + 1) % values.length];
      btn.dataset.value = next;
      btn.textContent = formatter(next);
    });
  }

  initCourtZones() {
    document.querySelectorAll(".court-zone").forEach(zone => {
      zone.addEventListener("click", () => {
        this.registerPoint({
          cause_key: "G_NF_RIVAL",
          point_result: "WON",
          outcome: "RIVAL_UNFORCED_ERROR",
          player_id: "",
          stroke_category: "",
          stroke_type: "",
          court_zone: zone.dataset.zone
        });
      });
    });
  }

  renderCategoryButtons() {
    const container = document.getElementById("category-buttons");
    container.innerHTML = "";

    Object.keys(STROKES).forEach(category => {
      const btn = document.createElement("button");
      btn.className = "category-btn";
      btn.textContent = category;

      if (category === this.currentStrokeCategory) {
        btn.classList.add("selected");
      }

      btn.addEventListener("click", () => {
        this.currentStrokeCategory = category;

        if (category === "SAQUE") {
          const rallyBtn = document.getElementById("rally-toggle");
          rallyBtn.dataset.value = "MENOS_3";
          rallyBtn.textContent = "R:<3";
        }

        this.renderCategoryButtons();
        this.renderAllStrokePanels();
      });

      container.appendChild(btn);
    });
  }

  renderAllStrokePanels() {
    Object.keys(PANEL_CONFIG).forEach(panelId => this.renderStrokePanel(panelId));
  }

  renderStrokePanel(panelId) {
    const cfg = PANEL_CONFIG[panelId];
    const container = document.getElementById(`stroke-buttons-${panelId}`);
    container.innerHTML = "";

    const counter = this.events.filter(e =>
      e.player_id === cfg.player_id &&
      e.point_result === cfg.point_result &&
      e.outcome === cfg.outcome &&
      e.stroke_category === this.currentStrokeCategory
    ).length;

    document.getElementById(`counter-${panelId}`).textContent = counter;

    STROKES[this.currentStrokeCategory].forEach(stroke => {
      const btn = document.createElement("button");
      btn.className = "stroke-btn";
      btn.textContent = stroke;

      btn.addEventListener("click", () => {
        this.registerPoint({
          cause_key: cfg.cause_key,
          point_result: cfg.point_result,
          outcome: cfg.outcome,
          player_id: cfg.player_id,
          stroke_category: this.currentStrokeCategory,
          stroke_type: stroke,
          court_zone: ""
        });
      });

      container.appendChild(btn);
    });
  }

  initCrono() {
    document.getElementById("toggle-crono").addEventListener("click", () => this.toggleCrono());
    document.getElementById("minus-crono").addEventListener("click", () => this.modifyCrono(-5));
    document.getElementById("plus-crono").addEventListener("click", () => this.modifyCrono(5));
    document.getElementById("reset-crono").addEventListener("click", () => this.resetCrono());
  }

  initBottomButtons() {
    document.getElementById("undo-btn").addEventListener("click", () => this.undoLastEvent());
    document.getElementById("export-btn").addEventListener("click", () => this.exportCSV());
  }

  initDeuceMode() {
    document.getElementById("deuce-mode").addEventListener("change", () => {
      this.recalculateScore();
      this.renderScore();
    });
  }

  toggleCrono() {
    this.cronoRunning ? this.stopCrono() : this.startCrono();
  }

  startCrono() {
    if (this.cronoInterval) return;
    this.cronoRunning = true;
    document.getElementById("toggle-crono").textContent = "⏸";
    this.cronoInterval = setInterval(() => {
      this.cronoSegundos++;
      this.renderCrono();
    }, 1000);
  }

  stopCrono() {
    clearInterval(this.cronoInterval);
    this.cronoInterval = null;
    this.cronoRunning = false;
    document.getElementById("toggle-crono").textContent = "▶";
  }

  modifyCrono(value) {
    this.cronoSegundos = Math.max(0, this.cronoSegundos + value);
    this.renderCrono();
  }

  resetCrono() {
    this.cronoSegundos = 0;
    this.renderCrono();
  }

  renderCrono() {
    const min = String(Math.floor(this.cronoSegundos / 60)).padStart(2, "0");
    const sec = String(this.cronoSegundos % 60).padStart(2, "0");
    document.getElementById("crono-display").textContent = `${min}:${sec}`;
  }

  getDeuceMode() {
    return document.getElementById("deuce-mode").value;
  }

  addScorePoint(winner) {
    winner === "OUR" ? this.score.ourPoints++ : this.score.rivalPoints++;
    this.normalizeGameScore();
  }

  normalizeGameScore() {
    const our = this.score.ourPoints;
    const rival = this.score.rivalPoints;
    const mode = this.getDeuceMode();

    if (mode === "GOLDEN_POINT") {
      if (our >= 4 && rival >= 3) return this.winGame("OUR");
      if (rival >= 4 && our >= 3) return this.winGame("RIVAL");
      if (our >= 4) return this.winGame("OUR");
      if (rival >= 4) return this.winGame("RIVAL");
      return;
    }

    if (our >= 4 && our - rival >= 2) return this.winGame("OUR");
    if (rival >= 4 && rival - our >= 2) return this.winGame("RIVAL");
  }

  winGame(team) {
    team === "OUR" ? this.score.ourGames++ : this.score.rivalGames++;
    this.score.ourPoints = 0;
    this.score.rivalPoints = 0;
  }

  getPointLabel(team) {
    const labels = ["0", "15", "30", "40"];
    const own = team === "OUR" ? this.score.ourPoints : this.score.rivalPoints;
    const other = team === "OUR" ? this.score.rivalPoints : this.score.ourPoints;

    if (own <= 3 && other <= 3) return labels[own];

    if (own >= 3 && other >= 3) {
      if (own === other) return "40";
      if (this.getDeuceMode() === "ADVANTAGE") return own > other ? "AD" : "40";
      return "40";
    }

    return labels[Math.min(own, 3)];
  }

  renderScore() {
    document.getElementById("our-games").textContent = this.score.ourGames;
    document.getElementById("rival-games").textContent = this.score.rivalGames;
    document.getElementById("our-points").textContent = this.getPointLabel("OUR");
    document.getElementById("rival-points").textContent = this.getPointLabel("RIVAL");
  }

  recalculateScore() {
    this.score = { ourGames: 0, rivalGames: 0, ourPoints: 0, rivalPoints: 0 };
    this.events.forEach(event => {
      const winner = event.point_result === "WON" ? "OUR" : "RIVAL";
      this.addScorePoint(winner);
    });
  }

  resetServeNumberToFirst() {
    const serveBtn = document.getElementById("serve-number-toggle");
    serveBtn.dataset.value = "1";
    serveBtn.textContent = "1º";
  }

  registerPoint(data) {
    const winner = data.point_result === "WON" ? "OUR" : "RIVAL";
    this.addScorePoint(winner);

    const event = {
      timestamp: new Date().toISOString(),
      point_id: this.pointId,
      cause_key: data.cause_key,
      point_result: data.point_result,
      player_id: data.player_id,
      player_team: data.player_id ? "OUR" : "",
      stroke_category: data.stroke_category,
      stroke_type: data.stroke_type,
      outcome: data.outcome,
      rally: document.getElementById("rally-toggle").dataset.value,
      server: document.getElementById("server-toggle").dataset.value,
      serve_number: document.getElementById("serve-number-toggle").dataset.value,
      serve_direction: "",
      court_zone: data.court_zone,
      point_duration_seconds: this.cronoSegundos,
      deuce_mode: this.getDeuceMode(),
      our_games_after: this.score.ourGames,
      rival_games_after: this.score.rivalGames,
      our_points_after: this.getPointLabel("OUR"),
      rival_points_after: this.getPointLabel("RIVAL")
    };

    this.events.push(event);
    this.pointId++;
    this.resetServeNumberToFirst();
    this.renderAllStrokePanels();
    this.renderScore();
    this.updateUI();
  }

  updateUI() {
    document.getElementById("event-count").textContent = this.events.length;
    document.getElementById("undo-btn").disabled = this.events.length === 0;
    document.getElementById("export-btn").disabled = this.events.length === 0;

    const last = this.events[this.events.length - 1];
    if (!last) {
      document.getElementById("last-event").textContent = "Sin eventos";
      return;
    }

    document.getElementById("last-event").textContent =
      `${last.point_id} · ${last.cause_key} · ${last.player_id || "RIVAL"} · ${last.stroke_type || last.court_zone}`;
  }

  undoLastEvent() {
    if (this.events.length === 0) return;
    this.events.pop();
    this.pointId = Math.max(1, this.pointId - 1);
    this.recalculateScore();
    this.renderAllStrokePanels();
    this.renderScore();
    this.updateUI();
  }

  exportCSV() {
    const headers = [
      "timestamp",
      "point_id",
      "cause_key",
      "point_result",
      "player_id",
      "player_team",
      "stroke_category",
      "stroke_type",
      "outcome",
      "rally",
      "server",
      "serve_number",
      "serve_direction",
      "court_zone",
      "point_duration_seconds",
      "deuce_mode",
      "our_games_after",
      "rival_games_after",
      "our_points_after",
      "rival_points_after"
    ];

    const rows = this.events.map(event => {
      return headers.map(header => {
        const value = event[header] ?? "";
        return `"${String(value).replaceAll('"', '""')}"`;
      }).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "padel-events.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window._padelTracker = new PadelEventTracker();
});

// ===================== TAB NAVIGATION =====================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`screen-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "dashboard") renderDashboard();
  });
});

// ===================== DASHBOARD =====================
const STROKE_COLORS = ["#4caf50","#00bcd4","#ffc107","#9c27b0","#ff9800","#03a9f4","#e91e63","#8bc34a"];

function renderDashboard() {
  const tracker = window._padelTracker;
  if (!tracker) return;
  const events = tracker.events;
  const score = tracker.score;

  // Scoreboard
  const ptLabel = p => {
    const labels = ["0","15","30","40"];
    return labels[Math.min(p, 3)] || "40";
  };
  document.getElementById("dash-our-games").textContent   = score.ourGames;
  document.getElementById("dash-rival-games").textContent = score.rivalGames;
  document.getElementById("dash-our-points").textContent   = ptLabel(score.ourPoints);
  document.getElementById("dash-rival-points").textContent = ptLabel(score.rivalPoints);

  const total  = events.length;
  const won    = events.filter(e => e.point_result === "WON").length;
  const lost   = total - won;
  const winPct = total ? ((won / total) * 100).toFixed(1) : null;

  document.getElementById("dash-total").textContent     = total;
  document.getElementById("dash-won-label").textContent  = `${won} pts`;
  document.getElementById("dash-lost-label").textContent = `${lost} pts`;
  document.getElementById("dash-win-bar").style.width    = winPct ? `${winPct}%` : "50%";
  document.getElementById("dash-win-pct").textContent   = winPct ? `${winPct}% puntos ganados` : "Sin datos";

  // Duration
  const durs = events.map(e => parseInt(e.point_duration_seconds)||0).filter(d => d > 0);
  const avg  = durs.length ? (durs.reduce((a,b)=>a+b,0)/durs.length).toFixed(1) : "—";
  const max  = durs.length ? Math.max(...durs) : "—";
  document.getElementById("dash-avg-dur").textContent = avg;
  document.getElementById("dash-max-dur").textContent = max;

  // Winners / Errors
  document.getElementById("dash-our-winners").textContent   = events.filter(e=>e.outcome==="WINNER_OR_FORCED").length;
  document.getElementById("dash-our-errors").textContent    = events.filter(e=>e.outcome==="OWN_UNFORCED_ERROR").length;
  document.getElementById("dash-rival-winners").textContent = events.filter(e=>e.outcome==="RIVAL_WINNER_OR_OWN_FORCED").length;
  document.getElementById("dash-rival-errors").textContent  = events.filter(e=>e.outcome==="RIVAL_UNFORCED_ERROR").length;

  // Stroke categories
  const catMap = {};
  events.forEach(e => { if (e.stroke_category) catMap[e.stroke_category] = (catMap[e.stroke_category]||0)+1; });
  const catEntries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const catMax = catEntries[0]?.[1] || 1;
  const strokesEl = document.getElementById("dash-strokes");
  if (catEntries.length) {
    strokesEl.innerHTML = catEntries.map(([name, val], i) => `
      <div class="dash-stroke-row">
        <div class="dash-stroke-name">${name}</div>
        <div class="dash-stroke-bar-track">
          <div class="dash-stroke-bar-fill" style="width:${(val/catMax)*100}%;background:${STROKE_COLORS[i%STROKE_COLORS.length]}"></div>
        </div>
        <div class="dash-stroke-count">${val}</div>
      </div>`).join("");
  } else {
    strokesEl.innerHTML = '<div class="dash-empty">Sin datos aún</div>';
  }

  // Stroke types top 6
  const typeMap = {};
  events.forEach(e => { if (e.stroke_type) typeMap[e.stroke_type] = (typeMap[e.stroke_type]||0)+1; });
  const typeEntries = Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const typeMax = typeEntries[0]?.[1] || 1;
  const typesEl = document.getElementById("dash-types");
  if (typeEntries.length) {
    typesEl.innerHTML = typeEntries.map(([name, val], i) => `
      <div class="dash-stroke-row">
        <div class="dash-stroke-name">${name}</div>
        <div class="dash-stroke-bar-track">
          <div class="dash-stroke-bar-fill" style="width:${(val/typeMax)*100}%;background:${STROKE_COLORS[(i+2)%STROKE_COLORS.length]}"></div>
        </div>
        <div class="dash-stroke-count">${val}</div>
      </div>`).join("");
  } else {
    typesEl.innerHTML = '<div class="dash-empty">Sin datos aún</div>';
  }

  // Court zones
  const zoneMap = {};
  events.forEach(e => { if (e.court_zone) zoneMap[e.court_zone] = (zoneMap[e.court_zone]||0)+1; });
  const zonesEl = document.getElementById("dash-zones");
  const zoneEntries = Object.entries(zoneMap);
  zonesEl.innerHTML = zoneEntries.length
    ? zoneEntries.map(([name, val]) => `
        <div class="dash-zone-pill">
          <div class="dash-zone-val">${val}</div>
          <div class="dash-zone-lbl">${name}</div>
        </div>`).join("")
    : '<div class="dash-empty">—</div>';

  // Servers
  const srvMap = {};
  events.forEach(e => { if (e.server) srvMap[e.server] = (srvMap[e.server]||0)+1; });
  const srvEl = document.getElementById("dash-servers");
  const srvEntries = Object.entries(srvMap);
  srvEl.innerHTML = srvEntries.length
    ? srvEntries.map(([name, val]) => `
        <div class="dash-zone-pill">
          <div class="dash-zone-val">${val}</div>
          <div class="dash-zone-lbl">${name}</div>
        </div>`).join("")
    : '<div class="dash-empty">—</div>';

  // Export button
  const exportBtn = document.getElementById("dash-export-btn");
  exportBtn.disabled = total === 0;
  exportBtn.onclick = () => exportDashboardCSV(tracker);
}

function exportDashboardCSV(tracker) {
  const e = tracker.events;
  const won  = e.filter(x=>x.point_result==="WON").length;
  const lost = e.length - won;
  const rows = [
    ["Métrica","Nosotros","Rival"],
    ["Games", tracker.score.ourGames, tracker.score.rivalGames],
    ["Puntos ganados", won, lost],
    ["Winners", e.filter(x=>x.outcome==="WINNER_OR_FORCED").length, e.filter(x=>x.outcome==="RIVAL_WINNER_OR_OWN_FORCED").length],
    ["Errores no forzados", e.filter(x=>x.outcome==="OWN_UNFORCED_ERROR").length, e.filter(x=>x.outcome==="RIVAL_UNFORCED_ERROR").length],
  ];
  const csv  = rows.map(r=>r.join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = "padel-resumen.csv";
  a.click();
}
