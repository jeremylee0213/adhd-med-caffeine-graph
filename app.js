const storageKey = "med-caffeine-graph-v4";

const defaultItems = [
  {
    id: "concerta",
    name: "콘서타",
    type: "약물",
    dose: 18,
    unit: "mg",
    time: "06:30",
    repeatDaily: true,
    halfLife: 3.5,
    peakTime: 6.8,
    effectType: "same-day",
    effectStart: 1,
    effectEnd: 12.5,
    steadyState: 0,
    confidence: "높음",
    evidenceLabel: "DailyMed + OROS 12.5h 연구",
    evidenceUrl: "https://journals.sagepub.com/doi/10.1177/1087054711425772",
    evidenceSummary: "Tmax 6-10h, 18mg Tmax 6.8h/t1/2 3.5h. OROS MPH 효과는 1h부터 12.5h까지 관찰.",
    color: "#1f8f83",
    note: "methylphenidate ER",
  },
  {
    id: "abilify",
    name: "아빌리파이",
    type: "약물",
    dose: 2,
    unit: "mg",
    time: "06:30",
    repeatDaily: true,
    halfLife: 75,
    peakTime: 4,
    effectType: "steady-state",
    effectStart: 0,
    effectEnd: 0,
    steadyState: 336,
    confidence: "높음",
    evidenceLabel: "DailyMed Abilify",
    evidenceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6875b848-8b13-45f8-ada5-69ef8aece6b6",
    evidenceSummary: "Tmax 3-5h, t1/2 75h. 활성대사체 94h, 정상상태는 약 14일.",
    color: "#6f63d8",
    note: "aripiprazole",
  },
  {
    id: "escitam",
    name: "에스시탐",
    type: "약물",
    dose: 2,
    unit: "mg",
    time: "06:30",
    repeatDaily: true,
    halfLife: 30,
    peakTime: 5,
    effectType: "steady-state",
    effectStart: 0,
    effectEnd: 0,
    steadyState: 168,
    confidence: "중간",
    evidenceLabel: "DailyMed + SSRI 리뷰",
    evidenceUrl: "https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5088d6cd-ec13-384d-e063-6394a90aee05",
    evidenceSummary: "Tmax 약 5h, t1/2 27-32h, 정상상태 약 1주. 임상 효과 평가는 보통 주 단위.",
    color: "#d98c23",
    note: "escitalopram 가정",
  },
  {
    id: "caffeine",
    name: "카페인",
    type: "카페인",
    dose: 100,
    unit: "mg",
    time: "08:00",
    repeatDaily: false,
    halfLife: 5,
    peakTime: 0.75,
    effectType: "same-day",
    effectStart: 0.25,
    effectEnd: 6,
    steadyState: 0,
    confidence: "중간",
    evidenceLabel: "NCBI StatPearls + caffeine review",
    evidenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK519490/",
    evidenceSummary: "성인 평균 t1/2 약 5h. 피크/체감은 개인차가 커서 흡연, 임신, 간기능, CYP1A2 영향.",
    color: "#8b5e34",
    note: "커피 1잔 수준 예시",
  },
];

const palette = ["#1f8f83", "#6f63d8", "#d98c23", "#8b5e34", "#2d7dd2", "#b23864"];

const state = {
  durationHours: 12,
  currentTime: "",
  hoverX: null,
  openEditorId: null,
  items: structuredClone(defaultItems),
};

const els = {
  currentTime: document.querySelector("#currentTime"),
  durationHours: document.querySelector("#durationHours"),
  resetButton: document.querySelector("#resetButton"),
  restoreButton: document.querySelector("#restoreButton"),
  addMedicationButton: document.querySelector("#addMedicationButton"),
  addCaffeineButton: document.querySelector("#addCaffeineButton"),
  itemEditor: document.querySelector("#itemEditor"),
  chartCanvas: document.querySelector("#chartCanvas"),
  chartTitle: document.querySelector("#chartTitle"),
  modelNote: document.querySelector("#modelNote"),
  peakBadge: document.querySelector("#peakBadge"),
  halfBadge: document.querySelector("#halfBadge"),
  summaryList: document.querySelector("#summaryList"),
  evidenceList: document.querySelector("#evidenceList"),
  legendItems: document.querySelector("#legendItems"),
  hoverReadout: document.querySelector("#hoverReadout"),
  segments: [...document.querySelectorAll(".segment")],
};

