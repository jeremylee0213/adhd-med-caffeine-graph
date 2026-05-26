const storageKey = "med-caffeine-graph-v2";

const defaultItems = [
  {
    id: "concerta",
    name: "콘서타",
    type: "약물",
    dose: 18,
    unit: "mg",
    time: "06:30",
    halfLife: 3.5,
    peakTime: 6.8,
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
    halfLife: 75,
    peakTime: 4,
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
    halfLife: 30,
    peakTime: 5,
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
    halfLife: 5,
    peakTime: 0.75,
    color: "#8b5e34",
    note: "커피 1잔 수준 예시",
  },
];

const palette = ["#1f8f83", "#6f63d8", "#d98c23", "#8b5e34", "#2d7dd2", "#b23864"];

const state = {
  durationHours: 12,
  currentTime: "",
  hoverX: null,
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
  state.items.push({
    id: crypto.randomUUID(),
    name: isCaffeine ? "카페인" : "새 약물",
    type,
    dose: isCaffeine ? 100 : 10,
    unit: "mg",
    time: state.currentTime || "08:00",
    halfLife: isCaffeine ? 5 : 4,
    peakTime: isCaffeine ? 0.75 : 2,
    color: palette[nextIndex % palette.length],
    note: isCaffeine ? "카페인 직접 입력" : "직접 입력",
  });
  saveState();
  render();
}

function updateItem(id, key, value) {
  const item = state.items.find((target) => target.id === id);
  if (!item) return;

  if (["dose", "halfLife", "peakTime"].includes(key)) {
    item[key] = clamp(Number(value), key === "dose" ? 0 : 0.05, key === "halfLife" ? 240 : 1000);
  } else {
    item[key] = value;
  }
  saveState();
  render();
}

function removeItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  saveState();
  render();
}

function render() {
  const activeCount = state.items.length;
  els.chartTitle.textContent = "약물·카페인 상대 농도";
  els.modelNote.textContent = "각 항목의 자기 최고치 대비 %, 실제 효과 지속시간 아님";
  els.peakBadge.textContent = `${activeCount}개 항목 계산`;
  els.halfBadge.textContent = `${formatDurationLabel(state.durationHours)} 보기`;
  els.durationHours.value = state.durationHours;
  syncDurationButtons();
  renderEditor();
  renderLegend();
  renderChartOnly();
  renderSummary();
}

