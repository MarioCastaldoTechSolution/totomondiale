const DATA_PATHS = {
  partecipanti: "data/partecipanti.json",
  partite: "data/partite.json",
  classifica: "data/classifica.json",
  regolamento: "data/regolamento.json",
};

const state = {
  partecipanti: [],
  partite: [],
  partiteData: {},
  regolamento: {},
  classificaFile: {},
  classifica: [],
  search: "",
  selectedPronostici: null,
  selectedPronosticiGroup: "all",
  selectedResultsGroup: "all",
  selectedDetail: null,
};

const statusMeta = {
  corretto: { label: "Corretto", className: "status-correct" },
  parziale: { label: "Parziale", className: "status-partial" },
  sbagliato: { label: "Sbagliato", className: "status-wrong" },
  da_giocare: { label: "Da giocare", className: "status-pending" },
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [partecipanti, partite, classifica, regolamento] = await Promise.all([
      loadJSON(DATA_PATHS.partecipanti),
      loadJSON(DATA_PATHS.partite),
      loadJSON(DATA_PATHS.classifica),
      loadJSON(DATA_PATHS.regolamento),
    ]);

    state.partecipanti = partecipanti.partecipanti || [];
    state.partiteData = partite;
    state.partite = partite.partite || [];
    state.classificaFile = classifica;
    state.regolamento = regolamento;
    state.classifica = calculateStandings();
    state.selectedPronostici = state.classifica[0]?.partecipanteId || state.partecipanti[0]?.id;
    state.selectedDetail = state.selectedPronostici;

    bindEvents();
    populateSelectors();
    renderAll();
  } catch (error) {
    renderLoadError(error);
  }
}