const ctx = els.chartCanvas.getContext("2d");
let lastChart = null;

function init() {
  loadState();
  if (!state.currentTime) {
    const now = new Date();
    state.currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
  }
  els.currentTime.value = state.currentTime;
  els.durationHours.value = state.durationHours;
  bindEvents();
  render();
}

function bindEvents() {
  els.currentTime.addEventListener("input", () => {
    state.currentTime = els.currentTime.value || "00:00";
    saveState();
    render();
  });

  els.durationHours.addEventListener("input", () => {
    if (els.durationHours.value === "") return;
    setDuration(Number(els.durationHours.value));
  });

  els.resetButton.addEventListener("click", restoreDefaults);
  els.restoreButton.addEventListener("click", restoreDefaults);
  els.addMedicationButton.addEventListener("click", () => addItem("약물"));
  els.addCaffeineButton.addEventListener("click", () => addItem("카페인"));

  els.segments.forEach((button) => {
    button.addEventListener("click", () => {
      setDuration(Number(button.dataset.duration));
    });
  });

  els.chartCanvas.addEventListener("pointermove", (event) => {
    const rect = els.chartCanvas.getBoundingClientRect();
    state.hoverX = event.clientX - rect.left;
    renderChartOnly();
  });

  els.chartCanvas.addEventListener("pointerleave", () => {
    state.hoverX = null;
    els.hoverReadout.hidden = true;
    renderChartOnly();
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Array.isArray(saved.items)) return;
    state.items = saved.items.map(normalizeItem).filter(Boolean);
    state.durationHours = clamp(Number(saved.durationHours) || 12, 1, 720);
    state.currentTime = typeof saved.currentTime === "string" ? saved.currentTime : "";
  } catch {
    state.items = structuredClone(defaultItems);
  }
}

function saveState() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      items: state.items,
      durationHours: state.durationHours,
      currentTime: state.currentTime,
    }),
  );
}

function restoreDefaults() {
  state.items = structuredClone(defaultItems);
  state.durationHours = 12;
  state.openEditorId = null;
  els.durationHours.value = state.durationHours;
  syncDurationButtons();
  saveState();
  render();
}

function setDuration(value) {
  state.durationHours = clamp(value, 1, 720);
  els.durationHours.value = state.durationHours;
  syncDurationButtons();
  saveState();
  render();
}

function syncDurationButtons() {
  els.segments.forEach((item) => {
    item.classList.toggle("active", Number(item.dataset.duration) === state.durationHours);
  });
}

function addItem(type) {
  const isCaffeine = type === "카페인";
  const nextIndex = state.items.length;
  const id = crypto.randomUUID();
  state.items.push({
    id,
    name: isCaffeine ? "카페인" : "새 약물",
    type,
    dose: isCaffeine ? 100 : 10,
    unit: "mg",
    time: state.currentTime || "08:00",
    repeatDaily: !isCaffeine,
    halfLife: isCaffeine ? 5 : 4,
    peakTime: isCaffeine ? 0.75 : 2,
    effectType: "same-day",
    effectStart: isCaffeine ? 0.25 : 1,
    effectEnd: isCaffeine ? 6 : 8,
    steadyState: 0,
    confidence: "직접입력",
    evidenceLabel: "사용자 입력",
    evidenceUrl: "",
    evidenceSummary: "사용자가 직접 입력한 지속시간입니다.",
    color: palette[nextIndex % palette.length],
    note: isCaffeine ? "카페인 직접 입력" : "직접 입력",
  });
  state.openEditorId = id;
  saveState();
  render();
}