function renderEditor() {
  els.itemEditor.replaceChildren();

  state.items.forEach((item) => {
    const card = document.createElement("section");
    card.className = "edit-card";
    card.style.setProperty("--med-color", item.color);
    card.innerHTML = `
      <div class="edit-card-head">
        <label class="compact-field name-field">
          <span>이름</span>
          <input data-key="name" value="${escapeHtml(item.name)}" />
        </label>
        <button class="delete-button" type="button" title="삭제" aria-label="${escapeHtml(item.name)} 삭제">×</button>
      </div>
      <div class="edit-grid">
        <label class="compact-field">
          <span>구분</span>
          <select data-key="type">
            <option value="약물" ${item.type === "약물" ? "selected" : ""}>약물</option>
            <option value="카페인" ${item.type === "카페인" ? "selected" : ""}>카페인</option>
          </select>
        </label>
        <label class="compact-field">
          <span>용량 mg</span>
          <input data-key="dose" type="number" min="0" step="0.5" value="${item.dose}" />
        </label>
        <label class="compact-field">
          <span>복용 시각</span>
          <input data-key="time" type="time" value="${item.time}" />
        </label>
        <label class="compact-field">
          <span>피크 h</span>
          <input data-key="peakTime" type="number" min="0.05" step="0.05" value="${item.peakTime}" />
        </label>
        <label class="compact-field">
          <span>반감기 h</span>
          <input data-key="halfLife" type="number" min="0.05" step="0.1" value="${item.halfLife}" />
        </label>
        <label class="compact-field">
          <span>색상</span>
          <input data-key="color" type="color" value="${item.color}" />
        </label>
      </div>
      <label class="compact-field">
        <span>메모</span>
        <input data-key="note" value="${escapeHtml(item.note)}" />
      </label>
    `;

    card.querySelectorAll("[data-key]").forEach((input) => {
      input.addEventListener("change", () => updateItem(item.id, input.dataset.key, input.value));
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
    empty.className = "metric";
    empty.innerHTML = "<span>요약</span><strong>-</strong><small>계산할 항목이 없습니다.</small>";
    els.summaryList.append(empty);
    return;
  }

  state.items.forEach((item, index) => {
    const elapsed = elapsedHourFor(item);
    const percent = concentrationPercentAt(elapsed, item);
    const estimatedMg = (item.dose * percent) / 100;
    const belowHalfAt = item.peakTime + item.halfLife;
    const card = document.createElement("div");
    card.className = `metric ${index === 0 ? "primary" : ""}`;
    card.innerHTML = `
      <span>${escapeHtml(item.name)} ${formatAmount(item.dose)}mg</span>
      <strong style="color:${item.color}">${Math.round(percent)}%</strong>
      <small>${formatAmount(estimatedMg)}mg 환산 · ${formatDoseElapsed(elapsed)} · 50% 아래 ${formatElapsed(belowHalfAt)} 전후</small>
    `;
    els.summaryList.append(card);
  });

  const reference = document.createElement("div");
  reference.className = "metric";
  reference.innerHTML = `
    <span>현재 시각</span>
    <strong>${state.currentTime || "--:--"}</strong>
    <small>mg 환산은 실제 혈중농도 단위가 아니라 복용량 대비 단순 추정입니다.</small>
  `;
  els.summaryList.append(reference);

  void data;
}

function buildChartData() {
  const step = state.durationHours <= 24 ? 0.05 : state.durationHours <= 72 ? 0.15 : 0.35;
  const startHour = referenceStartHour();
  const series = state.items.map((item) => {
    const points = [];
    for (let hour = 0; hour <= state.durationHours + 0.0001; hour += step) {
      const absoluteHour = startHour + hour;
      const elapsed = absoluteHour - doseAbsoluteHour(item, startHour);
      points.push({ hour, percent: concentrationPercentAt(elapsed, item) });
    }
    return { item, points };
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
  drawSeries(data, x, y);
  drawPeakMarkers(x, y, data.startHour);
  drawCurrentMarker(x, pad, plotH, data.startHour);
  drawHover(x, y, pad, plotW, plotH, data.startHour);
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
    const peakAt = doseAbsoluteHour(item, startHour) - startHour + item.peakTime;
    if (peakAt < 0 || peakAt > state.durationHours) return;
    const px = x(peakAt);
    const py = y(100);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (index < 5) {
      ctx.fillStyle = item.color;
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(item.name, px, Math.max(12, py - 10 - index * 13));
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

function drawHover(x, y, pad, plotW, plotH, startHour) {
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

  const rows = state.items
    .map((item) => {
      const elapsed = absoluteHour - doseAbsoluteHour(item, startHour);
      const percent = concentrationPercentAt(elapsed, item);
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

function concentrationPercentAt(hour, item) {
  if (hour < 0) return 0;
  const ka = solveAbsorptionRate(item.halfLife, item.peakTime);
  const value = doseContribution(hour, item.halfLife, ka, item.peakTime);
  return clamp(value * 100, 0, 100);
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

function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  if (number >= 10 || Number.isInteger(number)) return number.toFixed(0);
  return number.toFixed(1);
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;
  return {
    id: String(item.id || crypto.randomUUID()),
    name: String(item.name || "항목"),
    type: item.type === "카페인" ? "카페인" : "약물",
    dose: clamp(Number(item.dose), 0, 1000),
    unit: "mg",
    time: /^\d{2}:\d{2}$/.test(item.time) ? item.time : "08:00",
    halfLife: clamp(Number(item.halfLife), 0.05, 240),
    peakTime: clamp(Number(item.peakTime), 0.05, 72),
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