async function loadJSON(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status}`);
  }
  return response.json();
}

function bindEvents() {
  document.getElementById("participantSearch").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderClassifica();
  });

  document.getElementById("pronosticiParticipant").addEventListener("change", (event) => {
    state.selectedPronostici = event.target.value;
    renderPronostici();
  });

  document.getElementById("pronosticiGroupFilter").addEventListener("change", (event) => {
    state.selectedPronosticiGroup = event.target.value;
    renderPronostici();
  });

  document.getElementById("resultsGroupFilter").addEventListener("change", (event) => {
    state.selectedResultsGroup = event.target.value;
    renderResults();
  });

  document.getElementById("detailParticipant").addEventListener("change", (event) => {
    state.selectedDetail = event.target.value;
    renderDetail();
  });

  document.getElementById("standingRows").addEventListener("click", (event) => {
    const row = event.target.closest("[data-participant-id]");
    if (!row) return;
    const participantId = row.dataset.participantId;
    state.selectedDetail = participantId;
    state.selectedPronostici = participantId;
    populateSelectors();
    renderPronostici();
    renderDetail();
    document.getElementById("dettaglio").scrollIntoView({ behavior: "smooth" });
  });
}

function populateSelectors() {
  const orderedParticipants = [...state.partecipanti].sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }),
  );
  const groups = ["all", ...new Set(state.partite.map((partita) => partita.gruppo))];

  fillSelect(
    "pronosticiParticipant",
    orderedParticipants.map((participant) => ({
      value: participant.id,
      label: participant.nome,
    })),
    state.selectedPronostici,
  );
  fillSelect(
    "detailParticipant",
    orderedParticipants.map((participant) => ({
      value: participant.id,
      label: participant.nome,
    })),
    state.selectedDetail,
  );
  fillSelect(
    "pronosticiGroupFilter",
    groups.map((group) => ({
      value: group,
      label: group === "all" ? "Tutti" : `Gruppo ${group}`,
    })),
    state.selectedPronosticiGroup,
  );
  fillSelect(
    "resultsGroupFilter",
    groups.map((group) => ({
      value: group,
      label: group === "all" ? "Tutti" : `Gruppo ${group}`,
    })),
    state.selectedResultsGroup,
  );
}

function fillSelect(id, options, selectedValue) {
  const select = document.getElementById(id);
  select.innerHTML = options
    .map(
      (option) =>
        `<option value="${escapeAttr(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHTML(
          option.label,
        )}</option>`,
    )
    .join("");
}

function renderAll() {
  renderHome();
  renderClassifica();
  renderPronostici();
  renderResults();
  renderDetail();
  renderRegolamento();
}

function renderHome() {
  const played = state.partite.filter((partita) => Boolean(getActualScore(partita))).length;
  const pending = state.partite.length - played;
  const leader = state.classifica[0];
  const lastUpdate =
    state.partiteData.ultimoAggiornamento ||
    state.regolamento.ultimoAggiornamento ||
    state.partiteData.generatedAt;

  document.getElementById("lastUpdated").textContent = formatDate(lastUpdate);
  document.getElementById("homeStats").innerHTML = [
    statCard("Partecipanti", state.partecipanti.length, "Nickname registrati"),
    statCard("Partite", state.partite.length, "Gironi A-L"),
    statCard("Giocate", played, "Con risultato reale"),
    statCard("Da giocare", pending, "In attesa"),
    statCard("Leader", leader ? leader.nome : "-", leader ? `${leader.puntiTotali} punti` : ""),
  ].join("");

  const topThree = state.classifica.slice(0, 3);
  document.getElementById("topThree").innerHTML = topThree.length
    ? topThree
        .map(
          (row) => `
            <article class="podium-card">
              <div>
                <span>${row.posizione} posto</span>
                <strong>${escapeHTML(row.nome)}</strong>
              </div>
              <strong>${row.puntiTotali}</strong>
            </article>
          `,
        )
        .join("")
    : emptyState("Classifica non disponibile.");
}

function statCard(label, value, note) {
  return `
    <article class="stat-card">
      <p class="stat-label">${escapeHTML(label)}</p>
      <p class="stat-value">${escapeHTML(String(value))}</p>
      <p class="stat-note">${escapeHTML(note || "")}</p>
    </article>
  `;
}

function renderClassifica() {
  const query = normalizeLookup(state.search);
  const rows = state.classifica.filter((row) => normalizeLookup(row.nome).includes(query));
  document.getElementById("standingRows").innerHTML = rows.length
    ? rows
        .map((row) => {
          const rankClass = row.posizione <= 3 ? `rank-${row.posizione}` : "";
          return `
            <tr class="${rankClass}" data-participant-id="${escapeAttr(row.partecipanteId)}">
              <td class="rank-cell">${row.posizione}</td>
              <td>
                <span class="participant-name">${escapeHTML(row.nome)}</span>
                <div class="muted">Partite: ${row.puntiPartite} | Bonus: ${row.puntiBonus}</div>
              </td>
              <td class="score-cell">${row.puntiTotali}</td>
              <td>${row.risultatiEsatti}</td>
              <td>${row.risultatiParziali}</td>
              <td>${row.risultatiSbagliati}</td>
              <td>${row.partiteDaGiocare}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="7">${emptyState("Nessun partecipante trovato.")}</td></tr>`;
}

function renderPronostici() {
  const participant = findParticipant(state.selectedPronostici);
  if (!participant) {
    document.getElementById("pronosticiGrid").innerHTML = emptyState("Seleziona un partecipante.");
    return;
  }
  const matchesById = mapById(state.partite);
  const predictions = participant.pronostici
    .filter(
      (prediction) =>
        state.selectedPronosticiGroup === "all" ||
        prediction.gruppo === state.selectedPronosticiGroup,
    )
    .map((prediction) => ({
      prediction,
      score: scorePrediction(prediction, matchesById.get(prediction.partitaId)),
    }));

  document.getElementById("pronosticiGrid").innerHTML = predictions.length
    ? predictions
        .map(({ prediction, score }) => {
          const meta = statusMeta[score.stato] || statusMeta.da_giocare;
          return `
            <article class="prediction-card">
              <header>
                <div>
                  <span class="badge">Gruppo ${escapeHTML(prediction.gruppo)}</span>
                  <h3>${escapeHTML(prediction.partita)}</h3>
                </div>
                <span class="status-badge ${meta.className}">${meta.label}</span>
              </header>
              <div class="prediction-meta">
                <div>
                  <span>Segno</span>
                  <strong>${escapeHTML(prediction.pronostico || "-")}</strong>
                </div>
                <div>
                  <span>Risultato</span>
                  <strong>${escapeHTML(prediction.risultatoEsatto || "-")}</strong>
                </div>
              </div>
              <div class="muted">Reale: ${escapeHTML(score.risultatoReale || "Non giocata")} | Punti: ${score.punti}</div>
            </article>
          `;
        })
        .join("")
    : emptyState("Nessun pronostico per il filtro selezionato.");
}

function renderResults() {
  const rows = state.partite.filter(
    (partita) => state.selectedResultsGroup === "all" || partita.gruppo === state.selectedResultsGroup,
  );
  document.getElementById("resultsRows").innerHTML = rows
    .map((partita) => {
      const actualScore = getActualScore(partita);
      const played = Boolean(actualScore);
      const meta = played ? { label: "Giocata", className: "status-correct" } : statusMeta.da_giocare;
      const result = played ? `${actualScore[0]}-${actualScore[1]}` : "Non giocata";
      return `
        <tr>
          <td><span class="badge">Gruppo ${escapeHTML(partita.gruppo)}</span></td>
          <td>
            <strong>${escapeHTML(partita.partita)}</strong>
            ${partita.data ? `<div class="muted">${escapeHTML(partita.data)} ${escapeHTML(partita.ora || "")}</div>` : ""}
          </td>
          <td class="score-cell">${escapeHTML(result)}</td>
          <td><span class="status-badge ${meta.className}">${meta.label}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderDetail() {
  const row = state.classifica.find((item) => item.partecipanteId === state.selectedDetail);
  if (!row) {
    document.getElementById("detailContent").innerHTML = emptyState("Seleziona un partecipante.");
    return;
  }
  const matchRows = row.dettaglio.partite
    .map((item) => {
      const meta = statusMeta[item.stato] || statusMeta.da_giocare;
      return `
        <tr>
          <td><span class="badge">Gruppo ${escapeHTML(item.gruppo || "-")}</span></td>
          <td>${escapeHTML(item.partita || "-")}</td>
          <td>${escapeHTML(item.risultatoEsatto || "-")}</td>
          <td>${escapeHTML(item.risultatoReale || "Non giocata")}</td>
          <td><span class="status-badge ${meta.className}">${meta.label}</span></td>
          <td class="score-cell">${item.punti}</td>
        </tr>
      `;
    })
    .join("");
  const bonusRows = row.dettaglio.bonus
    .map((item) => {
      const meta = statusMeta[item.stato] || statusMeta.da_giocare;
      return `
        <tr>
          <td>${escapeHTML(item.label)}</td>
          <td>${escapeHTML(formatValue(item.pronostico))}</td>
          <td>${escapeHTML(formatValue(item.valoreReale))}</td>
          <td><span class="status-badge ${meta.className}">${meta.label}</span></td>
          <td class="score-cell">${item.punti}</td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("detailContent").innerHTML = `
    <div class="summary-panel">
      ${summaryItem("Totale", row.puntiTotali)}
      ${summaryItem("Partite", row.puntiPartite)}
      ${summaryItem("Bonus", row.puntiBonus)}
      ${summaryItem("Esatti", row.risultatiEsatti)}
      ${summaryItem("Da giocare", row.partiteDaGiocare)}
    </div>
    <div class="detail-grid">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Gruppo</th>
              <th>Partita</th>
              <th>Pronostico</th>
              <th>Reale</th>
              <th>Esito</th>
              <th>Punti</th>
            </tr>
          </thead>
          <tbody>${matchRows}</tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bonus</th>
              <th>Pronostico</th>
              <th>Reale</th>
              <th>Esito</th>
              <th>Punti</th>
            </tr>
          </thead>
          <tbody>${bonusRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(String(value))}</strong>
    </div>
  `;
}

function renderRegolamento() {
  const points = state.regolamento.punteggi || {};
  const rules = state.regolamento.regole || [];
  const pointLabels = {
    risultatoEsatto: "Risultato esatto",
    segnoCorretto: "Segno corretto",
    primaQualificata: "Prima qualificata",
    secondaQualificata: "Seconda qualificata",
    vincitore: "Vincitore",
    finalista: "Finalista",
    capocannoniere: "Capocannoniere",
    assistman: "Assistman",
    portiere: "Portiere",
    giocatore: "Giocatore",
    difesa: "Miglior difesa",
    attacco: "Miglior attacco",
  };

  document.getElementById("rulesContent").innerHTML = `
    <article class="rules-panel">
      <h3>${escapeHTML(state.regolamento.titolo || "Regolamento")}</h3>
      <p>${escapeHTML(state.regolamento.descrizione || "")}</p>
      <ul class="rules-list">
        ${rules.map((rule) => `<li>${escapeHTML(rule)}</li>`).join("")}
      </ul>
    </article>
    <article class="rules-panel">
      <h3>Punteggi</h3>
      <ul class="points-list">
        ${Object.entries(points)
          .map(
            ([key, value]) => `
              <li>
                <span>${escapeHTML(pointLabels[key] || key)}</span>
                <strong>${escapeHTML(String(value))}</strong>
              </li>
            `,
          )
          .join("")}
      </ul>
    </article>
  `;
}

function calculateStandings() {
  const matchesById = mapById(state.partite);
  const rows = state.partecipanti.map((participant) => {
    const matchDetails = (participant.pronostici || []).map((prediction) =>
      scorePrediction(prediction, matchesById.get(prediction.partitaId)),
    );
    const bonusDetails = scoreBonus(participant);
    const puntiPartite = sum(matchDetails.map((item) => item.punti));
    const puntiBonus = sum(bonusDetails.map((item) => item.punti));
    const counts = countBy(matchDetails, "stato");
    return {
      partecipanteId: participant.id,
      nome: participant.nome,
      puntiTotali: puntiPartite + puntiBonus,
      puntiPartite,
      puntiBonus,
      risultatiEsatti: counts.corretto || 0,
      risultatiParziali: counts.parziale || 0,
      risultatiSbagliati: counts.sbagliato || 0,
      partiteDaGiocare: counts.da_giocare || 0,
      dettaglio: {
        partite: matchDetails,
        bonus: bonusDetails,
      },
    };
  });

  rows.sort((a, b) => b.puntiTotali - a.puntiTotali || a.nome.localeCompare(b.nome, "it"));
  rows.forEach((row, index) => {
    row.posizione = index + 1;
  });
  return rows;
}

function scorePrediction(prediction, match) {
  const points = state.regolamento.punteggi || {};
  const actualScore = getActualScore(match);
  const predictedScore = parseScore(prediction.risultatoEsatto);
  const predictedOutcome = normalizeOutcome(prediction.pronostico) || outcomeFromScore(predictedScore);
  const base = {
    partitaId: prediction.partitaId,
    gruppo: prediction.gruppo,
    partita: prediction.partita,
    pronostico: predictedOutcome,
    risultatoEsatto: prediction.risultatoEsatto,
    risultatoReale: null,
    stato: "da_giocare",
    punti: 0,
  };

  if (!actualScore) {
    return base;
  }

  const actualOutcome = outcomeFromScore(actualScore);
  base.risultatoReale = `${actualScore[0]}-${actualScore[1]}`;
  if (predictedScore && predictedScore[0] === actualScore[0] && predictedScore[1] === actualScore[1]) {
    base.stato = "corretto";
    base.punti = Number(points.risultatoEsatto ?? 3);
  } else if (predictedOutcome && predictedOutcome === actualOutcome) {
    base.stato = "parziale";
    base.punti = Number(points.segnoCorretto ?? 1);
  } else {
    base.stato = "sbagliato";
  }
  return base;
}

function scoreBonus(participant) {
  const points = state.regolamento.punteggi || {};
  const realGroups = state.partiteData.qualificateReali || {};
  const realFinal = state.partiteData.bonusReali || {};
  const predictedGroups = participant.bonus?.gruppi || {};
  const predictedFinal = participant.bonus?.finali || {};
  const details = [];

  Object.entries(predictedGroups).forEach(([group, values]) => {
    [
      ["prima", "Prima qualificata", "primaQualificata"],
      ["seconda", "Seconda qualificata", "secondaQualificata"],
    ].forEach(([position, label, pointKey]) => {
      const predicted = values?.[position];
      const real = realGroups[group]?.[position];
      const scored = scoreTextValue(predicted, real, points[pointKey] ?? 0);
      details.push({
        id: `gruppo-${group.toLowerCase()}-${position}`,
        label: `${label} gruppo ${group}`,
        pronostico: predicted,
        valoreReale: real,
        ...scored,
      });
    });
  });

  [
    ["vincitore", "Vincitore mondiale", "vincitore"],
    ["capocannoniere", "Capocannoniere", "capocannoniere"],
    ["assistman", "Miglior assistman", "assistman"],
    ["portiere", "Miglior portiere", "portiere"],
    ["giocatore", "Miglior giocatore", "giocatore"],
    ["difesa", "Miglior difesa", "difesa"],
    ["attacco", "Miglior attacco", "attacco"],
  ].forEach(([key, label, pointKey]) => {
    const predicted = predictedFinal[key];
    const real = realFinal[key];
    const scored = scoreTextValue(predicted, real, points[pointKey] ?? 0);
    details.push({
      id: key,
      label,
      pronostico: predicted,
      valoreReale: real,
      ...scored,
    });
  });

  const finalists = Array.isArray(realFinal.finalisti)
    ? realFinal.finalisti
    : realFinal.finalisti
      ? [realFinal.finalisti]
      : [];
  const finalistLookup = new Set(finalists.map(normalizeLookup));
  ["finalista_1", "finalista_2"].forEach((key, index) => {
    const predicted = predictedFinal[key];
    let scored = { stato: "da_giocare", punti: 0 };
    if (finalistLookup.size > 0) {
      scored = finalistLookup.has(normalizeLookup(predicted))
        ? { stato: "corretto", punti: Number(points.finalista ?? 0) }
        : { stato: "sbagliato", punti: 0 };
    }
    details.push({
      id: key,
      label: `Finalista ${index + 1}`,
      pronostico: predicted,
      valoreReale: finalists,
      ...scored,
    });
  });

  return details;
}

function scoreTextValue(predicted, real, pointValue) {
  if (!real) {
    return { stato: "da_giocare", punti: 0 };
  }
  return normalizeLookup(predicted) === normalizeLookup(real)
    ? { stato: "corretto", punti: Number(pointValue) }
    : { stato: "sbagliato", punti: 0 };
}

function getActualScore(match) {
  if (!match) return null;
  const hasHomeGoals = match.golCasa !== null && match.golCasa !== undefined && match.golCasa !== "";
  const hasAwayGoals =
    match.golTrasferta !== null && match.golTrasferta !== undefined && match.golTrasferta !== "";
  const homeGoals = Number(match.golCasa);
  const awayGoals = Number(match.golTrasferta);
  if (hasHomeGoals && hasAwayGoals && Number.isInteger(homeGoals) && Number.isInteger(awayGoals)) {
    return [homeGoals, awayGoals];
  }
  return parseScore(match.risultatoReale);
}

function parseScore(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.trim().match(/(\d+)\D+(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function outcomeFromScore(score) {
  if (!score) return null;
  if (score[0] > score[1]) return "1";
  if (score[0] < score[1]) return "2";
  return "X";
}

function normalizeOutcome(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toUpperCase().replace(".0", "");
  return ["1", "X", "2"].includes(text) ? text : text || null;
}

function normalizeLookup(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function findParticipant(id) {
  return state.partecipanti.find((participant) => participant.id === id);
}

function countBy(items, key) {
  return items.reduce((accumulator, item) => {
    accumulator[item[key]] = (accumulator[item[key]] || 0) + 1;
    return accumulator;
  }, {});
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }
  return value || "-";
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}

function renderLoadError(error) {
  document.querySelector("main").innerHTML = `
    <section class="section">
      <div class="section-inner">
        <div class="error-state">
          Impossibile caricare i dati JSON. ${escapeHTML(error.message)}
        </div>
      </div>
    </section>
  `;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}