function updateItem(id, key, value) {
  const item = state.items.find((target) => target.id === id);
  if (!item) return;

  if (key === "repeatDaily") {
    item.repeatDaily = Boolean(value);
  } else if (["dose", "halfLife", "peakTime", "effectStart", "effectEnd", "steadyState"].includes(key)) {
    item[key] = clamp(
      Number(value),
      key === "dose" || key === "steadyState" || key === "effectStart" || key === "effectEnd" ? 0 : 0.05,
      key === "halfLife" ? 240 : 1000,
    );
  } else {
    item[key] = value;
  }
  state.openEditorId = id;
  saveState();
  render();
}

function removeItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  if (state.openEditorId === id) state.openEditorId = null;
  saveState();
  render();
}

function render() {
  const activeCount = state.items.length;
  const acuteCount = state.items.filter((item) => item.effectType === "same-day").length;
  const repeatCount = state.items.filter((item) => item.repeatDaily).length;
  const chronicCount = state.items.length - acuteCount;
  els.chartTitle.textContent = "약물·카페인 상대 농도·약효";
  els.modelNote.textContent = "실선=반복 반영 상대 혈중 추정, 얇은 밴드=문헌 기반 약효·각성 구간";
  els.peakBadge.textContent = `🔁 매일 반복 ${repeatCount}/${activeCount}`;
  els.halfBadge.textContent =
    chronicCount > 0 && state.durationHours < 168
      ? "🔭 장기약은 7일 보기 추천"
      : `⏱️ ${formatDurationLabel(state.durationHours)}`;
  els.durationHours.value = state.durationHours;
  syncDurationButtons();
  renderEditor();
  renderLegend();
  renderChartOnly();
  renderSummary();
  renderEvidence();
}

