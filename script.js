const STROKES = {
  "SAQUE": ["SAQUE T", "SAQUE CRISTAL", "RESTO"],
  "DERECHA": ["CRUZADA", "PARALELA", "CENTRO", "GLOBO SIN CRISTAL"],
  "REVES": ["CRUZADA", "PARALELA", "CENTRO", "GLOBO SIN CRISTAL"],
  "VOLEA DERECHA": ["ALTA CRUZADA", "ALTA PARALELA", "BAJA CRUZADA", "BAJA PARALELA"],
  "VOLEA REVES": ["ALTA CRUZADA", "ALTA PARALELA", "BAJA CRUZADA", "BAJA PARALELA"],
  "ESP RED": ["BANDEJA CRUZADA", "BANDEJA PARALELA", "X3", "REMATE", "RULO", "DEJADA", "BA", "BD"],
  "ESP FONDO": ["BAJADA DERECHA", "BAJADA REVES", "CHIQUITA CRUZADA", "CHIQUITA PARALELA", "CONTRARREMATE", "GLOBO CON CRISTAL"]
};

const STORAGE_KEY = "padeltrack_current_set";
const CSV_HEADERS = [
  "timestamp", "point_id", "cause_key", "point_result", "player_id", "player_team",
  "stroke_category", "stroke_type", "outcome", "rally", "server", "serve_number",
  "serve_direction", "court_zone", "point_duration_seconds", "deuce_mode", "our_games_after",
  "rival_games_after", "our_points_after", "rival_points_after"
];

class PadelEventTracker {
  constructor() {
    this.events = [];
    this.pointId = 1;
    this.currentStrokeCategory = "SAQUE";
    this.score = { ourGames:0, rivalGames:0, ourPoints:0, rivalPoints:0 };
    this.cronoSegundos = 0;
    this.cronoInterval = null;
    this.cronoRunning = false;
    this.init();
  }

  init(){
    this.loadState();
    this.renderCategoryButtons();
    this.renderAllStrokePanels();
    this.initToggles();
    this.initCourtZones();
    this.initCrono();
    this.initBottomButtons();
    this.renderScore();
    this.updateUI();
  }

  loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const state = JSON.parse(raw);
      this.events = Array.isArray(state.events) ? state.events : [];
      this.score = state.score || this.score;
      this.pointId = this.events.length ? Math.max(...this.events.map(e => Number(e.point_id) || 0)) + 1 : 1;
    }catch(err){ console.warn("No se pudo cargar localStorage", err); }
  }

  saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      events: this.events,
      score: this.score,
      updated_at: new Date().toISOString()
    }));
  }

  initToggles(){
    this.setupToggleButton("server-toggle", ["J1","J2","R1","R2"], value => `Saca ${value}`);
    this.setupToggleButton("serve-number-toggle", ["1","2"], value => `${value}º`);
    this.setupToggleButton("rally-toggle", ["MENOS_3","ENTRE_3_6","MAS_6"], value => {
      if(value === "MENOS_3") return "R:<3";
      if(value === "ENTRE_3_6") return "R:3-6";
      return "R:>6";
    });
  }

  setupToggleButton(id, values, formatter){
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
      const current = btn.dataset.value;
      const index = values.indexOf(current);
      const next = values[(index + 1) % values.length];
      btn.dataset.value = next;
      btn.textContent = formatter(next);
    });
  }

  initCourtZones(){
    document.querySelectorAll(".court-zone").forEach(zone => {
      zone.addEventListener("click", () => {
        this.registerPoint({
          cause_key:"G_NF_RIVAL",
          point_result:"WON",
          outcome:"RIVAL_UNFORCED_ERROR",
          player_id:"",
          stroke_category:"",
          stroke_type:"",
          court_zone:zone.dataset.zone
        });
      });
    });
  }

  renderCategoryButtons(){
    const container = document.getElementById("category-buttons");
    container.innerHTML = "";
    Object.keys(STROKES).forEach(category => {
      const btn = document.createElement("button");
      btn.className = "category-btn";
      btn.textContent = category;
      if(category === this.currentStrokeCategory) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        this.currentStrokeCategory = category;
        if(category === "SAQUE") this.setRally("MENOS_3");
        this.renderCategoryButtons();
        this.renderAllStrokePanels();
      });
      container.appendChild(btn);
    });
  }

  setRally(value){
    const rallyBtn = document.getElementById("rally-toggle");
    rallyBtn.dataset.value = value;
    rallyBtn.textContent = value === "MENOS_3" ? "R:<3" : value === "ENTRE_3_6" ? "R:3-6" : "R:>6";
  }

  renderAllStrokePanels(){
    this.renderStrokePanel("j1-win","J1","G_WF_J1","WON","WINNER_OR_FORCED");
    this.renderStrokePanel("j1-nf","J1","P_NF_J1","LOST","OWN_UNFORCED_ERROR");
    this.renderStrokePanel("j1-lost","J1","P_WF_RIVAL_J1","LOST","RIVAL_WINNER_OR_OWN_FORCED");
    this.renderStrokePanel("j2-win","J2","G_WF_J2","WON","WINNER_OR_FORCED");
    this.renderStrokePanel("j2-nf","J2","P_NF_J2","LOST","OWN_UNFORCED_ERROR");
    this.renderStrokePanel("j2-lost","J2","P_WF_RIVAL_J2","LOST","RIVAL_WINNER_OR_OWN_FORCED");
  }

  renderStrokePanel(panelId, playerId, causeKey, pointResult, outcome){
    const container = document.getElementById(`stroke-buttons-${panelId}`);
    container.innerHTML = "";
    const counter = this.events.filter(e =>
      e.player_id === playerId &&
      e.point_result === pointResult &&
      e.outcome === outcome &&
      e.stroke_category === this.currentStrokeCategory
    ).length;
    document.getElementById(`counter-${panelId}`).textContent = counter;
    STROKES[this.currentStrokeCategory].forEach(stroke => {
      const btn = document.createElement("button");
      btn.className = "stroke-btn";
      btn.textContent = stroke;
      btn.addEventListener("click", () => {
        this.registerPoint({
          cause_key: causeKey,
          point_result: pointResult,
          outcome: outcome,
          player_id: playerId,
          stroke_category: this.currentStrokeCategory,
          stroke_type: stroke,
          court_zone:""
        });
      });
      container.appendChild(btn);
    });
  }

  initCrono(){
    document.getElementById("toggle-crono").addEventListener("click", () => this.toggleCrono());
    document.getElementById("minus-crono").addEventListener("click", () => this.modifyCrono(-5));
    document.getElementById("plus-crono").addEventListener("click", () => this.modifyCrono(5));
    document.getElementById("reset-crono").addEventListener("click", () => this.resetCrono());
  }

  toggleCrono(){ this.cronoRunning ? this.stopCrono() : this.startCrono(); }
  startCrono(){
    if(this.cronoInterval) return;
    this.cronoRunning = true;
    document.getElementById("toggle-crono").textContent = "⏸";
    this.cronoInterval = setInterval(() => { this.cronoSegundos++; this.renderCrono(); }, 1000);
  }
  stopCrono(){
    clearInterval(this.cronoInterval); this.cronoInterval = null; this.cronoRunning = false;
    document.getElementById("toggle-crono").textContent = "▶";
  }
  modifyCrono(value){ this.cronoSegundos = Math.max(0, this.cronoSegundos + value); this.renderCrono(); }
  resetCrono(){ this.cronoSegundos = 0; this.renderCrono(); }
  renderCrono(){
    const min = String(Math.floor(this.cronoSegundos/60)).padStart(2,"0");
    const sec = String(this.cronoSegundos%60).padStart(2,"0");
    document.getElementById("crono-display").textContent = `${min}:${sec}`;
  }

  getDeuceMode(){ return document.getElementById("deuce-mode").value; }

  addScorePoint(winner){
    winner === "OUR" ? this.score.ourPoints++ : this.score.rivalPoints++;
    this.normalizeGameScore();
  }

  normalizeGameScore(){
    const our = this.score.ourPoints;
    const rival = this.score.rivalPoints;
    const mode = this.getDeuceMode();
    if(mode === "GOLDEN_POINT"){
      if(our >= 4 && rival >= 3) return this.winGame("OUR");
      if(rival >= 4 && our >= 3) return this.winGame("RIVAL");
      if(our >= 4) return this.winGame("OUR");
      if(rival >= 4) return this.winGame("RIVAL");
      return;
    }
    if(our >= 4 && our - rival >= 2) return this.winGame("OUR");
    if(rival >= 4 && rival - our >= 2) return this.winGame("RIVAL");
  }

  winGame(team){
    team === "OUR" ? this.score.ourGames++ : this.score.rivalGames++;
    this.score.ourPoints = 0;
    this.score.rivalPoints = 0;
  }

  getPointLabel(team){
    const labels = ["0","15","30","40"];
    const own = team === "OUR" ? this.score.ourPoints : this.score.rivalPoints;
    const other = team === "OUR" ? this.score.rivalPoints : this.score.ourPoints;
    if(own <= 3 && other <= 3) return labels[own];
    if(own >= 3 && other >= 3){
      if(own === other) return "40";
      return this.getDeuceMode() === "ADVANTAGE" ? (own > other ? "AD" : "40") : "40";
    }
    return labels[Math.min(own,3)];
  }

  renderScore(){
    document.getElementById("our-games").textContent = this.score.ourGames;
    document.getElementById("rival-games").textContent = this.score.rivalGames;
    document.getElementById("our-points").textContent = this.getPointLabel("OUR");
    document.getElementById("rival-points").textContent = this.getPointLabel("RIVAL");
  }

  registerPoint(data){
    const winner = data.point_result === "WON" ? "OUR" : "RIVAL";
    this.addScorePoint(winner);
    const event = {
      timestamp:new Date().toISOString(),
      point_id:this.pointId,
      cause_key:data.cause_key,
      point_result:data.point_result,
      player_id:data.player_id,
      player_team:data.player_id ? "OUR" : "",
      stroke_category:data.stroke_category,
      stroke_type:data.stroke_type,
      outcome:data.outcome,
      rally:document.getElementById("rally-toggle").dataset.value,
      server:document.getElementById("server-toggle").dataset.value,
      serve_number:document.getElementById("serve-number-toggle").dataset.value,
      serve_direction:"",
      court_zone:data.court_zone,
      point_duration_seconds:this.cronoSegundos,
      deuce_mode:this.getDeuceMode(),
      our_games_after:this.score.ourGames,
      rival_games_after:this.score.rivalGames,
      our_points_after:this.getPointLabel("OUR"),
      rival_points_after:this.getPointLabel("RIVAL")
    };
    this.events.push(event);
    this.pointId++;
    document.getElementById("serve-number-toggle").dataset.value = "1";
    document.getElementById("serve-number-toggle").textContent = "1º";
    this.renderAllStrokePanels();
    this.renderScore();
    this.updateUI();
    this.saveState();
  }

  updateUI(){
    document.getElementById("event-count").textContent = this.events.length;
    document.getElementById("undo-btn").disabled = this.events.length === 0;
    document.getElementById("export-btn").disabled = this.events.length === 0;
    const last = this.events[this.events.length-1];
    const el = document.getElementById("last-event");
    if(!last){ el.textContent = "Sin eventos"; return; }
    el.textContent = `${last.point_id} · ${last.player_id || "RIVAL"} · ${last.stroke_type || last.court_zone} · ${last.our_games_after}-${last.rival_games_after}`;
  }

  initBottomButtons(){
    document.getElementById("undo-btn").addEventListener("click", () => this.undoLastEvent());
    document.getElementById("export-btn").addEventListener("click", () => this.exportCSV());
    document.getElementById("deuce-mode").addEventListener("change", () => { this.recalculateScore(); this.renderScore(); this.saveState(); });
  }

  recalculateScore(){
    this.score = { ourGames:0, rivalGames:0, ourPoints:0, rivalPoints:0 };
    this.events.forEach(event => this.addScorePoint(event.point_result === "WON" ? "OUR" : "RIVAL"));
  }

  undoLastEvent(){
    if(this.events.length === 0) return;
    this.events.pop();
    this.pointId = Math.max(1, this.pointId - 1);
    this.recalculateScore();
    this.renderAllStrokePanels();
    this.renderScore();
    this.updateUI();
    this.saveState();
  }

  exportCSV(){
    const rows = this.events.map(event => CSV_HEADERS.map(header => {
      const value = event[header] ?? "";
      return `"${String(value).replaceAll('"','""')}"`;
    }).join(","));
    const csv = [CSV_HEADERS.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "padel-events.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }
}

document.addEventListener("DOMContentLoaded", () => new PadelEventTracker());
