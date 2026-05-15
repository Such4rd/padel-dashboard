function kpi(label, value, note = ""){
  return `
    <article class="kpi-card">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value">${esc(value)}</div>
      <div class="mini-note">${esc(note)}</div>
    </article>`;
}

function serviceTable(data){
  const rows = data.byServeNumber.map(item => `
    <tr>
      <td>${item.serve_number}º saque</td>
      <td>${item.played}</td>
      <td>${item.played_pct}%</td>
      <td>${item.won}</td>
      <td>${item.lost}</td>
      <td>${item.win_pct}%</td>
    </tr>
  `).join("");

  return `
    <table class="stat-table">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Jug.</th>
          <th>% uso</th>
          <th>Gan.</th>
          <th>Perd.</th>
          <th>% gan.</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function categoryTable(title, obj){
  const rows = CATEGORY_ORDER.map(category => `
    <tr>
      <td>${esc(labelCategory(category))}</td>
      <td>${obj[category] || 0}</td>
    </tr>
  `).join("");

  return `
    <h4>${esc(title)}</h4>
    <table class="stat-table compact-table">
      <tbody>${rows}</tbody>
    </table>`;
}

function zoneTable(obj){
  const zones = ["RED", "MEDIO", "FONDO"];
  const rows = zones.map(zone => `
    <tr>
      <td>${esc(labelZone(zone))}</td>
      <td>${obj[zone] || 0}</td>
    </tr>
  `).join("");

  return `
    <table class="stat-table compact-table">
      <tbody>${rows}</tbody>
    </table>`;
}

function barsFromObject(obj, total = null){
  const entries = Object.entries(obj)
    .filter(([, value]) => value > 0)
    .sort((a,b) => b[1] - a[1]);

  const max = Math.max(1, ...(entries.map(entry => entry[1])));

  if(!entries.length){
    return `<p class="mini-note">Sin datos.</p>`;
  }

  return entries.map(([label, value]) => {
    const width = total ? pct(value, total) : Math.round((value / max) * 100);
    return `
      <div class="bar-row">
        <span>${esc(labelCategory(label) || label)}</span>
        <div class="bar-bg"><div class="bar-fill" style="width:${width}%"></div></div>
        <strong>${value}</strong>
      </div>`;
  }).join("");
}

function playerPanel(title, stats){
  return `
    <h3>${esc(title)}</h3>
    <div class="dash-grid mini-kpis">
      ${kpi("Puntos", stats.total, "acciones registradas")}
      ${kpi("G-W/F", stats.winnerForced, "propios")}
      ${kpi("P-NF", stats.ownNF, "errores propios")}
      ${kpi("P-W/F", stats.lostWF, "rival/forzado")}
    </div>

    <div class="panel-grid nested-grid">
      <div>
        ${categoryTable("P-NF por categoría", stats.ownNFByCategory)}
      </div>
      <div>
        ${categoryTable("P-W/F rival por categoría", stats.lostWFByCategory)}
      </div>
    </div>

    <h4>Golpes más destacados</h4>
    ${barsFromObject(Object.fromEntries(topEntries(stats.allStrokes, 8)))}
  `;
}

function renderDashboard(){
  const state = loadPadelState();
  const events = state.events;
  const stats = buildStats(events);

  document.getElementById("updated-at").textContent = events.length
    ? `Puntos registrados: ${events.length} · actualizado ${state.updated_at || ""}`
    : "Sin puntos registrados todavía";

  document.getElementById("kpi-grid").innerHTML = [
    kpi("Puntos", stats.total, "total set"),
    kpi("Ganados", `${stats.won}`, `${stats.win_pct}%`),
    kpi("Perdidos", stats.lost, `${stats.lost_pct}%`),
    kpi("Marcador", `${state.score.ourGames}-${state.score.rivalGames}`, "juegos"),
    kpi("Servicio", `${stats.service.win_pct}%`, `${stats.service.won}/${stats.service.total} ganados`),
    kpi("Resto", `${stats.rest.win_pct}%`, `${stats.rest.won}/${stats.rest.total} ganados`),
    kpi("1º saque", `${stats.service.byServeNumber[0].win_pct}%`, `${stats.service.byServeNumber[0].played_pct}% uso`),
    kpi("2º saque", `${stats.service.byServeNumber[1].win_pct}%`, `${stats.service.byServeNumber[1].played_pct}% uso`)
  ].join("");

  document.getElementById("service-table").innerHTML = serviceTable(stats.service);
  document.getElementById("rest-table").innerHTML = serviceTable(stats.rest);
  document.getElementById("service-j1-table").innerHTML = serviceTable(stats.serviceJ1);
  document.getElementById("service-j2-table").innerHTML = serviceTable(stats.serviceJ2);
  document.getElementById("rest-r1-table").innerHTML = serviceTable(stats.restR1);
  document.getElementById("rest-r2-table").innerHTML = serviceTable(stats.restR2);

  document.getElementById("j1-panel").innerHTML = playerPanel("Revés / J1", stats.j1);
  document.getElementById("j2-panel").innerHTML = playerPanel("Derecha / J2", stats.j2);

  document.getElementById("won-summary").innerHTML = `
    <div class="dash-grid mini-kpis">
      ${kpi("Puntos ganados", stats.pair.won, "total")}
      ${kpi("NF rival", stats.pair.rivalNF, `${stats.pair.wonSplit.positive_pct}%`)}
      ${kpi("G-W/F propios", stats.pair.ownWF, `${stats.pair.wonSplit.negative_pct}%`)}
    </div>
    <div class="panel-grid nested-grid">
      <div><h4>NF rival por zona</h4>${zoneTable(stats.pair.rivalNFByZone)}</div>
      <div>${categoryTable("G-W/F propios por categoría", stats.pair.ownWFByCategory)}</div>
    </div>`;

  document.getElementById("lost-summary").innerHTML = `
    <div class="dash-grid mini-kpis">
      ${kpi("Puntos perdidos", stats.pair.lost, "total")}
      ${kpi("P-NF propios", stats.pair.ownNF, `${stats.pair.lostSplit.positive_pct}%`)}
      ${kpi("P-W/F rival", stats.pair.rivalWF, `${stats.pair.lostSplit.negative_pct}%`)}
    </div>
    <div class="panel-grid nested-grid">
      <div>${categoryTable("P-NF propios por categoría", stats.pair.ownNFByCategory)}</div>
      <div>${categoryTable("P-W/F rival por categoría", stats.pair.rivalWFByCategory)}</div>
    </div>`;

  document.getElementById("category-bars").innerHTML = barsFromObject(stats.categories, stats.total);
  document.getElementById("zone-bars").innerHTML = barsFromObject(stats.zones);
  document.getElementById("rally-bars").innerHTML = barsFromObject(stats.rally, stats.total);
}

document.getElementById("refresh-dashboard").addEventListener("click", renderDashboard);
document.getElementById("download-pdf").addEventListener("click", downloadPdfReport);
window.addEventListener("storage", renderDashboard);
setInterval(renderDashboard, 3000);
renderDashboard();