function renderEditor() {
  els.itemEditor.replaceChildren();

  state.items.forEach((item) => {
    const card = document.createElement("details");
    card.className = "edit-card edit-row";
    card.style.setProperty("--med-color", item.color);
    if (state.openEditorId === item.id) card.open = true;
    const icon = item.type === "카페인" ? "☕" : "💊";
    card.innerHTML = `
      <summary class="edit-card-summary">
        <span class="item-icon" aria-hidden="true">${icon}</span>
        <span class="edit-title">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${formatAmount(item.dose)}mg · ${item.time} · ${item.repeatDaily ? "🔁 매일 · " : ""}${formatEffectBadge(item)}</small>
        </span>
        <span class="edit-pill" aria-hidden="true">✏️</span>
      </summary>
      <div class="edit-body">
        <label class="compact-field name-field">
          <span>🏷️ 이름</span>
          <input data-key="name" aria-label="이름" value="${escapeHtml(item.name)}" />
        </label>
        <label class="compact-field">
          <span>🔖 구분</span>
          <select data-key="type" aria-label="구분">
            <option value="약물" ${item.type === "약물" ? "selected" : ""}>💊 약물</option>
            <option value="카페인" ${item.type === "카페인" ? "selected" : ""}>☕ 카페인</option>
          </select>
        </label>
        <label class="compact-field">
          <span>⚖️ mg</span>
          <input data-key="dose" aria-label="용량 mg" type="number" min="0" step="0.5" value="${item.dose}" />
        </label>
        <label class="compact-field">
          <span>🕒 시간</span>
          <input data-key="time" aria-label="복용 시각" type="time" value="${item.time}" />
        </label>
        <label class="compact-field check-field">
          <span>🔁 반복</span>
          <input data-key="repeatDaily" aria-label="매일 반복 복용" type="checkbox" ${item.repeatDaily ? "checked" : ""} />
          <em>매일</em>
        </label>
        <label class="compact-field">
          <span>⛰️ 피크</span>
          <input data-key="peakTime" aria-label="피크 시간" type="number" min="0.05" step="0.05" value="${item.peakTime}" />
        </label>
        <label class="compact-field">
          <span>⏳ 반감</span>
          <input data-key="halfLife" aria-label="반감기" type="number" min="0.05" step="0.1" value="${item.halfLife}" />
        </label>
        <label class="compact-field color-field">
          <span>🎨 색</span>
          <input data-key="color" aria-label="색상" type="color" value="${item.color}" />
        </label>
        <label class="compact-field">
          <span>🧭 방식</span>
          <select data-key="effectType" aria-label="약효 표시 방식">
            <option value="same-day" ${item.effectType === "same-day" ? "selected" : ""}>🧭 당일</option>
            <option value="steady-state" ${item.effectType === "steady-state" ? "selected" : ""}>🧬 누적</option>
          </select>
        </label>
        ${
          item.effectType === "steady-state"
            ? `
        <label class="compact-field">
          <span>🧬 정상상태 h</span>
          <input data-key="steadyState" aria-label="정상상태 도달 시간" type="number" min="0" step="1" value="${item.steadyState}" />
        </label>`
            : `
        <label class="compact-field">
          <span>🚦 효과 시작</span>
          <input data-key="effectStart" aria-label="효과 시작 시간" type="number" min="0" step="0.25" value="${item.effectStart}" />
        </label>
        <label class="compact-field">
          <span>🏁 효과 끝</span>
          <input data-key="effectEnd" aria-label="효과 종료 시간" type="number" min="0" step="0.25" value="${item.effectEnd}" />
        </label>`
        }
        <label class="compact-field note-field">
          <span>📝 메모</span>
          <input data-key="note" aria-label="메모" value="${escapeHtml(item.note)}" />
        </label>
        <label class="compact-field evidence-field">
          <span>📚 근거</span>
          <input data-key="evidenceSummary" aria-label="근거 요약" value="${escapeHtml(item.evidenceSummary)}" />
        </label>
        <label class="compact-field evidence-field">
          <span>🔗 출처 URL</span>
          <input data-key="evidenceUrl" aria-label="출처 URL" value="${escapeHtml(item.evidenceUrl)}" />
        </label>
        <button class="delete-button" type="button" title="삭제" aria-label="${escapeHtml(item.name)} 삭제">🗑️ 삭제</button>
      </div>
    `;

    card.addEventListener("toggle", () => {
      if (card.open) {
        state.openEditorId = item.id;
        els.itemEditor.querySelectorAll(".edit-card[open]").forEach((other) => {
          if (other !== card) other.open = false;
        });
      } else if (state.openEditorId === item.id) {
        state.openEditorId = null;
      }
    });
    card.querySelectorAll("[data-key]").forEach((input) => {
      input.addEventListener("change", () =>
        updateItem(
          item.id,
          input.dataset.key,
          input.type === "checkbox" ? input.checked : input.value,
        ),
      );
    });
    card
      .querySelector(".delete-button")
      .addEventListener("click", () => removeItem(item.id));
    els.itemEditor.append(card);
  });

  if (state.items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "항목이 없습니다. 약물 또는 카페인을 추가하세요.";
    els.itemEditor.append(empty);
  }
}

function renderLegend() {
  els.legendItems.replaceChildren();
  state.items.forEach((item) => {
    const legend = document.createElement("span");
    legend.innerHTML = `<i style="background:${item.color}"></i>${escapeHtml(item.name)}`;
    els.legendItems.append(legend);
  });
}

function renderChartOnly() {
  const data = buildChartData();
  lastChart = data;
  drawChart(data);
}

