function reportKpi(label, value, note = ""){
  return `
    <div class="report-kpi">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      ${note ? `<small>${esc(note)}</small>` : ""}
    </div>`;
}

function reportServiceBlock(title, data){
  return `
    <div class="report-section keep-together">
      <h2>${esc(title)}</h2>
      <div class="report-kpis">
        ${reportKpi("Jugados", data.total)}
        ${reportKpi("Ganados", data.won, `${data.win_pct}%`)}
        ${reportKpi("Perdidos", data.lost, `${data.lost_pct}%`)}
      </div>
      ${serviceTable(data)}
    </div>`;
}

function reportCategoryTable(title, obj){
  return `
    <div class="report-subblock">
      ${categoryTable(title, obj)}
    </div>`;
}

function reportPlayerBlock(title, stats){
  return `
    <div class="report-page page-break">
      <h1>${esc(title)}</h1>

      <div class="report-section">
        <h2>Puntos ganados y perdidos</h2>
        <div class="report-kpis">
          ${reportKpi("Acciones", stats.total)}
          ${reportKpi("G-W/F", stats.winnerForced, "propios")}
          ${reportKpi("P-NF", stats.ownNF, "errores propios")}
          ${reportKpi("P-W/F", stats.lostWF, "rival/forzado")}
        </div>
      </div>

      <div class="report-section">
        <h2>Puntos perdidos</h2>
        <div class="two-col-report">
          ${reportCategoryTable("Errores no forzados propios", stats.ownNFByCategory)}
          ${reportCategoryTable("Forzados / winner rival", stats.lostWFByCategory)}
        </div>
      </div>

      <div class="report-section">
        <h2>Golpes más destacados</h2>
        <div class="two-col-report">
          <div>
            <h3>Errores propios</h3>
            ${barsFromObject(Object.fromEntries(topEntries(stats.ownNFStrokes, 6)))}
          </div>
          <div>
            <h3>Golpes ganadores / forzados</h3>
            ${barsFromObject(Object.fromEntries(topEntries(stats.winnerForcedStrokes, 6)))}
          </div>
        </div>
      </div>
    </div>`;
}

function buildReportHtml(){
  const state = loadPadelState();
  const stats = buildStats(state.events);
  const now = new Date().toLocaleString("es-ES");

  return `
    <div class="print-report" id="pdf-report">
      <div class="report-cover">
        <div>
          <div class="report-title">Informe táctico del set</div>
          <div class="mini-note">Generado: ${esc(now)} · Puntos registrados: ${stats.total}</div>
        </div>
        <div class="report-score">${esc(state.score.ourGames)}-${esc(state.score.rivalGames)}</div>
      </div>

      <div class="report-section">
        <h2>Resumen ejecutivo</h2>
        <div class="report-kpis">
          ${reportKpi("Puntos", stats.total)}
          ${reportKpi("Ganados", stats.won, `${stats.win_pct}%`)}
          ${reportKpi("Perdidos", stats.lost, `${stats.lost_pct}%`)}
          ${reportKpi("Marcador", `${state.score.ourGames}-${state.score.rivalGames}`)}
        </div>
      </div>

      <div class="report-section">
        <h2>Resumen puntos ganados</h2>
        <div class="report-kpis">
          ${reportKpi("Ganados", stats.pair.won)}
          ${reportKpi("NF rival", stats.pair.rivalNF, `${stats.pair.wonSplit.positive_pct}%`)}
          ${reportKpi("G-W/F propios", stats.pair.ownWF, `${stats.pair.wonSplit.negative_pct}%`)}
        </div>
        <div class="two-col-report">
          <div><h3>NF rival por zona</h3>${zoneTable(stats.pair.rivalNFByZone)}</div>
          ${reportCategoryTable("G-W/F propios por categoría", stats.pair.ownWFByCategory)}
        </div>
      </div>

      <div class="report-section">
        <h2>Resumen puntos perdidos</h2>
        <div class="report-kpis">
          ${reportKpi("Perdidos", stats.pair.lost)}
          ${reportKpi("P-NF propios", stats.pair.ownNF, `${stats.pair.lostSplit.positive_pct}%`)}
          ${reportKpi("P-W/F rival", stats.pair.rivalWF, `${stats.pair.lostSplit.negative_pct}%`)}
        </div>
        <div class="two-col-report">
          ${reportCategoryTable("P-NF propios por categoría", stats.pair.ownNFByCategory)}
          ${reportCategoryTable("P-W/F rival por categoría", stats.pair.rivalWFByCategory)}
        </div>
      </div>

      <div class="report-page page-break">
        <h1>Servicio y resto</h1>
        <div class="two-col-report">
          ${reportServiceBlock("Servicio propio", stats.service)}
          ${reportServiceBlock("Resto", stats.rest)}
          ${reportServiceBlock("Servicio Revés / J1", stats.serviceJ1)}
          ${reportServiceBlock("Servicio Derecha / J2", stats.serviceJ2)}
        </div>
      </div>

      ${reportPlayerBlock("Estadísticas Revés / J1", stats.j1)}
      ${reportPlayerBlock("Estadísticas Derecha / J2", stats.j2)}

      <div class="report-page page-break">
        <h1>Categorías, zonas y rally</h1>
        <div class="report-section">
          <h2>Categorías de golpe</h2>
          ${barsFromObject(stats.categories, stats.total)}
        </div>
        <div class="report-section">
          <h2>Rally</h2>
          ${barsFromObject(stats.rally, stats.total)}
        </div>
        <div class="report-section">
          <h2>Zonas NF rival</h2>
          ${barsFromObject(stats.zones)}
        </div>
      </div>
    </div>`;
}

function downloadPdfReport(){
  const container = document.getElementById("report-container");
  container.innerHTML = buildReportHtml();
  container.classList.remove("hidden");

  const element = document.getElementById("pdf-report");

  if(window.html2pdf){
    html2pdf().set({
      margin: 8,
      filename: "informe-padel-set.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], before: ".page-break" }
    }).from(element).save().then(() => container.classList.add("hidden"));
  }else{
    const win = window.open("", "_blank");
    win.document.write(`<!doctype html><html><head><title>Informe</title><link rel="stylesheet" href="styles.css"></head><body>${element.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    container.classList.add("hidden");
  }
}