function renderSummary() {
  const data = lastChart ?? buildChartData();
  els.summaryList.replaceChildren();

  if (state.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "summary-row";
    empty.innerHTML = "<span>요약</span><strong>-</strong><small>계산할 항목이 없습니다.</small>";
    els.summaryList.append(empty);
    return;
  }

  state.items.forEach((item, index) => {
    const elapsed = elapsedHourFor(item);
    const series = data.series.find((entry) => entry.item.id === item.id);
    const raw = concentrationRawAt(elapsed, item);
    const percent = concentrationPercentAt(elapsed, item, series?.normalizer || 1);
    const amountLabel = item.repeatDaily
      ? `반복지수 ${formatRatio(raw)}x`
      : `${formatAmount((item.dose * percent) / 100)}mg`;
    const card = document.createElement("div");
    card.className = `summary-row ${index === 0 ? "primary" : ""}`;
    const icon = item.type === "카페인" ? "☕" : "💊";
    card.innerHTML = `
      <span>${icon} ${escapeHtml(item.name)} <b class="confidence-chip">${escapeHtml(item.confidence)}</b></span>
      <strong style="color:${item.color}">${Math.round(percent)}%</strong>
      <small>${item.repeatDaily ? "🔁 매일 반복 · " : ""}${amountLabel} · ${formatDoseElapsed(elapsed)} · ${escapeHtml(effectStatusFor(item, elapsed))}</small>
    `;
    els.summaryList.append(card);
  });

  const reference = document.createElement("div");
  reference.className = "summary-row";
  reference.innerHTML = `
    <span>🕒 현재</span>
    <strong>${state.currentTime || "--:--"}</strong>
    <small>mg는 복용량 대비 단순 환산</small>
  `;
  els.summaryList.append(reference);

  void data;
}

function renderEvidence() {
  if (!els.evidenceList) return;
  els.evidenceList.replaceChildren();

  state.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "evidence-row";
    const icon = item.type === "카페인" ? "☕" : "💊";
    const source = item.evidenceUrl
      ? `<a href="${escapeHtml(item.evidenceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.evidenceLabel || "출처")}</a>`
      : `<span>${escapeHtml(item.evidenceLabel || "사용자 입력")}</span>`;
    row.innerHTML = `
      <strong>${icon} ${escapeHtml(item.name)} <b class="confidence-chip">${escapeHtml(item.confidence)}</b></strong>
      <small>${escapeHtml(item.evidenceSummary)}</small>
      ${source}
    `;
    els.evidenceList.append(row);
  });
}

function buildChartData() {
  const step = state.durationHours <= 24 ? 0.05 : state.durationHours <= 72 ? 0.15 : 0.35;
  const startHour = referenceStartHour();
  const series = state.items.map((item) => {
    const rawPoints = [];
    for (let hour = 0; hour <= state.durationHours + 0.0001; hour += step) {
      const absoluteHour = startHour + hour;
      const elapsed = absoluteHour - doseAbsoluteHour(item, startHour);
      rawPoints.push({ hour, raw: concentrationRawAt(elapsed, item) });
    }
    const normalizer = Math.max(1, ...rawPoints.map((point) => point.raw));
    const points = rawPoints.map((point) => ({
      ...point,
      percent: clamp((point.raw / normalizer) * 100, 0, 100),
    }));
    return { item, points, normalizer };
  });
  return { series, startHour };
}

function drawChart(data) {
  const canvas = els.chartCanvas;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(340, Math.floor(rect.width * dpr));
  canvas.height = Math.max(320, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const pad = {
    top: 32,
    right: width < 620 ? 18 : 42,
    bottom: 46,
    left: width < 620 ? 42 : 56,
  };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (hour) => pad.left + (hour / state.durationHours) * plotW;
  const y = (percent) => pad.top + plotH - (percent / 105) * plotH;

  ctx.clearRect(0, 0, width, height);
  drawAxes(width, pad, plotW, plotH, x, y, data.startHour);
  drawHalfLine(pad, plotW, y);
  drawEffectWindows(x, pad, plotW, plotH, data.startHour);
  drawSeries(data, x, y);
  drawPeakMarkers(x, y, data.startHour);
  drawCurrentMarker(x, pad, plotH, data.startHour);
  drawHover(data, x, y, pad, plotW, plotH, data.startHour);
}

function drawAxes(width, pad, plotW, plotH, x, y, startHour) {
  ctx.strokeStyle = "#d8e2de";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#63716c";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  [0, 25, 50, 75, 100].forEach((percent) => {
    const py = y(percent);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(width - pad.right, py);
    ctx.stroke();
    ctx.fillText(`${percent}%`, pad.left - 9, py);
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const step = state.durationHours <= 24 ? 4 : state.durationHours <= 72 ? 12 : 24;
  for (let hour = 0; hour <= state.durationHours; hour += step) {
    const px = x(hour);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, pad.top + plotH);
    ctx.stroke();
    ctx.fillText(formatClock(startHour + hour), px, pad.top + plotH + 12);
  }
}

function drawHalfLine(pad, plotW, y) {
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "#93aaa3";
  ctx.beginPath();
  ctx.moveTo(pad.left, y(50));
  ctx.lineTo(pad.left + plotW, y(50));
  ctx.stroke();
  ctx.restore();
}

function drawEffectWindows(x, pad, plotW, plotH, startHour) {
  const acuteItems = state.items.filter((item) => item.effectType === "same-day").slice(0, 5);
  acuteItems.forEach((item, index) => {
    const doseAt = doseAbsoluteHour(item, startHour) - startHour;
    const firstDay = item.repeatDaily ? Math.floor((-doseAt - item.effectEnd) / 24) : 0;
    const lastDay = item.repeatDaily
      ? Math.ceil((state.durationHours - doseAt - item.effectStart) / 24)
      : 0;
    let labelled = false;

    for (let day = firstDay; day <= lastDay; day += 1) {
      const start = clamp(doseAt + day * 24 + item.effectStart, 0, state.durationHours);
      const end = clamp(doseAt + day * 24 + item.effectEnd, 0, state.durationHours);
      if (end <= 0 || start >= state.durationHours || end <= start) continue;

      const yPos = pad.top + plotH - 18 - index * 14;
      const xStart = x(start);
      const width = Math.max(8, x(end) - xStart);

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = item.color;
      ctx.fillRect(xStart, yPos, width, 7);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(xStart, yPos, width, 7);

      if (!labelled && width > 56) {
        ctx.fillStyle = item.color;
        ctx.font = "11px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${item.name} 약효`, xStart + width / 2, yPos - 2);
        labelled = true;
      }
      ctx.restore();
    }
  });
}

function drawSeries(data, x, y) {
  data.series.forEach(({ item, points }) => {
    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(point.hour);
      const py = y(point.percent);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineWidth = 3;
    ctx.strokeStyle = item.color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  });
}

function drawPeakMarkers(x, y, startHour) {
  state.items.forEach((item, index) => {
    const doseAt = doseAbsoluteHour(item, startHour) - startHour;
    const lastDay = item.repeatDaily ? Math.ceil((state.durationHours - doseAt - item.peakTime) / 24) : 0;
    let labelled = false;

    for (let day = 0; day <= lastDay; day += 1) {
      const peakAt = doseAt + day * 24 + item.peakTime;
      if (peakAt < 0 || peakAt > state.durationHours) continue;
      const px = x(peakAt);
      const py = y(100);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (!labelled && index < 5) {
        ctx.fillStyle = item.color;
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(item.name, px, Math.max(12, py - 10 - index * 13));
        labelled = true;
      }
    }
  });
}

function drawCurrentMarker(x, pad, plotH, startHour) {
  const currentAt = currentAbsoluteHour(startHour) - startHour;
  if (currentAt < 0 || currentAt > state.durationHours) return;
  const px = x(currentAt);
  ctx.strokeStyle = "#d98c23";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, pad.top);
  ctx.lineTo(px, pad.top + plotH);
  ctx.stroke();
}

function drawHover(data, x, y, pad, plotW, plotH, startHour) {
  if (state.hoverX == null) return;
  const rect = els.chartCanvas.getBoundingClientRect();
  const plotX = clamp(state.hoverX, pad.left, pad.left + plotW);
  const hour = ((plotX - pad.left) / plotW) * state.durationHours;
  const absoluteHour = startHour + hour;

  ctx.strokeStyle = "rgba(23, 33, 29, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotX, pad.top);
  ctx.lineTo(plotX, pad.top + plotH);
  ctx.stroke();

  const rows = data.series
    .map(({ item, normalizer }) => {
      const elapsed = absoluteHour - doseAbsoluteHour(item, startHour);
      const percent = concentrationPercentAt(elapsed, item, normalizer);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(plotX, y(percent), 4, 0, Math.PI * 2);
      ctx.fill();
      return `<span style="color:${item.color}">${escapeHtml(item.name)}</span> ${Math.round(percent)}%`;
    })
    .join("<br />");

  els.hoverReadout.hidden = false;
  els.hoverReadout.innerHTML = `<strong>${formatClock(absoluteHour)}</strong><br />${rows}`;
  const left = plotX > rect.width - 210 ? plotX - 200 : plotX + 12;
  els.hoverReadout.style.left = `${left}px`;
  els.hoverReadout.style.top = `${Math.max(12, y(84) - 12)}px`;
}

function concentrationPercentAt(hour, item, normalizer = 1) {
  return clamp((concentrationRawAt(hour, item) / Math.max(0.0001, normalizer)) * 100, 0, 100);
}

function concentrationRawAt(hour, item) {
  if (!item.repeatDaily) {
    return singleDoseContributionAt(hour, item);
  }
  const lookbackDays = repeatLookbackDays(item);
  const forwardDays = Math.ceil((state.durationHours + 48) / 24);
  let total = 0;
  for (let day = -lookbackDays; day <= forwardDays; day += 1) {
    total += singleDoseContributionAt(hour - day * 24, item);
  }
  return total;
}

function singleDoseContributionAt(hour, item) {
  if (hour < 0) return 0;
  const ka = solveAbsorptionRate(item.halfLife, item.peakTime);
  const value = doseContribution(hour, item.halfLife, ka, item.peakTime);
  return Math.max(0, value);
}

function repeatLookbackDays(item) {
  const pharmacokineticWindow = Math.max(item.steadyState || 0, item.halfLife * 5, 24);
  return clamp(Math.ceil(pharmacokineticWindow / 24), 1, 60);
}

function doseContribution(age, halfLife, ka, peakTime) {
  if (age < 0) return 0;
  const ke = Math.LN2 / halfLife;
  if (Math.abs(ka - ke) < 0.00001) {
    const normalized = age * Math.exp(-ke * age);
    const peak = peakTime * Math.exp(-ke * peakTime);
    return peak > 0 ? normalized / peak : 0;
  }
  const raw = (ka / (ka - ke)) * (Math.exp(-ke * age) - Math.exp(-ka * age));
  const peakRaw =
    (ka / (ka - ke)) * (Math.exp(-ke * peakTime) - Math.exp(-ka * peakTime));
  return Math.max(0, peakRaw ? raw / peakRaw : 0);
}

function solveAbsorptionRate(halfLife, peakTime) {
  const ke = Math.LN2 / halfLife;
  const meanTime = 1 / ke;
  const target = Math.max(0.05, peakTime);
  let lo;
  let hi;

  if (target < meanTime) {
    lo = ke * 1.0001;
    hi = 100;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      if (tmaxForRates(mid, ke) > target) lo = mid;
      else hi = mid;
    }
  } else {
    lo = 0.0001;
    hi = ke * 0.9999;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      if (tmaxForRates(mid, ke) > target) lo = mid;
      else hi = mid;
    }
  }

  return (lo + hi) / 2;
}

function tmaxForRates(ka, ke) {
  if (Math.abs(ka - ke) < 0.00001) return 1 / ke;
  return Math.log(ka / ke) / (ka - ke);
}

function elapsedHourFor(item) {
  const startHour = referenceStartHour();
  return currentAbsoluteHour(startHour) - doseAbsoluteHour(item, startHour);
}

function referenceStartHour() {
  if (state.items.length === 0) return 0;
  return Math.min(...state.items.map((item) => timeToHours(item.time || "00:00")));
}

function doseAbsoluteHour(item, startHour) {
  const dose = timeToHours(item.time || "00:00");
  return dose < startHour ? dose + 24 : dose;
}

function currentAbsoluteHour(startHour) {
  const current = timeToHours(state.currentTime || "00:00");
  return current < startHour ? current + 24 : current;
}

function timeToHours(value) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) + Number(minutes) / 60;
}

function formatClock(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.round((normalized - h) * 60);
  const day = Math.floor(hour / 24);
  const prefix = day > 0 ? `+${day}일 ` : "";
  return `${prefix}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatElapsed(hours) {
  const safe = Math.max(0, hours);
  const day = Math.floor(safe / 24);
  const remainder = safe - day * 24;
  const h = Math.floor(remainder);
  const m = Math.round((remainder - h) * 60);
  const parts = [];
  if (day) parts.push(`${day}일`);
  if (h) parts.push(`${h}시간`);
  if (m && day === 0) parts.push(`${m}분`);
  return parts.length ? parts.join(" ") : "0분";
}

function formatDurationLabel(hours) {
  if (hours >= 24 && Number.isInteger(hours / 24)) return `${hours / 24}일`;
  return `${Number(hours).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}시간`;
}

function formatDoseElapsed(hours) {
  return hours < 0 ? "복용 전" : `복용 후 ${formatElapsed(hours)}`;
}

function formatEffectBadge(item) {
  if (item.effectType === "steady-state") {
    return `🧬 정상상태 ${formatElapsed(item.steadyState)}`;
  }
  return `🧭 약효 ${formatElapsed(item.effectStart)}-${formatElapsed(item.effectEnd)}`;
}

function effectStatusFor(item, elapsed) {
  if (item.effectType === "steady-state") {
    return `누적형: 정상상태 약 ${formatElapsed(item.steadyState)}`;
  }
  if (elapsed < item.effectStart) return `효과 시작 전: 약 ${formatElapsed(item.effectStart - elapsed)} 남음`;
  if (elapsed <= item.effectEnd) return `문헌 기반 약효 구간: ${formatElapsed(item.effectEnd - elapsed)} 남음`;
  return `약효 구간 이후: ${formatElapsed(elapsed - item.effectEnd)} 경과`;
}

function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  if (number >= 10 || Number.isInteger(number)) return number.toFixed(0);
  return number.toFixed(1);
}

function formatRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  if (number >= 10) return number.toFixed(0);
  return number.toFixed(1);
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;
  const preset = defaultItems.find((candidate) => candidate.id === item.id) || {};
  const effectType = item.effectType === "steady-state" ? "steady-state" : "same-day";
  return {
    id: String(item.id || crypto.randomUUID()),
    name: String(item.name || "항목"),
    type: item.type === "카페인" ? "카페인" : "약물",
    dose: clamp(Number(item.dose), 0, 1000),
    unit: "mg",
    time: /^\d{2}:\d{2}$/.test(item.time) ? item.time : "08:00",
    repeatDaily: typeof item.repeatDaily === "boolean" ? item.repeatDaily : Boolean(preset.repeatDaily),
    halfLife: clamp(Number(item.halfLife), 0.05, 240),
    peakTime: clamp(Number(item.peakTime), 0.05, 72),
    effectType,
    effectStart: clamp(Number(item.effectStart ?? preset.effectStart ?? 1), 0, 240),
    effectEnd: clamp(Number(item.effectEnd ?? preset.effectEnd ?? 8), 0, 720),
    steadyState: clamp(Number(item.steadyState ?? preset.steadyState ?? 0), 0, 1000),
    confidence: String(item.confidence || preset.confidence || "직접입력"),
    evidenceLabel: String(item.evidenceLabel || preset.evidenceLabel || "사용자 입력"),
    evidenceUrl: String(item.evidenceUrl || preset.evidenceUrl || ""),
    evidenceSummary: String(item.evidenceSummary || preset.evidenceSummary || "사용자가 직접 입력한 값입니다."),
    color: /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : "#1f8f83",
    note: String(item.note || ""),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

window.addEventListener("resize", () => renderChartOnly());
init();
