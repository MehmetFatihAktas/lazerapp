const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");

const refs = {
  status: document.getElementById("jobStatus"),
  laserModeHint: document.getElementById("laserModeHint"),
  unitChip: document.getElementById("unitChip"),
  bedChip: document.getElementById("bedChip"),
  layoutChip: document.getElementById("layoutChip"),
  warningChip: document.getElementById("warningChip"),
  preflightBtn: document.getElementById("preflightBtn"),
  generateBtn: document.getElementById("generateBtn"),
  jobSummary: document.getElementById("jobSummaryGrid"),
  layoutStatus: document.getElementById("layoutStatusBox"),
  layoutBanner: document.getElementById("layoutBanner"),
  warningsList: document.getElementById("warningsList"),
  partsList: document.getElementById("partsList"),
  patternsList: document.getElementById("patternsList"),
  selectionPanel: document.getElementById("selectionPanel"),
  preflightPanel: document.getElementById("preflightPanel"),
  summary: document.getElementById("summaryBox"),
  readout: document.getElementById("canvasReadout"),
  safetyReadout: document.getElementById("canvasSafetyReadout"),
  bottomStatus: document.getElementById("bottomStatus"),
  smallBedWarning: document.getElementById("smallBedWarning"),
  activeAreaText: document.getElementById("activeAreaText"),
  materialAreaText: document.getElementById("materialAreaText"),
  outputPath: document.getElementById("outputPath"),
  textInput: document.getElementById("textInput"),
  textFont: document.getElementById("textFont"),
  textFontUpload: document.getElementById("textFontUpload"),
  textFontHint: document.getElementById("textFontHint"),
  textHeight: document.getElementById("textHeight"),
  textTracking: document.getElementById("textTracking"),
  textWeight: document.getElementById("textWeight"),
  textStyle: document.getElementById("textStyle"),
  textOperation: document.getElementById("textOperation"),
  shapeWidth: document.getElementById("shapeWidth"),
  shapeHeight: document.getElementById("shapeHeight"),
  shapeRadius: document.getElementById("shapeRadius"),
  shapeSides: document.getElementById("shapeSides"),
  bedW: document.getElementById("bedW"),
  bedH: document.getElementById("bedH"),
  quantity: document.getElementById("quantity"),
  gap: document.getElementById("gap"),
  margin: document.getElementById("margin"),
  bedAlignMode: document.getElementById("bedAlignMode"),
  jobOffsetX: document.getElementById("jobOffsetX"),
  jobOffsetY: document.getElementById("jobOffsetY"),
  allowRotate: document.getElementById("allowRotate"),
  cutFeed: document.getElementById("cutFeed"),
  cutPower: document.getElementById("cutPower"),
  passes: document.getElementById("passes"),
  overcut: document.getElementById("overcut"),
  kerf: document.getElementById("kerf"),
  travelFeed: document.getElementById("travelFeed"),
  pierceDelay: document.getElementById("pierceDelay"),
  airAssist: document.getElementById("airAssist"),
  airAssistCommand: document.getElementById("airAssistCommand"),
  innerFirst: document.getElementById("innerFirst"),
  returnOrigin: document.getElementById("returnOrigin"),
  engravePower: document.getElementById("engravePower"),
  engraveFeed: document.getElementById("engraveFeed"),
  lineStep: document.getElementById("lineStep"),
  threshold: document.getElementById("threshold"),
  nudgeStep: document.getElementById("nudgeStep"),
  vecThreshold: document.getElementById("vecThreshold"),
  vecMode: document.getElementById("vecMode"),
  vecThresholdMode: document.getElementById("vecThresholdMode"),
  vecBlur: document.getElementById("vecBlur"),
  vecContrast: document.getElementById("vecContrast"),
  vecMorphClose: document.getElementById("vecMorphClose"),
  vecMorphOpen: document.getElementById("vecMorphOpen"),
  vecDenoise: document.getElementById("vecDenoise"),
  vecMinArea: document.getElementById("vecMinArea"),
  vecMinLength: document.getElementById("vecMinLength"),
  vecSimplify: document.getElementById("vecSimplify"),
  vecSmooth: document.getElementById("vecSmooth"),
  vecMaxContours: document.getElementById("vecMaxContours"),
  vecStitchGap: document.getElementById("vecStitchGap"),
  vecMaxDimension: document.getElementById("vecMaxDimension"),
  vecAdaptiveBlock: document.getElementById("vecAdaptiveBlock"),
  vecAdaptiveC: document.getElementById("vecAdaptiveC"),
  vecInvert: document.getElementById("vecInvert"),
  vecRemoveBorder: document.getElementById("vecRemoveBorder"),
  vecBackgroundNormalize: document.getElementById("vecBackgroundNormalize"),
  machinePort: document.getElementById("machinePort"),
  machineBaud: document.getElementById("machineBaud"),
  machineStatusBox: document.getElementById("machineStatusBox"),
  machineJogStep: document.getElementById("machineJogStep"),
  machineJogFeed: document.getElementById("machineJogFeed"),
  machineFrameFeed: document.getElementById("machineFrameFeed"),
  machineFramePadding: document.getElementById("machineFramePadding"),
  machinePulsePower: document.getElementById("machinePulsePower"),
  machinePulseDuration: document.getElementById("machinePulseDuration"),
  machineCommand: document.getElementById("machineCommand"),
  machineLog: document.getElementById("machineLog"),
  sendGcodeToMachineBtn: document.getElementById("sendGcodeToMachineBtn"),
  drawAreaToolBtn: document.getElementById("drawAreaToolBtn"),
  finishAreaBtn: document.getElementById("finishAreaBtn"),
  clearAreaBtn: document.getElementById("clearAreaBtn"),
};

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function colorWithAlpha(color, alpha) {
  const value = String(color || "").trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((part) => part + part).join("") : hex[1];
    const number = parseInt(raw, 16);
    return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(",").map((part) => part.trim()).slice(0, 3);
    return `rgba(${parts.join(", ")}, ${alpha})`;
  }
  return value || `rgba(0, 0, 0, ${alpha})`;
}

function cssAlpha(name, alpha, fallback) {
  return colorWithAlpha(cssColor(name, fallback), alpha);
}

function canvasPalette() {
  return {
    canvas: cssColor("--canvas", "#E9EDF3"),
    bed: cssColor("--bed", "#FBFCFE"),
    bedBorder: cssColor("--bed-border", "#4B5565"),
    gridSmall: cssColor("--grid-small", "#E1E6EE"),
    gridLarge: cssColor("--grid-large", "#C5CDD9"),
    marginLine: cssColor("--margin-line", "#7C8BA1"),
    ruler: cssColor("--ruler-text", "#667085"),
    origin: cssColor("--origin", "#111827"),
    selection: cssColor("--selection", "#2563EB"),
    cut: cssColor("--cut", "#E11D48"),
    cutSoft: cssAlpha("--cut", 0.28, "#E11D48"),
    engraveLine: cssColor("--engrave-line", "#2563EB"),
    engraveFill: cssColor("--engrave-fill", "#1F2937"),
    engraveHatch: cssColor("--engrave-hatch", "#6B7280"),
    ignored: cssColor("--ignored", "#98A2B3"),
    outside: cssColor("--outside-object", "#F97316"),
    outsideSoft: cssAlpha("--outside-object", 0.12, "#F97316"),
    materialArea: cssColor("--material-area", "#0E9384"),
    materialAreaFill: cssAlpha("--material-area", 0.14, "#0E9384"),
    materialAreaOutside: cssAlpha("--material-area", 0.08, "#0E9384"),
    warningBg: cssAlpha("--warning", 0.10, "#D97706"),
    text: cssColor("--text", "#172033"),
    panel: cssColor("--panel", "#FFFFFF"),
  };
}

const state = {
  parts: [],
  placements: [],
  patterns: [],
  images: new Map(),
  customFonts: [],
  selected: null,
  selectedItems: [],
  clipboard: [],
  clipboardPasteCount: 0,
  drag: null,
  view: { scale: 1, offsetX: 0, offsetY: 0, width: 1, height: 1, zoom: 1, panX: 0, panY: 0 },
  cursor: null,
  laserCmd: "M4",
  spaceDown: false,
  layout: {
    appliedSettings: null,
    dirty: false,
    manual: false,
    acceptedSmallBed: "",
  },
  materialArea: {
    points: [],
    drawing: false,
    previewPoint: null,
  },
  currentAnalysis: null,
  machine: {
    available: false,
    connected: false,
    port: "",
    baud: 115200,
    lastStatus: {},
    job: {},
    log: [],
    ports: [],
    preferredPort: "",
    pollTimer: null,
    preview: null,
    previewPath: "",
  },
  clientId: "",
  clientPingTimer: null,
};

const SETTINGS_KEY = "laser-editor-settings-v3";
const VECTOR_SETTINGS_VERSION = 7;
const CLIENT_SESSION_KEY = "laser-editor-client-id-v1";
let jobAnalysisTimer = null;

const TEXT_FONT_PRESETS = [
  { id: "laser-single", label: "Laser tek çizgi", kind: "single", family: "" },
  { id: "arial", label: "Arial", kind: "outline", family: "Arial, Helvetica, sans-serif" },
  { id: "arial-black", label: "Arial Black", kind: "outline", family: "'Arial Black', Gadget, sans-serif" },
  { id: "segoe-ui", label: "Segoe UI", kind: "outline", family: "'Segoe UI', Arial, sans-serif" },
  { id: "calibri", label: "Calibri", kind: "outline", family: "Calibri, 'Segoe UI', sans-serif" },
  { id: "tahoma", label: "Tahoma", kind: "outline", family: "Tahoma, Geneva, sans-serif" },
  { id: "verdana", label: "Verdana", kind: "outline", family: "Verdana, Geneva, sans-serif" },
  { id: "trebuchet", label: "Trebuchet MS", kind: "outline", family: "'Trebuchet MS', sans-serif" },
  { id: "century-gothic", label: "Century Gothic", kind: "outline", family: "'Century Gothic', Arial, sans-serif" },
  { id: "times", label: "Times New Roman", kind: "outline", family: "'Times New Roman', Times, serif" },
  { id: "georgia", label: "Georgia", kind: "outline", family: "Georgia, serif" },
  { id: "garamond", label: "Garamond", kind: "outline", family: "Garamond, Georgia, serif" },
  { id: "cambria", label: "Cambria", kind: "outline", family: "Cambria, Georgia, serif" },
  { id: "consolas", label: "Consolas", kind: "outline", family: "Consolas, monospace" },
  { id: "courier", label: "Courier New", kind: "outline", family: "'Courier New', Courier, monospace" },
  { id: "impact", label: "Impact", kind: "outline", family: "Impact, Haettenschweiler, sans-serif" },
  { id: "comic", label: "Comic Sans MS", kind: "outline", family: "'Comic Sans MS', cursive" },
  { id: "brush", label: "Brush Script MT", kind: "outline", family: "'Brush Script MT', cursive" },
  { id: "lucida", label: "Lucida Handwriting", kind: "outline", family: "'Lucida Handwriting', cursive" },
];

function updateJobAnalysisNow(extra = "") {
  if (jobAnalysisTimer) {
    window.clearTimeout(jobAnalysisTimer);
    jobAnalysisTimer = null;
  }
  updateUiFromAnalysis(computeJobAnalysis(), extra);
}

function scheduleJobAnalysis(delay = 150) {
  window.clearTimeout(jobAnalysisTimer);
  jobAnalysisTimer = window.setTimeout(() => {
    jobAnalysisTimer = null;
    updateUiFromAnalysis(computeJobAnalysis());
  }, delay);
}

const vectorSafeDefaults = {
  vecMode: "auto",
  vecThresholdMode: "otsu",
  vecBlur: "1",
  vecContrast: "1",
  vecMorphClose: "1",
  vecMorphOpen: "0",
  vecDenoise: "5",
  vecMinArea: "25",
  vecMinLength: "8",
  vecSimplify: "0.55",
  vecSmooth: "3",
  vecMaxContours: "3000",
  vecStitchGap: "0",
  vecMaxDimension: "2200",
  vecAdaptiveBlock: "35",
  vecAdaptiveC: "5",
  vecInvert: true,
  vecRemoveBorder: true,
  vecBackgroundNormalize: true,
};
const persistedInputIds = [
  "bedW",
  "bedH",
  "quantity",
  "gap",
  "margin",
  "bedAlignMode",
  "allowRotate",
  "cutFeed",
  "cutPower",
  "passes",
  "overcut",
  "kerf",
  "travelFeed",
  "pierceDelay",
  "airAssist",
  "airAssistCommand",
  "innerFirst",
  "returnOrigin",
  "engravePower",
  "engraveFeed",
  "lineStep",
  "threshold",
  "textFont",
  "textWeight",
  "textStyle",
  "textOperation",
  "nudgeStep",
  "vecMode",
  "vecThresholdMode",
  "vecThreshold",
  "vecBlur",
  "vecContrast",
  "vecMorphClose",
  "vecMorphOpen",
  "vecDenoise",
  "vecMinArea",
  "vecMinLength",
  "vecSimplify",
  "vecSmooth",
  "vecMaxContours",
  "vecStitchGap",
  "vecMaxDimension",
  "vecAdaptiveBlock",
  "vecAdaptiveC",
  "vecInvert",
  "vecRemoveBorder",
  "vecBackgroundNormalize",
  "machineBaud",
  "machineJogStep",
  "machineJogFeed",
  "machineFrameFeed",
  "machineFramePadding",
  "machinePulsePower",
  "machinePulseDuration",
];

const UNDO_LIMIT = 50;
const undoInputIds = Array.from(new Set([...persistedInputIds.filter((id) => !id.startsWith("machine")), "outputPath"]));
const undoStack = [];
const redoStack = [];
let undoRestoring = false;

function undoInputSnapshot() {
  const values = {};
  for (const id of undoInputIds) {
    const input = refs[id];
    if (!input) continue;
    values[id] = input.type === "checkbox" ? Boolean(input.checked) : input.value;
  }
  return values;
}

function applyUndoInputSnapshot(values = {}) {
  for (const [id, value] of Object.entries(values)) {
    const input = refs[id];
    if (!input) continue;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = value;
  }
}

function captureImageSources() {
  const sources = {};
  for (const [id, image] of state.images.entries()) {
    if (image?.src) sources[id] = image.src;
  }
  return sources;
}

function restoreImageSources(sources = {}) {
  state.images = new Map();
  for (const [id, src] of Object.entries(sources)) {
    if (!src) continue;
    const image = new Image();
    image.src = src;
    image.addEventListener("load", draw, { once: true });
    state.images.set(id, image);
  }
}

function createUndoSnapshot(label = "islem") {
  return {
    label,
    parts: clonePlain(state.parts),
    placements: clonePlain(state.placements),
    patterns: clonePlain(state.patterns),
    customFonts: clonePlain(state.customFonts),
    selected: state.selected ? clonePlain(state.selected) : null,
    selectedItems: clonePlain(state.selectedItems || []),
    clipboardPasteCount: state.clipboardPasteCount,
    laserCmd: state.laserCmd,
    layout: clonePlain(state.layout),
    materialArea: clonePlain(state.materialArea),
    inputs: undoInputSnapshot(),
    imageSources: captureImageSources(),
  };
}

function pushUndo(label = "islem") {
  if (undoRestoring) return;
  undoStack.push(createUndoSnapshot(label));
  redoStack.length = 0;
  while (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function restoreUndoSnapshot(snapshot) {
  undoRestoring = true;
  try {
    state.parts = clonePlain(snapshot.parts || []);
    state.placements = clonePlain(snapshot.placements || []);
    state.patterns = clonePlain(snapshot.patterns || []);
    state.customFonts = clonePlain(snapshot.customFonts || []).map((font) => ({ ...font, installed: false }));
    state.selected = snapshot.selected ? clonePlain(snapshot.selected) : null;
    state.selectedItems = clonePlain(snapshot.selectedItems || []);
    state.clipboardPasteCount = Number(snapshot.clipboardPasteCount) || 0;
    state.laserCmd = snapshot.laserCmd || state.laserCmd;
    state.layout = clonePlain(snapshot.layout || state.layout);
    state.materialArea = normalizeMaterialArea(snapshot.materialArea || state.materialArea);
    state.drag = null;
    state.currentAnalysis = null;
    applyUndoInputSnapshot(snapshot.inputs || {});
    restoreImageSources(snapshot.imageSources || {});
    installCustomFonts().then(() => renderTextFontOptions(refs.textFont?.value)).catch(() => renderTextFontOptions(refs.textFont?.value));
    syncLaserButtons();
    saveUiSettings();
    clearMachinePreview();
    updateUiFromAnalysis(computeJobAnalysis());
    updateSelectionPanel();
    draw();
    renderMachinePanel();
  } finally {
    undoRestoring = false;
  }
}

function undoLast() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    setStatus("Geri alınacak işlem yok.", "warn");
    return;
  }
  redoStack.push(createUndoSnapshot(snapshot.label || "işlem"));
  while (redoStack.length > UNDO_LIMIT) redoStack.shift();
  restoreUndoSnapshot(snapshot);
  setStatus(`Geri alındı: ${snapshot.label || "işlem"}.`, "ok");
}

function redoLast() {
  const snapshot = redoStack.pop();
  if (!snapshot) {
    setStatus("Yinelenecek işlem yok.", "warn");
    return;
  }
  undoStack.push(createUndoSnapshot(snapshot.label || "işlem"));
  while (undoStack.length > UNDO_LIMIT) undoStack.shift();
  restoreUndoSnapshot(snapshot);
  setStatus(`Yinelendi: ${snapshot.label || "işlem"}.`, "ok");
}

function bindUndoBeforeEdit(input, label) {
  if (!input) return;
  let captured = false;
  const capture = () => {
    if (captured || undoRestoring) return;
    pushUndo(label);
    captured = true;
  };
  input.addEventListener("focus", capture);
  input.addEventListener("pointerdown", capture);
  input.addEventListener("keydown", (event) => {
    if (["Tab", "Shift", "Control", "Alt", "Meta", "Escape"].includes(event.key)) return;
    capture();
  });
  input.addEventListener("blur", () => {
    captured = false;
  });
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function mm(id, fallback = 0) {
  const raw = refs[id]?.value;
  if (raw === "" || raw === undefined || raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function customFontValue(font) {
  return `custom:${font.id}`;
}

function selectedTextFontDefinition() {
  const value = refs.textFont?.value || "laser-single";
  if (value.startsWith("custom:")) {
    const id = value.slice("custom:".length);
    const font = state.customFonts.find((item) => item.id === id);
    if (font) return { ...font, kind: "outline", custom: true, value };
  }
  return TEXT_FONT_PRESETS.find((item) => item.id === value) || TEXT_FONT_PRESETS[0];
}

function renderTextFontOptions(selectedValue = "") {
  const select = refs.textFont;
  if (!select) return;
  const selected = selectedValue || select.value || "laser-single";
  select.innerHTML = "";
  const appendGroup = (label, fonts) => {
    if (!fonts.length) return;
    const group = document.createElement("optgroup");
    group.label = label;
    fonts.forEach((font) => {
      const option = document.createElement("option");
      option.value = font.custom ? customFontValue(font) : font.id;
      option.textContent = font.name || font.label;
      group.appendChild(option);
    });
    select.appendChild(group);
  };
  appendGroup("Lazer fontu", TEXT_FONT_PRESETS.filter((font) => font.kind === "single"));
  appendGroup("Sistem fontları", TEXT_FONT_PRESETS.filter((font) => font.kind !== "single"));
  appendGroup("Yüklenen fontlar", state.customFonts.map((font) => ({ ...font, custom: true })));
  const values = Array.from(select.options).map((option) => option.value);
  select.value = values.includes(selected) ? selected : "laser-single";
  updateTextFontHint();
}

function updateTextFontHint() {
  const hint = refs.textFontHint;
  if (!hint) return;
  const font = selectedTextFontDefinition();
  const op = refs.textOperation?.value || "engrave_line";
  if (font.kind === "single") {
    hint.textContent = "Laser tek çizgi font hızlı kazıma içindir; kesim/dolgu için kontur font seç.";
  } else if (op === "cut") {
    hint.textContent = `"${font.name || font.label}" kontur olarak kesime çevrilecek. İnce yazılarda küçük iç adalar düşmeyebilir.`;
  } else if (op === "engrave_fill") {
    hint.textContent = `"${font.name || font.label}" dolu alan yakma vektörü olarak üretilecek.`;
  } else {
    hint.textContent = `"${font.name || font.label}" dış kontur çizgisi olarak yakılacak.`;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Font okunamadi.")));
    reader.readAsDataURL(file);
  });
}

async function installCustomFonts() {
  if (!("FontFace" in window)) return;
  for (const font of state.customFonts) {
    if (!font?.dataUrl || font.installed) continue;
    const face = new FontFace(font.family, `url(${font.dataUrl})`);
    await face.load();
    document.fonts.add(face);
    font.installed = true;
  }
}

async function handleTextFontUpload(event) {
  const files = Array.from(event.target?.files || []);
  if (!files.length) return;
  pushUndo("Font yukle");
  let loaded = 0;
  let selected = "";
  try {
    for (const file of files) {
      if (!/\.(ttf|otf|woff2?)$/i.test(file.name) && !String(file.type || "").startsWith("font/")) continue;
      const dataUrl = await readFileAsDataUrl(file);
      const id = uid("font");
      const cleanName = file.name.replace(/\.(ttf|otf|woff2?)$/i, "");
      const font = {
        id,
        name: cleanName || "Yüklenen font",
        family: `LaserUserFont_${id.replace(/[^a-z0-9_]/gi, "_")}`,
        dataUrl,
        installed: false,
      };
      state.customFonts.push(font);
      selected = customFontValue(font);
      loaded += 1;
    }
    await installCustomFonts();
    renderTextFontOptions(selected || refs.textFont?.value);
    saveUiSettings();
    setStatus(loaded ? `${loaded} font yüklendi ve metin listesine eklendi.` : "Desteklenen font dosyası bulunamadı.", loaded ? "ok" : "warn");
  } catch (error) {
    setStatus(error.message || "Font yüklenemedi.", "danger");
  } finally {
    if (event.target) event.target.value = "";
  }
}

function setStatus(text, level = "info") {
  if (!refs.status) return;
  const normalized =
    level === "danger" || level === "error" || level === "critical"
      ? "danger"
      : level === "warn" || level === "warning"
        ? "warn"
        : level === "ok" || level === "success"
          ? "ok"
          : "info";
  refs.status.textContent = text;
  refs.status.className = `job-status ${normalized}`;
}

function loadUiSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    for (const id of persistedInputIds) {
      const input = refs[id];
      if (!input || saved[id] === undefined) continue;
      if (input.type === "checkbox") input.checked = Boolean(saved[id]);
      else input.value = saved[id];
    }
    if (saved.vectorSettingsVersion !== VECTOR_SETTINGS_VERSION) {
      for (const [id, value] of Object.entries(vectorSafeDefaults)) {
        const input = refs[id];
        if (!input) continue;
        if (input.type === "checkbox") input.checked = Boolean(value);
        else input.value = value;
      }
    }
    if (saved.laserCmd) state.laserCmd = saved.laserCmd;
  } catch (_error) {
    localStorage.removeItem(SETTINGS_KEY);
  }
  enforceAirAssistDefaults();
}

function saveUiSettings() {
  enforceAirAssistDefaults();
  const payload = { laserCmd: state.laserCmd, vectorSettingsVersion: VECTOR_SETTINGS_VERSION };
  for (const id of persistedInputIds) {
    const input = refs[id];
    if (!input) continue;
    payload[id] = input.type === "checkbox" ? input.checked : input.value;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

function enforceAirAssistDefaults() {
  if (refs.airAssist) {
    refs.airAssist.checked = true;
    refs.airAssist.disabled = true;
  }
  if (refs.airAssistCommand) {
    refs.airAssistCommand.value = "M8";
    refs.airAssistCommand.disabled = true;
  }
}

function syncLaserButtons() {
  document.querySelectorAll("#laserCmd button").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === state.laserCmd);
  });
  if (refs.laserModeHint) {
    const m3 = state.laserCmd === "M3";
    refs.laserModeHint.textContent = m3
      ? "M3 sabit güçtür: kafa yavaşlasa veya dursa bile yakma riski artar. Sadece bilerek kullan."
      : "M4 önerilir: hareket yavaşladığında güç düşer; duran kafada lazer söner.";
    refs.laserModeHint.classList.toggle("warn", m3);
  }
}

// --- Malzeme profilleri -------------------------------------------------
const MATERIAL_PROFILES_KEY = "laser-editor-material-profiles-v1";
const PROFILE_FIELDS = [
  "cutFeed", "cutPower", "passes", "overcut", "kerf",
  "travelFeed", "pierceDelay", "engravePower", "engraveFeed", "lineStep", "threshold",
];
const BUILTIN_PROFILES = [
  {
    id: "builtin-kontrplak-3",
    name: "3mm Kontrplak",
    builtin: true,
    values: { cutFeed: 500, cutPower: 1000, passes: 1, overcut: 0.8, kerf: 0.15, travelFeed: 3000, pierceDelay: 0, engravePower: 250, engraveFeed: 1800, lineStep: 0.35, threshold: 140 },
    laserCmd: "M4",
  },
  {
    id: "builtin-mdf-3",
    name: "3mm MDF",
    builtin: true,
    values: { cutFeed: 350, cutPower: 1000, passes: 1, overcut: 0.8, kerf: 0.15, travelFeed: 3000, pierceDelay: 0, engravePower: 300, engraveFeed: 1600, lineStep: 0.35, threshold: 140 },
    laserCmd: "M4",
  },
  {
    id: "builtin-karton",
    name: "Karton / Mukavva",
    builtin: true,
    values: { cutFeed: 1500, cutPower: 600, passes: 1, overcut: 0.5, kerf: 0.1, travelFeed: 3000, pierceDelay: 0, engravePower: 150, engraveFeed: 2500, lineStep: 0.35, threshold: 140 },
    laserCmd: "M4",
  },
];

function loadCustomProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATERIAL_PROFILES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomProfiles(profiles) {
  localStorage.setItem(MATERIAL_PROFILES_KEY, JSON.stringify(profiles));
}

function allProfiles() {
  return [...BUILTIN_PROFILES, ...loadCustomProfiles()];
}

function renderProfileSelect(selectedId = "") {
  const select = document.getElementById("materialProfile");
  if (!select) return;
  const custom = loadCustomProfiles();
  const option = (profile) => `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`;
  select.innerHTML =
    `<optgroup label="Hazır">${BUILTIN_PROFILES.map(option).join("")}</optgroup>` +
    (custom.length ? `<optgroup label="Kayıtlı">${custom.map(option).join("")}</optgroup>` : "");
  if (selectedId && allProfiles().some((profile) => profile.id === selectedId)) select.value = selectedId;
  const current = allProfiles().find((profile) => profile.id === select.value);
  const deleteBtn = document.getElementById("deleteProfileBtn");
  if (deleteBtn) deleteBtn.disabled = !current || Boolean(current.builtin);
}

function applyMaterialProfile() {
  const select = document.getElementById("materialProfile");
  const profile = allProfiles().find((item) => item.id === select?.value);
  if (!profile) return;
  pushUndo("Malzeme profili");
  for (const field of PROFILE_FIELDS) {
    const input = document.getElementById(field);
    if (!input || profile.values[field] === undefined) continue;
    input.value = String(profile.values[field]);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (profile.laserCmd) {
    state.laserCmd = profile.laserCmd;
    syncLaserButtons();
    saveUiSettings();
  }
  const hint = document.getElementById("profileHint");
  if (hint) hint.textContent = `"${profile.name}" uygulandı: F${profile.values.cutFeed} S${profile.values.cutPower} ${profile.values.passes} pas, kerf ${profile.values.kerf} mm.`;
  updateUiFromAnalysis(computeJobAnalysis());
  setStatus(`Malzeme profili uygulandı: ${profile.name}`);
}

function saveMaterialProfile() {
  const name = window.prompt("Profil adı (örn. 4mm Kontrplak):", "");
  if (!name || !name.trim()) return;
  const values = {};
  for (const field of PROFILE_FIELDS) {
    const input = document.getElementById(field);
    if (input) values[field] = Number(input.value) || 0;
  }
  const custom = loadCustomProfiles();
  const id = `custom-${Date.now()}`;
  custom.push({ id, name: name.trim().slice(0, 60), values, laserCmd: state.laserCmd });
  saveCustomProfiles(custom);
  renderProfileSelect(id);
  setStatus(`Profil kaydedildi: ${name.trim()}`);
}

function deleteMaterialProfile() {
  const select = document.getElementById("materialProfile");
  const profile = allProfiles().find((item) => item.id === select?.value);
  if (!profile || profile.builtin) return;
  if (!window.confirm(`"${profile.name}" profili silinsin mi?`)) return;
  saveCustomProfiles(loadCustomProfiles().filter((item) => item.id !== profile.id));
  renderProfileSelect();
  setStatus(`Profil silindi: ${profile.name}`);
}

function bed() {
  return {
    width: Math.max(1, mm("bedW", 400)),
    height: Math.max(1, mm("bedH", 400)),
  };
}

function normalizeMaterialArea(area) {
  const points = Array.isArray(area?.points)
    ? area.points
        .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  return {
    points,
    drawing: Boolean(area?.drawing),
    previewPoint: area?.previewPoint && Number.isFinite(Number(area.previewPoint.x)) && Number.isFinite(Number(area.previewPoint.y))
      ? { x: Number(area.previewPoint.x), y: Number(area.previewPoint.y) }
      : null,
  };
}

function materialAreaPoints() {
  return Array.isArray(state.materialArea?.points) ? state.materialArea.points : [];
}

function hasMaterialArea() {
  return !state.materialArea?.drawing && materialAreaCanClose(materialAreaPoints());
}

function materialAreaPayload() {
  if (!hasMaterialArea()) return null;
  return {
    type: "polygon",
    points: materialAreaPoints().map((point) => ({ x: roundMm(point.x), y: roundMm(point.y) })),
  };
}

function roundMm(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function clampPointToBed(point) {
  const b = bed();
  return {
    x: clamp(Number(point.x) || 0, 0, b.width),
    y: clamp(Number(point.y) || 0, 0, b.height),
  };
}

function materialAreaSignature() {
  if (!hasMaterialArea()) return "rect";
  return materialAreaPoints().map((point) => `${roundMm(point.x)},${roundMm(point.y)}`).join("|");
}

function materialAreaRegion(margin = Math.max(0, mm("margin", 1))) {
  if (!hasMaterialArea()) return null;
  return {
    polygons: [materialAreaPoints()],
    margin,
  };
}

function worldPolygonArea(points) {
  if (!points || points.length < 3) return 0;
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total / 2);
}

function rectangleSamplePoints(rect, step = 6) {
  const points = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
    { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 },
  ];
  const width = Math.max(0, rect.maxX - rect.minX);
  const height = Math.max(0, rect.maxY - rect.minY);
  const xSteps = Math.max(1, Math.ceil(width / Math.max(1, step)));
  const ySteps = Math.max(1, Math.ceil(height / Math.max(1, step)));
  for (let index = 1; index < xSteps; index += 1) {
    const x = rect.minX + (width * index) / xSteps;
    points.push({ x, y: rect.minY }, { x, y: rect.maxY });
  }
  for (let index = 1; index < ySteps; index += 1) {
    const y = rect.minY + (height * index) / ySteps;
    points.push({ x: rect.minX, y }, { x: rect.maxX, y });
  }
  return points;
}

function rectFitsMaterialArea(rect, b, margin) {
  if (!rectFitsBed(rect, b, 0)) return false;
  const region = materialAreaRegion(margin);
  if (!region) return rectFitsBed(rect, b, margin);
  const sampleStep = Math.max(2, Math.min(8, Math.min(rect.maxX - rect.minX, rect.maxY - rect.minY) / 3 || 4));
  return rectangleSamplePoints(rect, sampleStep).every((point) => clipRegionContains(point, region));
}

function rectFitsActiveArea(rect, b = bed(), margin = Math.max(0, mm("margin", 1))) {
  return hasMaterialArea() ? rectFitsMaterialArea(rect, b, margin) : rectFitsBed(rect, b, margin);
}

function itemFitsActiveArea(item, b, margin, allowRotate = refs.allowRotate.checked) {
  if (!hasMaterialArea()) return partFitsBed(item.part || item, b, margin, allowRotate);
  return Boolean(findMaterialAreaSlot(item.part ? item : { part: item }, [], b, margin, 0, allowRotate));
}

function getSettings() {
  return {
    bedWidth: Math.max(1, mm("bedW", 400)),
    bedHeight: Math.max(1, mm("bedH", 400)),
    margin: Math.max(0, mm("margin", 1)),
    gap: Math.max(0, mm("gap", 3)),
    quantity: Math.max(1, Math.round(mm("quantity", 1))),
    allowRotate: Boolean(refs.allowRotate?.checked),
    feed: mm("cutFeed", 500),
    power: clamp(Math.round(mm("cutPower", 1000)), 0, 1000),
    passes: Math.max(1, Math.round(mm("passes", 1))),
    overcut: Math.max(0, mm("overcut", 0.8)),
    kerf: Math.min(1, Math.max(0, mm("kerf", 0))),
    travelFeed: Math.max(1, mm("travelFeed", 3000)),
    pierceDelay: Math.max(0, mm("pierceDelay", 0)),
    airAssist: true,
    airAssistCommand: "M8",
    availableArea: materialAreaPayload(),
    engravePower: clamp(Math.round(mm("engravePower", 250)), 0, 1000),
    engraveFeed: Math.max(1, mm("engraveFeed", 1800)),
    lineStep: Math.max(0.05, mm("lineStep", 0.35)),
    laserCmd: state.laserCmd,
    innerFirst: refs.innerFirst.checked,
    returnToOrigin: refs.returnOrigin.checked,
    tolerance: 0.25,
    joinTolerance: 0.05,
  };
}

function getVectorSettings() {
  return {
    mode: refs.vecMode?.value || "outline",
    thresholdMode: refs.vecThresholdMode?.value || "manual",
    threshold: clamp(Math.round(mm("vecThreshold", 140)), 0, 255),
    blur: Math.max(0, Math.round(mm("vecBlur", 3))),
    contrast: Math.max(0.2, Math.min(4, mm("vecContrast", 1))),
    morphClose: Math.max(0, Math.round(mm("vecMorphClose", 1))),
    morphOpen: Math.max(0, Math.round(mm("vecMorphOpen", 0))),
    denoise: Math.max(0, Math.round(mm("vecDenoise", 3))),
    minArea: Math.max(1, mm("vecMinArea", 40)),
    minLength: Math.max(0, mm("vecMinLength", 8)),
    simplify: Math.max(0.05, mm("vecSimplify", 0.8)),
    smooth: Math.max(0, Math.min(3, Math.round(mm("vecSmooth", 1)))),
    maxContours: Math.max(10, Math.round(mm("vecMaxContours", 1200))),
    stitchGap: Math.max(0, mm("vecStitchGap", 3)),
    maxDimension: Math.max(256, Math.round(mm("vecMaxDimension", 1800))),
    adaptiveBlock: Math.max(3, Math.round(mm("vecAdaptiveBlock", 35)) | 1),
    adaptiveC: mm("vecAdaptiveC", 5),
    invert: Boolean(refs.vecInvert?.checked),
    removeBorder: Boolean(refs.vecRemoveBorder?.checked),
    backgroundNormalize: Boolean(refs.vecBackgroundNormalize?.checked),
  };
}

function applyAutoVectorPreset() {
  pushUndo("Vektor profili");
  const values = {
    vecMode: "auto",
    vecThresholdMode: "otsu",
    vecBlur: "1",
    vecContrast: "1",
    vecMorphClose: "1",
    vecMorphOpen: "0",
    vecDenoise: "5",
    vecMinArea: "25",
    vecMinLength: "8",
    vecSimplify: "0.55",
    vecSmooth: "3",
    vecMaxContours: "3000",
    vecStitchGap: "0",
    vecMaxDimension: "2200",
    vecAdaptiveBlock: "35",
    vecAdaptiveC: "5",
  };
  for (const [id, value] of Object.entries(values)) {
    const input = refs[id];
    if (input) input.value = value;
  }
  if (refs.vecInvert) refs.vecInvert.checked = true;
  if (refs.vecRemoveBorder) refs.vecRemoveBorder.checked = true;
  if (refs.vecBackgroundNormalize) refs.vecBackgroundNormalize.checked = true;
  saveUiSettings();
  setStatus("Otomatik fotograf profili uygulandi. Simdi Foto Sec ve Vektorlestir.");
}

async function api(path, payload = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "İşlem tamamlanamadı.");
  }
  return data;
}

function getClientSessionId() {
  try {
    let clientId = sessionStorage.getItem(CLIENT_SESSION_KEY);
    if (!clientId) {
      clientId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `client_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      sessionStorage.setItem(CLIENT_SESSION_KEY, clientId);
    }
    return clientId;
  } catch {
    return `client_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }
}

function clientLifecyclePayload() {
  return JSON.stringify({
    clientId: state.clientId || getClientSessionId(),
    href: location.href,
  });
}

function sendClientPing() {
  const payload = clientLifecyclePayload();
  fetch("/api/client/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function sendClientClose() {
  const payload = clientLifecyclePayload();
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/client/close", new Blob([payload], { type: "application/json" }));
    return;
  }
  fetch("/api/client/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function startClientLifecycleTracking() {
  state.clientId = getClientSessionId();
  sendClientPing();
  if (state.clientPingTimer) window.clearInterval(state.clientPingTimer);
  state.clientPingTimer = window.setInterval(sendClientPing, 3000);
  window.addEventListener("pagehide", sendClientClose);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sendClientPing();
  });
}

function detachMachineHomeFromSidePanel() {
  const home = document.getElementById("machinePanelHome");
  const tab = document.getElementById("machineTab");
  if (!home || !tab || !home.parentElement?.classList.contains("left-panel")) return;
  tab.parentElement?.insertBefore(home, tab);
}

function setMachineTabOpen(open, updateHash = true) {
  detachMachineHomeFromSidePanel();
  const tab = document.getElementById("machineTab");
  const content = document.getElementById("machinePanelContent");
  const home = document.getElementById("machinePanelHome");
  const body = document.getElementById("machineTabBody");
  const nav = document.getElementById("machineNavBtn");
  if (!tab || !content || !home || !body) return;
  if (open) {
    body.appendChild(content);
    tab.classList.remove("hidden");
    nav?.classList.add("active");
    document.body.classList.add("machine-tab-open");
    if (updateHash && location.hash !== "#machine") history.pushState(null, "", "#machine");
    refreshMachinePorts();
    ensureMachinePreviewForCurrentOutput(false);
  } else {
    home.appendChild(content);
    tab.classList.add("hidden");
    nav?.classList.remove("active");
    document.body.classList.remove("machine-tab-open");
    if (updateHash && location.hash === "#machine") history.pushState(null, "", `${location.pathname}${location.search}`);
  }
  renderMachinePanel();
}

function syncMachineTabFromHash() {
  setMachineTabOpen(location.hash === "#machine", false);
}

function applyMachineSnapshot(machine) {
  if (!machine) return;
  state.machine = {
    ...state.machine,
    ...machine,
    job: machine.job || {},
    lastStatus: machine.lastStatus || {},
    log: machine.log || [],
  };
  renderMachinePanel();
}

function machinePositionText(status) {
  const point = status?.WPos || status?.MPos;
  if (!Array.isArray(point) || point.length < 2) return "Konum: -";
  return `X ${Number(point[0]).toFixed(2)} · Y ${Number(point[1]).toFixed(2)}${point.length > 2 ? ` · Z ${Number(point[2]).toFixed(2)}` : ""}`;
}

function machineJobActive(job = state.machine.job || {}) {
  return Boolean(job.running) || Boolean(job.paused);
}

function machineLaserModeWarnings(machine) {
  const warnings = Array.isArray(machine.warnings) ? [...machine.warnings] : [];
  const settings = machine.settings || {};
  const hasLaserModeSetting = Object.prototype.hasOwnProperty.call(settings, "32");
  const laserModeEnabled = hasLaserModeSetting && Number(settings["32"]) === 1;
  const m3Selected = state.laserCmd === "M3" || Boolean(machine.preview?.usesM3);
  if (machine.connected && m3Selected && !laserModeEnabled) {
    warnings.push("M3 kullaniliyor; GRBL $32=1 dogrulanmadan feed hold sirasinda lazer kapanmayabilir.");
  }
  return [...new Set(warnings)];
}

function ensureMachineIdleForCommand(commandName) {
  if (!machineJobActive()) return true;
  setStatus(`${commandName} calisan is sirasinda gonderilemez. Pause/Resume/Iptal/Soft Reset kullanin.`);
  renderMachinePanel();
  return false;
}

function renderMachinePanel() {
  if (!refs.machineStatusBox) return;
  const machine = state.machine;
  const job = machine.job || {};
  const status = machine.lastStatus || {};
  const connected = Boolean(machine.connected);
  const activeJob = machineJobActive(job);
  const warnings = machineLaserModeWarnings(machine);
  const jobText = job.running
    ? `Gönderim: ${Number(job.sent || 0)} / ${Number(job.total || 0)}`
    : job.message || (connected ? "Hazır" : machine.available === false ? "pyserial gerekli" : "Bağlı değil");
  const title = connected ? `${status.state || "Bağlı"} · ${machine.port || ""}` : "Bağlı değil";
  const level = connected ? (activeJob || warnings.length ? "warn" : "ok") : machine.available === false ? "danger" : "";
  refs.machineStatusBox.className = `state-card machine-status ${level}`;
  refs.machineStatusBox.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(machinePositionText(status))}</span><span>${escapeHtml(jobText)}</span>${warnings
    .map((warning) => `<span>${escapeHtml(warning)}</span>`)
    .join("")}`;
  if (refs.machineLog) refs.machineLog.textContent = (machine.log || []).slice(-40).join("\n");

  document.getElementById("connectMachineBtn").disabled = connected || !refs.machinePort?.value || machine.available === false;
  document.getElementById("autoConnectMachineBtn").disabled = connected || machine.available === false;
  document.getElementById("disconnectMachineBtn").disabled = !connected;
  document.getElementById("machineStatusBtn").disabled = !connected;
  document.getElementById("sendGcodeToMachineBtn").disabled = !connected || activeJob || !refs.outputPath?.value;
  document.getElementById("sendMachineCommandBtn").disabled = !connected || activeJob;
  document.getElementById("machineFrameBtn").disabled = !connected || activeJob;
  document.getElementById("setMachineOriginBtn").disabled = !connected || activeJob;
  document.getElementById("clearMachineOriginBtn").disabled = !connected || activeJob;
  document.getElementById("focusPulseBtn").disabled = !connected || activeJob;
  document.querySelectorAll("[data-machine-action]").forEach((button) => {
    const action = button.dataset.machineAction;
    const realtimeAllowed = ["hold", "resume", "abort", "reset"].includes(action);
    button.disabled = !connected || (activeJob && !realtimeAllowed);
  });
  document.querySelectorAll("[data-machine-jog]").forEach((button) => {
    button.disabled = !connected || activeJob;
  });
  document.querySelectorAll("[data-machine-override]").forEach((button) => {
    button.disabled = !connected;
  });
  renderMachineOverrides(status);
  renderMachinePreviewInfo();
  drawMachinePreview();
  updateProduceFlowMachineState();
}

function renderMachineOverrides(status) {
  const ov = Array.isArray(status?.Ov) ? status.Ov : null;
  const feedEl = document.getElementById("ovFeedVal");
  const spindleEl = document.getElementById("ovSpindleVal");
  if (feedEl) feedEl.textContent = ov ? `%${Math.round(ov[0])}` : "—";
  if (spindleEl) spindleEl.textContent = ov && ov.length > 2 ? `%${Math.round(ov[2])}` : "—";
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} dk ${s} sn` : `${s} sn`;
}

function machineRemainingSeconds() {
  const preview = state.machine.preview;
  const job = state.machine.job || {};
  if (!preview || !Array.isArray(preview.lineSeconds) || !job.running) return null;
  const sent = Math.max(0, Number(job.sent) || 0);
  let remaining = 0;
  for (let i = sent; i < preview.lineSeconds.length; i += 1) remaining += preview.lineSeconds[i];
  return remaining;
}

function renderMachinePreviewInfo() {
  const info = document.getElementById("machinePreviewInfo");
  if (!info) return;
  const preview = state.machine.preview;
  if (!preview) {
    info.textContent = "Önizleme yok — \"Önizle\" ile G-code dosyasını yükleyin.";
    return;
  }
  const bounds = preview.bounds || {};
  const parts = [
    `${(bounds.width || 0).toFixed(1)} × ${(bounds.height || 0).toFixed(1)} mm`,
    `kesim ${Math.round(preview.cutLength || 0)} mm`,
    `süre ~${formatDuration(preview.estimatedSeconds)}`,
  ];
  const remaining = machineRemainingSeconds();
  if (remaining !== null) parts.push(`kalan ~${formatDuration(remaining)}`);
  info.textContent = parts.join(" · ");
}

function drawMachinePreview() {
  const canvas = document.getElementById("machinePreviewCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cssStyles = getComputedStyle(document.documentElement);
  const colorFor = (name, fallback) => (cssStyles.getPropertyValue(name) || fallback).trim() || fallback;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colorFor("--canvas", "#0a0e13");
  ctx.fillRect(0, 0, width, height);
  const preview = state.machine.preview;
  if (!preview || !Array.isArray(preview.segments) || !preview.segments.length) {
    ctx.fillStyle = colorFor("--faint", "#5c6b7c");
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("G-code önizlemesi", width / 2, height / 2);
    return;
  }
  const bounds = preview.bounds;
  const pad = 10;
  const spanX = Math.max(1e-6, bounds.width);
  const spanY = Math.max(1e-6, bounds.height);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offsetX = (width - spanX * scale) / 2 - bounds.minX * scale;
  const offsetY = height - ((height - spanY * scale) / 2 - bounds.minY * scale);
  const mapX = (x) => offsetX + x * scale;
  const mapY = (y) => offsetY - y * scale; // G-code Y yukari, canvas Y asagi
  const job = state.machine.job || {};
  const sent = job.running || job.finishedAt ? Math.max(0, Number(job.sent) || 0) : -1;

  const strokeGroup = (filterFn, color, dash, lineWidth) => {
    ctx.strokeStyle = color;
    ctx.setLineDash(dash);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const seg of preview.segments) {
      if (!filterFn(seg)) continue;
      ctx.moveTo(mapX(seg[0]), mapY(seg[1]));
      ctx.lineTo(mapX(seg[2]), mapY(seg[3]));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  strokeGroup((seg) => seg[4] === 0, colorFor("--ignore", "#55616e"), [3, 3], 1);
  strokeGroup((seg) => seg[4] === 1 && seg[5] >= sent, colorFor("--cut", "#ff5544"), [], 1.4);
  if (sent >= 0) {
    strokeGroup((seg) => seg[4] === 1 && seg[5] < sent, colorFor("--ok", "#34d399"), [], 1.4);
  }

  // makine kafasi imleci (is koordinati)
  const status = state.machine.lastStatus || {};
  let point = Array.isArray(status.WPos) ? status.WPos : null;
  if (!point && Array.isArray(status.MPos) && Array.isArray(status.WCO)) {
    point = [status.MPos[0] - status.WCO[0], status.MPos[1] - status.WCO[1]];
  }
  if (state.machine.connected && Array.isArray(point) && point.length >= 2) {
    const px = mapX(point[0]);
    const py = mapY(point[1]);
    ctx.strokeStyle = colorFor("--selection", "#c084fc");
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px - 7, py); ctx.lineTo(px + 7, py);
    ctx.moveTo(px, py - 7); ctx.lineTo(px, py + 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

async function loadMachinePreview(showErrors = true) {
  const path = refs.outputPath?.value?.trim() || "";
  if (!path) {
    clearMachinePreview();
    if (showErrors) setStatus("Önce G-code çıktı yolu gerekli.", "warn");
    return;
  }
  try {
    const data = await api("/api/machine/gcode-info", { path });
    state.machine.preview = data.info || null;
    state.machine.previewPath = path;
    renderMachinePreviewInfo();
    drawMachinePreview();
  } catch (error) {
    state.machine.preview = null;
    state.machine.previewPath = "";
    renderMachinePreviewInfo();
    drawMachinePreview();
    if (showErrors) setStatus(`Önizleme yüklenemedi: ${error.message}`, "danger");
  }
}

function clearMachinePreview() {
  state.machine.preview = null;
  state.machine.previewPath = "";
  renderMachinePreviewInfo();
  drawMachinePreview();
}

function ensureMachinePreviewForCurrentOutput(showErrors = false) {
  const path = refs.outputPath?.value?.trim() || "";
  if (!path) {
    if (state.machine.preview || state.machine.previewPath) clearMachinePreview();
    return;
  }
  if (state.machine.preview && state.machine.previewPath === path) return;
  loadMachinePreview(showErrors);
}

async function machineOverride(kind, action) {
  try {
    const data = await api("/api/machine/override", { kind, action });
    applyMachineSnapshot(data.machine);
  } catch (error) {
    setStatus(`Override hatası: ${error.message}`, "danger");
  }
}

function produceFlowOpen() {
  return !document.getElementById("produceFlowModal")?.classList.contains("hidden");
}

function openProduceFlow(result) {
  const modal = document.getElementById("produceFlowModal");
  if (!modal) return;
  state.lastGenerateResult = result || null;
  const fileEl = document.getElementById("flowStepFile");
  if (fileEl) fileEl.textContent = refs.outputPath?.value || "";
  updateProduceFlowSummary();
  updateProduceFlowMachineState();
  modal.classList.remove("hidden");
}

function closeProduceFlow() {
  document.getElementById("produceFlowModal")?.classList.add("hidden");
}

function updateProduceFlowSummary() {
  const summary = document.getElementById("flowSummary");
  if (!summary) return;
  const parts = [];
  const result = state.lastGenerateResult;
  if (result) {
    parts.push(`Kesim alanı: ${Number(result.cutWidth || 0).toFixed(1)} × ${Number(result.cutHeight || 0).toFixed(1)} mm`);
    parts.push(`${result.lineCount} satır`);
  }
  const preview = state.machine.preview;
  if (preview) {
    parts.push(`kesim ${Math.round(preview.cutLength || 0)} mm`);
    parts.push(`süre ~${formatDuration(preview.estimatedSeconds)}`);
  }
  summary.textContent = parts.join(" · ") || "Özet hazırlanıyor...";
}

function updateProduceFlowMachineState() {
  if (!produceFlowOpen()) return;
  const machine = state.machine;
  const job = machine.job || {};
  const connected = Boolean(machine.connected);
  const running = Boolean(job.running);
  const frameBtn = document.getElementById("flowFrameBtn");
  const sendBtn = document.getElementById("flowSendBtn");
  if (frameBtn) frameBtn.disabled = !connected || running;
  if (sendBtn) sendBtn.disabled = !connected || running || !refs.outputPath?.value;
  const note = document.getElementById("flowMachineNote");
  if (note) {
    note.textContent = !connected
      ? "Makine bağlı değil — sol paneldeki Makine bölümünden bağlan."
      : running
        ? `Gönderim sürüyor: ${Number(job.sent || 0)}/${Number(job.total || 0)}`
        : "Makine hazır. Gönderimden önce onay istenecek.";
  }
  // Onizleme gec yuklenirse sure bilgisi ozete sonradan islenir.
  updateProduceFlowSummary();
}

async function refreshMachinePorts(options = {}) {
  const silent = Boolean(options.silent);
  try {
    const data = await api("/api/machine/ports", {});
    state.machine.available = Boolean(data.available);
    state.machine.ports = data.ports || [];
    state.machine.preferredPort = data.preferredPort || "";
    const current = refs.machinePort?.value || state.machine.port || "";
    if (refs.machinePort) {
      const preferredPort = data.preferredPort || "";
      const currentPort = state.machine.ports.find((port) => port.device === current);
      const shouldPrefer =
        preferredPort &&
        !state.machine.connected &&
        (!current || !currentPort || !currentPort.likelyLaser || currentPort.device !== preferredPort);
      refs.machinePort.innerHTML = state.machine.ports.length
        ? state.machine.ports
            .map((port) => {
              const suffix = port.device === preferredPort ? " · önerilen" : port.reason ? ` · ${port.reason}` : "";
              const label = `${port.device}${port.description ? ` · ${port.description}` : ""}${suffix}`;
              return `<option value="${escapeHtml(port.device)}">${escapeHtml(label)}</option>`;
            })
            .join("")
        : `<option value="">Port yok</option>`;
      if (shouldPrefer) refs.machinePort.value = preferredPort;
      else if (current && state.machine.ports.some((port) => port.device === current)) refs.machinePort.value = current;
    }
    renderMachinePanel();
    const selected = refs.machinePort?.value || "";
    if (!silent) {
      setStatus(
      data.available
        ? `${state.machine.ports.length} port bulundu${selected ? `, seçilen: ${selected}` : ""}.`
        : data.error || "Seri port destegi yok."
      );
    }
  } catch (error) {
    if (!silent) setStatus(error.message);
  }
}

async function refreshMachineStatus(query = false, options = {}) {
  const silent = Boolean(options.silent);
  try {
    const data = await api("/api/machine/status", { query });
    applyMachineSnapshot(data.machine);
  } catch (error) {
    if (!silent) setStatus(error.message);
  }
}

function startMachinePolling() {
  if (state.machine.pollTimer) window.clearInterval(state.machine.pollTimer);
  state.machine.pollTimer = window.setInterval(() => {
    refreshMachineStatus(Boolean(state.machine.connected), { silent: true });
  }, 1200);
}

async function connectMachine() {
  try {
    const port = refs.machinePort?.value || "";
    const baud = Math.max(1, Math.round(Number(refs.machineBaud?.value) || 115200));
    const data = await api("/api/machine/connect", { port, baud });
    applyMachineSnapshot(data.machine);
    setStatus(`Makine bağlandı: ${port}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function autoConnectMachine() {
  await refreshMachinePorts();
  const preferred = state.machine.preferredPort || refs.machinePort?.value || "";
  if (!preferred) {
    setStatus("Otomatik bağlanacak uygun USB seri port bulunamadı.");
    return;
  }
  if (refs.machinePort) refs.machinePort.value = preferred;
  await connectMachine();
}

async function disconnectMachine() {
  try {
    const data = await api("/api/machine/disconnect", {});
    applyMachineSnapshot(data.machine);
    setStatus("Makine bağlantısı kapatıldı.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function machineControl(action) {
  const actionText = { home: "Homing başlatılsın mı?", reset: "Soft reset gönderilsin mi?", abort: "Gönderim iptal edilsin mi?" }[action];
  if (actionText && !window.confirm(actionText)) return;
  try {
    const data = await api("/api/machine/control", { action });
    applyMachineSnapshot(data.machine);
    setStatus(`Makine komutu gönderildi: ${action}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function jogMachine(axis, direction) {
  if (!ensureMachineIdleForCommand("Jog")) return;
  try {
    const step = Math.max(0.01, Number(refs.machineJogStep?.value) || 1);
    const feed = Math.max(1, Number(refs.machineJogFeed?.value) || 1200);
    const data = await api("/api/machine/jog", { axis, distance: step * direction, feed });
    applyMachineSnapshot(data.machine);
    setStatus(`Jog: ${axis}${(step * direction).toFixed(2)} mm`);
  } catch (error) {
    setStatus(error.message);
  }
}

function activeMachineJobBounds(analysis) {
  const bounds = emptyBounds();
  for (const item of analysis.placements || []) {
    if (item.active && item.bounds) {
      includePoint(bounds, { x: item.bounds.minX, y: item.bounds.minY });
      includePoint(bounds, { x: item.bounds.maxX, y: item.bounds.maxY });
    }
  }
  for (const item of analysis.patterns || []) {
    if (item.active && item.pathCount > 0 && item.bounds) {
      includePoint(bounds, { x: item.bounds.minX, y: item.bounds.minY });
      includePoint(bounds, { x: item.bounds.maxX, y: item.bounds.maxY });
    }
  }
  return boundsReady(bounds) ? bounds : null;
}

async function frameMachineJob() {
  if (!ensureMachineIdleForCommand("Cerceve hareketi")) return;
  const analysis = computeJobAnalysis();
  updateUiFromAnalysis(analysis);
  if (!analysis.canGenerate) {
    const first = analysis.warnings.find((item) => item.level === "critical");
    setStatus(`Çerçeve gezdirilemez: ${first?.title || "kritik sorun var"}.`);
    return;
  }
  const bounds = activeMachineJobBounds(analysis);
  if (!bounds) {
    setStatus("Çerçeve için aktif iş sınırı bulunamadı.");
    return;
  }
  const feed = Math.max(1, Number(refs.machineFrameFeed?.value) || 3000);
  const padding = Math.max(0, Number(refs.machineFramePadding?.value) || 0);
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;
  const message = `Lazer kapalı çerçeve hareketi başlatılacak.\nAlan: ${width.toFixed(1)} × ${height.toFixed(1)} mm\nHız: F${feed.toFixed(0)}\n\nDevam edilsin mi?`;
  if (!window.confirm(message)) return;
  try {
    const data = await api("/api/machine/frame", { bounds, feed, padding, confirmed: true });
    applyMachineSnapshot(data.machine);
    setStatus("Çerçeve hareketi tamamlandı.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function setMachineOrigin(clear = false) {
  if (!ensureMachineIdleForCommand("Is sifiri")) return;
  const message = clear
    ? "G92 iş sıfırı temizlenecek. Devam edilsin mi?"
    : "Kafanın mevcut konumu iş sıfırı yapılacak: X0 Y0. Devam edilsin mi?";
  if (!window.confirm(message)) return;
  try {
    const data = await api("/api/machine/origin", { clear, confirmed: true });
    applyMachineSnapshot(data.machine);
    setStatus(clear ? "İş sıfırı temizlendi." : "Mevcut kafa konumu X0 Y0 yapıldı.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function focusPulse() {
  if (!ensureMachineIdleForCommand("Odak atimi")) return;
  const power = clamp(Math.round(Number(refs.machinePulsePower?.value) || 10), 1, 200);
  const durationMs = clamp(Math.round(Number(refs.machinePulseDuration?.value) || 80), 1, 1000);
  if (refs.machinePulsePower) refs.machinePulsePower.value = power;
  if (refs.machinePulseDuration) refs.machinePulseDuration.value = durationMs;
  const message = `Odak/test atımı yapılacak.\nGüç: S${power}\nSüre: ${durationMs} ms\n\nLazer kısa süre yanacak. Devam edilsin mi?`;
  if (!window.confirm(message)) return;
  try {
    const data = await api("/api/machine/focus-pulse", { power, durationMs, confirmed: true });
    applyMachineSnapshot(data.machine);
    setStatus(`Odak atımı tamamlandı: S${power}, ${durationMs} ms.`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function sendMachineCommand() {
  if (!ensureMachineIdleForCommand("Tek komut")) return;
  const command = refs.machineCommand?.value.trim() || "";
  if (!command) return;
  const mayFireLaser = /\bM0?[34]\b/i.test(command) || /\bS[1-9]\d*/i.test(command);
  if (mayFireLaser && !window.confirm("Bu komut lazeri yakabilir. Gönderilsin mi?")) return;
  try {
    const data = await api("/api/machine/command", { command });
    applyMachineSnapshot(data.machine);
    setStatus(`Komut gönderildi: ${command}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function sendGcodeToMachine() {
  if (!ensureMachineIdleForCommand("G-code gonderimi")) return;
  const path = refs.outputPath?.value.trim() || "";
  if (!path) {
    setStatus("Makineye göndermek için önce G-code dosyası seçin veya oluşturun.");
    return;
  }
  const message = `G-code dosyası doğrudan makineye gönderilecek:\n${path}\n\nLazer ve eksen hareketleri başlayabilir. Devam edilsin mi?`;
  if (!window.confirm(message)) return;
  try {
    // Onizleme + kalan sure gostergesi icin isi gondermeden dosyayi coz.
    if (state.machine.previewPath !== path) await loadMachinePreview(false);
    const data = await api("/api/machine/send-gcode", { path, confirmed: true });
    applyMachineSnapshot(data.machine);
    setStatus("G-code gönderimi başladı.");
  } catch (error) {
    setStatus(error.message);
  }
}

function partById(id) {
  return state.parts.find((part) => part.id === id);
}

function defaultPartQuantity() {
  return Math.max(1, Math.round(Number(refs.quantity?.value) || 1));
}

function partQuantity(part) {
  return Math.max(1, Math.round(Number(part?.quantity) || 1));
}

function setPartQuantity(part, quantity, options = {}) {
  if (!part) return false;
  const next = Math.max(1, Math.round(Number(quantity) || 1));
  if (partQuantity(part) === next && Number(part.quantity) === next) return false;
  if (options.recordUndo !== false) pushUndo("DXF adedi");
  part.quantity = next;
  markLayoutSettingsChanged();
  draw();
  updateSelectionPanel();
  updateUiFromAnalysis(computeJobAnalysis());
  setStatus(`${part.name || "DXF"} adedi ${next} olarak ayarlandı. Yerleşimi yeniden hesaplayın.`);
  return true;
}

function placementById(id) {
  return state.placements.find((placement) => placement.id === id);
}

function patternById(id) {
  return state.patterns.find((pattern) => pattern.id === id);
}

function placementSize(placement) {
  const part = partById(placement.partId);
  if (!part) return { width: 0, height: 0 };
  const rotation = ((Math.round(placement.rotation) % 360) + 360) % 360;
  if (rotation === 90 || rotation === 270) {
    return { width: part.height, height: part.width };
  }
  return { width: part.width, height: part.height };
}

function placementBounds(placement) {
  const size = placementSize(placement);
  return {
    minX: placement.x,
    minY: placement.y,
    maxX: placement.x + size.width,
    maxY: placement.y + size.height,
    width: size.width,
    height: size.height,
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function clonePartPayload(part) {
  return clonePlain(part);
}

function pruneUnusedParts() {
  const usedPartIds = new Set(state.placements.map((placement) => placement.partId));
  state.parts = state.parts.filter((part) => usedPartIds.has(part.id));
}

function deletePlacementById(id) {
  const childPatterns = state.patterns.filter((item) => item.parentId === id);
  for (const pattern of childPatterns) state.images.delete(pattern.id);
  state.placements = state.placements.filter((item) => item.id !== id);
  state.patterns = state.patterns.filter((item) => item.parentId !== id);
  pruneUnusedParts();
}

function transformPartPoint(point, placement) {
  const part = partById(placement.partId);
  if (!part) return { x: placement.x, y: placement.y };
  const x = point[0];
  const y = point[1];
  const rotation = ((Math.round(placement.rotation) % 360) + 360) % 360;
  if (rotation === 90) return { x: placement.x + y, y: placement.y + part.width - x };
  if (rotation === 180) return { x: placement.x + part.width - x, y: placement.y + part.height - y };
  if (rotation === 270) return { x: placement.x + part.height - y, y: placement.y + x };
  return { x: placement.x + x, y: placement.y + y };
}

function pathArea(path) {
  if (!path || path.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < path.length; i += 1) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function patternPoint(pattern, localX, localY) {
  const cx = pattern.x + pattern.width / 2;
  const cy = pattern.y + pattern.height / 2;
  if (pattern.mirrorX) localX = pattern.width - localX;
  if (pattern.mirrorY) localY = pattern.height - localY;
  const dx = localX - pattern.width / 2;
  const dy = localY - pattern.height / 2;
  const angle = (pattern.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function patternCorners(pattern) {
  return [
    patternPoint(pattern, 0, 0),
    patternPoint(pattern, pattern.width, 0),
    patternPoint(pattern, pattern.width, pattern.height),
    patternPoint(pattern, 0, pattern.height),
  ];
}

function placementCenter(placement) {
  const size = placementSize(placement);
  return {
    x: placement.x + size.width / 2,
    y: placement.y + size.height / 2,
    width: size.width,
    height: size.height,
  };
}

function emptyBounds() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function includePoint(bounds, point) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function boundsReady(bounds) {
  return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY);
}

function boundsSize(bounds) {
  return { width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
}

function jobBounds() {
  const bounds = emptyBounds();
  for (const placement of state.placements) {
    const size = placementSize(placement);
    includePoint(bounds, { x: placement.x, y: placement.y });
    includePoint(bounds, { x: placement.x + size.width, y: placement.y + size.height });
  }
  for (const pattern of state.patterns) {
    for (const point of patternCorners(pattern)) includePoint(bounds, point);
  }
  return boundsReady(bounds) ? bounds : null;
}

function moveAll(dx, dy) {
  if (!dx && !dy) return;
  for (const placement of state.placements) {
    placement.x += dx;
    placement.y += dy;
  }
  for (const pattern of state.patterns) {
    pattern.x += dx;
    pattern.y += dy;
  }
}

function vectorLocalPoint(pattern, point) {
  const sourceWidth = Math.max(0.001, pattern.sourceWidth || pattern.width);
  const sourceHeight = Math.max(0.001, pattern.sourceHeight || pattern.height);
  return {
    x: (point[0] / sourceWidth) * pattern.width,
    y: pattern.height - (point[1] / sourceHeight) * pattern.height,
  };
}

function patternLocalPointFromWorld(pattern, worldPoint) {
  const cx = pattern.x + pattern.width / 2;
  const cy = pattern.y + pattern.height / 2;
  const angle = (pattern.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const vx = worldPoint.x - cx;
  const vy = worldPoint.y - cy;
  let localX = vx * cos + vy * sin + pattern.width / 2;
  let localY = -vx * sin + vy * cos + pattern.height / 2;
  if (pattern.mirrorX) localX = pattern.width - localX;
  if (pattern.mirrorY) localY = pattern.height - localY;
  return { x: localX, y: localY };
}

function patternSourcePointFromWorld(pattern, worldPoint) {
  const sourceWidth = Math.max(0.001, pattern.sourceWidth || pattern.width);
  const sourceHeight = Math.max(0.001, pattern.sourceHeight || pattern.height);
  const local = patternLocalPointFromWorld(pattern, worldPoint);
  return [
    (local.x / Math.max(0.001, pattern.width)) * sourceWidth,
    ((Math.max(0.001, pattern.height) - local.y) / Math.max(0.001, pattern.height)) * sourceHeight,
  ];
}

function patternWorldPoint(pattern, localPoint) {
  const point = patternPoint(pattern, localPoint.x, localPoint.y);
  return { x: point.x, y: point.y };
}

function vectorWorldPath(pattern, vectorPath) {
  return (vectorPath.points || []).map((point) => patternWorldPoint(pattern, vectorLocalPoint(pattern, point)));
}

function vectorPathPreservesDuringPatternResize(pattern, vectorPath) {
  if (!vectorPath || vectorPath.removed) return false;
  if (vectorPath.locked) return true;
  return Boolean(pattern?.protectVectorDeformation) && !vectorPath.deformable;
}

function vectorPathProtectionLabel(pattern, vectorPath) {
  if (vectorPath?.locked) return "Tek kontur kilitli";
  if (pattern?.protectVectorDeformation && vectorPath?.deformable) return "Desen korunuyor, bu kontur oynatilabilir";
  if (pattern?.protectVectorDeformation) return "Desen korumasi ile sabit";
  return "Kilit yok";
}

function preserveLockedVectorPaths(oldPattern, newPattern) {
  if (!vectorPatternHasPaths(newPattern)) return;
  for (const vectorPath of newPattern.vectorPaths || []) {
    if (!vectorPathPreservesDuringPatternResize(newPattern, vectorPath) || !(vectorPath.points || []).length) continue;
    const oldWorldPoints = (vectorPath.points || []).map((point) => patternWorldPoint(oldPattern, vectorLocalPoint(oldPattern, point)));
    vectorPath.points = oldWorldPoints.map((point) => patternSourcePointFromWorld(newPattern, point));
    refreshVectorPathMetrics(vectorPath);
  }
}

function updatePatternGeometry(pattern, updates = {}, options = {}) {
  if (!pattern) return;
  const oldPattern = clonePatternPayload(pattern);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) continue;
    pattern[key] = Number(value);
  }
  pattern.width = Math.max(1, Number(pattern.width) || 1);
  pattern.height = Math.max(1, Number(pattern.height) || 1);
  if (options.preserveLocked !== false && (oldPattern.width !== pattern.width || oldPattern.height !== pattern.height || oldPattern.x !== pattern.x || oldPattern.y !== pattern.y)) {
    preserveLockedVectorPaths(oldPattern, pattern);
  }
}

function pointInPolygon(point, polygon) {
  let inside = false;
  let previous = polygon[polygon.length - 1];
  for (const current of polygon) {
    if ((current.y > point.y) !== (previous.y > point.y)) {
      const x = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y + 1e-12) + current.x;
      if (point.x < x) inside = !inside;
    }
    previous = current;
  }
  return inside;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-12) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function distanceToPolyline(point, points, closed = false) {
  if (!points || points.length < 2) return Infinity;
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, distanceToSegment(point, points[index], points[index + 1]));
  }
  if (closed) best = Math.min(best, distanceToSegment(point, points[points.length - 1], points[0]));
  return best;
}

function closedPolygonsForPlacement(placement) {
  const part = partById(placement?.partId);
  if (!part) return [];
  return (part.paths || [])
    .filter((path) => path && path.length >= 3 && Math.abs(pathArea(path)) >= 0.5)
    .map((path) => {
      const polygon = path.map((point) => transformPartPoint(point, placement));
      if (polygon.length > 3 && Math.hypot(polygon[0].x - polygon[polygon.length - 1].x, polygon[0].y - polygon[polygon.length - 1].y) <= 0.05) {
        polygon.pop();
      }
      return polygon;
    })
    .filter((polygon) => polygon.length >= 3);
}

function activeClipPlacements(source = null) {
  const placements = source ? source.map((item) => item.placement || item) : state.placements;
  return placements.filter((placement) => placement && placementOperation(placement) !== "ignore");
}

function placementClipMargin(placement) {
  return Math.max(0, Number(placement?.boundaryMargin ?? placement?.clipMargin) || 0);
}

function placementClipCloseBoundary(placement) {
  return Boolean(placement?.clipCloseBoundary || placement?.boundaryClose);
}


function patternClipRegion(pattern) {
  if (!pattern || patternOperation(pattern) === "ignore") return null;
  const extraMargin = Math.max(0, Number(pattern.clipMargin) || 0);
  if (pattern.parentId) {
    const placement = placementById(pattern.parentId);
    if (!placement) return null;
    const polygons = closedPolygonsForPlacement(placement);
    if (!polygons.length) return null;
    return {
      polygons,
      margin: placementClipMargin(placement) + extraMargin,
      closeBoundary: placementClipCloseBoundary(placement) || Boolean(pattern.clipCloseBoundary),
    };
  }
  const bounds = patternBounds(pattern);
  if (!bounds) return null;
  const polygons = [];
  let margin = 0;
  let closeBoundary = Boolean(pattern.clipCloseBoundary);
  for (const placement of activeClipPlacements()) {
    const placementPolygons = closedPolygonsForPlacement(placement);
    const regionBounds = polygonsBounds(placementPolygons);
    if (!regionBounds || !boundsOverlap(bounds, regionBounds)) continue;
    polygons.push(...placementPolygons);
    margin = Math.max(margin, placementClipMargin(placement));
    closeBoundary = closeBoundary || placementClipCloseBoundary(placement);
  }
  if (!polygons.length) return null;
  return { polygons, margin: margin + extraMargin, closeBoundary };
}

function boundsOverlap(first, second, tolerance = 0.001) {
  if (!first || !second) return false;
  return !(
    first.maxX <= second.minX + tolerance ||
    first.minX >= second.maxX - tolerance ||
    first.maxY <= second.minY + tolerance ||
    first.minY >= second.maxY - tolerance
  );
}

function polygonsBounds(polygons) {
  const bounds = emptyBounds();
  for (const polygon of polygons || []) {
    for (const point of polygon) includePoint(bounds, point);
  }
  return boundsReady(bounds) ? bounds : null;
}

function patternBoundsInsideRegion(pattern, region) {
  return patternCorners(pattern).every((point) => clipRegionContains(point, region));
}

function patternBoundsCrossesRegion(pattern, region) {
  const regionBounds = polygonsBounds(region?.polygons || []);
  const bounds = patternBounds(pattern);
  if (!regionBounds || !bounds || !boundsOverlap(bounds, regionBounds)) return false;
  return !patternBoundsInsideRegion(pattern, region);
}

function patternBoundaryIssue(pattern, activePlacements) {
  if (!pattern || patternOperation(pattern) === "ignore") return null;
  if (pattern.parentId) {
    const placement = placementById(pattern.parentId);
    if (!placement) {
      return {
        level: "critical",
        title: "Desenin bağlı olduğu DXF parçası yok",
        body: `${pattern.name || "Desen"} artık mevcut olmayan bir parçaya bağlı. G-code üretilemez.`,
        action: "Deseni seç",
        target: "pattern-boundary",
        patternId: pattern.id,
      };
    }
    const polygons = closedPolygonsForPlacement(placement);
    if (!polygons.length) {
      return {
        level: "critical",
        title: "Bağlı DXF parçasında kapalı sınır yok",
        body: `${pattern.name || "Desen"} kapalı sınırı olmayan bir parçaya bağlı. Güvenli kırpma yapılamaz.`,
        action: "Deseni seç",
        target: "pattern-boundary",
        patternId: pattern.id,
      };
    }
    const region = patternClipRegion(pattern) || { polygons, margin: Math.max(0, Number(pattern.clipMargin) || 0) };
    if (patternBoundsCrossesRegion(pattern, region)) {
      return {
        level: "warning",
        title: "Desen parça sınırında kırpılacak",
        body: `${pattern.name || "Desen"} bağlı DXF sınırını veya parça iç payını aşıyor. Dışta kalan geometri G-code'a dahil edilmeyecek.`,
        action: "Deseni seç",
        target: "pattern-boundary",
        patternId: pattern.id,
      };
    }
    return null;
  }

  for (const item of activePlacements || []) {
    const polygons = closedPolygonsForPlacement(item.placement);
    if (!polygons.length) continue;
    const region = { polygons, margin: placementClipMargin(item.placement), closeBoundary: placementClipCloseBoundary(item.placement) || Boolean(pattern.clipCloseBoundary) };
    if (patternBoundsCrossesRegion(pattern, region)) {
      return {
        level: "warning",
        title: "Bağımsız desen parça sınırında kırpılacak",
        body: `${pattern.name || "Desen"} bir DXF parçasına denk geliyor ve sınırı aşıyor. Dışta kalan geometri G-code'a dahil edilmeyecek.`,
        action: "Deseni seç",
        target: "pattern-boundary",
        patternId: pattern.id,
      };
    }
  }
  return null;
}

function pointToPolygonsDistance(point, polygons) {
  let best = Infinity;
  for (const polygon of polygons || []) {
    for (let index = 0; index < polygon.length; index += 1) {
      best = Math.min(best, distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length]));
    }
  }
  return best;
}

function clipRegionContains(point, region) {
  if (!region?.polygons?.length) return true;
  let inside = false;
  for (const polygon of region.polygons) {
    if (pointInPolygon(point, polygon)) inside = !inside;
  }
  if (!inside) return false;
  return region.margin <= 0 || pointToPolygonsDistance(point, region.polygons) >= region.margin;
}

function clipSegmentToRegion(start, end, region, step = 0.25) {
  if (!region?.polygons?.length) return [[start, end]];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length <= 1e-9) return [];
  const divisions = Math.max(1, Math.ceil(length / Math.max(0.05, step)));
  const pointAt = (t) => ({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  const boundaryBetween = (insideT, outsideT) => {
    let low = insideT;
    let high = outsideT;
    for (let index = 0; index < 18; index += 1) {
      const mid = (low + high) / 2;
      if (clipRegionContains(pointAt(mid), region)) low = mid;
      else high = mid;
    }
    return pointAt(low);
  };
  const result = [];
  let currentStart = null;
  let previousT = 0;
  let previousPoint = pointAt(previousT);
  let previousInside = clipRegionContains(previousPoint, region);
  if (previousInside) currentStart = previousPoint;

  for (let index = 1; index <= divisions; index += 1) {
    const currentT = index / divisions;
    const currentPoint = pointAt(currentT);
    const currentInside = clipRegionContains(currentPoint, region);
    if (previousInside && !currentInside) {
      const boundary = boundaryBetween(previousT, currentT);
      if (currentStart && Math.hypot(boundary.x - currentStart.x, boundary.y - currentStart.y) >= 0.03) result.push([currentStart, boundary]);
      currentStart = null;
    } else if (!previousInside && currentInside) {
      currentStart = boundaryBetween(currentT, previousT);
    }
    previousT = currentT;
    previousPoint = currentPoint;
    previousInside = currentInside;
  }
  if (currentStart && previousInside && Math.hypot(previousPoint.x - currentStart.x, previousPoint.y - currentStart.y) >= 0.03) {
    result.push([currentStart, previousPoint]);
  }
  return result;
}

function boundaryProjection(point, polygon) {
  let bestDistance = Infinity;
  let bestIndex = 0;
  let bestT = 0;
  let bestPoint = polygon[0];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq <= 1e-12 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
    const projected = { x: start.x + dx * t, y: start.y + dy * t };
    const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
      bestT = t;
      bestPoint = projected;
    }
  }
  return { distance: bestDistance, index: bestIndex, t: bestT, point: bestPoint };
}

function polygonBoundaryRoute(start, end, polygon, forward) {
  const startProjection = boundaryProjection(start, polygon);
  const endProjection = boundaryProjection(end, polygon);
  if (startProjection.index === endProjection.index) return [start, end];
  const route = [start];
  const count = polygon.length;
  let index = forward ? (startProjection.index + 1) % count : startProjection.index;
  let guard = 0;
  while (guard <= count) {
    const vertex = polygon[index];
    if (Math.hypot(route[route.length - 1].x - vertex.x, route[route.length - 1].y - vertex.y) > 0.03) route.push(vertex);
    if ((forward && index === endProjection.index) || (!forward && index === (endProjection.index + 1) % count)) break;
    index = forward ? (index + 1) % count : (index - 1 + count) % count;
    guard += 1;
  }
  if (Math.hypot(route[route.length - 1].x - end.x, route[route.length - 1].y - end.y) > 0.03) route.push(end);
  return route;
}

function lineIntersection(a1, a2, b1, b2) {
  const ax = a2.x - a1.x;
  const ay = a2.y - a1.y;
  const bx = b2.x - b1.x;
  const by = b2.y - b1.y;
  const denom = ax * by - ay * bx;
  if (Math.abs(denom) <= 1e-9) return null;
  const cx = b1.x - a1.x;
  const cy = b1.y - a1.y;
  const t = (cx * by - cy * bx) / denom;
  return { x: a1.x + ax * t, y: a1.y + ay * t };
}

function insetPolygonForMargin(polygon, margin) {
  margin = Math.max(0, Number(margin) || 0);
  if (margin <= 1e-9 || !polygon || polygon.length < 3) return polygon;
  const area = pathArea(polygon);
  if (Math.abs(area) <= 1e-9) return polygon;
  const sign = area > 0 ? 1 : -1;
  const shiftedEdges = polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const normal = length <= 1e-9 ? { x: 0, y: 0 } : { x: (-dy / length) * sign, y: (dx / length) * sign };
    return {
      start: { x: start.x + normal.x * margin, y: start.y + normal.y * margin },
      end: { x: end.x + normal.x * margin, y: end.y + normal.y * margin },
      normal,
    };
  });
  const inset = [];
  for (let index = 0; index < shiftedEdges.length; index += 1) {
    const previous = shiftedEdges[(index - 1 + shiftedEdges.length) % shiftedEdges.length];
    const current = shiftedEdges[index];
    let point = lineIntersection(previous.start, previous.end, current.start, current.end);
    if (!point) {
      const vertex = polygon[index];
      const normal = { x: previous.normal.x + current.normal.x, y: previous.normal.y + current.normal.y };
      const normalLength = Math.hypot(normal.x, normal.y);
      point =
        normalLength > 1e-9
          ? { x: vertex.x + (normal.x / normalLength) * margin, y: vertex.y + (normal.y / normalLength) * margin }
          : current.start;
    }
    if (!inset.length || Math.hypot(inset[inset.length - 1].x - point.x, inset[inset.length - 1].y - point.y) > 0.03) inset.push(point);
  }
  return inset.length >= 3 && Math.abs(pathArea(inset)) >= 0.05 ? inset : polygon;
}

function polylineWorldLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length;
}

function clipBoundaryConnector(start, end, region) {
  let bestRoute = null;
  let bestScore = Infinity;
  const margin = Math.max(0, Number(region?.margin) || 0);
  const projectionLimit = Math.max(1, margin * 0.35 + 0.5);
  for (const polygon of region?.polygons || []) {
    if (polygon.length < 3) continue;
    const routePolygon = insetPolygonForMargin(polygon, margin);
    const startDistance = boundaryProjection(start, routePolygon).distance;
    const endDistance = boundaryProjection(end, routePolygon).distance;
    if (startDistance > projectionLimit || endDistance > projectionLimit) continue;
    for (const forward of [true, false]) {
      const route = polygonBoundaryRoute(start, end, routePolygon, forward);
      const score = polylineWorldLength(route) + startDistance + endDistance;
      if (score < bestScore) {
        bestScore = score;
        bestRoute = route;
      }
    }
  }
  return bestRoute || [start, end];
}

function closeClippedPolyline(points, region) {
  if (points.length < 2 || Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) <= 0.03) return points;
  const connector = clipBoundaryConnector(points[points.length - 1], points[0], region);
  return points.concat(connector.slice(1));
}

function clipPolylineToRegion(points, region, step = 0.25, closeBoundary = false, closedSource = false) {
  if (!region?.polygons?.length) return points.length >= 2 ? [points] : [];
  const clipped = [];
  let current = [];
  for (let index = 1; index < points.length; index += 1) {
    for (const [start, end] of clipSegmentToRegion(points[index - 1], points[index], region, step)) {
      if (current.length && Math.hypot(current[current.length - 1].x - start.x, current[current.length - 1].y - start.y) <= Math.max(0.05, step * 1.25)) {
        current.push(end);
      } else {
        if (current.length >= 2) clipped.push(current);
        current = [start, end];
      }
    }
  }
  if (current.length >= 2) clipped.push(current);
  if (
    closedSource &&
    clipped.length > 1 &&
    Math.hypot(clipped[clipped.length - 1][clipped[clipped.length - 1].length - 1].x - clipped[0][0].x, clipped[clipped.length - 1][clipped[clipped.length - 1].length - 1].y - clipped[0][0].y) <=
      Math.max(0.05, step * 1.25)
  ) {
    const first = clipped.shift();
    clipped[clipped.length - 1].push(...first.slice(1));
  }
  return closeBoundary ? clipped.map((path) => closeClippedPolyline(path, region)) : clipped;
}

function drawCanvasClipPath(region) {
  ctx.beginPath();
  for (const polygon of region?.polygons || []) {
    polygon.forEach((world, index) => {
      const screen = worldToScreen(world);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();
  }
}

function applyCanvasClipRegion(region) {
  if (!region?.polygons?.length) return false;
  drawCanvasClipPath(region);
  try {
    ctx.clip("evenodd");
  } catch (_error) {
    ctx.clip();
  }
  return true;
}

function eraseClipMarginBand(region) {
  if (!region?.polygons?.length || region.margin <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, region.margin * 2 * state.view.scale);
  for (const polygon of region.polygons) {
    ctx.beginPath();
    polygon.forEach((world, index) => {
      const screen = worldToScreen(world);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawWithPatternClip(pattern, drawContent) {
  const region = patternClipRegion(pattern);
  if (!region) {
    drawContent();
    return null;
  }
  ctx.save();
  applyCanvasClipRegion(region);
  drawContent();
  eraseClipMarginBand(region);
  ctx.restore();
  return region;
}

function drawPatternBitmap(pattern, alpha) {
  const image = state.images.get(pattern.id);
  const center = worldToScreen({ x: pattern.x + pattern.width / 2, y: pattern.y + pattern.height / 2 });
  const width = pattern.width * state.view.scale;
  const height = pattern.height * state.view.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((-pattern.rotation * Math.PI) / 180);
  ctx.scale(pattern.mirrorX ? -1 : 1, pattern.mirrorY ? -1 : 1);
  ctx.globalAlpha = alpha;
  if (image && image.complete) {
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    ctx.fillStyle = cssAlpha("--travel", 0.18, "#A855F7");
    ctx.fillRect(-width / 2, -height / 2, width, height);
  }
  ctx.restore();
}

function worldToScreen(point) {
  const { scale, offsetX, offsetY } = state.view;
  const b = bed();
  return {
    x: offsetX + point.x * scale,
    y: offsetY + (b.height - point.y) * scale,
  };
}

function screenToWorld(point) {
  const { scale, offsetX, offsetY } = state.view;
  const b = bed();
  return {
    x: (point.x - offsetX) / scale,
    y: b.height - (point.y - offsetY) / scale,
  };
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.view.width = rect.width;
  state.view.height = rect.height;
  draw();
}

function computeView() {
  const b = bed();
  const pad = 34;
  const fitScale = Math.min((state.view.width - pad * 2) / b.width, (state.view.height - pad * 2) / b.height);
  state.view.scale = Math.max(0.01, fitScale * state.view.zoom);
  state.view.offsetX = (state.view.width - b.width * state.view.scale) / 2 + state.view.panX;
  state.view.offsetY = (state.view.height - b.height * state.view.scale) / 2 + state.view.panY;
  const grid = niceGridStep(22 / Math.max(0.001, state.view.scale));
  refs.readout.textContent = `${b.width.toFixed(0)} × ${b.height.toFixed(0)} mm  |  ${Math.round(state.view.zoom * 100)}%`;
  if (refs.safetyReadout) {
    const cursor = state.cursor
      ? `X ${state.cursor.x.toFixed(1)} mm, Y ${state.cursor.y.toFixed(1)} mm`
      : "-";
    refs.safetyReadout.textContent = `Grid: ${grid.toFixed(grid < 10 ? 1 : 0)} mm · Zoom: ${Math.round(state.view.zoom * 100)}% · İmleç: ${cursor}`;
  }
}

function fitView() {
  state.view.zoom = 1;
  state.view.panX = 0;
  state.view.panY = 0;
  draw();
}

function alignJobToBed(showStatus = true) {
  const bounds = jobBounds();
  if (!bounds) {
    if (showStatus) setStatus("Hizalanacak iş yok.");
    return;
  }
  const b = bed();
  const margin = Math.max(0, mm("margin", 1));
  const size = boundsSize(bounds);
  const mode = refs.bedAlignMode?.value || "bottom-left";
  let targetX = margin;
  let targetY = margin;
  if (mode.includes("center")) targetX = (b.width - size.width) / 2;
  if (mode.includes("right")) targetX = b.width - margin - size.width;
  if (mode === "center") targetY = (b.height - size.height) / 2;
  else if (mode.includes("top")) targetY = b.height - margin - size.height;
  else targetY = margin;
  const dx = targetX - bounds.minX;
  const dy = targetY - bounds.minY;
  if (showStatus && (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001)) pushUndo("Isi hizala");
  moveAll(dx, dy);
  markManualLayout();
  draw();
  updateSelectionPanel();
  if (showStatus) setStatus(`İş ${modeLabel(mode)} hizasına taşındı.`);
}

function modeLabel(mode) {
  return (
    {
      "bottom-left": "sol alt",
      "bottom-center": "alt orta",
      center: "tam orta",
      "top-left": "sol üst",
    }[mode] || mode
  );
}

function applyJobOffset() {
  const dx = Number(refs.jobOffsetX?.value) || 0;
  const dy = Number(refs.jobOffsetY?.value) || 0;
  if (!jobBounds()) {
    setStatus("Kaydırılacak iş yok.");
    return;
  }
  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) pushUndo("Isi kaydir");
  moveAll(dx, dy);
  markManualLayout();
  draw();
  updateSelectionPanel();
  setStatus(`Tüm iş kaydırıldı: X ${dx.toFixed(2)} mm, Y ${dy.toFixed(2)} mm.`);
}

function zoomView(factor, screenPoint = null) {
  const point = screenPoint || { x: state.view.width / 2, y: state.view.height / 2 };
  const before = screenToWorld(point);
  state.view.zoom = clamp(state.view.zoom * factor, 0.25, 16);
  computeView();
  const after = worldToScreen(before);
  state.view.panX += point.x - after.x;
  state.view.panY += point.y - after.y;
  draw();
}

function niceGridStep(targetMm) {
  const base = Math.pow(10, Math.floor(Math.log10(Math.max(1, targetMm))));
  for (const multiplier of [1, 2, 5, 10]) {
    const step = base * multiplier;
    if (step >= targetMm) return step;
  }
  return base * 10;
}

function materialAreaGridStep() {
  return niceGridStep(22 / Math.max(0.001, state.view.scale));
}

function snapMaterialAreaPoint(world) {
  const step = materialAreaGridStep();
  const snapped = {
    x: Math.round((Number(world.x) || 0) / step) * step,
    y: Math.round((Number(world.y) || 0) / step) * step,
  };
  return clampPointToBed(snapped);
}

function axisConstrainedMaterialAreaPoint(world) {
  const snapped = snapMaterialAreaPoint(world);
  const points = materialAreaPoints();
  const previous = points[points.length - 1];
  if (!previous) return snapped;
  const dx = Math.abs(snapped.x - previous.x);
  const dy = Math.abs(snapped.y - previous.y);
  return dx >= dy ? { x: snapped.x, y: previous.y } : { x: previous.x, y: snapped.y };
}

function materialAreaSegmentIsAxisAligned(a, b) {
  return Math.abs(a.x - b.x) < 0.001 || Math.abs(a.y - b.y) < 0.001;
}

function materialAreaCanClose(points = materialAreaPoints()) {
  if (points.length < 4 || worldPolygonArea(points) < 1) return false;
  for (let index = 1; index < points.length; index += 1) {
    if (!materialAreaSegmentIsAxisAligned(points[index - 1], points[index])) return false;
  }
  return materialAreaSegmentIsAxisAligned(points[points.length - 1], points[0]);
}

function materialAreaPreviewDistance() {
  const points = materialAreaPoints();
  const previous = points[points.length - 1];
  const preview = state.materialArea.previewPoint;
  if (!previous || !preview) return null;
  const mmValue = Math.hypot(preview.x - previous.x, preview.y - previous.y);
  return { mm: mmValue, cm: mmValue / 10 };
}

function crisp(value) {
  return Math.round(value) + 0.5;
}

function drawMaterialAreaOverlay() {
  const points = materialAreaPoints();
  if (!points.length && !state.materialArea.drawing) return;
  const palette = canvasPalette();
  const pathPoints = [...points];
  if (state.materialArea.drawing && state.materialArea.previewPoint) pathPoints.push(state.materialArea.previewPoint);
  ctx.save();
  if (materialAreaCanClose(points)) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const screen = worldToScreen(point);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();
    ctx.fillStyle = palette.materialAreaFill;
    ctx.fill();
    ctx.strokeStyle = palette.materialArea;
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 5]);
    ctx.stroke();
  }
  if (pathPoints.length >= 2) {
    ctx.beginPath();
    pathPoints.forEach((point, index) => {
      const screen = worldToScreen(point);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.strokeStyle = palette.materialArea;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(state.materialArea.drawing ? [5, 5] : []);
    ctx.stroke();
  }
  if (state.materialArea.drawing && state.materialArea.previewPoint && points.length) {
    const previous = points[points.length - 1];
    const preview = state.materialArea.previewPoint;
    const start = worldToScreen(previous);
    const end = worldToScreen(preview);
    const distance = materialAreaPreviewDistance();
    ctx.setLineDash([]);
    ctx.strokeStyle = palette.selection;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = palette.selection;
    ctx.fill();
    if (distance) {
      const label = `${distance.cm.toFixed(1)} cm / ${distance.mm.toFixed(0)} mm`;
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      ctx.font = "800 13px Segoe UI";
      const metrics = ctx.measureText(label);
      const boxX = midX + 10;
      const boxY = midY - 30;
      ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
      ctx.strokeStyle = palette.selection;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, metrics.width + 16, 25, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette.text;
      ctx.fillText(label, boxX + 8, boxY + 17);
    }
  }
  points.forEach((point, index) => {
    const screen = worldToScreen(point);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, index === 0 ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? palette.selection : palette.panel;
    ctx.fill();
    ctx.strokeStyle = palette.materialArea;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });
  if (state.materialArea.drawing && points.length) {
    const first = worldToScreen(points[0]);
    ctx.fillStyle = palette.materialArea;
    ctx.font = "700 12px Segoe UI";
    ctx.fillText("Grid noktasına tıkla / yatay-dikey çiz / kapatmak için ilk noktaya dön", first.x + 8, first.y - 8);
  }
  ctx.restore();
}

function drawGrid() {
  const b = bed();
  const margin = Math.max(0, mm("margin", 1));
  const palette = canvasPalette();
  ctx.fillStyle = palette.canvas;
  ctx.fillRect(0, 0, state.view.width, state.view.height);

  const bottomLeft = worldToScreen({ x: 0, y: 0 });
  const topLeft = worldToScreen({ x: 0, y: b.height });
  const bottomRight = worldToScreen({ x: b.width, y: 0 });
  const topRight = worldToScreen({ x: b.width, y: b.height });

  const minorStep = niceGridStep(22 / Math.max(0.001, state.view.scale));
  const majorStep = minorStep * 5;
  const minWorld = screenToWorld({ x: 0, y: state.view.height });
  const maxWorld = screenToWorld({ x: state.view.width, y: 0 });
  const startX = Math.floor(minWorld.x / minorStep) * minorStep;
  const endX = Math.ceil(maxWorld.x / minorStep) * minorStep;
  const startY = Math.floor(minWorld.y / minorStep) * minorStep;
  const endY = Math.ceil(maxWorld.y / minorStep) * minorStep;

  ctx.fillStyle = palette.bed;
  ctx.fillRect(topLeft.x, topLeft.y, b.width * state.view.scale, b.height * state.view.scale);

  ctx.lineWidth = 1;
  for (let x = startX; x <= endX + 0.001; x += minorStep) {
    const sx = crisp(worldToScreen({ x, y: 0 }).x);
    const isMajor = Math.abs(x / majorStep - Math.round(x / majorStep)) < 0.001;
    ctx.strokeStyle = isMajor ? palette.gridLarge : palette.gridSmall;
    ctx.beginPath();
    ctx.moveTo(sx, topLeft.y);
    ctx.lineTo(sx, bottomLeft.y);
    ctx.stroke();
  }
  for (let y = startY; y <= endY + 0.001; y += minorStep) {
    const sy = crisp(worldToScreen({ x: 0, y }).y);
    const isMajor = Math.abs(y / majorStep - Math.round(y / majorStep)) < 0.001;
    ctx.strokeStyle = isMajor ? palette.gridLarge : palette.gridSmall;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, sy);
    ctx.lineTo(topRight.x, sy);
    ctx.stroke();
  }

  ctx.strokeStyle = palette.bedBorder;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(topLeft.x, topLeft.y, b.width * state.view.scale, b.height * state.view.scale);

  if (margin > 0 && margin * 2 < b.width && margin * 2 < b.height) {
    const marginTopLeft = worldToScreen({ x: margin, y: b.height - margin });
    const marginBottomRight = worldToScreen({ x: b.width - margin, y: margin });
    ctx.strokeStyle = palette.marginLine;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(
      marginTopLeft.x,
      marginTopLeft.y,
      marginBottomRight.x - marginTopLeft.x,
      marginBottomRight.y - marginTopLeft.y
    );
    ctx.setLineDash([]);
  }

  drawMaterialAreaOverlay();

  const shelfY = worldToScreen({ x: 0, y: -majorStep }).y;
  if (shelfY < state.view.height - 18) {
    ctx.fillStyle = palette.warningBg;
    ctx.fillRect(0, shelfY, state.view.width, state.view.height - shelfY);
    ctx.fillStyle = palette.outside;
    ctx.font = "700 12px Segoe UI";
    ctx.fillText("Tabla dışında kalanlar - G-code oluşturulamaz", Math.max(12, topLeft.x), shelfY + 18);
  }

  ctx.fillStyle = palette.ruler;
  ctx.font = "12px Segoe UI";
  ctx.fillText("0,0", bottomLeft.x + 8, bottomLeft.y - 8);
  ctx.fillText(`${b.width.toFixed(0)} mm`, bottomRight.x - 62, bottomRight.y - 8);
  ctx.fillText(`${b.height.toFixed(0)} mm`, topLeft.x + 8, topLeft.y + 16);
  ctx.fillStyle = palette.origin;
  ctx.beginPath();
  ctx.arc(bottomLeft.x, bottomLeft.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlacements() {
  const bedSize = bed();
  const margin = Math.max(0, mm("margin", 1));
  const palette = canvasPalette();
  for (const placement of state.placements) {
    const part = partById(placement.partId);
    if (!part) continue;
    const size = placementSize(placement);
    const operation = placementOperation(placement);
    const ignored = operation === "ignore";
    const outside = !rectFitsActiveArea(placementBounds(placement), bedSize, margin);
    const a = worldToScreen({ x: placement.x, y: placement.y });
    const screenB = worldToScreen({ x: placement.x + size.width, y: placement.y + size.height });
    ctx.save();
    ctx.globalAlpha = ignored ? 0.38 : outside ? 0.72 : 1;
    ctx.strokeStyle = selectedIs("placement", placement.id) ? palette.selection : outside ? palette.outside : palette.bedBorder;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(a.x, screenB.y, screenB.x - a.x, a.y - screenB.y);
    if (outside) {
      ctx.fillStyle = palette.outsideSoft;
      ctx.fillRect(a.x, screenB.y, screenB.x - a.x, a.y - screenB.y);
    }
    ctx.restore();

    const largeArea = part.width * part.height * 0.25;
    for (const path of part.paths) {
      if (!path || path.length < 2) continue;
      ctx.beginPath();
      path.forEach((point, index) => {
        const world = transformPartPoint(point, placement);
        const screen = worldToScreen(world);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      if (ignored) {
        ctx.strokeStyle = palette.ignored;
        ctx.setLineDash([7, 4]);
      } else if (operation === "cut") {
        ctx.strokeStyle = palette.cut;
        ctx.setLineDash([]);
      } else if (operation === "engrave_fill" && Math.abs(pathArea(path)) > largeArea) {
        ctx.strokeStyle = palette.engraveFill;
        ctx.setLineDash([2, 3]);
      } else {
        ctx.strokeStyle = palette.engraveLine;
        ctx.setLineDash([]);
      }
      ctx.lineWidth = operation === "cut" ? 1.8 : operation === "engrave_fill" ? 1.3 : 1.2;
      ctx.globalAlpha = ignored ? 0.42 : outside ? 0.62 : 1;
      ctx.stroke();
    }
    drawPlacementCenterGuides(placement, size);
  }
}

function drawPlacementCenterGuides(placement, size) {
  const palette = canvasPalette();
  const center = placementCenter(placement);
  const verticalStart = worldToScreen({ x: center.x, y: placement.y });
  const verticalEnd = worldToScreen({ x: center.x, y: placement.y + size.height });
  const horizontalStart = worldToScreen({ x: placement.x, y: center.y });
  const horizontalEnd = worldToScreen({ x: placement.x + size.width, y: center.y });
  ctx.save();
  ctx.strokeStyle = selectedIs("placement", placement.id) ? palette.selection : colorWithAlpha(palette.selection, 0.55);
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(verticalStart.x, verticalStart.y);
  ctx.lineTo(verticalEnd.x, verticalEnd.y);
  ctx.moveTo(horizontalStart.x, horizontalStart.y);
  ctx.lineTo(horizontalEnd.x, horizontalEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colorWithAlpha(palette.selection, 0.78);
  ctx.font = "11px Segoe UI";
  ctx.fillText("X", horizontalEnd.x - 12, horizontalEnd.y - 5);
  ctx.fillText("Y", verticalEnd.x + 5, verticalEnd.y + 14);
  ctx.restore();
}

function drawPatterns() {
  for (const pattern of state.patterns) {
    const ignored = patternOperation(pattern) === "ignore";
    ctx.save();
    if (ignored) ctx.globalAlpha = 0.38;
    if (vectorPatternHasPaths(pattern)) {
      drawVectorPattern(pattern);
    } else {
      if (patternClipRegion(pattern)) {
        drawPatternBitmap(pattern, pattern.kind === "svg" ? 0.16 : 0.12);
      }
      drawWithPatternClip(pattern, () => {
        drawPatternBitmap(pattern, pattern.kind === "svg" ? 1 : 0.7);
      });
    }

    if (selectedIs("pattern", pattern.id)) {
      drawPatternSelectionOutline(pattern, state.selected?.type === "pattern" && state.selected.id === pattern.id);
    }
    ctx.restore();
  }
}

function drawPatternSelectionOutline(pattern, active = false) {
  const palette = canvasPalette();
  const corners = patternCorners(pattern).map(worldToScreen);
  ctx.save();
  ctx.beginPath();
  corners.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.strokeStyle = active ? palette.selection : colorWithAlpha(palette.selection, 0.76);
  ctx.lineWidth = active ? 2.4 : 1.6;
  ctx.setLineDash([7, 4]);
  ctx.stroke();
  ctx.restore();
}

function drawVectorFillShape(pattern, alpha = 1) {
  const palette = canvasPalette();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  if (vectorPatternFillInvert(pattern)) {
    const corners = patternCorners(pattern).map(worldToScreen);
    corners.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
  }
  for (const vectorPath of pattern.vectorPaths || []) {
    if (!vectorPathIsActive(vectorPath, pattern) || vectorPathOperation(vectorPath, pattern) !== "engrave_fill" || !vectorPath.closed) continue;
    const points = vectorWorldPath(pattern, vectorPath).map(worldToScreen);
    if (points.length < 3) continue;
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
  }
  ctx.fillStyle = colorWithAlpha(palette.engraveFill, 0.58);
  ctx.fill("evenodd");
  ctx.setLineDash([]);
  ctx.restore();
}

function strokeWorldPolyline(points, strokeStyle, lineWidth, alpha = 1) {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  points.map(worldToScreen).forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

function drawVectorGhostStrokes(pattern, filledPreview) {
  const palette = canvasPalette();
  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed) continue;
    const operation = vectorPathOperation(vectorPath, pattern);
    const selectedPath =
      state.selected?.type === "vectorPath" &&
      state.selected.id === pattern.id &&
      state.selected.pathId === vectorPath.id;
    if (filledPreview && operation === "engrave_fill" && vectorPath.closed && !selectedPath) continue;
    const worldPoints = vectorWorldPath(pattern, vectorPath);
    if (vectorPath.closed && worldPoints.length > 1) worldPoints.push(worldPoints[0]);
    const strokeStyle =
      selectedPath
        ? palette.selection
        : operation === "cut"
          ? palette.cut
          : operation === "ignore"
            ? palette.ignored
            : operation === "engrave_fill"
              ? palette.engraveFill
              : palette.engraveLine;
    strokeWorldPolyline(worldPoints, strokeStyle, selectedPath ? 1.6 : 1.0, selectedPath ? 0.24 : operation === "ignore" ? 0.2 : 0.16);
  }
}

function drawVectorPattern(pattern) {
  const palette = canvasPalette();
  const clipRegion = patternClipRegion(pattern);
  const filledPreview = vectorPatternFilledPreview(pattern);
  const preview = state.images.get(pattern.id);
  if (preview && preview.complete) {
    if (clipRegion) drawPatternBitmap(pattern, filledPreview ? 0.012 : 0.06);
    drawWithPatternClip(pattern, () => {
      drawPatternBitmap(pattern, filledPreview ? 0.04 : 0.18);
    });
  }

  if (filledPreview) {
    if (clipRegion) drawVectorFillShape(pattern, 0.16);
    drawWithPatternClip(pattern, () => {
      drawVectorFillShape(pattern, 1);
    });
  }

  if (clipRegion) drawVectorGhostStrokes(pattern, filledPreview);

  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed) continue;
    const operation = vectorPathOperation(vectorPath, pattern);
    const worldPoints = vectorWorldPath(pattern, vectorPath);
    const closedSource = Boolean(vectorPath.closed);
    if (closedSource && worldPoints.length > 1) worldPoints.push(worldPoints[0]);
    const clippedPaths = clipPolylineToRegion(
      worldPoints,
      clipRegion,
      0.25,
      Boolean(clipRegion?.closeBoundary) && closedSource,
      closedSource,
    );
    const selectedPath =
      state.selected?.type === "vectorPath" &&
      state.selected.id === pattern.id &&
      state.selected.pathId === vectorPath.id;
    if (filledPreview && operation === "engrave_fill" && vectorPath.closed && !selectedPath) continue;
    for (const clipped of clippedPaths) {
      const points = clipped.map(worldToScreen);
      if (points.length < 2) continue;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle =
        selectedPath
          ? palette.selection
          : operation === "cut"
            ? palette.cut
            : operation === "ignore"
              ? palette.ignored
              : operation === "engrave_fill"
                ? palette.engraveFill
                : palette.engraveLine;
      ctx.lineWidth = selectedPath ? 2.6 : operation === "cut" ? 1.6 : 1.4;
      ctx.setLineDash(operation === "ignore" ? [6, 4] : []);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}

function drawSelectedPatternHandles() {
  if (state.selected?.type === "pattern") {
    const pattern = selectedPattern();
    if (pattern) drawPatternHandles(pattern);
  }
}

function drawPatternHandles(pattern) {
  const palette = canvasPalette();
  const handles = patternHandles(pattern);
  for (const handle of handles) {
    ctx.beginPath();
    if (handle.type === "rotate") {
      ctx.arc(handle.screen.x, handle.screen.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = palette.outside;
    } else {
      ctx.rect(handle.screen.x - 5, handle.screen.y - 5, 10, 10);
      ctx.fillStyle = palette.panel;
    }
    ctx.fill();
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function vectorPatternFilledPreview(pattern) {
  if (!vectorPatternHasPaths(pattern)) return false;
  return (pattern.vectorPaths || []).some((item) => vectorPathIsActive(item, pattern) && vectorPathOperation(item, pattern) === "engrave_fill" && vectorPathSupportsFill(item));
}

function vectorEngraveMode(pattern) {
  return pattern?.vectorEngraveMode === "fill" ? "fill" : "contour";
}

function vectorCanFillEngrave(pattern) {
  if (!vectorPatternHasPaths(pattern)) return false;
  return (pattern.vectorPaths || []).some((item) => !item.removed && vectorPathSupportsFill(item));
}

function vectorPatternFillInvert(pattern) {
  return Boolean(pattern?.vectorStats?.filledTraceInvert);
}

function draw() {
  computeView();
  ctx.clearRect(0, 0, state.view.width, state.view.height);
  drawGrid();
  drawPatterns();
  drawPlacements();
  drawSelectedPatternHandles();
  scheduleJobAnalysis(state.drag ? 180 : 80);
}

function selectionKey(item) {
  return `${item.type}:${item.id}`;
}

function uniqueSelectionItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    if (!item || item.type !== "pattern" || !patternById(item.id)) continue;
    const key = selectionKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type: item.type, id: item.id });
  }
  return result;
}

function selectedPatternObjects() {
  let items = uniqueSelectionItems(state.selectedItems);
  if (!items.length && (state.selected?.type === "pattern" || state.selected?.type === "vectorPath")) {
    items = uniqueSelectionItems([{ type: "pattern", id: state.selected.id }]);
  }
  return items.map((item) => patternById(item.id)).filter(Boolean);
}

function selectedIs(type, id) {
  return (
    (state.selected && state.selected.type === type && state.selected.id === id) ||
    state.selectedItems.some((item) => item.type === type && item.id === id)
  );
}

function selectedVectorPath() {
  if (state.selected?.type !== "vectorPath") return null;
  const pattern = patternById(state.selected.id);
  if (!pattern) return null;
  const vectorPath = (pattern.vectorPaths || []).find((item) => item.id === state.selected.pathId);
  return vectorPath ? { pattern, vectorPath } : null;
}

function selectedVectorPattern() {
  if (state.selected?.type === "vectorPath") {
    const pattern = patternById(state.selected.id);
    return vectorPatternHasPaths(pattern) ? pattern : null;
  }
  const pattern = selectedPattern();
  return vectorPatternHasPaths(pattern) ? pattern : null;
}

function isVectorLikePattern(pattern) {
  return pattern?.kind === "svg" || pattern?.kind === "vector";
}

function vectorPatternHasPaths(pattern) {
  return isVectorLikePattern(pattern) && (pattern.vectorPaths || []).length > 0;
}

const autoCutInnerPathCache = new WeakMap();

function sourcePointInPolygon(point, polygon) {
  let inside = false;
  let previous = polygon[polygon.length - 1];
  for (const current of polygon) {
    if ((current.y > point.y) !== (previous.y > point.y)) {
      const x = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y + 1e-12) + current.x;
      if (point.x < x) inside = !inside;
    }
    previous = current;
  }
  return inside;
}

function sourceBounds(points) {
  const bounds = emptyBounds();
  for (const point of points || []) includePoint(bounds, point);
  return boundsReady(bounds) ? bounds : null;
}

function sourcePolygonArea(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

function sourceDistanceToPolyline(point, points) {
  return distanceToPolyline(point, points, true);
}

function median(values) {
  if (!values.length) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function cutInnerPathSignature(pattern) {
  return (pattern.vectorPaths || [])
    .map((path, index) => {
      const bbox = path.bbox || [];
      const points = path.points || [];
      const first = points[0] || [];
      const last = points[points.length - 1] || [];
      return [
        index,
        path.id || "",
        path.removed ? 1 : 0,
        path.closed ? 1 : 0,
        path.operation || "",
        points.length,
        bbox.join(","),
        first.join(","),
        last.join(","),
      ].join(":");
    })
    .join("|");
}

function shouldAutoIgnoreInnerCutPath(candidate, parent) {
  if (!candidate || !parent || candidate.area <= 0 || parent.area <= candidate.area) return false;
  const parentSize = boundsSize(parent.bounds);
  const candidateSize = boundsSize(candidate.bounds);
  if (parentSize.width <= 0 || parentSize.height <= 0 || candidateSize.width <= 0 || candidateSize.height <= 0) return false;
  const widthRatio = candidateSize.width / parentSize.width;
  const heightRatio = candidateSize.height / parentSize.height;
  const areaRatio = candidate.area / parent.area;
  if (widthRatio < 0.52 || heightRatio < 0.52 || areaRatio < 0.28 || areaRatio > 0.97) return false;
  if (!sourcePointInPolygon(candidate.points[0], parent.points)) return false;
  const sampleStep = Math.max(1, Math.floor(candidate.points.length / 24));
  const distances = [];
  for (let index = 0; index < candidate.points.length; index += sampleStep) {
    distances.push(sourceDistanceToPolyline(candidate.points[index], parent.points));
  }
  const closeOffset = median(distances);
  const closeLimit = Math.max(0.75, Math.min(6, Math.min(candidateSize.width, candidateSize.height) * 0.12));
  return closeOffset <= closeLimit;
}

function autoIgnoredCutInnerPaths(pattern) {
  if (!vectorPatternHasPaths(pattern) || patternOperation(pattern) !== "cut") return new Set();
  const signature = cutInnerPathSignature(pattern);
  const cached = autoCutInnerPathCache.get(pattern);
  if (cached?.signature === signature) return cached.paths;
  const entries = [];
  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed || !vectorPath.closed || baseVectorPathOperation(vectorPath, pattern) !== "cut") continue;
    const points = (vectorPath.points || []).map((point) => ({ x: Number(point[0]) || 0, y: Number(point[1]) || 0 }));
    if (points.length < 3) continue;
    if (points.length > 3) {
      const first = points[0];
      const last = points[points.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.001) points.pop();
    }
    const bounds = sourceBounds(points);
    const area = sourcePolygonArea(points);
    if (!bounds || area <= 0.5) continue;
    entries.push({ vectorPath, points, bounds, area });
  }
  const ignored = new Set();
  for (const candidate of entries) {
    for (const parent of entries) {
      if (candidate === parent || ignored.has(candidate.vectorPath)) continue;
      if (shouldAutoIgnoreInnerCutPath(candidate, parent)) ignored.add(candidate.vectorPath);
    }
  }
  autoCutInnerPathCache.set(pattern, { signature, paths: ignored });
  return ignored;
}

function normalizeOperation(value, fallback = "engrave_line") {
  const operation = String(value || fallback).toLowerCase();
  if (operation === "engrave") return "engrave_line";
  if (operation === "engrave-line") return "engrave_line";
  if (operation === "engrave-fill") return "engrave_fill";
  if (["cut", "engrave_line", "engrave_fill", "ignore"].includes(operation)) return operation;
  return fallback;
}

function patternOperation(pattern) {
  const fallback = pattern?.kind === "raster" ? "engrave_fill" : "engrave_line";
  const operation = normalizeOperation(pattern?.operation, fallback);
  if (operation === "engrave_line" && pattern?.kind === "vector" && pattern.vectorEngraveMode === "fill") {
    return "engrave_fill";
  }
  return operation;
}

function baseVectorPathOperation(vectorPath, pattern) {
  const patternOp = patternOperation(pattern);
  if (patternOp === "ignore") return "ignore";
  const rawOperation = String(vectorPath?.operation || "").toLowerCase().replace("-", "_");
  if (patternOp === "cut" && rawOperation === "engrave") return "cut";
  const operation = normalizeOperation(vectorPath?.operation, patternOp);
  return operation === "engrave_fill" && !vectorPathSupportsFill(vectorPath) ? "engrave_line" : operation;
}

function vectorPathOperation(vectorPath, pattern) {
  const operation = baseVectorPathOperation(vectorPath, pattern);
  if (operation === "cut" && autoIgnoredCutInnerPaths(pattern).has(vectorPath)) return "ignore";
  return operation;
}

function vectorPathSupportsFill(vectorPath) {
  return Boolean(vectorPath?.closed) && (vectorPath.points || []).length >= 3;
}

function vectorPathIsActive(vectorPath, pattern) {
  return Boolean(vectorPath) && !vectorPath.removed && (vectorPath.points || []).length >= 2 && vectorPathOperation(vectorPath, pattern) !== "ignore";
}

function vectorPathBounds(vectorPath) {
  const bounds = emptyBounds();
  for (const point of vectorPath?.points || []) {
    includePoint(bounds, { x: Number(point[0]) || 0, y: Number(point[1]) || 0 });
  }
  return boundsReady(bounds) ? bounds : null;
}

function scaleVectorPath(vectorPath, scaleX = 1, scaleY = 1) {
  if (!vectorPath || !(vectorPath.points || []).length) return false;
  const sx = Math.max(0.01, Number(scaleX) || 1);
  const sy = Math.max(0.01, Number(scaleY) || 1);
  const bounds = vectorPathBounds(vectorPath);
  if (!bounds) return false;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  vectorPath.points = (vectorPath.points || []).map((point) => [
    cx + (Number(point[0]) - cx) * sx,
    cy + (Number(point[1]) - cy) * sy,
  ]);
  refreshVectorPathMetrics(vectorPath);
  return true;
}

function moveVectorPathByMm(pattern, vectorPath, dxMm = 0, dyMm = 0) {
  if (!pattern || !vectorPath || !(vectorPath.points || []).length) return false;
  const sourceWidth = Math.max(0.001, pattern.sourceWidth || pattern.width);
  const sourceHeight = Math.max(0.001, pattern.sourceHeight || pattern.height);
  const localDx = Number(dxMm) || 0;
  const localDy = Number(dyMm) || 0;
  if (!localDx && !localDy) return false;
  const sourceDx = (pattern.mirrorX ? -1 : 1) * (localDx / Math.max(0.001, pattern.width)) * sourceWidth;
  const sourceDy = (pattern.mirrorY ? 1 : -1) * (localDy / Math.max(0.001, pattern.height)) * sourceHeight;
  vectorPath.points = (vectorPath.points || []).map((point) => [
    Number(point[0]) + sourceDx,
    Number(point[1]) + sourceDy,
  ]);
  refreshVectorPathMetrics(vectorPath);
  return true;
}

function placementOperation(placement) {
  return normalizeOperation(placement?.operation, "cut");
}

function operationLabel(operation) {
  return (
    {
      cut: "Kesim",
      engrave_line: "Kazıma çizgi",
      engrave_fill: "Kazıma dolgu",
      ignore: "Yok say",
    }[normalizeOperation(operation, "engrave_line")] || "Kazıma çizgi"
  );
}

function applyPatternOperation(pattern, operation) {
  const nextOperation = normalizeOperation(operation, pattern?.kind === "raster" ? "engrave_fill" : "engrave_line");
  if (!pattern) return;
  const needsPathSync =
    vectorPatternHasPaths(pattern) &&
    nextOperation !== "ignore" &&
    (pattern.vectorPaths || []).some((vectorPath) => !vectorPath.removed && baseVectorPathOperation(vectorPath, pattern) !== nextOperation);
  if (pattern.operation === nextOperation && !needsPathSync) return;
  pushUndo("Desen islemi");
  pattern.operation = nextOperation;
  if (vectorPatternHasPaths(pattern) && nextOperation !== "ignore") {
    for (const vectorPath of pattern.vectorPaths || []) {
      if (!vectorPath.removed) vectorPath.operation = nextOperation;
    }
  }
  if (pattern.operation === "cut") {
    pattern.power = clamp(Math.round(mm("cutPower", 1000)), 0, 1000);
    pattern.feed = Math.max(1, mm("cutFeed", 500));
    pattern.vectorEngraveMode = "contour";
  } else if (pattern.operation === "engrave_line" || pattern.operation === "engrave_fill") {
    pattern.power = clamp(Math.round(mm("engravePower", 250)), 0, 1000);
    pattern.feed = Math.max(1, mm("engraveFeed", 1800));
    pattern.vectorEngraveMode = pattern.operation === "engrave_fill" ? "fill" : "contour";
  }
  draw();
  updateSelectionPanel();
}

function applyPlacementOperation(placement, operation) {
  if (!placement) return;
  const nextOperation = normalizeOperation(operation, "cut");
  if (placement.operation === nextOperation) return;
  pushUndo("Parca islemi");
  placement.operation = nextOperation;
  markManualLayout();
  draw();
  updateSelectionPanel();
}

function updatePartsList(analysis = state.currentAnalysis || computeJobAnalysis()) {
  if (!state.parts.length) {
    refs.partsList.innerHTML = `<div class="selection-empty">DXF yok</div>`;
    return;
  }
  refs.partsList.innerHTML = state.parts
    .map((part) => {
      const placements = analysis.placements.filter((item) => item.part?.id === part.id);
      const active = placements.filter((item) => item.active);
      const inside = active.filter((item) => item.inside).length;
      const outside = active.length - inside;
      const physicalFits = itemFitsActiveArea(part, analysis.bed, analysis.margin, Boolean(refs.allowRotate?.checked));
      const level = !physicalFits || outside ? "danger" : inside ? "ok" : "";
      const quantity = partQuantity(part);
      return `<div class="item part-item ${level}" data-part-id="${escapeHtml(part.id)}">
        <div>
          <strong>${escapeHtml(part.name)}</strong>
          <small>${part.width.toFixed(2)} × ${part.height.toFixed(2)} mm</small>
          <small>Adet: ${quantity} · Yerleşen: ${inside} / ${quantity}${outside ? ` · Dışta: ${outside}` : ""}${physicalFits ? "" : " · Sığmıyor"}</small>
        </div>
        <div class="part-controls">
          <label>Adet <input data-part-quantity="${escapeHtml(part.id)}" type="number" min="1" step="1" value="${quantity}" /></label>
          <button type="button" class="small" data-part-select="${escapeHtml(part.id)}">${physicalFits ? "Seç" : "Sığmıyor"}</button>
        </div>
      </div>`;
    })
    .join("");
  refs.partsList.querySelectorAll("[data-part-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const placement = state.placements.find((item) => item.partId === button.dataset.partSelect);
      if (placement) select("placement", placement.id);
    });
  });
  refs.partsList.querySelectorAll("[data-part-quantity]").forEach((input) => {
    const part = partById(input.dataset.partQuantity);
    bindUndoBeforeEdit(input, "DXF adedi");
    input.addEventListener("change", () => {
      if (setPartQuantity(part, input.value, { recordUndo: false })) input.value = String(partQuantity(part));
    });
  });
}

function updateSummary(extra = "", analysis = state.currentAnalysis || computeJobAnalysis()) {
  const b = analysis.bed;
  const bounds = jobBounds();
  const boundsLines = bounds
    ? [
        `İş alanı: ${boundsSize(bounds).width.toFixed(2)} x ${boundsSize(bounds).height.toFixed(2)} mm`,
        `Sol alt: X${bounds.minX.toFixed(2)} Y${bounds.minY.toFixed(2)}`,
      ]
    : [];
  refs.summary.textContent = [
    `Tabla: ${b.width.toFixed(0)} x ${b.height.toFixed(0)} mm`,
    `Aktif alan: ${Math.max(0, analysis.activeWidth).toFixed(0)} x ${Math.max(0, analysis.activeHeight).toFixed(0)} mm`,
    `DXF: ${state.parts.length}`,
    `Parça: ${analysis.placements.length}`,
    `Desen: ${state.patterns.length}`,
    `Kesim yolu: ${analysis.cutPathCount}`,
    `Kerf: ${analysis.kerf.toFixed(2)} mm`,
    `Kazıma yolu: ${analysis.engraveLineCount + analysis.engraveFillCount}`,
    `Kritik: ${analysis.criticalCount}`,
    ...boundsLines,
    `Çıktı: ${refs.outputPath.value || "-"}`,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

function select(type, id, extra = {}) {
  state.selected = type && id ? { type, id, ...extra } : null;
  if (!state.selected) {
    state.selectedItems = [];
  } else if (type === "pattern") {
    state.selectedItems = [{ type, id }];
  } else if (type === "vectorPath") {
    state.selectedItems = [{ type: "pattern", id }];
  } else {
    state.selectedItems = [];
  }
  updateSelectionPanel();
  draw();
}

function selectPatternItems(patternIds, activeId = null) {
  state.selectedItems = uniqueSelectionItems(patternIds.map((id) => ({ type: "pattern", id })));
  const active = activeId && state.selectedItems.some((item) => item.id === activeId)
    ? activeId
    : state.selectedItems[0]?.id;
  state.selected = active ? { type: "pattern", id: active } : null;
  updateSelectionPanel();
  draw();
}

function togglePatternSelection(patternId) {
  const items = uniqueSelectionItems(state.selectedItems);
  const index = items.findIndex((item) => item.id === patternId);
  if (index >= 0) {
    items.splice(index, 1);
    if (!items.length) {
      select(null, null);
      return;
    }
    selectPatternItems(items.map((item) => item.id), items[items.length - 1]?.id);
    return;
  }
  if (index < 0) items.push({ type: "pattern", id: patternId });
  selectPatternItems(items.map((item) => item.id), patternId);
}

function updateSelectionPanel() {
  if (!state.selected) {
    refs.selectionPanel.className = "selection-empty";
    refs.selectionPanel.innerHTML = "Seçim yok";
    return;
  }
  refs.selectionPanel.className = "property-stack";
  if (state.selected.type === "placement") {
    renderPlacementPanel(placementById(state.selected.id));
  } else if (state.selected.type === "pattern") {
    renderPatternPanel(patternById(state.selected.id));
  } else if (state.selected.type === "vectorPath") {
    const selected = selectedVectorPath();
    renderVectorPathPanel(selected?.pattern, selected?.vectorPath);
  }
}

function renderPlacementPanel(placement) {
  if (!placement) {
    select(null, null);
    return;
  }
  const part = partById(placement.partId);
  const size = placementSize(placement);
  const operation = placementOperation(placement);
  refs.selectionPanel.innerHTML = `
    <div class="property-title"><strong>${escapeHtml(part?.name || "Parça")}</strong><span>DXF Parça · ${operationLabel(operation)} · ${size.width.toFixed(2)} × ${size.height.toFixed(2)} mm</span></div>
    <div class="form-grid">
      <label>X konumu (mm) <span class="unit-input"><input data-placement="x" type="number" step="0.01" value="${placement.x.toFixed(2)}" /><b>mm</b></span></label>
      <label>Y konumu (mm) <span class="unit-input"><input data-placement="y" type="number" step="0.01" value="${placement.y.toFixed(2)}" /><b>mm</b></span></label>
      <label>Açı <input data-placement="rotation" type="number" step="90" value="${placement.rotation}" /></label>
      <label>Parça iç sınır payı <span class="unit-input"><input data-placement="boundaryMargin" type="number" min="0" step="0.1" value="${placementClipMargin(placement).toFixed(1)}" /><b>mm</b></span></label>
      <label>DXF adedi <input data-part-field="quantity" type="number" min="1" step="1" value="${partQuantity(part)}" /></label>
    </div>
    <label class="checkline">
      <input data-placement-flag="clipCloseBoundary" type="checkbox" ${placementClipCloseBoundary(placement) ? "checked" : ""} />
      <span>Taşan kapalı desenleri bu sınırda kapat</span>
    </label>
    <div class="operation-card">
      <strong>İşlem</strong>
      <span>Kırmızı yollar kesim, mavi yollar çizgi kazıma, gri yollar G-code dışıdır.</span>
      <div class="operation-toggle">
        <button data-placement-operation="cut" class="${operation === "cut" ? "active danger-mode" : ""}">Kesim</button>
        <button data-placement-operation="engrave_line" class="${operation === "engrave_line" ? "active" : ""}">Kazıma çizgi</button>
        <button data-placement-operation="engrave_fill" class="${operation === "engrave_fill" ? "active" : ""}">Kazıma dolgu</button>
        <button data-placement-operation="ignore" class="${operation === "ignore" ? "active" : ""}">Yok say</button>
      </div>
    </div>
    <div class="nudge-pad">
      <span></span><button data-nudge="0,1">↑</button><span></span>
      <button data-nudge="-1,0">←</button><button data-nudge="0,-1">↓</button><button data-nudge="1,0">→</button>
    </div>
    <div class="button-grid">
      <button id="panelAddImage">Desen Ekle</button>
      <button id="panelRotatePart">90° Döndür</button>
      <button id="panelDeletePlacement" class="danger">Sil</button>
    </div>
  `;
  bindPlacementPanel(placement);
}

function bindPlacementPanel(placement) {
  refs.selectionPanel.querySelectorAll("[data-placement]").forEach((input) => {
    bindUndoBeforeEdit(input, "Parca ayari");
    input.addEventListener("input", () => {
      const key = input.dataset.placement;
      placement[key] = key === "rotation" ? Math.round(Number(input.value) || 0) : Number(input.value) || 0;
      if (key === "boundaryMargin") placement[key] = Math.max(0, placement[key]);
      markManualLayout();
      draw();
    });
  });
  refs.selectionPanel.querySelectorAll("[data-part-field]").forEach((input) => {
    bindUndoBeforeEdit(input, "DXF adedi");
    input.addEventListener("change", () => {
      const part = partById(placement.partId);
      if (input.dataset.partField === "quantity" && setPartQuantity(part, input.value, { recordUndo: false })) {
        input.value = String(partQuantity(part));
      }
    });
  });
  refs.selectionPanel.querySelectorAll("[data-placement-flag]").forEach((input) => {
    input.addEventListener("change", () => {
      pushUndo("Parca ayari");
      placement[input.dataset.placementFlag] = input.checked;
      markManualLayout();
      draw();
      updateSelectionPanel();
    });
  });
  refs.selectionPanel.querySelectorAll("[data-placement-operation]").forEach((button) => {
    button.addEventListener("click", () => applyPlacementOperation(placement, button.dataset.placementOperation));
  });
  refs.selectionPanel.querySelectorAll("[data-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      const [dx, dy] = button.dataset.nudge.split(",").map(Number);
      const step = nudgeStep();
      moveSelected(dx * step, dy * step);
    });
  });
  document.getElementById("panelAddImage").addEventListener("click", addImage);
  document.getElementById("panelRotatePart").addEventListener("click", () => {
    rotateSelected(90);
  });
  document.getElementById("panelDeletePlacement").addEventListener("click", () => {
    pushUndo("Parca sil");
    deletePlacementById(placement.id);
    select(null, null);
  });
}

function renderPatternPanel(pattern) {
  if (!pattern) {
    select(null, null);
    return;
  }
  const kindText =
    pattern.kind === "vector"
        ? "Foto vektör"
        : pattern.kind === "svg"
          ? "Temiz SVG vektör"
          : "Raster kazıma";
  const operation = patternOperation(pattern);
  const hasVectorPaths = vectorPatternHasPaths(pattern);
  const canFillVectorEngrave = vectorCanFillEngrave(pattern);
  const filledVectorEngrave = operation === "engrave_fill" && vectorPatternFilledPreview(pattern);
  const operationText =
    operation === "cut"
      ? "Kesim: vektör konturlarını kırmızı kesim yolu olarak üretir."
      : operation === "engrave_fill"
        ? "Kazıma dolgu: dolu alanları tarama satırlarıyla kazır."
        : operation === "ignore"
          ? "Yok say: bu nesne G-code çıktısına dahil edilmez."
          : "Kazıma çizgi: mavi çizgi kazıma yolu olarak üretir.";
  const operationControl = `<div class="operation-card">
        <div>
          <strong>İşlem</strong>
          <span>${operationText}</span>
        </div>
        <div class="operation-toggle">
          ${isVectorLikePattern(pattern) ? `<button data-operation="cut" class="${operation === "cut" ? "active danger-mode" : ""}">Kesim</button>` : ""}
          <button data-operation="engrave_line" class="${operation === "engrave_line" ? "active" : ""}">Kazıma çizgi</button>
          <button data-operation="engrave_fill" class="${operation === "engrave_fill" ? "active" : ""}" ${hasVectorPaths && !canFillVectorEngrave ? "disabled" : ""}>Kazıma dolgu</button>
          <button data-operation="ignore" class="${operation === "ignore" ? "active" : ""}">Yok say</button>
        </div>
      </div>`;
  const boundaryCloseControl = isVectorLikePattern(pattern)
    ? `<label class="checkline">
        <input data-pattern-flag="clipCloseBoundary" type="checkbox" ${pattern.clipCloseBoundary ? "checked" : ""} />
        <span>Taşan kapalı konturu sınırdan kapat</span>
      </label>`
    : "";
  const vectorModeControl = "";
  const svgInfo =
    pattern.kind === "svg" && pattern.cleanStats
      ? `<div class="svg-clean-info">
          <strong>SVG hazırlandı</strong>
          <span>Şekil→path: ${pattern.cleanStats.converted_shape_count ?? 0}</span>
          <span>Ayrılan path: ${pattern.cleanStats.split_path_count ?? 0}</span>
          <span>Temiz ölçü: ${Number(pattern.cleanStats.normalized_width || pattern.width).toFixed(2)} x ${Number(pattern.cleanStats.normalized_height || pattern.height).toFixed(2)} mm</span>
        </div>`
      : "";
  const activeVectorCount = hasVectorPaths ? (pattern.vectorPaths || []).filter((item) => vectorPathIsActive(item, pattern)).length : 0;
  const lockedVectorCount = hasVectorPaths ? (pattern.vectorPaths || []).filter((item) => vectorPathPreservesDuringPatternResize(pattern, item)).length : 0;
  const deformableVectorCount = hasVectorPaths ? (pattern.vectorPaths || []).filter((item) => item.deformable && !item.removed).length : 0;
  const vectorSettings = pattern.vectorSettings || {};
  const vectorStats = pattern.vectorStats || {};
  const multiSelectionText = state.selectedItems.length > 1 ? ` · ${state.selectedItems.length} secili` : "";
  const vectorTiming = vectorStats.timings?.total ? ` · Süre: ${Number(vectorStats.timings.total).toFixed(2)} sn` : "";
  const vectorInfo =
    hasVectorPaths
      ? `<div class="svg-clean-info">
          <strong>${pattern.kind === "svg" ? "SVG konturları hazır" : "Foto vektör hazır"}</strong>
          <span>Aktif kontur: ${activeVectorCount} / ${(pattern.vectorPaths || []).length}</span>
          <span>Korunan kontur: ${lockedVectorCount}</span>
          <span>Oynatilabilir kontur: ${deformableVectorCount}</span>
          <span>Kaynak: ${Number(pattern.sourceWidth || 0).toFixed(0)} x ${Number(pattern.sourceHeight || 0).toFixed(0)} px</span>
          <span>Mod: ${vectorSettings.mode || "outline"} · Eşik: ${vectorSettings.thresholdMode || "manual"} ${vectorSettings.usedThreshold > 0 ? `(${Number(vectorSettings.usedThreshold).toFixed(0)})` : ""}</span>
          <span>Otomatik gizlenen: ${Number(vectorStats.removedBorder || 0) + Number(vectorStats.removedShortPost || 0)} · Çerçeve: ${vectorStats.removedBorder ?? 0} · Birleşen: ${vectorStats.stitchedGap ?? 0}${vectorTiming}</span>
        </div>`
      : "";
  const debugInfo =
    pattern.kind === "vector" && pattern.debugPreviews?.length
      ? `<div class="debug-preview-grid">
          ${pattern.debugPreviews
            .map(
              (preview) => `<div class="debug-preview-card">
                <img src="${preview.dataUrl}" alt="${escapeHtml(preview.name || "preview")}" />
                <span>${escapeHtml(preview.name || "A?ama")}</span>
              </div>`
            )
            .join("")}
        </div>`
      : "";
  refs.selectionPanel.innerHTML = `
    <div class="property-title"><strong>${escapeHtml(pattern.name || "Desen")}</strong><span>${kindText} · ${operationLabel(operation)} · ${pattern.width.toFixed(2)} x ${pattern.height.toFixed(2)} mm${multiSelectionText}</span></div>
    ${svgInfo}
    ${vectorInfo}
    ${debugInfo}
    ${operationControl}
    ${vectorModeControl}
    <div class="form-grid">
      <label>X <input data-pattern="x" type="number" step="0.01" value="${pattern.x.toFixed(2)}" /></label>
      <label>Y <input data-pattern="y" type="number" step="0.01" value="${pattern.y.toFixed(2)}" /></label>
      <label>Genişlik <input data-pattern="width" type="number" min="1" step="0.01" value="${pattern.width.toFixed(2)}" /></label>
      <label>Yükseklik <input data-pattern="height" type="number" min="1" step="0.01" value="${pattern.height.toFixed(2)}" /></label>
      <label>Açı <input data-pattern="rotation" type="number" step="0.1" value="${pattern.rotation.toFixed(1)}" /></label>
      <label>Ek iç pay <input data-pattern="clipMargin" type="number" min="0" step="0.1" value="${Number(pattern.clipMargin || 0).toFixed(1)}" /></label>
      <label>${operation === "cut" ? "Kesim gücü S" : "Kazıma gücü S"} <input data-pattern="power" type="number" min="0" max="1000" step="10" value="${pattern.power}" /></label>
      <label>${operation === "cut" ? "Kesim hızı F" : "Kazıma hızı F"} <input data-pattern="feed" type="number" min="1" step="50" value="${pattern.feed}" /></label>
      ${
        pattern.kind === "raster"
          ? `<label>Çizgi <input data-pattern="lineStep" type="number" min="0.05" step="0.05" value="${pattern.lineStep}" /></label>
             <label>Eşik <input data-pattern="threshold" type="number" min="0" max="255" step="1" value="${pattern.threshold}" /></label>`
          : filledVectorEngrave
            ? `<label>Tarama aralığı <input data-pattern="lineStep" type="number" min="0.05" step="0.05" value="${pattern.lineStep}" /></label>`
          : ""
      }
    </div>
    ${boundaryCloseControl}
    ${
      hasVectorPaths
        ? `<label class="checkline">
            <input data-pattern-flag="protectVectorDeformation" type="checkbox" ${pattern.protectVectorDeformation ? "checked" : ""} />
            <span>Deseni deformasyondan koru; sadece izin verilen konturlar esnesin</span>
          </label>`
        : ""
    }
    <div class="nudge-pad">
      <span></span><button data-nudge="0,1">↑</button><span></span>
      <button data-nudge="-1,0">←</button><button data-nudge="0,-1">↓</button><button data-nudge="1,0">→</button>
    </div>
    <div class="button-grid">
      <button id="panelCenterPattern">Ortala</button>
      <button id="panelFitPattern">Sığdır</button>
      <button id="panelScaleDown">Küçült</button>
      <button id="panelScaleUp">Büyüt</button>
      <button id="panelFramePattern">Kenar çerçeve kapla</button>
      <button id="panelRotatePattern">90° Döndür</button>
      <button id="panelMirrorPatternX">Kopyayı dikey aynala</button>
      <button id="panelMirrorPatternY">Kopyayı yatay aynala</button>
      ${
        hasVectorPaths
          ? `${pattern.kind === "vector" ? `<button id="panelRevectorize">Yeniden İşle</button>` : ""}<button id="panelSmoothVector">Yumuşat</button><button id="panelSaveVectorSvg">SVG Kaydet</button><button id="panelRestoreVectorPaths">Konturları Geri Al</button>`
          : ""
      }
      <button id="panelDeletePattern" class="danger">Sil</button>
    </div>
  `;
  bindPatternPanel(pattern);
}

function renderVectorPathPanel(pattern, vectorPath) {
  if (!pattern || !vectorPath) {
    select(null, null);
    return;
  }
  const activeCount = (pattern.vectorPaths || []).filter((item) => vectorPathIsActive(item, pattern)).length;
  const totalCount = (pattern.vectorPaths || []).length;
  const operation = vectorPathOperation(vectorPath, pattern);
  const canFill = vectorPathSupportsFill(vectorPath);
  const operationText =
    operation === "cut"
      ? "Bu kontur kesim yolu olarak uretilir."
      : operation === "engrave_fill"
        ? "Bu kapali alan tarama satirlariyla yakilir."
        : operation === "ignore"
          ? "Bu kontur G-code ciktisina dahil edilmez."
          : "Bu kontur cizgi yakma yolu olarak uretilir.";
  const bbox = vectorPath.bbox || [];
  const bboxText =
    bbox.length === 4
      ? `X${Number(bbox[0]).toFixed(1)} Y${Number(bbox[1]).toFixed(1)} · ${Math.max(0, Number(bbox[2]) - Number(bbox[0])).toFixed(1)} x ${Math.max(0, Number(bbox[3]) - Number(bbox[1])).toFixed(1)} px`
      : "-";
  const warnings = vectorPath.warnings?.length ? vectorPath.warnings.join(", ") : "Yok";
  refs.selectionPanel.innerHTML = `
    <div class="property-title"><strong>Vektor konturu</strong><span>${escapeHtml(pattern.name || "Desen")}</span></div>
    <div class="svg-clean-info">
      <strong>Secili kontur</strong>
      <span>Nokta: ${(vectorPath.points || []).length}</span>
      <span>Alan: ${Number(vectorPath.area || 0).toFixed(1)} px</span>
      <span>Uzunluk: ${Number(vectorPath.length || 0).toFixed(1)} px · ${vectorPath.closed ? "Kapalı" : "Açık"}</span>
      <span>BBox: ${bboxText}</span>
      <span>Uyarı: ${escapeHtml(warnings)}</span>
      <span>Aktif: ${activeCount} / ${totalCount}</span>
      <span>Koruma: ${escapeHtml(vectorPathProtectionLabel(pattern, vectorPath))}</span>
    </div>
    <div class="operation-card">
      <div>
        <strong>Kontur islemi</strong>
        <span>${operationText}</span>
      </div>
      <div class="operation-toggle">
        <button data-vector-path-operation="cut" class="${operation === "cut" ? "active danger-mode" : ""}">Kesim</button>
        <button data-vector-path-operation="engrave_line" class="${operation === "engrave_line" ? "active" : ""}">Yakma cizgi</button>
        <button data-vector-path-operation="engrave_fill" class="${operation === "engrave_fill" ? "active" : ""}" ${canFill ? "" : "disabled"}>Yakma alan</button>
        <button data-vector-path-operation="ignore" class="${operation === "ignore" ? "active" : ""}">Yok say</button>
      </div>
    </div>
    <label class="checkline">
      <input id="panelVectorPathLocked" type="checkbox" ${vectorPath.locked ? "checked" : ""} />
      <span>Bu konturu deformasyondan koru</span>
    </label>
    ${
      pattern.protectVectorDeformation
        ? `<label class="checkline">
            <input id="panelVectorPathDeformable" type="checkbox" ${vectorPath.deformable ? "checked" : ""} ${vectorPath.locked ? "disabled" : ""} />
            <span>Bu kontur genel deformasyona katılsın</span>
          </label>`
        : ""
    }
    <div class="operation-card vector-move-card">
      <div>
        <strong>Kontur konumu</strong>
        <span>Seçili konturu desen ekseninde mm cinsinden taşır.</span>
      </div>
      <div class="form-grid">
        <label>X hareket mm <input id="vectorPathMoveX" type="number" step="0.01" value="0" /></label>
        <label>Y hareket mm <input id="vectorPathMoveY" type="number" step="0.01" value="0" /></label>
      </div>
      <div class="nudge-pad">
        <span></span><button data-vector-path-move="0,1">↑</button><span></span>
        <button data-vector-path-move="-1,0">←</button><button data-vector-path-move="0,-1">↓</button><button data-vector-path-move="1,0">→</button>
      </div>
      <button id="panelApplyVectorPathMove">Hareketi Uygula</button>
    </div>
    <div class="operation-card vector-transform-card">
      <div>
        <strong>Kontur deformasyonu</strong>
        <span>Seçili konturu kendi merkezinden X/Y ayrı ölçekler. 100 değeri mevcut ölçüdür.</span>
      </div>
      <div class="form-grid">
        <label>X ölçek % <input id="vectorPathScaleX" type="number" min="1" step="1" value="100" /></label>
        <label>Y ölçek % <input id="vectorPathScaleY" type="number" min="1" step="1" value="100" /></label>
      </div>
      <div class="button-grid">
        <button data-vector-path-scale="0.9,1">X -10%</button>
        <button data-vector-path-scale="1.1,1">X +10%</button>
        <button data-vector-path-scale="1,0.9">Y -10%</button>
        <button data-vector-path-scale="1,1.1">Y +10%</button>
        <button id="panelApplyVectorPathScale">Ölçeği Uygula</button>
        <button id="panelResetVectorPathScale">100 / 100</button>
      </div>
    </div>
    <div class="button-grid">
      <button id="panelCopyVectorPath">Konturu Kopyala</button>
      <button id="panelDeleteVectorPath" class="danger">Konturu Sil</button>
      <button id="panelSelectVectorPattern">Tum Deseni Sec</button>
    </div>
  `;
  refs.selectionPanel.querySelectorAll("[data-vector-path-operation]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextOperation = normalizeOperation(button.dataset.vectorPathOperation, patternOperation(pattern));
      if (nextOperation === "engrave_fill" && !canFill) {
        setStatus("Alan yakma icin kapali kontur secin.");
        return;
      }
      if (vectorPath.operation === nextOperation && !vectorPath.removed) return;
      pushUndo("Kontur islemi");
      vectorPath.operation = nextOperation;
      vectorPath.removed = false;
      draw();
      updateSelectionPanel();
    });
  });
  document.getElementById("panelVectorPathLocked")?.addEventListener("change", (event) => {
    pushUndo("Kontur kilidi");
    vectorPath.locked = Boolean(event.target.checked);
    if (vectorPath.locked) vectorPath.deformable = false;
    draw();
    updateSelectionPanel();
  });
  document.getElementById("panelVectorPathDeformable")?.addEventListener("change", (event) => {
    pushUndo("Kontur deformasyon izni");
    vectorPath.deformable = Boolean(event.target.checked);
    if (vectorPath.deformable) vectorPath.locked = false;
    draw();
    updateSelectionPanel();
  });
  refs.selectionPanel.querySelectorAll("[data-vector-path-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const [dx, dy] = button.dataset.vectorPathMove.split(",").map(Number);
      const step = nudgeStep();
      pushUndo("Kontur tasi");
      if (moveVectorPathByMm(pattern, vectorPath, dx * step, dy * step)) {
        draw();
        updateSelectionPanel();
      }
    });
  });
  document.getElementById("panelApplyVectorPathMove")?.addEventListener("click", () => {
    const dx = Number(document.getElementById("vectorPathMoveX")?.value) || 0;
    const dy = Number(document.getElementById("vectorPathMoveY")?.value) || 0;
    if (!dx && !dy) return;
    pushUndo("Kontur tasi");
    if (moveVectorPathByMm(pattern, vectorPath, dx, dy)) {
      draw();
      updateSelectionPanel();
    }
  });
  refs.selectionPanel.querySelectorAll("[data-vector-path-scale]").forEach((button) => {
    button.addEventListener("click", () => {
      const [scaleX, scaleY] = button.dataset.vectorPathScale.split(",").map(Number);
      pushUndo("Kontur olcekle");
      if (scaleVectorPath(vectorPath, scaleX, scaleY)) {
        draw();
        updateSelectionPanel();
      }
    });
  });
  document.getElementById("panelApplyVectorPathScale")?.addEventListener("click", () => {
    const scaleX = Math.max(1, Number(document.getElementById("vectorPathScaleX")?.value) || 100) / 100;
    const scaleY = Math.max(1, Number(document.getElementById("vectorPathScaleY")?.value) || 100) / 100;
    if (Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001) return;
    pushUndo("Kontur olcekle");
    if (scaleVectorPath(vectorPath, scaleX, scaleY)) {
      draw();
      updateSelectionPanel();
    }
  });
  document.getElementById("panelResetVectorPathScale")?.addEventListener("click", () => {
    const scaleX = document.getElementById("vectorPathScaleX");
    const scaleY = document.getElementById("vectorPathScaleY");
    if (scaleX) scaleX.value = "100";
    if (scaleY) scaleY.value = "100";
  });
  document.getElementById("panelCopyVectorPath").addEventListener("click", copySelectedVectorPath);
  document.getElementById("panelDeleteVectorPath").addEventListener("click", () => {
    pushUndo("Kontur sil");
    vectorPath.removed = true;
    select("pattern", pattern.id);
  });
  document.getElementById("panelSelectVectorPattern").addEventListener("click", () => {
    select("pattern", pattern.id);
  });
}

function bindPatternPanel(pattern) {
  refs.selectionPanel.querySelectorAll("[data-pattern]").forEach((input) => {
    bindUndoBeforeEdit(input, "Desen ayari");
    input.addEventListener("input", () => {
      const key = input.dataset.pattern;
      const value = Number(input.value) || 0;
      if (key === "width" || key === "height") {
        updatePatternGeometry(pattern, { [key]: value });
      } else {
        pattern[key] = value;
      }
      if (key === "power") pattern[key] = clamp(Math.round(pattern[key]), 0, 1000);
      if (key === "threshold") pattern[key] = clamp(Math.round(pattern[key]), 0, 255);
      if (key === "clipMargin") pattern[key] = Math.max(0, pattern[key]);
      draw();
    });
  });
  refs.selectionPanel.querySelectorAll("[data-pattern-flag]").forEach((input) => {
    input.addEventListener("change", () => {
      pushUndo("Desen ayari");
      pattern[input.dataset.patternFlag] = input.checked;
      draw();
      updateSelectionPanel();
    });
  });
  refs.selectionPanel.querySelectorAll("[data-operation]").forEach((button) => {
    button.addEventListener("click", () => applyPatternOperation(pattern, button.dataset.operation));
  });
  refs.selectionPanel.querySelectorAll("[data-vector-engrave-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      pushUndo("Vektor modu");
      pattern.vectorEngraveMode = button.dataset.vectorEngraveMode === "fill" ? "fill" : "contour";
      draw();
      updateSelectionPanel();
    });
  });
  refs.selectionPanel.querySelectorAll("[data-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      const [dx, dy] = button.dataset.nudge.split(",").map(Number);
      const step = nudgeStep();
      moveSelected(dx * step, dy * step);
    });
  });
  document.getElementById("panelCenterPattern").addEventListener("click", () => centerSelectedPattern());
  document.getElementById("panelFitPattern").addEventListener("click", () => fitSelectedPattern());
  document.getElementById("panelScaleDown").addEventListener("click", () => resizeSelected(0.98));
  document.getElementById("panelScaleUp").addEventListener("click", () => resizeSelected(1.02));
  document.getElementById("panelFramePattern").addEventListener("click", createFrameFromSelectedPattern);
  document.getElementById("panelRotatePattern").addEventListener("click", () => rotateSelected(90));
  document.getElementById("panelMirrorPatternX").addEventListener("click", () => mirrorSelectedPattern("x"));
  document.getElementById("panelMirrorPatternY").addEventListener("click", () => mirrorSelectedPattern("y"));
  document.getElementById("panelRevectorize")?.addEventListener("click", revectorizeSelected);
  document.getElementById("panelSmoothVector")?.addEventListener("click", () => smoothSelectedVector(pattern));
  document.getElementById("panelSaveVectorSvg")?.addEventListener("click", saveSelectedVectorSvg);
  document.getElementById("panelRestoreVectorPaths")?.addEventListener("click", () => {
    pushUndo("Konturlari geri yukle");
    if (pattern.originalVectorPaths?.length) {
      pattern.vectorPaths = cloneVectorPaths(pattern.originalVectorPaths);
    } else {
      for (const vectorPath of pattern.vectorPaths || []) vectorPath.removed = false;
    }
    draw();
    updateSelectionPanel();
  });
  document.getElementById("panelDeletePattern").addEventListener("click", () => {
    pushUndo("Desen sil");
    state.patterns = state.patterns.filter((item) => item.id !== pattern.id);
    state.images.delete(pattern.id);
    select(null, null);
  });
}

function autoLayout(recordUndo = true) {
  optimizedAutoLayout(recordUndo);
}

function rectFitsBed(rect, b, margin) {
  return (
    rect.minX >= margin - 0.001 &&
    rect.minY >= margin - 0.001 &&
    rect.maxX <= b.width - margin + 0.001 &&
    rect.maxY <= b.height - margin + 0.001
  );
}

function partFitsBed(part, b, margin, allowRotate = refs.allowRotate.checked) {
  const usableWidth = Math.max(0, b.width - margin * 2);
  const usableHeight = Math.max(0, b.height - margin * 2);
  return (
    (part.width <= usableWidth + 0.001 && part.height <= usableHeight + 0.001) ||
    (allowRotate && part.height <= usableWidth + 0.001 && part.width <= usableHeight + 0.001)
  );
}

function tableSizeWarning() {
  if (!state.parts.length) return "";
  const b = bed();
  const margin = Math.max(0, mm("margin", 1));
  const allowRotate = refs.allowRotate.checked;
  const oversized = state.parts.filter((part) => !itemFitsActiveArea(part, b, margin, allowRotate));
  if (!oversized.length) return "";
  if (hasMaterialArea()) {
    return "Bazi parcalar cizilen kullanilabilir alana sigmiyor; alani buyut, parcayi azalt veya dondurmeye izin ver.";
  }
  const tenTimesBed = { width: b.width * 10, height: b.height * 10 };
  const likelyCmInput = oversized.every((part) => partFitsBed(part, tenTimesBed, margin * 10, allowRotate));
  if (likelyCmInput) {
    return "Tabla olcusu mm girilir: 40 cm icin 400 yaz. Parcalar fiziksel olcekte kucultulmez.";
  }
  return "Bazi parcalar bu tabla olcusune fiziksel olarak sigmiyor; olcuyu buyut veya parcayi kucultmeden kesilemez.";
}

function layoutSettingsSnapshot() {
  return {
    bedW: refs.bedW?.value || "400",
    bedH: refs.bedH?.value || "400",
    gap: refs.gap?.value || "3",
    margin: refs.margin?.value || "1",
    allowRotate: Boolean(refs.allowRotate?.checked),
    materialArea: materialAreaSignature(),
  };
}

function sameLayoutSettings(a, b) {
  if (!a || !b) return false;
  return ["bedW", "bedH", "gap", "margin", "allowRotate", "materialArea"].every((key) => String(a[key]) === String(b[key]));
}

function acceptCurrentLayoutSettings() {
  state.layout.appliedSettings = layoutSettingsSnapshot();
  state.layout.dirty = false;
}

function markLayoutSettingsChanged() {
  const current = layoutSettingsSnapshot();
  if (!state.parts.length && !state.placements.length && !state.patterns.length) {
    state.layout.appliedSettings = current;
    state.layout.dirty = false;
    draw();
    return;
  }
  if (sameLayoutSettings(state.layout.appliedSettings, current)) {
    state.layout.dirty = false;
    draw();
    return;
  }
  if (!state.layout.dirty) {
    state.layout.previousSettings = state.layout.appliedSettings || current;
  }
  state.layout.dirty = true;
  draw();
}

function restoreLayoutSettings() {
  const snapshot = state.layout.previousSettings || state.layout.appliedSettings;
  if (!snapshot) return;
  pushUndo("Yerlesim ayarini geri al");
  for (const key of ["bedW", "bedH", "gap", "margin"]) {
    if (refs[key]) refs[key].value = snapshot[key];
  }
  if (refs.allowRotate) refs.allowRotate.checked = Boolean(snapshot.allowRotate);
  state.layout.dirty = false;
  saveUiSettings();
  draw();
  setStatus("Yerleşim ayarı geri alındı.");
}

function keepCurrentLayoutPositions() {
  pushUndo("Konumlari koru");
  acceptCurrentLayoutSettings();
  saveUiSettings();
  draw();
  setStatus("Konumlar korundu. Dışta kalan parça varsa G-code engeli devam eder.");
}

function markManualLayout() {
  if (!state.placements.length && !state.patterns.length) return;
  state.layout.manual = true;
}

function boundsFromPoints(points) {
  const bounds = emptyBounds();
  for (const point of points || []) includePoint(bounds, point);
  return boundsReady(bounds) ? bounds : null;
}

function patternBounds(pattern) {
  return boundsFromPoints(patternCorners(pattern));
}

function patternPathOperationCounts(pattern) {
  const counts = { cut: 0, engrave_line: 0, engrave_fill: 0, ignore: 0 };
  if (!pattern) return counts;
  if (vectorPatternHasPaths(pattern)) {
    for (const vectorPath of pattern.vectorPaths || []) {
      if (vectorPath.removed || (vectorPath.points || []).length < 2) continue;
      const operation = vectorPathOperation(vectorPath, pattern);
      counts[operation] = (counts[operation] || 0) + 1;
    }
    return counts;
  }
  const operation = patternOperation(pattern);
  counts[operation] = 1;
  return counts;
}


function severityClass(level) {
  return level === "critical" ? "danger" : level === "warning" ? "warn" : "ok";
}

function computeJobAnalysis() {
  const b = bed();
  const margin = Math.max(0, mm("margin", 1));
  const kerf = Math.min(1, Math.max(0, mm("kerf", 0)));
  const quantity = defaultPartQuantity();
  const activeWidth = b.width - margin * 2;
  const activeHeight = b.height - margin * 2;
  const allowRotate = Boolean(refs.allowRotate?.checked);
  const warnings = [];
  const placements = state.placements.map((placement) => {
    const part = partById(placement.partId);
    const operation = placementOperation(placement);
    const bounds = placementBounds(placement);
    const active = operation !== "ignore";
    const inside = rectFitsActiveArea(bounds, b, margin);
    const physicalFits = part ? itemFitsActiveArea(part, b, margin, allowRotate) : false;
    return { placement, part, operation, bounds, active, inside, physicalFits };
  });
  const patterns = state.patterns.map((pattern) => {
    const operation = patternOperation(pattern);
    const bounds = patternBounds(pattern);
    const pathCounts = patternPathOperationCounts(pattern);
    const pathCount = pathCounts.cut + pathCounts.engrave_line + pathCounts.engrave_fill;
    const active = operation !== "ignore" && pathCount > 0;
    const inside = bounds ? rectFitsActiveArea(bounds, b, margin) : true;
    return { pattern, operation, bounds, active, inside, pathCount, pathCounts };
  });

  const activePlacements = placements.filter((item) => item.active);
  const activePatterns = patterns.filter((item) => item.active && item.pathCount > 0);
  for (const item of patterns) {
    item.boundaryIssue = item.active ? patternBoundaryIssue(item.pattern, activePlacements) : null;
  }
  const patternBoundaryIssues = activePatterns.map((item) => item.boundaryIssue).filter(Boolean);
  const outsidePlacements = activePlacements.filter((item) => !item.inside);
  const outsidePatterns = activePatterns.filter((item) => !item.inside);
  const oversizedParts = state.parts.filter((part) => !itemFitsActiveArea(part, b, margin, allowRotate));
  const placedInside = activePlacements.filter((item) => item.inside).length;
  const requestedPlacements = state.parts.reduce((total, part) => total + partQuantity(part), 0);
  const quantityMismatches = state.parts
    .map((part) => ({
      part,
      requested: partQuantity(part),
      actual: placements.filter((item) => item.placement.partId === part.id).length,
    }))
    .filter((item) => item.requested !== item.actual);
  let cutPathCount = 0;
  let engraveLineCount = 0;
  let engraveFillCount = 0;
  let ignoredCount = placements.filter((item) => !item.active).length;

  for (const item of activePlacements) {
    const pathCount = item.part?.paths?.length || 0;
    if (item.operation === "cut") cutPathCount += pathCount;
    else if (item.operation === "engrave_fill") engraveFillCount += pathCount;
    else engraveLineCount += pathCount;
  }
  for (const item of activePatterns) {
    cutPathCount += item.pathCounts.cut;
    engraveLineCount += item.pathCounts.engrave_line;
    engraveFillCount += item.pathCounts.engrave_fill;
  }
  for (const item of patterns) ignoredCount += item.pathCounts.ignore;

  if (b.width <= 0 || b.height <= 0 || activeWidth <= 0 || activeHeight <= 0) {
    warnings.push({
      level: "critical",
      title: "Tabla ölçüsü geçersiz",
      body: "Tabla genişliği, yüksekliği ve kenar payı aktif kesim alanı bırakmalıdır.",
      action: "Tabla ölçüsünü düzelt",
    });
  }
  if (oversizedParts.length) {
    const first = oversizedParts[0];
    warnings.push({
      level: "critical",
      title: `${oversizedParts.length} parça fiziksel olarak sığmıyor`,
      body: `${first.name} ${first.width.toFixed(1)} × ${first.height.toFixed(1)} mm, aktif alan ${Math.max(0, activeWidth).toFixed(1)} × ${Math.max(0, activeHeight).toFixed(1)} mm.`,
      action: "Tabla ölçüsünü büyüt",
    });
  }
  const outsideCount = outsidePlacements.length + outsidePatterns.length;
  if (outsideCount) {
    warnings.push({
      level: "critical",
      title: `${outsideCount} nesne tabla dışında`,
      body: "Aktif alan dışında kalan nesneler varken G-code oluşturulamaz.",
      action: "Dıştakileri göster",
      target: "outside",
    });
  }
  if (quantityMismatches.length) {
    const first = quantityMismatches[0];
    warnings.push({
      level: "critical",
      title: "DXF adedi yerleşime uygulanmadı",
      body: `${first.part.name || "DXF"} için istenen adet ${first.requested}, yerleşimdeki adet ${first.actual}. G-code almadan önce yerleşimi yeniden hesaplayın.`,
      action: "Yeniden hesapla",
    });
  }
  for (const issue of patternBoundaryIssues) {
    warnings.push(issue);
  }
  if (cutPathCount + engraveLineCount + engraveFillCount === 0) {
    warnings.push({
      level: "critical",
      title: "Kesim veya kazıma yolu yok",
      body: "G-code oluşturmak için en az bir aktif kesim veya kazıma nesnesi gerekir.",
      action: "DXF veya desen ekle",
    });
  }
  if (state.layout.dirty) {
    warnings.push({
      level: "warning",
      title: "Yerleşim ayarları değişti",
      body: "Tabla, boşluk, DXF adedi veya döndürme ayarı değişti. Mevcut konumlar eski ayarlara göre.",
      action: "Yeniden hesapla",
    });
  }
  if (state.layout.manual) {
    warnings.push({
      level: "info",
      title: "Manuel düzenleme var",
      body: "Bazı parçalar elle taşındı. Otomatik yerleşim tekrar çalışırsa konumlar değişebilir.",
      action: "Konumları koru",
    });
  }
  if (mm("gap", 3) < 1 && state.parts.length) {
    warnings.push({
      level: "warning",
      title: "Parça arası boşluk 1 mm’den küçük",
      body: "Çok düşük boşluk kesim sırasında parçaların birbirine yaklaşmasına neden olabilir.",
      action: "Boşluğu artır",
    });
  }
  const likelyCmInput = b.width > 0 && b.height > 0 && b.width <= 120 && b.height <= 120;
  if (likelyCmInput) {
    warnings.push({
      level: "warning",
      title: "Tabla ölçüsü küçük görünüyor",
      body: `${b.width.toFixed(0)} × ${b.height.toFixed(0)} mm girdiniz. 60 × 40 cm için 600 × 400 mm kullanın.`,
      action: "600 × 400 mm yap",
      target: "small-bed",
    });
  }

  const criticalCount = warnings.filter((item) => item.level === "critical").length;
  const warningCount = warnings.filter((item) => item.level === "warning").length;
  const infoCount = warnings.filter((item) => item.level === "info").length;
  let layoutStatus = "yerleşim_yok";
  if (oversizedParts.length) layoutStatus = "sığmıyor";
  else if (outsideCount) layoutStatus = "dışarıda";
  else if (quantityMismatches.length || state.layout.dirty) layoutStatus = "ayarlar_değişti";
  else if (state.layout.manual) layoutStatus = "manuel";
  else if (state.placements.length || state.patterns.length) layoutStatus = "güncel";

  return {
    bed: b,
    margin,
    kerf,
    activeWidth,
    activeHeight,
    quantity,
    placements,
    patterns,
    requestedPlacements,
    placedInside,
    outsidePlacements,
    outsidePatterns,
    patternBoundaryIssues,
    oversizedParts,
    quantityMismatches,
    ignoredCount,
    cutPathCount,
    engraveLineCount,
    engraveFillCount,
    warnings,
    criticalCount,
    warningCount,
    infoCount,
    layoutStatus,
    canGenerate: criticalCount === 0,
  };
}

function layoutStatusText(status) {
  return (
    {
      yerleşim_yok: "Yerleşim yapılmadı",
      güncel: "Yerleşim güncel",
      manuel: "Manuel düzenleme var",
      ayarlar_değişti: "Yerleşim ayarları değişti",
      dışarıda: "Tabla dışında parça var",
      sığmıyor: "Parça fiziksel olarak sığmıyor",
    }[status] || "Yerleşim durumu"
  );
}

function layoutStatusBody(status, analysis) {
  if (status === "güncel") return "Parçalar mevcut tabla ve boşluk ayarlarına göre yerleştirildi.";
  if (status === "manuel") return "Bazı parçalar elle taşındı. Otomatik yerleşim tekrar çalışırsa bu konumlar değişebilir.";
  if (status === "ayarlar_değişti") return "Tabla ölçüsü, boşluk veya DXF adedi değişti. Mevcut yerleşim eski ayarlara göre.";
  if (status === "dışarıda") return `${analysis.outsidePlacements.length + analysis.outsidePatterns.length} nesne aktif tabla alanının dışında. G-code oluşturulamaz.`;
  if (status === "sığmıyor") return `${analysis.oversizedParts[0]?.name || "Parça"} aktif tabla alanından büyük.`;
  return "Parçaları tabla üzerine yerleştirmek için Otomatik Yerleştir’e basın.";
}

function setChip(ref, text, level = "") {
  if (!ref) return;
  ref.textContent = text;
  ref.className = `status-chip${level ? ` ${level}` : ""}`;
}

function renderJobSummary(analysis) {
  if (!refs.jobSummary) return;
  const outside = analysis.outsidePlacements.length + analysis.outsidePatterns.length;
  const cells = [
    ["DXF parça", state.parts.length, state.parts.length ? "ok" : ""],
    ["Yerleşen", `${analysis.placedInside} / ${analysis.requestedPlacements || analysis.placements.length}`, outside ? "danger" : "ok"],
    ["Dışta kalan", outside, outside ? "danger" : "ok"],
    ["Desen", state.patterns.length, state.patterns.length ? "ok" : ""],
    ["Kesim yolu", analysis.cutPathCount, analysis.cutPathCount ? "ok" : ""],
    ["Kazıma yolu", analysis.engraveLineCount + analysis.engraveFillCount, analysis.engraveLineCount + analysis.engraveFillCount ? "ok" : ""],
    ["Yok sayılan", analysis.ignoredCount, analysis.ignoredCount ? "warn" : ""],
    ["Uyarı", analysis.criticalCount + analysis.warningCount, analysis.criticalCount ? "danger" : analysis.warningCount ? "warn" : "ok"],
  ];
  refs.jobSummary.innerHTML = cells
    .map(
      ([label, value, level]) => `<button type="button" class="summary-cell ${level || ""}" data-summary="${escapeHtml(label)}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </button>`
    )
    .join("");
  refs.jobSummary.querySelectorAll("[data-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.summary || "";
      if (key.includes("Dışta")) zoomToOutside();
      if (key.includes("Uyarı")) refs.warningsList?.scrollIntoView({ block: "nearest" });
    });
  });
}

function renderLayoutStatus(analysis) {
  if (!refs.layoutStatus) return;
  const level = analysis.layoutStatus === "sığmıyor" || analysis.layoutStatus === "dışarıda" ? "danger" : analysis.layoutStatus === "güncel" ? "ok" : "warn";
  refs.layoutStatus.className = `state-card ${level}`;
  refs.layoutStatus.innerHTML = `<strong>${layoutStatusText(analysis.layoutStatus)}</strong><span>${layoutStatusBody(analysis.layoutStatus, analysis)}</span>`;
  refs.layoutBanner?.classList.toggle("hidden", !state.layout.dirty);
}

function renderWarnings(analysis) {
  if (!refs.warningsList) return;
  if (!analysis.warnings.length) {
    refs.warningsList.innerHTML = `<div class="warning-item info"><div class="warning-title">Uyarı yok<span>Hazır</span></div><span>Kesim ve kazıma yolları kontrol edildi.</span></div>`;
    return;
  }
  refs.warningsList.innerHTML = analysis.warnings
    .map(
      (warning, index) => `<div class="warning-item ${warning.level}">
        <div class="warning-title">${escapeHtml(warning.level === "critical" ? "Kritik" : warning.level === "warning" ? "Dikkat" : "Bilgi")}<span>${escapeHtml(warning.title)}</span></div>
        <span>${escapeHtml(warning.body)}</span>
        <div class="warning-actions">
          <button data-warning-action="${index}">${escapeHtml(warning.action || "Sorunu Göster")}</button>
          <button data-warning-show="${index}">Canvas’ta Göster</button>
        </div>
      </div>`
    )
    .join("");
  refs.warningsList.querySelectorAll("[data-warning-action]").forEach((button) => {
    button.addEventListener("click", () => handleWarningAction(analysis.warnings[Number(button.dataset.warningAction)]));
  });
  refs.warningsList.querySelectorAll("[data-warning-show]").forEach((button) => {
    button.addEventListener("click", () => focusWarning(analysis.warnings[Number(button.dataset.warningShow)]));
  });
}

function renderPatternsList(analysis) {
  if (!refs.patternsList) return;
  if (!state.patterns.length) {
    refs.patternsList.innerHTML = `<div class="selection-empty">Desen yok</div>`;
    return;
  }
  refs.patternsList.innerHTML = analysis.patterns
    .map(({ pattern, operation, inside, boundaryIssue }) => {
      const level = operation === "ignore" ? "" : !inside ? "danger" : boundaryIssue ? severityClass(boundaryIssue.level) : "ok";
      const stateText =
        operation === "ignore"
          ? "Yok say"
          : !inside
            ? "Dışta"
            : boundaryIssue?.level === "warning"
              ? "Kırpılacak"
              : boundaryIssue
                ? "Sınır hatası"
                : "Hazır";
      const clip = pattern.parentId ? "Parçaya bağlı" : "Bağımsız";
      return `<button type="button" class="item ${level}" data-pattern-id="${escapeHtml(pattern.id)}">
        <div>
          <strong>${escapeHtml(pattern.name || "Desen")}</strong>
          <small>${operationLabel(operation)} · ${pattern.width.toFixed(1)} × ${pattern.height.toFixed(1)} mm</small>
          <small>${clip}${boundaryIssue ? ` · ${escapeHtml(boundaryIssue.title)}` : inside ? "" : " · Tabla dışında"}</small>
        </div>
        <span>${stateText}</span>
      </button>`;
    })
    .join("");
  refs.patternsList.querySelectorAll("[data-pattern-id]").forEach((button) => {
    button.addEventListener("click", () => select("pattern", button.dataset.patternId));
  });
}

function renderPreflight(analysis) {
  if (!refs.preflightPanel) return;
  const stateClass = analysis.canGenerate ? "ready" : "blocked";
  const stateText = analysis.canGenerate ? "Hazır" : "Hazır değil";
  const issueList = analysis.warnings
    .filter((item) => item.level === "critical")
    .slice(0, 4)
    .map((item) => `<li>${escapeHtml(item.title)}</li>`)
    .join("");
  refs.preflightPanel.innerHTML = `
    <div class="preflight-state ${stateClass}">
      <strong>Durum: ${stateText}</strong>
      <span>Tabla: ${analysis.bed.width.toFixed(0)} × ${analysis.bed.height.toFixed(0)} mm · Kenar payı: ${analysis.margin.toFixed(1)} mm</span>
      <span>Yerleşen: ${analysis.placedInside} / ${analysis.requestedPlacements || analysis.placements.length} · Dışta: ${analysis.outsidePlacements.length + analysis.outsidePatterns.length}</span>
      <span>Kesim: ${analysis.cutPathCount} yol · Kazıma: ${analysis.engraveLineCount + analysis.engraveFillCount} yol · Kerf: ${analysis.kerf.toFixed(2)} mm</span>
    </div>
    ${
      issueList
        ? `<div class="warning-item critical"><div class="warning-title">G-code oluşturulamaz<span>${analysis.criticalCount} kritik</span></div><ul>${issueList}</ul><button id="showFirstPreflightIssue">İlk sorunu göster</button></div>`
        : `<div class="warning-item info"><div class="warning-title">Kontrol tamam<span>${analysis.warningCount} dikkat</span></div><span>Kırmızı yollar kesim, mavi yollar çizgi kazıma, taramalı alanlar dolgu kazıma olarak üretilecek.</span></div>`
    }
  `;
  document.getElementById("showFirstPreflightIssue")?.addEventListener("click", () => focusWarning(analysis.warnings.find((item) => item.level === "critical")));
}

function renderStatusBars(analysis) {
  const totalWarnings = analysis.criticalCount + analysis.warningCount + analysis.infoCount;
  setChip(refs.unitChip, "Birim: mm kilitli", "locked");
  setChip(refs.bedChip, `Tabla: ${analysis.bed.width.toFixed(0)} × ${analysis.bed.height.toFixed(0)} mm`);
  setChip(
    refs.layoutChip,
    layoutStatusText(analysis.layoutStatus),
    analysis.layoutStatus === "güncel" ? "ok" : analysis.layoutStatus === "dışarıda" || analysis.layoutStatus === "sığmıyor" ? "danger" : "warn"
  );
  setChip(refs.warningChip, `Uyarı: ${totalWarnings}`, analysis.criticalCount ? "danger" : analysis.warningCount ? "warn" : "ok");
  if (refs.bottomStatus) {
    refs.bottomStatus.textContent = `DXF: ${state.parts.length} dosya / ${analysis.placements.length} parça | Yerleşen: ${analysis.placedInside}/${analysis.requestedPlacements || analysis.placements.length} | Desen: ${state.patterns.length} | Dışta: ${analysis.outsidePlacements.length + analysis.outsidePatterns.length} | Uyarı: ${totalWarnings}`;
  }
  if (refs.generateBtn) {
    refs.generateBtn.disabled = !analysis.canGenerate;
    refs.generateBtn.classList.toggle("is-blocked", !analysis.canGenerate);
    refs.generateBtn.textContent = analysis.canGenerate ? "G-code Oluştur" : "G-code Oluşturulamaz";
    refs.generateBtn.title = analysis.canGenerate ? "G-code oluştur" : `G-code oluşturulamaz: ${analysis.warnings.find((item) => item.level === "critical")?.title || "kritik sorun var"}`;
  }
  if (refs.activeAreaText) {
    refs.activeAreaText.textContent = `Aktif alan: ${Math.max(0, analysis.activeWidth).toFixed(0)} × ${Math.max(0, analysis.activeHeight).toFixed(0)} mm`;
  }
  if (refs.activeAreaText && hasMaterialArea()) {
    refs.activeAreaText.textContent = `Aktif alan: grid cokgen + ${analysis.margin.toFixed(1)} mm kenar payi`;
  }
  if (refs.materialAreaText) {
    const points = materialAreaPoints();
    const area = worldPolygonArea(points);
    refs.materialAreaText.textContent = state.materialArea.drawing
      ? `Kullanilabilir alan ciziliyor: ${points.length} kose. Grid noktalari kullanilir; kenarlar yatay/dikey kilitlidir.`
      : hasMaterialArea()
        ? `Kullanilabilir alan: ${points.length} grid kosesi, yaklasik ${(area / 100).toFixed(1)} cm2. Otomatik yerlestirme bu alanin icini doldurur.`
        : "Kullanilabilir alan: dikdortgen tabla. Bos alan cizimi grid noktalari ve yatay/dikey kenarlarla yapilir.";
  }
  refs.drawAreaToolBtn?.classList.toggle("active", Boolean(state.materialArea.drawing));
  if (refs.finishAreaBtn) refs.finishAreaBtn.disabled = !state.materialArea.drawing || materialAreaPoints().length < 4;
  if (refs.clearAreaBtn) refs.clearAreaBtn.disabled = !hasMaterialArea() && !state.materialArea.drawing;
  if (refs.smallBedWarning) {
    const smallBed = analysis.warnings.find((item) => item.target === "small-bed");
    const smallBedSignature = `${analysis.bed.width.toFixed(0)}x${analysis.bed.height.toFixed(0)}`;
    const showSmallBed = smallBed && state.layout.acceptedSmallBed !== smallBedSignature;
    refs.smallBedWarning.classList.toggle("hidden", !showSmallBed);
    refs.smallBedWarning.innerHTML = smallBed
      ? `${escapeHtml(smallBed.body)} <div class="warning-actions"><button id="apply600x400">600 × 400 mm yap</button><button id="acceptSmallBed">Bu ölçü doğru</button></div>`
      : "";
    document.getElementById("apply600x400")?.addEventListener("click", () => applyBedPreset(600, 400));
    document.getElementById("acceptSmallBed")?.addEventListener("click", () => {
      state.layout.acceptedSmallBed = smallBedSignature;
      refs.smallBedWarning.classList.add("hidden");
    });
  }
}

function updateUiFromAnalysis(analysis, extra = "") {
  state.currentAnalysis = analysis;
  renderJobSummary(analysis);
  renderLayoutStatus(analysis);
  renderWarnings(analysis);
  renderPatternsList(analysis);
  renderPreflight(analysis);
  renderStatusBars(analysis);
  updatePartsList(analysis);
  updateSummary(extra, analysis);
}

function handleWarningAction(warning) {
  if (!warning) return;
  if (warning.target === "small-bed") {
    applyBedPreset(600, 400);
    return;
  }
  if (warning.target === "outside") {
    zoomToOutside();
    return;
  }
  if (warning.target === "pattern-boundary") {
    if (warning.patternId) select("pattern", warning.patternId);
    return;
  }
  if (warning.title.includes("Yerleşim")) {
    autoLayout();
    return;
  }
  focusWarning(warning);
}

function focusWarning(warning) {
  if (!warning) return;
  if (warning.target === "pattern-boundary") {
    if (warning.patternId) select("pattern", warning.patternId);
    return;
  }
  if (warning.target === "outside" || warning.title.includes("dışında")) {
    zoomToOutside();
    return;
  }
  if (state.currentAnalysis?.outsidePlacements[0]) select("placement", state.currentAnalysis.outsidePlacements[0].placement.id);
}

function zoomToOutside() {
  const analysis = state.currentAnalysis || computeJobAnalysis();
  const outside = [...analysis.outsidePlacements.map((item) => item.bounds), ...analysis.outsidePatterns.map((item) => item.bounds)].filter(Boolean);
  if (!outside.length) return;
  const bounds = emptyBounds();
  outside.forEach((rect) => {
    includePoint(bounds, { x: rect.minX, y: rect.minY });
    includePoint(bounds, { x: rect.maxX, y: rect.maxY });
  });
  fitBounds(bounds, 80);
}

function fitBounds(bounds, pad = 48) {
  if (!boundsReady(bounds)) return;
  const size = boundsSize(bounds);
  const scale = Math.min((state.view.width - pad * 2) / Math.max(1, size.width), (state.view.height - pad * 2) / Math.max(1, size.height));
  const fitScale = Math.min((state.view.width - 68) / bed().width, (state.view.height - 68) / bed().height);
  state.view.zoom = Math.max(0.1, scale / Math.max(0.001, fitScale));
  computeView();
  const center = worldToScreen({ x: bounds.minX + size.width / 2, y: bounds.minY + size.height / 2 });
  state.view.panX += state.view.width / 2 - center.x;
  state.view.panY += state.view.height / 2 - center.y;
  draw();
}

function applyBedPreset(width, height) {
  pushUndo("Tabla olcusu");
  if (refs.bedW) refs.bedW.value = width;
  if (refs.bedH) refs.bedH.value = height;
  markLayoutSettingsChanged();
  saveUiSettings();
}

function beginMaterialAreaDrawing() {
  pushUndo("Bos alan ciz");
  state.materialArea = { points: [], drawing: true, previewPoint: null };
  select(null, null);
  draw();
  setStatus("Bos alan cizimi aktif: grid noktalarina tikla; kenarlar yatay/dikey kilitlenir, uzunluk cm/mm olarak gorunur.", "info");
}

function finishMaterialAreaDrawing() {
  const points = materialAreaPoints();
  if (points.length < 4) {
    setStatus("Alan icin en az 4 kose gerekir; ucgen veya acik cizgi kabul edilmez.", "warn");
    return;
  }
  if (!materialAreaCanClose(points)) {
    setStatus("Alan kapanisi yatay/dikey olmali ve gercek bir alan olusturmali.", "warn");
    return;
  }
  state.materialArea.points = points.map(clampPointToBed);
  state.materialArea.drawing = false;
  state.materialArea.previewPoint = null;
  markLayoutSettingsChanged();
  saveUiSettings();
  draw();
  setStatus("Kullanilabilir alan grid noktalarindan kaydedildi. Otomatik Yerlestir bu alanin icini dolduracak.", "ok");
}

function clearMaterialArea() {
  if (!hasMaterialArea() && !state.materialArea.drawing) {
    setStatus("Temizlenecek ozel alan yok.", "warn");
    return;
  }
  pushUndo("Bos alani temizle");
  state.materialArea = { points: [], drawing: false, previewPoint: null };
  markLayoutSettingsChanged();
  saveUiSettings();
  draw();
  setStatus("Kullanilabilir alan dikdortgen tabla olarak sifirlandi.", "ok");
}

function addMaterialAreaPoint(world) {
  const rawPoint = snapMaterialAreaPoint(world);
  const point = axisConstrainedMaterialAreaPoint(world);
  const points = materialAreaPoints();
  if (points.length >= 3) {
    const firstScreen = worldToScreen(points[0]);
    const currentScreen = worldToScreen(rawPoint);
    if (Math.hypot(currentScreen.x - firstScreen.x, currentScreen.y - firstScreen.y) <= 12) {
      if (materialAreaCanClose(points)) finishMaterialAreaDrawing();
      else setStatus("Alani kapatmak icin en az 4 kose gerekir ve son kenar ilk noktaya yatay/dikey donmelidir.", "warn");
      return;
    }
  }
  const last = points[points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.001) {
    setStatus("Ayni grid noktasina tekrar tiklanmadi; baska bir nokta sec.", "warn");
    return;
  }
  if (last && !materialAreaSegmentIsAxisAligned(last, point)) {
    setStatus("Bos alan kenarlari sadece yatay veya dikey olabilir.", "warn");
    return;
  }
  points.push(point);
  state.materialArea.points = points;
  state.materialArea.previewPoint = point;
  draw();
}

function parkOutsideItems() {
  const analysis = state.currentAnalysis || computeJobAnalysis();
  const b = bed();
  const margin = Math.max(0, mm("margin", 1));
  const gap = Math.max(0, mm("gap", 3));
  const items = analysis.outsidePlacements.filter((item) => item.physicalFits);
  if (!items.length) {
    setStatus("Park alanına alınacak dış parça yok.");
    return;
  }
  pushUndo("Park alanina al");
  let x = margin;
  let y = b.height + Math.max(10, gap);
  let rowHeight = 0;
  for (const item of items) {
    const size = placementSize(item.placement);
    if (x > margin + 0.001 && x + size.width > b.width - margin) {
      x = margin;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const dx = x - item.placement.x;
    const dy = y - item.placement.y;
    item.placement.x = x;
    item.placement.y = y;
    for (const pattern of state.patterns.filter((candidate) => candidate.parentId === item.placement.id)) {
      pattern.x += dx;
      pattern.y += dy;
    }
    x += size.width + gap;
    rowHeight = Math.max(rowHeight, size.height);
  }
  acceptCurrentLayoutSettings();
  state.layout.manual = true;
  draw();
  setStatus(`${items.length} parça park alanına alındı. Dışta parça varken G-code oluşturulamaz.`);
}

function rectOverlaps(a, b, gap) {
  return !(
    a.maxX <= b.minX - gap + 0.001 ||
    a.minX >= b.maxX + gap - 0.001 ||
    a.maxY <= b.minY - gap + 0.001 ||
    a.minY >= b.maxY + gap - 0.001
  );
}


function appendPartsToLayout(parts) {
  return optimizedAppendPartsToLayout(parts);
}

function packRectWidth(rect) {
  return Math.max(0, rect.maxX - rect.minX);
}

function packRectHeight(rect) {
  return Math.max(0, rect.maxY - rect.minY);
}

function packRectArea(rect) {
  return packRectWidth(rect) * packRectHeight(rect);
}

function packRectContains(outer, inner) {
  return (
    outer.minX <= inner.minX + 0.001 &&
    outer.minY <= inner.minY + 0.001 &&
    outer.maxX >= inner.maxX - 0.001 &&
    outer.maxY >= inner.maxY - 0.001
  );
}

function packingUsableRect(b, margin) {
  const rect = { minX: margin, minY: margin, maxX: b.width - margin, maxY: b.height - margin };
  return packRectWidth(rect) > 0.001 && packRectHeight(rect) > 0.001 ? rect : null;
}

function packingExpandedRect(rect, amount) {
  return {
    minX: rect.minX - amount,
    minY: rect.minY - amount,
    maxX: rect.maxX + amount,
    maxY: rect.maxY + amount,
  };
}

function prunePackingFreeRects(rects) {
  const filtered = rects.filter((rect) => packRectWidth(rect) > 0.001 && packRectHeight(rect) > 0.001);
  const result = [];
  for (let index = 0; index < filtered.length; index += 1) {
    let contained = false;
    for (let other = 0; other < filtered.length; other += 1) {
      if (index !== other && packRectContains(filtered[other], filtered[index])) {
        contained = true;
        break;
      }
    }
    if (!contained) result.push(filtered[index]);
  }
  return result;
}

function splitPackingFreeRects(freeRects, usedRect) {
  const next = [];
  for (const free of freeRects) {
    if (!rectOverlaps(free, usedRect, 0)) {
      next.push(free);
      continue;
    }
    if (usedRect.minX > free.minX + 0.001) next.push({ minX: free.minX, minY: free.minY, maxX: usedRect.minX, maxY: free.maxY });
    if (usedRect.maxX < free.maxX - 0.001) next.push({ minX: usedRect.maxX, minY: free.minY, maxX: free.maxX, maxY: free.maxY });
    if (usedRect.minY > free.minY + 0.001) next.push({ minX: free.minX, minY: free.minY, maxX: free.maxX, maxY: usedRect.minY });
    if (usedRect.maxY < free.maxY - 0.001) next.push({ minX: free.minX, minY: usedRect.maxY, maxX: free.maxX, maxY: free.maxY });
  }
  return prunePackingFreeRects(next);
}

function packingItemOptions(item, allowRotate) {
  const part = item.part;
  const options = [{ rotation: 0, width: part.width, height: part.height }];
  if (!item.fixedRotation && allowRotate && Math.abs(part.width - part.height) > 0.001) options.push({ rotation: 90, width: part.height, height: part.width });
  return options;
}

function comparePackingScore(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    if (Math.abs(a[index] - b[index]) > 0.001) return a[index] - b[index];
  }
  return 0;
}

function bestPackingPosition(item, freeRects, allowRotate) {
  let best = null;
  for (const option of packingItemOptions(item, allowRotate)) {
    for (const free of freeRects) {
      if (option.width > packRectWidth(free) + 0.001 || option.height > packRectHeight(free) + 0.001) continue;
      const rect = { minX: free.minX, minY: free.minY, maxX: free.minX + option.width, maxY: free.minY + option.height };
      const waste = packRectArea(free) - option.width * option.height;
      const shortSide = Math.min(packRectWidth(free) - option.width, packRectHeight(free) - option.height);
      const longSide = Math.max(packRectWidth(free) - option.width, packRectHeight(free) - option.height);
      const score = [waste, shortSide, longSide, rect.minY, rect.minX];
      if (!best || comparePackingScore(score, best.score) < 0) best = { ...option, rect, score };
    }
  }
  return best;
}

function materialAreaScanStep(gap) {
  return Math.max(1, Math.min(5, Number(gap) > 0 ? Number(gap) : 3));
}

function candidateAxisValues(min, max, size, occupiedRects, gap, step, axis) {
  const values = new Set([roundMm(min), roundMm(max)]);
  for (let value = min; value <= max + 0.001; value += step) values.add(roundMm(value));
  for (const rect of occupiedRects) {
    const start = axis === "x" ? rect.minX : rect.minY;
    const end = axis === "x" ? rect.maxX : rect.maxY;
    values.add(roundMm(end + gap));
    values.add(roundMm(start - gap - size));
  }
  return [...values]
    .filter((value) => value >= min - 0.001 && value <= max + 0.001)
    .sort((a, bValue) => a - bValue);
}

function findMaterialAreaSlot(item, occupiedRects, b, margin, gap, allowRotate) {
  if (!hasMaterialArea()) return null;
  const areaBounds = polygonsBounds([materialAreaPoints()]);
  if (!areaBounds) return null;
  const minX = Math.max(0, areaBounds.minX);
  const minY = Math.max(0, areaBounds.minY);
  const maxX = Math.min(b.width, areaBounds.maxX);
  const maxY = Math.min(b.height, areaBounds.maxY);
  const step = materialAreaScanStep(gap);
  let best = null;
  for (const option of packingItemOptions(item, allowRotate)) {
    const xMax = maxX - option.width;
    const yMax = maxY - option.height;
    if (xMax < minX - 0.001 || yMax < minY - 0.001) continue;
    const xs = candidateAxisValues(minX, xMax, option.width, occupiedRects, gap, step, "x");
    const ys = candidateAxisValues(minY, yMax, option.height, occupiedRects, gap, step, "y");
    for (const y of ys) {
      for (const x of xs) {
        const rect = { minX: x, minY: y, maxX: x + option.width, maxY: y + option.height };
        if (!rectFitsActiveArea(rect, b, margin)) continue;
        if (!occupiedRects.every((used) => !rectOverlaps(rect, used, gap))) continue;
        const score = [rect.minY, rect.minX, option.width * option.height, option.rotation];
        if (!best || comparePackingScore(score, best.score) < 0) best = { ...option, rect, score };
      }
    }
  }
  return best;
}

function packLayoutItemsInMaterialArea(items, occupiedRects = []) {
  const b = bed();
  const margin = Math.max(0, mm("margin", 1));
  const gap = Math.max(0, mm("gap", 3));
  const allowRotate = refs.allowRotate.checked;
  const packed = [];
  const usedRects = [...occupiedRects];
  const overflowItems = [];
  for (const item of sortedPackingItems(items)) {
    const best = findMaterialAreaSlot(item, usedRects, b, margin, gap, allowRotate);
    if (!best) {
      overflowItems.push(item);
      continue;
    }
    const packedItem = { item, x: best.rect.minX, y: best.rect.minY, rotation: best.rotation, rect: best.rect, overflow: false };
    packed.push(packedItem);
    usedRects.push(best.rect);
  }
  const startY = Math.max(b.height + gap, margin, ...usedRects.map((rect) => rect.maxY + gap));
  const overflow = placePackingOverflowItems(overflowItems, startY, b, margin, gap, allowRotate);
  return { packed: [...packed, ...overflow], overflowCount: overflow.length };
}

function sortedPackingItems(items) {
  return [...items].sort((a, bItem) => {
    const aArea = a.part.width * a.part.height;
    const bArea = bItem.part.width * bItem.part.height;
    if (Math.abs(bArea - aArea) > 0.001) return bArea - aArea;
    return Math.max(bItem.part.width, bItem.part.height) - Math.max(a.part.width, a.part.height);
  });
}

function placePackingOverflowItems(items, startY, b, margin, gap, allowRotate) {
  const packed = [];
  let x = margin;
  let y = startY;
  let rowHeight = 0;
  const maxX = Math.max(margin + 1, b.width - margin);
  for (const item of items) {
    const option = packingItemOptions(item, allowRotate).sort((a, bOption) => {
      const aFits = a.width <= maxX - margin + 0.001 ? 0 : 1;
      const bFits = bOption.width <= maxX - margin + 0.001 ? 0 : 1;
      if (aFits !== bFits) return aFits - bFits;
      return a.width - bOption.width;
    })[0];
    if (x > margin + 0.001 && x + option.width > maxX + 0.001) {
      x = margin;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const rect = { minX: x, minY: y, maxX: x + option.width, maxY: y + option.height };
    packed.push({ item, x, y, rotation: option.rotation, rect, overflow: true });
    x += option.width + gap;
    rowHeight = Math.max(rowHeight, option.height);
  }
  return packed;
}

function packLayoutItems(items, occupiedRects = []) {
  if (hasMaterialArea()) return packLayoutItemsInMaterialArea(items, occupiedRects);
  const b = bed();
  const margin = Math.max(0, mm("margin", 1));
  const gap = Math.max(0, mm("gap", 3));
  const allowRotate = refs.allowRotate.checked;
  let freeRects = [];
  const usable = packingUsableRect(b, margin);
  if (usable) freeRects = [usable];
  for (const rect of occupiedRects) {
    freeRects = splitPackingFreeRects(freeRects, packingExpandedRect(rect, gap));
  }
  const packed = [];
  const overflowItems = [];
  for (const item of sortedPackingItems(items)) {
    const best = bestPackingPosition(item, freeRects, allowRotate);
    if (!best) {
      overflowItems.push(item);
      continue;
    }
    packed.push({ item, x: best.rect.minX, y: best.rect.minY, rotation: best.rotation, rect: best.rect, overflow: false });
    freeRects = splitPackingFreeRects(freeRects, packingExpandedRect(best.rect, gap));
  }
  const startY = Math.max(b.height + gap, margin, ...occupiedRects.map((rect) => rect.maxY + gap), ...packed.map((item) => item.rect.maxY + gap));
  const overflow = placePackingOverflowItems(overflowItems, startY, b, margin, gap, allowRotate);
  return { packed: [...packed, ...overflow], overflowCount: overflow.length };
}

function buildReusableLayoutItems() {
  const queues = new Map();
  for (const placement of state.placements) {
    if (!queues.has(placement.partId)) queues.set(placement.partId, []);
    queues.get(placement.partId).push(placement);
  }
  const items = [];
  for (const part of state.parts) {
    const quantity = partQuantity(part);
    for (let index = 0; index < quantity; index += 1) {
      const placement = queues.get(part.id)?.shift() || null;
      items.push({ part, placement });
    }
  }
  return items;
}

function buildNewPartItems(parts) {
  const items = [];
  for (const part of parts) {
    const quantity = partQuantity(part);
    for (let index = 0; index < quantity; index += 1) items.push({ part });
  }
  return items;
}

function applyPackedLayout(packed, reusable = false) {
  const reusedIds = new Set(packed.map((item) => item.item.placement?.id).filter(Boolean));
  if (reusable) {
    const removedIds = new Set(state.placements.filter((placement) => !reusedIds.has(placement.id)).map((placement) => placement.id));
    for (const pattern of state.patterns.filter((item) => removedIds.has(item.parentId))) state.images.delete(pattern.id);
    state.patterns = state.patterns.filter((pattern) => !removedIds.has(pattern.parentId));
  }
  const placements = [];
  for (const packedItem of packed) {
    const existing = packedItem.item.placement;
    const placement = {
      ...(existing || { id: uid("pl"), partId: packedItem.item.part.id, operation: "cut", boundaryMargin: 0, clipCloseBoundary: false }),
      operation: placementOperation(existing || { operation: "cut" }),
      x: packedItem.x,
      y: packedItem.y,
      rotation: packedItem.rotation,
    };
    if (existing) {
      const dx = placement.x - existing.x;
      const dy = placement.y - existing.y;
      for (const pattern of state.patterns.filter((item) => item.parentId === existing.id)) {
        pattern.x += dx;
        pattern.y += dy;
      }
    }
    placements.push(placement);
  }
  if (reusable) state.placements = placements;
  else state.placements.push(...placements);
  return placements;
}

function buildStandalonePatternLayoutItems() {
  return state.patterns
    .filter((pattern) => !pattern.parentId && patternOperation(pattern) !== "ignore")
    .map((pattern) => {
      const bounds = patternBounds(pattern);
      if (!bounds) return null;
      const size = boundsSize(bounds);
      if (size.width <= 0.001 || size.height <= 0.001) return null;
      return {
        pattern,
        bounds,
        fixedRotation: true,
        part: {
          id: pattern.id,
          width: size.width,
          height: size.height,
        },
      };
    })
    .filter(Boolean);
}

function applyPackedStandalonePatterns(packed) {
  const moved = [];
  for (const packedItem of packed) {
    const pattern = packedItem.item.pattern;
    if (!pattern) continue;
    const bounds = patternBounds(pattern);
    if (!bounds) continue;
    pattern.x += packedItem.x - bounds.minX;
    pattern.y += packedItem.y - bounds.minY;
    moved.push(pattern);
  }
  return moved;
}

function layoutStandalonePatterns(occupiedRects = []) {
  const items = buildStandalonePatternLayoutItems();
  if (!items.length) return { total: 0, overflowCount: 0 };
  const result = packLayoutItems(items, occupiedRects);
  const moved = applyPackedStandalonePatterns(result.packed);
  return { total: moved.length, overflowCount: result.overflowCount };
}

function optimizedAutoLayout(recordUndo = true) {
  const patternItems = buildStandalonePatternLayoutItems();
  if (!state.parts.length && !patternItems.length) {
    state.placements = [];
    select(null, null);
    setStatus("Yerlestirilecek DXF veya desen yok.");
    return;
  }
  if (recordUndo) pushUndo("Yerlesimi hesapla");
  let partResult = { packed: [], overflowCount: 0 };
  if (state.parts.length) {
    partResult = packLayoutItems(buildReusableLayoutItems());
    applyPackedLayout(partResult.packed, true);
  } else {
    state.placements = [];
  }
  const patternResult = layoutStandalonePatterns(state.placements.map(placementBounds));
  acceptCurrentLayoutSettings();
  state.layout.manual = false;
  draw();
  updateSelectionPanel();
  const total = partResult.packed.length + patternResult.total;
  const overflowCount = partResult.overflowCount + patternResult.overflowCount;
  const fitted = total - overflowCount;
  const warning = tableSizeWarning();
  if (warning) setStatus(warning);
  else if (overflowCount) setStatus(`${fitted}/${total} nesne tablaya sigdi; ${overflowCount} nesne disarida.`);
  else setStatus(`Yerlestirim hazir: ${total} nesne verimli dizildi.`);
  select(null, null);
}

function optimizedAppendPartsToLayout(parts) {
  const result = packLayoutItems(buildNewPartItems(parts), state.placements.map(placementBounds));
  const placements = applyPackedLayout(result.packed, false);
  placements.overflowCount = result.overflowCount;
  return placements;
}

async function addDxfs() {
  try {
    setStatus("DXF seçiliyor...");
    const data = await api("/api/open-dxf", {
      tolerance: 0.25,
      joinTolerance: 0.05,
      innerFirst: refs.innerFirst.checked,
    });
    if (!data.parts.length) {
      setStatus("DXF seçilmedi.");
      return;
    }
    for (const part of data.parts) part.quantity = defaultPartQuantity();
    const hadPlacements = state.placements.length > 0;
    pushUndo("DXF ekle");
    pruneUnusedParts();
    state.parts.push(...data.parts);
    if (hadPlacements) {
      const created = appendPartsToLayout(data.parts);
      const b = bed();
      const margin = Math.max(0, mm("margin", 1));
      const outside = created.overflowCount > 0 || created.some((placement) => !rectFitsActiveArea(placementBounds(placement), b, margin));
      if (created[0]) select("placement", created[0].id);
      else draw();
      const fitted = created.length - (created.overflowCount || 0);
      const warning = tableSizeWarning();
      setStatus(warning || (outside ? `${fitted}/${created.length} yeni parca tablaya sigdi.` : `${created.length} yeni parca eklendi.`));
    } else {
      autoLayout(false);
      setStatus(`${data.parts.length} DXF eklendi.`);
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function addImage() {
  try {
    setStatus("Desen seçiliyor...");
    const data = await api("/api/open-image", {});
    if (!data.image) {
      setStatus("Desen seçilmedi.");
      return;
    }
    pushUndo("Desen ekle");
    const image = new Image();
    image.src = data.image.dataUrl;
    const id = uid("pat");
    state.images.set(id, image);
    image.addEventListener("load", draw, { once: true });

    const target = selectedPlacement() || state.placements[0] || null;
    const pattern = createPatternForPlacement(id, data.image, target);
    state.patterns.push(pattern);
    select("pattern", id);
    if (data.image.kind === "svg") {
      const converted = data.image.cleanStats?.converted_shape_count ?? 0;
      const split = data.image.cleanStats?.split_path_count ?? 0;
      setStatus(`SVG hazırlandı. Şekil→path: ${converted}, ayrılan path: ${split}.`);
    } else {
      setStatus("Desen eklendi.");
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function vectorizePhoto(options = {}) {
  const replacePattern = options.replacePattern || null;
  const sourcePath = options.path || replacePattern?.sourcePath || replacePattern?.originalPath || null;
  try {
    setStatus(replacePattern ? "Vektör yeniden işleniyor..." : "Fotoğraf vektörleştiriliyor...");
    const data = await api("/api/vectorize-image", { ...getVectorSettings(), path: sourcePath });
    if (!data.vector) {
      setStatus("Fotoğraf seçilmedi.");
      return;
    }
    const vector = data.vector;
    if (!vector.vectorPaths?.length) {
      setStatus("Bu ayarla vektör bulunamadı. Eşik veya min alanı değiştirin.");
      return;
    }
    pushUndo(replacePattern ? "Vektor yeniden isle" : "Vektor ekle");
    const id = uid("pat");
    const preview = new Image();
    preview.src = vector.preview?.dataUrl || "";
    const targetId = replacePattern?.id || id;
    state.images.set(targetId, preview);
    preview.addEventListener("load", draw, { once: true });

    const target = selectedPlacement() || state.placements[0] || null;
    let pattern;
    if (replacePattern) {
      const previous = {
        id: replacePattern.id,
        parentId: replacePattern.parentId,
        x: replacePattern.x,
        y: replacePattern.y,
        width: replacePattern.width,
        height: replacePattern.height,
        rotation: replacePattern.rotation,
        operation: replacePattern.operation,
        power: replacePattern.power,
        feed: replacePattern.feed,
        lineStep: replacePattern.lineStep,
        threshold: replacePattern.threshold,
        clipMargin: replacePattern.clipMargin,
        mirrorX: Boolean(replacePattern.mirrorX),
        mirrorY: Boolean(replacePattern.mirrorY),
        vectorEngraveMode: replacePattern.vectorEngraveMode,
        vectorPreset: replacePattern.vectorPreset,
      };
      pattern = createVectorPatternForPlacement(replacePattern.id, vector, target);
      Object.assign(replacePattern, pattern, previous, {
        sourcePath: vector.sourcePath,
        originalPath: vector.sourcePath,
        name: vector.name || replacePattern.name,
        sourceWidth: vector.sourceWidth || replacePattern.sourceWidth,
        sourceHeight: vector.sourceHeight || replacePattern.sourceHeight,
        originalWidth: vector.originalWidth,
        originalHeight: vector.originalHeight,
        vectorPaths: cloneVectorPaths(vector.vectorPaths || []),
        originalVectorPaths: cloneVectorPaths(vector.vectorPaths || []),
        vectorSettings: vector.settings || getVectorSettings(),
        vectorStats: vector.stats || null,
        debugPreviews: vector.debugPreviews || [],
      });
      pattern = replacePattern;
    } else {
      pattern = createVectorPatternForPlacement(id, vector, target);
      state.patterns.push(pattern);
    }
    select("pattern", pattern.id);
    const stats = vector.stats || {};
    const timeText = stats.timings?.total ? `, süre: ${Number(stats.timings.total).toFixed(2)} sn` : "";
    setStatus(
      `Vektör hazır. Aktif: ${stats.pathsKept ?? pattern.vectorPaths.length}/${stats.pathsTotal ?? pattern.vectorPaths.length}, bulunan: ${stats.contoursFound ?? "-"}, otomatik gizlenen: ${Number(stats.removedBorder || 0) + Number(stats.removedShortPost || 0)}, birleşen: ${stats.stitchedGap ?? 0}${timeText}.`
    );
  } catch (error) {
    setStatus(error.message);
  }
}

function revectorizeSelected() {
  const pattern = selectedVectorPattern();
  if (!pattern || pattern.kind !== "vector") {
    setStatus("Yeniden işlemek için fotoğraftan üretilmiş bir vektör seçin.");
    return;
  }
  vectorizePhoto({ replacePattern: pattern });
}

function selectedPlacement() {
  if (state.selected?.type === "placement") return placementById(state.selected.id);
  if (state.selected?.type === "pattern") {
    const pattern = patternById(state.selected.id);
    return placementById(pattern?.parentId);
  }
  if (state.selected?.type === "vectorPath") {
    const pattern = patternById(state.selected.id);
    return placementById(pattern?.parentId);
  }
  return null;
}

function createPatternForPlacement(id, imageData, placement) {
  const b = bed();
  const size = placement ? placementSize(placement) : { width: b.width, height: b.height };
  const aspect = imageData.width && imageData.height ? imageData.width / imageData.height : 2;
  const maxWidth = Math.max(8, size.width * 0.72);
  const maxHeight = Math.max(8, size.height * 0.72);
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  const vectorPaths = cloneVectorPaths(imageData.vectorPaths || []);
  return {
    id,
    parentId: placement?.id || null,
    path: imageData.path,
    originalPath: imageData.originalPath || imageData.path,
    kind: imageData.kind || "raster",
    operation: imageData.kind === "raster" ? "engrave_fill" : "engrave_line",
    cleanStats: imageData.cleanStats || null,
    name: imageData.name,
    x: (placement?.x || 0) + (size.width - width) / 2,
    y: (placement?.y || 0) + (size.height - height) / 2,
    width,
    height,
    rotation: 0,
    power: clamp(Math.round(mm("engravePower", 250)), 0, 1000),
    feed: Math.max(1, mm("engraveFeed", 1800)),
    lineStep: Math.max(0.05, mm("lineStep", 0.35)),
    threshold: clamp(Math.round(mm("threshold", 140)), 0, 255),
    sourcePath: imageData.sourcePath || imageData.path,
    sourceWidth: imageData.sourceWidth || imageData.width || width,
    sourceHeight: imageData.sourceHeight || imageData.height || height,
    originalWidth: imageData.originalWidth || imageData.width || width,
    originalHeight: imageData.originalHeight || imageData.height || height,
    vectorPaths,
    originalVectorPaths: cloneVectorPaths(vectorPaths),
    vectorStats: imageData.vectorStats || null,
    vectorSettings: imageData.vectorSettings || imageData.settings || null,
    clipMargin: 0,
    clipCloseBoundary: false,
    mirrorX: false,
    mirrorY: false,
    vectorEngraveMode: "contour",
  };
}

function createVectorPatternForPlacement(id, vector, placement) {
  const pattern = createPatternForPlacement(
    id,
    {
      path: vector.sourcePath,
      originalPath: vector.sourcePath,
      kind: "vector",
      name: vector.name || "vectorized.svg",
      width: vector.sourceWidth || vector.preview?.width || 100,
      height: vector.sourceHeight || vector.preview?.height || 100,
    },
    placement
  );
  const vectorPaths = cloneVectorPaths(vector.vectorPaths || []);
  return {
    ...pattern,
    kind: "vector",
    sourcePath: vector.sourcePath,
    sourceWidth: vector.sourceWidth || vector.preview?.width || 100,
    sourceHeight: vector.sourceHeight || vector.preview?.height || 100,
    originalWidth: vector.originalWidth || vector.preview?.width || vector.sourceWidth || 100,
    originalHeight: vector.originalHeight || vector.preview?.height || vector.sourceHeight || 100,
    vectorPaths,
    originalVectorPaths: cloneVectorPaths(vectorPaths),
    vectorSettings: vector.settings || getVectorSettings(),
    vectorStats: vector.stats || null,
    debugPreviews: vector.debugPreviews || [],
  };
}

function addGeneratedVector(geometry, options) {
  options = options || {};
  if (!geometry || !(geometry.vectorPaths || []).length) {
    setStatus("Üretilecek geometri boş.");
    return null;
  }
  const name = options.name || "Nesne";
  pushUndo(`${name} ekle`);
  const id = uid("pat");
  const vector = {
    sourcePath: `generated:${geometry.kind || "shape"}`,
    name,
    sourceWidth: geometry.sourceWidth,
    sourceHeight: geometry.sourceHeight,
    originalWidth: geometry.sourceWidth,
    originalHeight: geometry.sourceHeight,
    vectorPaths: geometry.vectorPaths,
    preview: null,
    settings: null,
    stats: null,
  };
  const pattern = createVectorPatternForPlacement(id, vector, null);
  // Uretilen geometri zaten mm cinsinden -> 1:1 gercek boyut (oto-olcekleme yok).
  pattern.width = geometry.sourceWidth;
  pattern.height = geometry.sourceHeight;
  const b = bed();
  pattern.x = Math.max(0, (b.width - pattern.width) / 2);
  pattern.y = Math.max(0, (b.height - pattern.height) / 2);
  pattern.operation = options.operation || "engrave_line";
  pattern.vectorEngraveMode = pattern.operation === "engrave_fill" ? "fill" : "contour";
  pattern.generated = true;
  pattern.generatedKind = geometry.kind;
  pattern.textSettings = options.textSettings || geometry.textSettings || null;
  pattern.vectorStats = geometry.vectorStats || pattern.vectorStats || null;
  state.patterns.push(pattern);
  select("pattern", id);
  updateUiFromAnalysis(computeJobAnalysis());
  setStatus(`${name} eklendi (${pattern.width.toFixed(1)} × ${pattern.height.toFixed(1)} mm).`);
  return pattern;
}

function initRibbon() {
  const tabs = document.querySelectorAll(".ribbon-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateRibbonTab(tab.dataset.tab));
  });
}

function activateRibbonTab(name) {
  if (!name) return;
  document.querySelectorAll(".ribbon-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".ribbon-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tab === name);
  });
}

function openVectorPanel() {
  // Ust bardaki/Ekle sekmesindeki "Foto→Vektör" -> Vektor seritine gecer.
  activateRibbonTab("vektor");
  document.getElementById("vectorizePhotoBtn")?.focus();
}

function textCanvasFont(fontPx, font) {
  const style = refs.textStyle?.value || "normal";
  const weight = refs.textWeight?.value || "400";
  const family = font.family || "Arial, sans-serif";
  return `${style} ${weight} ${fontPx}px ${family}`;
}

function measureTrackedText(ctx2d, text, trackingPx) {
  let width = 0;
  const chars = Array.from(text);
  chars.forEach((ch, index) => {
    width += ctx2d.measureText(ch).width;
    if (index < chars.length - 1) width += trackingPx;
  });
  return width;
}

function drawTrackedText(ctx2d, text, x, y, trackingPx) {
  let pen = x;
  const chars = Array.from(text);
  chars.forEach((ch, index) => {
    ctx2d.fillText(ch, pen, y);
    pen += ctx2d.measureText(ch).width + (index < chars.length - 1 ? trackingPx : 0);
  });
}

function trimTextCanvas(source) {
  const ctx2d = source.getContext("2d");
  const data = ctx2d.getImageData(0, 0, source.width, source.height);
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const alpha = data.data[(y * source.width + x) * 4 + 3];
      if (alpha <= 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const pad = 2;
  const width = maxX - minX + 1 + pad * 2;
  const height = maxY - minY + 1 + pad * 2;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const out = output.getContext("2d");
  out.fillStyle = "#fff";
  out.fillRect(0, 0, width, height);
  out.drawImage(source, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, maxX - minX + 1, maxY - minY + 1);
  return output;
}

async function renderTextFontMask(text, font, heightMm, trackingMm) {
  const lines = String(text).split(/\r?\n/);
  let pxPerMm = 12;
  let fontPx = heightMm * pxPerMm;
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d");
  measure.textBaseline = "alphabetic";
  measure.font = textCanvasFont(fontPx, font);
  await document.fonts?.load?.(measure.font);
  const maxLineWidthPx = Math.max(1, ...lines.map((line) => measureTrackedText(measure, line, trackingMm * pxPerMm)));
  const widthMmEstimate = maxLineWidthPx / pxPerMm;
  const totalHeightMmEstimate = Math.max(heightMm, lines.length * heightMm * 1.28);
  const maxDimension = 2200;
  if (Math.max(widthMmEstimate, totalHeightMmEstimate) * pxPerMm > maxDimension) {
    pxPerMm = Math.max(3, maxDimension / Math.max(widthMmEstimate, totalHeightMmEstimate));
    fontPx = heightMm * pxPerMm;
    measure.font = textCanvasFont(fontPx, font);
    await document.fonts?.load?.(measure.font);
  }
  const trackingPx = trackingMm * pxPerMm;
  const lineHeight = fontPx * 1.28;
  const contentWidth = Math.max(1, ...lines.map((line) => measureTrackedText(measure, line, trackingPx)));
  const padding = Math.max(12, fontPx * 0.5);
  const raw = document.createElement("canvas");
  raw.width = Math.ceil(contentWidth + padding * 2);
  raw.height = Math.ceil(lineHeight * lines.length + padding * 2);
  const rawCtx = raw.getContext("2d");
  rawCtx.clearRect(0, 0, raw.width, raw.height);
  rawCtx.fillStyle = "#000";
  rawCtx.textBaseline = "alphabetic";
  rawCtx.font = textCanvasFont(fontPx, font);
  lines.forEach((line, index) => {
    drawTrackedText(rawCtx, line, padding, padding + fontPx + index * lineHeight, trackingPx);
  });
  const trimmed = trimTextCanvas(raw);
  if (!trimmed) return null;
  return {
    dataUrl: trimmed.toDataURL("image/png"),
    pxPerMm,
    widthMm: trimmed.width / pxPerMm,
    heightMm: trimmed.height / pxPerMm,
  };
}

async function buildOutlineTextGeometry(text, options) {
  const font = options.font;
  const raster = await renderTextFontMask(text, font, options.height, options.tracking);
  if (!raster) return null;
  const data = await api("/api/vectorize-image", {
    dataUrl: raster.dataUrl,
    name: options.name,
    threshold: 200,
    thresholdMode: "manual",
    mode: "auto",
    blur: 0,
    minArea: 4,
    minLength: 1,
    simplify: 0.35,
    smooth: 1,
    invert: true,
    maxContours: 5000,
    contrast: 1,
    morphOpen: 0,
    morphClose: 0,
    adaptiveBlock: 35,
    adaptiveC: 5,
    maxDimension: 2200,
    removeBorder: false,
    stitchGap: 0,
    backgroundNormalize: false,
    denoise: 0,
  });
  const vector = data.vector;
  if (!vector?.vectorPaths?.length) return null;
  const operation = options.operation || "engrave_line";
  const vectorPaths = cloneVectorPaths(vector.vectorPaths).map((path) => {
    path.points = (path.points || []).map(([x, y]) => [x / raster.pxPerMm, y / raster.pxPerMm]);
    path.operation = operation;
    refreshVectorPathMetrics(path);
    return path;
  });
  return {
    vectorPaths,
    sourceWidth: Math.max(0.5, (vector.sourceWidth || raster.widthMm * raster.pxPerMm) / raster.pxPerMm),
    sourceHeight: Math.max(0.5, (vector.sourceHeight || raster.heightMm * raster.pxPerMm) / raster.pxPerMm),
    kind: "text",
    textSettings: {
      mode: "outline",
      font: font.name || font.label,
      family: font.family,
      height: options.height,
      tracking: options.tracking,
      weight: refs.textWeight?.value || "400",
      style: refs.textStyle?.value || "normal",
      operation,
    },
    vectorStats: vector.stats || null,
  };
}

async function addTextPattern() {
  const geometryLib = window.LaserGeometry;
  if (!geometryLib) {
    setStatus("Geometri modülü yüklenmedi (geometry.js).");
    return;
  }
  const text = (refs.textInput?.value || "").trim();
  if (!text) {
    setStatus("Önce kazınacak metni yazın.");
    refs.textInput?.focus();
    return;
  }
  const height = Math.max(2, Number(refs.textHeight?.value) || 20);
  const tracking = Number(refs.textTracking?.value) || 0;
  const selectedFont = selectedTextFontDefinition();
  const requestedOperation = refs.textOperation?.value || "engrave_line";
  let geometry;
  let operation = requestedOperation;
  if (selectedFont.kind === "single") {
    operation = "engrave_line";
    if (requestedOperation !== "engrave_line") {
      setStatus("Tek çizgi font sadece yakma çizgi olarak üretilir; kesim veya dolgu için kontur font seç.", "warn");
    }
    geometry = geometryLib.buildText(text, { height, tracking });
    if (geometry?.vectorPaths) geometry.vectorPaths.forEach((path) => { path.operation = "engrave_line"; });
    if (geometry) geometry.textSettings = { mode: "single-line", font: selectedFont.label, height, tracking, operation };
  } else {
    setStatus("Font konturu vektöre çevriliyor...");
    await installCustomFonts();
    geometry = await buildOutlineTextGeometry(text, {
      font: selectedFont,
      height,
      tracking,
      operation,
      name: `Metin ${selectedFont.name || selectedFont.label}`,
    });
  }
  if (!geometry) {
    setStatus("Bu metinden çizgi üretilemedi.");
    return;
  }
  const name = `Metin: ${text.length > 18 ? text.slice(0, 18) + "…" : text}`;
  const pattern = addGeneratedVector(geometry, { name, operation, textSettings: geometry.textSettings });
  if (pattern) setStatus(`${name} eklendi: ${selectedFont.name || selectedFont.label}.`, "ok");
}

function addShapePattern(kind) {
  const geometryLib = window.LaserGeometry;
  if (!geometryLib) {
    setStatus("Geometri modülü yüklenmedi (geometry.js).");
    return;
  }
  const width = Math.max(1, Number(refs.shapeWidth?.value) || 30);
  const height = Math.max(1, Number(refs.shapeHeight?.value) || width);
  const radius = Math.max(0, Number(refs.shapeRadius?.value) || 0);
  const sides = Math.max(3, Math.round(Number(refs.shapeSides?.value) || 6));
  let geometry;
  let name;
  let operation = "cut";
  if (kind === "rect") {
    geometry = geometryLib.buildShape("rect", { width, height, radius, operation: "cut" });
    name = `Dikdörtgen ${width}×${height}`;
  } else if (kind === "circle") {
    geometry = geometryLib.buildShape("circle", { width, operation: "cut" });
    name = `Daire Ø${width}`;
  } else if (kind === "polygon") {
    geometry = geometryLib.buildShape("polygon", { width, sides, operation: "cut" });
    name = `${sides}gen ${width}mm`;
  } else if (kind === "test-square") {
    geometry = geometryLib.buildShape("test-square", { size: width });
    name = `Test karesi ${width}mm`;
    operation = "cut";
  }
  if (!geometry) {
    setStatus("Şekil üretilemedi.");
    return;
  }
  addGeneratedVector(geometry, { name, operation });
}

function cloneVectorPaths(paths) {
  return (paths || []).map((item) => ({
    ...item,
    points: (item.points || []).map((point) => [Number(point[0]), Number(point[1])]),
    warnings: item.warnings ? [...item.warnings] : item.warnings,
  }));
}

function clonePatternPayload(pattern) {
  return {
    ...pattern,
    vectorPaths: cloneVectorPaths(pattern.vectorPaths || []),
    originalVectorPaths: cloneVectorPaths(pattern.originalVectorPaths || []),
    debugPreviews: (pattern.debugPreviews || []).map((preview) => ({ ...preview })),
    vectorSettings: pattern.vectorSettings ? { ...pattern.vectorSettings } : pattern.vectorSettings,
    vectorStats: pattern.vectorStats ? { ...pattern.vectorStats } : pattern.vectorStats,
    cleanStats: pattern.cleanStats ? { ...pattern.cleanStats } : pattern.cleanStats,
  };
}

function clonePatternCopy(pattern, suffix = "kopya", sourceImage = null) {
  const id = uid("pat");
  const copy = {
    ...clonePatternPayload(pattern),
    id,
    name: `${pattern.name || "Desen"} ${suffix}`,
  };
  const image = sourceImage || state.images.get(pattern.id);
  if (image) state.images.set(id, image);
  return copy;
}

function clonePatternForMirror(pattern) {
  return clonePatternCopy(pattern, "kopya");
}

function standalonePatternFromVectorPath(pattern, vectorPath) {
  if (!pattern || !vectorPath || !(vectorPath.points || []).length) return null;
  const worldPoints = vectorWorldPath(pattern, vectorPath);
  const worldBounds = boundsFromPoints(worldPoints);
  if (!worldBounds) return null;
  const rawWidth = worldBounds.maxX - worldBounds.minX;
  const rawHeight = worldBounds.maxY - worldBounds.minY;
  const width = Math.max(0.5, rawWidth);
  const height = Math.max(0.5, rawHeight);
  const operation = baseVectorPathOperation(vectorPath, pattern);
  const path = {
    ...clonePlain(vectorPath),
    id: uid("vp"),
    points: worldPoints.map((point) => [
      Number(point.x) - worldBounds.minX,
      height - (Number(point.y) - worldBounds.minY),
    ]),
    operation,
    removed: false,
    locked: false,
    deformable: false,
  };
  refreshVectorPathMetrics(path);
  const copy = {
    id: uid("pat"),
    parentId: null,
    path: pattern.path,
    originalPath: pattern.originalPath || pattern.path,
    sourcePath: pattern.sourcePath || pattern.originalPath || pattern.path,
    kind: "vector",
    operation,
    name: `${pattern.name || "Desen"} kontur`,
    x: worldBounds.minX,
    y: worldBounds.minY,
    width,
    height,
    rotation: 0,
    mirrorX: false,
    mirrorY: false,
    power: pattern.power,
    feed: pattern.feed,
    lineStep: pattern.lineStep,
    threshold: pattern.threshold,
    sourceWidth: width,
    sourceHeight: height,
    originalWidth: width,
    originalHeight: height,
    vectorPaths: [path],
    originalVectorPaths: cloneVectorPaths([path]),
    vectorSettings: pattern.vectorSettings ? { ...pattern.vectorSettings } : pattern.vectorSettings,
    vectorStats: null,
    debugPreviews: [],
    clipMargin: 0,
    clipCloseBoundary: false,
  };
  return copy;
}

function copySelectedVectorPath() {
  const selected = selectedVectorPath();
  const pattern = selected?.pattern;
  const vectorPath = selected?.vectorPath;
  const copy = standalonePatternFromVectorPath(pattern, vectorPath);
  if (!copy) {
    setStatus("Kopyalanacak kontur yok.");
    return false;
  }
  state.clipboard = [{ type: "pattern", pattern: copy, image: null }];
  state.clipboardPasteCount = 0;
  setStatus("1 kontur bagimsiz desen olarak kopyalandi.");
  return true;
}

function copySelectedPatterns() {
  const patterns = selectedPatternObjects();
  if (!patterns.length) {
    setStatus("Kopyalanacak desen yok.");
    return;
  }
  state.clipboard = patterns.map((pattern) => ({
    type: "pattern",
    pattern: clonePatternPayload(pattern),
    image: state.images.get(pattern.id) || null,
  }));
  state.clipboardPasteCount = 0;
  setStatus(`${patterns.length} desen kopyalandi.`);
}

function copySelectedPlacement() {
  const placement = state.selected?.type === "placement" ? placementById(state.selected.id) : null;
  const part = placement ? partById(placement.partId) : null;
  if (!placement || !part) {
    setStatus("Kopyalanacak DXF parcasi yok.");
    return false;
  }
  const childPatterns = state.patterns.filter((pattern) => pattern.parentId === placement.id);
  state.clipboard = [
    {
      type: "placement",
      placement: { ...placement },
      part: clonePartPayload(part),
      patterns: childPatterns.map((pattern) => ({
        pattern: clonePatternPayload(pattern),
        image: state.images.get(pattern.id) || null,
      })),
    },
  ];
  state.clipboardPasteCount = 0;
  setStatus("1 DXF parcasi kopyalandi.");
  return true;
}

function copySelection() {
  if (state.selected?.type === "vectorPath") {
    copySelectedVectorPath();
    return;
  }
  if (state.selected?.type === "placement") {
    copySelectedPlacement();
    return;
  }
  copySelectedPatterns();
}

function pastePatternsFromClipboard() {
  const items = state.clipboard.filter((item) => item.type === "pattern" || item.pattern);
  if (!items.length) {
    setStatus("Panoda desen yok.");
    return;
  }
  pushUndo("Desen yapistir");
  state.clipboardPasteCount += 1;
  const offset = state.clipboardPasteCount * 5;
  const copies = items.map((item) => {
    const copy = clonePatternCopy(item.pattern, "kopya", item.image);
    copy.x += offset;
    copy.y += offset;
    return copy;
  });
  state.patterns.push(...copies);
  selectPatternItems(copies.map((copy) => copy.id), copies[0]?.id);
  setStatus(`${copies.length} desen yapistirildi.`);
}

function pastePlacementsFromClipboard() {
  const items = state.clipboard.filter((item) => item.type === "placement");
  if (!items.length) {
    setStatus("Panoda DXF parcasi yok.");
    return;
  }
  pushUndo("Parca yapistir");
  state.clipboardPasteCount += 1;
  const offset = state.clipboardPasteCount * 5;
  const created = [];
  for (const item of items) {
    if (!partById(item.placement.partId)) {
      state.parts.push(clonePartPayload(item.part));
    }
    const placement = {
      ...item.placement,
      id: uid("pl"),
      x: item.placement.x + offset,
      y: item.placement.y + offset,
    };
    state.placements.push(placement);
    created.push(placement);
    const patternCopies = (item.patterns || []).map((payload) => {
      const copy = clonePatternCopy(payload.pattern, "kopya", payload.image);
      copy.parentId = placement.id;
      copy.x += offset;
      copy.y += offset;
      return copy;
    });
    state.patterns.push(...patternCopies);
  }
  if (created[0]) select("placement", created[0].id);
  else draw();
  setStatus(`${created.length} DXF parcasi yapistirildi.`);
}

function pasteClipboard() {
  if (!state.clipboard.length) {
    setStatus("Pano bos.");
    return;
  }
  if (state.clipboard.some((item) => item.type === "placement")) {
    pastePlacementsFromClipboard();
    return;
  }
  pastePatternsFromClipboard();
}

function selectAllPatterns() {
  if (!state.patterns.length) {
    setStatus("Secilecek desen yok.");
    return;
  }
  selectPatternItems(state.patterns.map((pattern) => pattern.id), state.patterns[0].id);
  setStatus(`${state.patterns.length} desen secildi.`);
}

function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area / 2);
}

function pointDistance(a, b) {
  return Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
}

function polylineLength(points, closed = false) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += pointDistance(points[index - 1], points[index]);
  if (closed) total += pointDistance(points[points.length - 1], points[0]);
  return total;
}

function turnAngle(prev, point, next) {
  const ax = Number(point[0]) - Number(prev[0]);
  const ay = Number(point[1]) - Number(prev[1]);
  const bx = Number(next[0]) - Number(point[0]);
  const by = Number(next[1]) - Number(point[1]);
  const al = Math.hypot(ax, ay);
  const bl = Math.hypot(bx, by);
  if (al < 1e-6 || bl < 1e-6) return 0;
  const dot = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl)));
  return (Math.acos(dot) * 180) / Math.PI;
}

function dedupeVectorPoints(points, closed, minDistance = 0.08) {
  const output = [];
  for (const point of points || []) {
    const next = [Number(point[0]), Number(point[1])];
    if (!output.length || pointDistance(output[output.length - 1], next) >= minDistance) output.push(next);
  }
  if (closed && output.length > 2 && pointDistance(output[0], output[output.length - 1]) < minDistance) output.pop();
  return output;
}

function smoothVectorPoints(points, closed = true, passes = 2) {
  let current = dedupeVectorPoints(points, closed, 0.04);
  if (current.length < (closed ? 5 : 4)) return current;
  for (let pass = 0; pass < Math.max(1, passes); pass += 1) {
    const output = [];
    for (let index = 0; index < current.length; index += 1) {
      const point = current[index];
      if (!closed && (index === 0 || index === current.length - 1)) {
        output.push(point);
        continue;
      }
      const prev = current[(index - 1 + current.length) % current.length];
      const next = current[(index + 1) % current.length];
      const angle = turnAngle(prev, point, next);
      if (angle >= 58) {
        output.push(point);
        continue;
      }
      output.push([
        point[0] * 0.58 + (prev[0] + next[0]) * 0.21,
        point[1] * 0.58 + (prev[1] + next[1]) * 0.21,
      ]);
    }
    current = dedupeVectorPoints(output, closed, 0.08);
  }
  return current;
}

function refreshVectorPathMetrics(vectorPath) {
  const points = vectorPath.points || [];
  vectorPath.area = vectorPath.closed ? polygonArea(points) : 0;
  vectorPath.length = polylineLength(points, Boolean(vectorPath.closed));
  const bounds = vectorPathBounds(vectorPath);
  vectorPath.bbox = bounds ? [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY] : vectorPath.bbox;
}

function smoothSelectedVector(pattern) {
  if (!vectorPatternHasPaths(pattern)) return;
  pushUndo("Vektor yumusat");
  if (!pattern.originalVectorPaths?.length) pattern.originalVectorPaths = cloneVectorPaths(pattern.vectorPaths || []);
  let changed = 0;
  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed || !vectorPath.points || vectorPath.points.length < 4) continue;
    const before = vectorPath.points.length;
    const smoothed = smoothVectorPoints(vectorPath.points, Boolean(vectorPath.closed), 2);
    if (smoothed.length < 3) continue;
    vectorPath.points = smoothed;
    refreshVectorPathMetrics(vectorPath);
    if (smoothed.length !== before || polylineLength(smoothed, Boolean(vectorPath.closed)) > 0) changed += 1;
  }
  draw();
  updateSelectionPanel();
  setStatus(changed ? `${changed} kontur yumuşatıldı. Geri almak için Konturları Geri Al.` : "Yumuşatılacak uygun kontur bulunamadı.");
}

function vectorPathsForCurrentSize(pattern) {
  const sourceWidth = Math.max(0.001, pattern.sourceWidth || pattern.width);
  const sourceHeight = Math.max(0.001, pattern.sourceHeight || pattern.height);
  return (pattern.vectorPaths || []).map((vectorPath) => ({
    ...vectorPath,
    points: (vectorPath.points || []).map((point) => [
      (Number(point[0]) / sourceWidth) * pattern.width,
      (Number(point[1]) / sourceHeight) * pattern.height,
    ]),
  }));
}

async function saveSelectedVectorSvg() {
  const pattern = selectedVectorPattern();
  if (!vectorPatternHasPaths(pattern)) {
    setStatus("Önce bir SVG veya vektör deseni seçin.");
    return;
  }
  const activePaths = (pattern.vectorPaths || []).filter((item) => vectorPathIsActive(item, pattern));
  if (!activePaths.length) {
    setStatus("Kaydedilecek aktif kontur kalmadı.");
    return;
  }
  try {
    setStatus("SVG kaydediliyor...");
    const data = await api("/api/save-vector-svg", {
      name: pattern.name || "vectorized.svg",
      vectorPaths: vectorPathsForCurrentSize({ ...pattern, vectorPaths: activePaths }),
      sourceWidth: pattern.width,
      sourceHeight: pattern.height,
      fillMode: vectorPatternFilledPreview(pattern),
      fillInvert: vectorPatternFillInvert(pattern),
    });
    if (!data.saved) {
      setStatus("SVG kaydedilmedi.");
      return;
    }
    setStatus(`SVG kaydedildi: ${data.saved.outputPath}`);
  } catch (error) {
    setStatus(error.message);
  }
}

function centerSelectedPattern(recordUndo = true) {
  const pattern = selectedPattern();
  const placement = selectedPlacement();
  if (!pattern) return;
  if (recordUndo) pushUndo("Deseni ortala");
  const b = bed();
  const size = placement ? placementSize(placement) : { width: b.width, height: b.height };
  pattern.x = (placement?.x || 0) + (size.width - pattern.width) / 2;
  pattern.y = (placement?.y || 0) + (size.height - pattern.height) / 2;
  pattern.parentId = placement?.id || null;
  draw();
  updateSelectionPanel();
}

function fitSelectedPattern() {
  const pattern = selectedPattern();
  const placement = selectedPlacement();
  if (!pattern) return;
  pushUndo("Deseni sigdir");
  const b = bed();
  const size = placement ? placementSize(placement) : { width: b.width, height: b.height };
  const padding = Math.min(size.width, size.height) * 0.12;
  const maxWidth = Math.max(4, size.width - padding * 2);
  const maxHeight = Math.max(4, size.height - padding * 2);
  const aspect = pattern.width / Math.max(0.01, pattern.height);
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  updatePatternGeometry(pattern, { width, height });
  pattern.parentId = placement?.id || null;
  centerSelectedPattern(false);
}

function frameRepeatCount(sideLength, moduleWidth) {
  if (sideLength <= 0 || moduleWidth <= 0 || sideLength < moduleWidth) return 0;
  const rawCount = Math.max(1, Math.floor(sideLength / Math.max(0.5, moduleWidth)));
  return Math.min(80, rawCount);
}

function frameRepeatOffsets(sideLength, moduleWidth) {
  const count = frameRepeatCount(sideLength, moduleWidth);
  if (!count) return [];
  const usedLength = count * moduleWidth;
  const startOffset = (sideLength - usedLength) / 2 + moduleWidth / 2;
  return Array.from({ length: count }, (_value, index) => startOffset + index * moduleWidth);
}

function createFrameFromSelectedPattern() {
  const pattern = selectedPattern();
  if (!pattern) return;
  const placement = placementById(pattern.parentId);
  if (!placement) {
    setStatus("Cerceve icin deseni once bir DXF parcasina baglayin.");
    return;
  }
  const size = placementSize(placement);
  const moduleWidth = Math.max(0.5, Number(pattern.width) || 1);
  const moduleHeight = Math.max(0.5, Number(pattern.height) || 1);
  const edgeMargin = placementClipMargin(placement) + Math.max(0, Number(pattern.clipMargin) || 0);
  const centerInset = edgeMargin + moduleHeight / 2;
  const horizontalLength = size.width - edgeMargin * 2;
  const verticalLength = size.height - edgeMargin * 2;
  const bottomY = placement.y + centerInset;
  const topY = placement.y + size.height - centerInset;
  const leftX = placement.x + centerInset;
  const rightX = placement.x + size.width - centerInset;
  const baseRotation = Number(pattern.rotation) || 0;
  const sides = [
    { name: "alt", length: horizontalLength, start: { x: placement.x + edgeMargin, y: bottomY }, dir: { x: 1, y: 0 }, rotation: 0 },
    { name: "sag", length: verticalLength, start: { x: rightX, y: placement.y + edgeMargin }, dir: { x: 0, y: 1 }, rotation: 90 },
    { name: "ust", length: horizontalLength, start: { x: placement.x + size.width - edgeMargin, y: topY }, dir: { x: -1, y: 0 }, rotation: 180 },
    { name: "sol", length: verticalLength, start: { x: leftX, y: placement.y + size.height - edgeMargin }, dir: { x: 0, y: -1 }, rotation: 270 },
  ];
  const copies = [];
  let capped = false;
  for (const side of sides) {
    const offsets = frameRepeatOffsets(side.length, moduleWidth);
    if (!offsets.length) continue;
    if (Math.floor(side.length / Math.max(0.5, moduleWidth)) > offsets.length) capped = true;
    for (const [index, offset] of offsets.entries()) {
      const center = {
        x: side.start.x + side.dir.x * offset,
        y: side.start.y + side.dir.y * offset,
      };
      const copy = clonePatternCopy(pattern, `cerceve ${side.name} ${index + 1}`);
      copy.parentId = placement.id;
      copy.frameSourceId = pattern.id;
      copy.frameSide = side.name;
      copy.frameIndex = index;
      copy.width = moduleWidth;
      copy.height = moduleHeight;
      copy.x = center.x - copy.width / 2;
      copy.y = center.y - copy.height / 2;
      copy.rotation = (baseRotation + side.rotation + 360) % 360;
      copies.push(copy);
    }
  }
  if (!copies.length) {
    setStatus("Cerceve icin yeterli kenar alani yok.");
    return;
  }
  pushUndo("Kenar cerceve");
  state.patterns.push(...copies);
  select("pattern", pattern.id);
  draw();
  updateSelectionPanel();
  setStatus(`${copies.length} motifle kenar cercevesi olusturuldu.${capped ? " Cok kucuk motiflerde tekrar sayisi sinirlandi." : ""}`);
}

function mirrorSelectedPattern(axis) {
  const pattern = selectedPattern();
  if (!pattern) return;
  const placement = placementById(pattern.parentId);
  if (!placement) {
    setStatus("Aynalama icin deseni once bir DXF parcasina baglayin.");
    return;
  }
  const copy = clonePatternForMirror(pattern);
  const center = placementCenter(placement);
  const patternCenterX = copy.x + copy.width / 2;
  const patternCenterY = copy.y + copy.height / 2;
  if (axis === "x") {
    const mirroredCenterX = center.x * 2 - patternCenterX;
    copy.x = mirroredCenterX - copy.width / 2;
    copy.mirrorX = !copy.mirrorX;
    copy.rotation = (360 - (Number(copy.rotation) || 0)) % 360;
    setStatus("Desenin kopyasi parcanin dikey merkez eksenine gore aynalandi.");
  } else {
    const mirroredCenterY = center.y * 2 - patternCenterY;
    copy.y = mirroredCenterY - copy.height / 2;
    copy.mirrorY = !copy.mirrorY;
    copy.rotation = (360 - (Number(copy.rotation) || 0)) % 360;
    setStatus("Desenin kopyasi parcanin yatay merkez eksenine gore aynalandi.");
  }
  pushUndo("Deseni aynala");
  state.patterns.push(copy);
  select("pattern", copy.id);
  draw();
  updateSelectionPanel();
}

function selectedPattern() {
  if (state.selected?.type !== "pattern" && state.selected?.type !== "vectorPath") return null;
  return patternById(state.selected.id);
}

function rotateSelected(delta) {
  if (!state.selected) return;
  pushUndo("Dondur");
  if (state.selected.type === "pattern") {
    const pattern = selectedPattern();
    if (!pattern) return;
    pattern.rotation = (pattern.rotation + delta + 360) % 360;
  }
  if (state.selected.type === "placement") {
    const placement = placementById(state.selected.id);
    if (!placement) return;
    placement.rotation = (placement.rotation + delta + 360) % 360;
    markManualLayout();
  }
  draw();
  updateSelectionPanel();
}

function selectedObject() {
  if (!state.selected) return null;
  if (state.selected.type === "pattern" || state.selected.type === "vectorPath") return patternById(state.selected.id);
  return placementById(state.selected.id);
}

function moveSelected(dx, dy) {
  if (!dx && !dy) return;
  if (state.selected?.type === "vectorPath") {
    const selected = selectedVectorPath();
    if (!selected) return;
    pushUndo("Kontur tasi");
    if (moveVectorPathByMm(selected.pattern, selected.vectorPath, dx, dy)) {
      draw();
      updateSelectionPanel();
    }
    return;
  }
  pushUndo("Tasi");
  const selectedPatterns = selectedPatternObjects();
  if (selectedPatterns.length && state.selected?.type !== "placement") {
    for (const pattern of selectedPatterns) {
      pattern.x += dx;
      pattern.y += dy;
    }
    draw();
    updateSelectionPanel();
    return;
  }
  const object = selectedObject();
  if (!object) return;
  object.x += dx;
  object.y += dy;
  if (state.selected.type === "placement") {
    markManualLayout();
    for (const pattern of state.patterns.filter((item) => item.parentId === object.id)) {
      pattern.x += dx;
      pattern.y += dy;
    }
  }
  draw();
  updateSelectionPanel();
}

function resizeSelected(factor) {
  const pattern = selectedPattern();
  if (!pattern) return;
  pushUndo("Olcekle");
  const cx = pattern.x + pattern.width / 2;
  const cy = pattern.y + pattern.height / 2;
  const width = Math.max(1, pattern.width * factor);
  const height = Math.max(1, pattern.height * factor);
  updatePatternGeometry(pattern, {
    width,
    height,
    x: cx - width / 2,
    y: cy - height / 2,
  });
  draw();
  updateSelectionPanel();
}

function deleteSelected() {
  if (!state.selected) return;
  pushUndo("Sil");
  const selectedPatterns = selectedPatternObjects();
  if (selectedPatterns.length > 1) {
    const ids = new Set(selectedPatterns.map((pattern) => pattern.id));
    state.patterns = state.patterns.filter((item) => !ids.has(item.id));
    for (const id of ids) state.images.delete(id);
    select(null, null);
    return;
  }
  if (state.selected.type === "pattern") {
    state.patterns = state.patterns.filter((item) => item.id !== state.selected.id);
    state.images.delete(state.selected.id);
  } else if (state.selected.type === "vectorPath") {
    const selected = selectedVectorPath();
    if (selected) {
      selected.vectorPath.removed = true;
      select("pattern", selected.pattern.id);
      return;
    }
  } else if (state.selected.type === "placement") {
    const id = state.selected.id;
    deletePlacementById(id);
  }
  select(null, null);
}

function nudgeStep(event = null) {
  let step = Math.max(0.01, Number(refs.nudgeStep?.value) || 0.1);
  if (event?.shiftKey) step *= 10;
  if (event?.altKey) step *= 0.1;
  return step;
}

function patternHandles(pattern) {
  const corners = patternCorners(pattern);
  const sides = [
    patternPoint(pattern, pattern.width / 2, 0),
    patternPoint(pattern, pattern.width, pattern.height / 2),
    patternPoint(pattern, pattern.width / 2, pattern.height),
    patternPoint(pattern, 0, pattern.height / 2),
  ];
  const top = patternPoint(pattern, pattern.width / 2, pattern.height + 16 / state.view.scale);
  return [
    ...corners.map((world, index) => ({ type: "resize", index, world, screen: worldToScreen(world) })),
    { type: "resizeY", index: 0, world: sides[0], screen: worldToScreen(sides[0]) },
    { type: "resizeX", index: 1, world: sides[1], screen: worldToScreen(sides[1]) },
    { type: "resizeY", index: 2, world: sides[2], screen: worldToScreen(sides[2]) },
    { type: "resizeX", index: 3, world: sides[3], screen: worldToScreen(sides[3]) },
    { type: "rotate", world: top, screen: worldToScreen(top) },
  ];
}

function hitPatternHandle(screenPoint) {
  const pattern = selectedPattern();
  if (!pattern) return null;
  for (const handle of patternHandles(pattern)) {
    const distance = Math.hypot(screenPoint.x - handle.screen.x, screenPoint.y - handle.screen.y);
    if (distance <= 10) return handle;
  }
  return null;
}

function hitTest(worldPoint) {
  const vectorHitDistance = Math.max(2 / Math.max(0.001, state.view.scale), 0.3);
  for (let i = state.patterns.length - 1; i >= 0; i -= 1) {
    const pattern = state.patterns[i];
    if (vectorPatternHasPaths(pattern)) {
      const vectorPaths = pattern.vectorPaths || [];
      for (let j = vectorPaths.length - 1; j >= 0; j -= 1) {
        const vectorPath = vectorPaths[j];
        if (vectorPath.removed) continue;
        const points = vectorWorldPath(pattern, vectorPath);
        if (distanceToPolyline(worldPoint, points, Boolean(vectorPath.closed)) <= vectorHitDistance) {
          return { type: "vectorPath", id: pattern.id, pathId: vectorPath.id };
        }
      }
    }
    if (pointInPolygon(worldPoint, patternCorners(pattern))) return { type: "pattern", id: pattern.id };
  }
  for (let i = state.placements.length - 1; i >= 0; i -= 1) {
    const placement = state.placements[i];
    const size = placementSize(placement);
    if (
      worldPoint.x >= placement.x &&
      worldPoint.x <= placement.x + size.width &&
      worldPoint.y >= placement.y &&
      worldPoint.y <= placement.y + size.height
    ) {
      return { type: "placement", id: placement.id };
    }
  }
  return null;
}

function onPointerDown(event) {
  const screen = canvasPoint(event);
  const world = screenToWorld(screen);
  if (state.materialArea.drawing && event.button === 0 && !state.spaceDown) {
    addMaterialAreaPoint(world);
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  if (event.button === 1 || state.spaceDown) {
    state.drag = {
      mode: "pan",
      startScreen: screen,
      startPanX: state.view.panX,
      startPanY: state.view.panY,
    };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  const handle = hitPatternHandle(screen);
  if (handle) {
    const pattern = selectedPattern();
    const center = { x: pattern.x + pattern.width / 2, y: pattern.y + pattern.height / 2 };
    pushUndo(handle.type === "rotate" ? "Dondur" : "Olcekle");
    state.drag = {
      mode: handle.type,
      id: pattern.id,
      startWorld: world,
      startPattern: { ...pattern },
      center,
      startDistance: Math.max(0.01, Math.hypot(world.x - center.x, world.y - center.y)),
      startAngle: Math.atan2(world.y - center.y, world.x - center.x),
      startAxisDistance: handle.type === "resizeX" ? Math.max(0.01, pattern.width / 2) : Math.max(0.01, pattern.height / 2),
    };
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  const hit = hitTest(world);
  if (!hit) {
    select(null, null);
    state.drag = {
      mode: "pan",
      startScreen: screen,
      startPanX: state.view.panX,
      startPanY: state.view.panY,
    };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (hit.type === "vectorPath") {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      togglePatternSelection(hit.id);
      return;
    }
    select("vectorPath", hit.id, { pathId: hit.pathId });
    return;
  }
  if ((event.ctrlKey || event.metaKey || event.shiftKey) && hit.type === "pattern") {
    togglePatternSelection(hit.id);
    return;
  }
  const movingPatternGroup = hit.type === "pattern" && selectedIs("pattern", hit.id) && selectedPatternObjects().length > 1;
  if (movingPatternGroup) {
    state.selected = { type: "pattern", id: hit.id };
    updateSelectionPanel();
  } else {
    select(hit.type, hit.id);
  }
  const selectedObject = hit.type === "pattern" ? patternById(hit.id) : placementById(hit.id);
  pushUndo(hit.type === "pattern" ? "Desen tasi" : "Parca tasi");
  state.drag = {
    mode: movingPatternGroup ? "moveSelection" : hit.type === "pattern" ? "movePattern" : "movePlacement",
    id: hit.id,
    startWorld: world,
    startObject: { ...selectedObject },
    startSelectedPatterns: movingPatternGroup
      ? selectedPatternObjects().map((item) => ({ id: item.id, x: item.x, y: item.y }))
      : [],
    startPatterns:
      hit.type === "placement"
        ? state.patterns
            .filter((item) => item.parentId === hit.id)
            .map((item) => ({ id: item.id, x: item.x, y: item.y }))
        : [],
  };
  canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  const screen = canvasPoint(event);
  const world = screenToWorld(screen);
  state.cursor = world;
  if (state.materialArea.drawing) {
    state.materialArea.previewPoint = axisConstrainedMaterialAreaPoint(world);
    canvas.style.cursor = "crosshair";
    draw();
    return;
  }
  if (!state.drag) {
    const handle = hitPatternHandle(screen);
    const handleCursor =
      handle?.type === "rotate"
        ? "grab"
        : handle?.type === "resizeX"
          ? "ew-resize"
          : handle?.type === "resizeY"
            ? "ns-resize"
            : handle
              ? "nwse-resize"
              : "";
    canvas.style.cursor = handleCursor || (hitTest(world) ? "move" : "grab");
    computeView();
    return;
  }
  if (state.drag.mode === "pan") {
    state.view.panX = state.drag.startPanX + (screen.x - state.drag.startScreen.x);
    state.view.panY = state.drag.startPanY + (screen.y - state.drag.startScreen.y);
    draw();
    return;
  }
  const dx = world.x - state.drag.startWorld.x;
  const dy = world.y - state.drag.startWorld.y;
  if (state.drag.mode === "movePattern") {
    const pattern = patternById(state.drag.id);
    pattern.x = state.drag.startObject.x + dx;
    pattern.y = state.drag.startObject.y + dy;
  }
  if (state.drag.mode === "moveSelection") {
    for (const startPattern of state.drag.startSelectedPatterns || []) {
      const pattern = patternById(startPattern.id);
      if (!pattern) continue;
      pattern.x = startPattern.x + dx;
      pattern.y = startPattern.y + dy;
    }
  }
  if (state.drag.mode === "movePlacement") {
    const placement = placementById(state.drag.id);
    placement.x = state.drag.startObject.x + dx;
    placement.y = state.drag.startObject.y + dy;
    for (const startPattern of state.drag.startPatterns) {
      const pattern = patternById(startPattern.id);
      if (!pattern) continue;
      pattern.x = startPattern.x + dx;
      pattern.y = startPattern.y + dy;
    }
  }
  if (state.drag.mode === "resize") {
    const pattern = patternById(state.drag.id);
    const distance = Math.max(0.01, Math.hypot(world.x - state.drag.center.x, world.y - state.drag.center.y));
    const factor = Math.max(0.05, distance / state.drag.startDistance);
    const width = Math.max(1, state.drag.startPattern.width * factor);
    const height = Math.max(1, state.drag.startPattern.height * factor);
    updatePatternGeometry(pattern, {
      width,
      height,
      x: state.drag.center.x - width / 2,
      y: state.drag.center.y - height / 2,
    });
  }
  if (state.drag.mode === "resizeX") {
    const pattern = patternById(state.drag.id);
    if (!pattern) return;
    const local = patternLocalPointFromWorld(state.drag.startPattern, world);
    const factor = Math.max(0.05, Math.abs(local.x - state.drag.startPattern.width / 2) / state.drag.startAxisDistance);
    const width = Math.max(1, state.drag.startPattern.width * factor);
    updatePatternGeometry(pattern, {
      width,
      height: state.drag.startPattern.height,
      x: state.drag.center.x - width / 2,
      y: state.drag.center.y - state.drag.startPattern.height / 2,
    });
  }
  if (state.drag.mode === "resizeY") {
    const pattern = patternById(state.drag.id);
    if (!pattern) return;
    const local = patternLocalPointFromWorld(state.drag.startPattern, world);
    const factor = Math.max(0.05, Math.abs(local.y - state.drag.startPattern.height / 2) / state.drag.startAxisDistance);
    const height = Math.max(1, state.drag.startPattern.height * factor);
    updatePatternGeometry(pattern, {
      width: state.drag.startPattern.width,
      height,
      x: state.drag.center.x - state.drag.startPattern.width / 2,
      y: state.drag.center.y - height / 2,
    });
  }
  if (state.drag.mode === "rotate") {
    const pattern = patternById(state.drag.id);
    const angle = Math.atan2(world.y - state.drag.center.y, world.x - state.drag.center.x);
    pattern.rotation = (state.drag.startPattern.rotation + ((angle - state.drag.startAngle) * 180) / Math.PI + 360) % 360;
  }
  draw();
  updateSelectionPanel();
}

function onPointerUp(event) {
  const hadDrag = Boolean(state.drag);
  if (state.drag?.mode === "movePlacement") {
    markManualLayout();
    draw();
  }
  state.drag = null;
  canvas.releasePointerCapture?.(event.pointerId);
  if (hadDrag) updateJobAnalysisNow();
}

function onWheel(event) {
  event.preventDefault();
  const direction = event.deltaY < 0 ? 1 : -1;
  const screen = canvasPoint(event);
  const pattern = selectedPattern();
  const world = screenToWorld(screen);
  if (pattern && pointInPolygon(world, patternCorners(pattern)) && event.altKey) {
    const factor = direction > 0 ? 1.03 : 1 / 1.03;
    resizeSelected(factor);
    return;
  }
  if (pattern && pointInPolygon(world, patternCorners(pattern)) && event.shiftKey) {
    pushUndo("Dondur");
    pattern.rotation = (pattern.rotation + direction * 5 + 360) % 360;
    draw();
    updateSelectionPanel();
    return;
  }
  zoomView(direction > 0 ? 1.12 : 1 / 1.12, screen);
}

async function chooseOutput() {
  try {
    const data = await api("/api/save-gcode-dialog", {});
    if (data.path) {
      pushUndo("Cikti yolu");
      refs.outputPath.value = data.path;
      clearMachinePreview();
      updateSummary();
    }
  } catch (error) {
    setStatus(error.message);
  }
}

function projectDefaultName() {
  const output = refs.outputPath?.value || "";
  const name = output.split(/[\\/]/).pop()?.replace(/\.(nc|gcode)$/i, "") || "laser_job";
  return `${name}.laserjob.json`;
}

function projectPayload() {
  return {
    schema: "laser-editor-project-v1",
    version: 1,
    features: { embeddedPartGeometry: true },
    name: projectDefaultName(),
    savedAt: new Date().toISOString(),
    parts: clonePlain(state.parts),
    placements: clonePlain(state.placements),
    patterns: state.patterns.map((pattern) => clonePatternPayload(pattern)),
    customFonts: clonePlain(state.customFonts),
    selected: state.selected ? clonePlain(state.selected) : null,
    selectedItems: clonePlain(state.selectedItems || []),
    layout: clonePlain(state.layout),
    materialArea: clonePlain(state.materialArea),
    laserCmd: state.laserCmd,
    inputs: undoInputSnapshot(),
    outputPath: refs.outputPath?.value || "",
    imageSources: captureImageSources(),
  };
}

function restoreProject(project) {
  if (!project || project.schema !== "laser-editor-project-v1") {
    throw new Error("Bu dosya Lazer İş Editörü proje dosyası değil.");
  }
  pushUndo("Proje ac");
  state.parts = clonePlain(project.parts || []);
  state.placements = clonePlain(project.placements || []);
  state.patterns = (project.patterns || []).map((pattern) => clonePatternPayload(pattern));
  state.customFonts = clonePlain(project.customFonts || []).map((font) => ({ ...font, installed: false }));
  state.selected = project.selected ? clonePlain(project.selected) : null;
  state.selectedItems = clonePlain(project.selectedItems || []);
  state.layout = clonePlain(project.layout || state.layout);
  state.materialArea = normalizeMaterialArea(project.materialArea || {});
  state.laserCmd = project.laserCmd || state.laserCmd;
  applyUndoInputSnapshot(project.inputs || {});
  if (refs.outputPath) refs.outputPath.value = project.outputPath || project.inputs?.outputPath || "";
  restoreImageSources(project.imageSources || {});
  installCustomFonts().then(() => renderTextFontOptions(project.inputs?.textFont || refs.textFont?.value)).catch(() => renderTextFontOptions(refs.textFont?.value));
  syncLaserButtons();
  clearMachinePreview();
  saveUiSettings();
  updateUiFromAnalysis(computeJobAnalysis());
  updateSelectionPanel();
  draw();
  renderMachinePanel();
}

async function saveProject() {
  try {
    setStatus("İş projesi kaydediliyor...");
    const data = await api("/api/save-project", {
      project: projectPayload(),
      defaultName: projectDefaultName(),
    });
    if (!data.saved) {
      setStatus("Proje kaydedilmedi.");
      return;
    }
    setStatus(`Proje kaydedildi: ${data.saved.outputPath}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function openProject() {
  try {
    const data = await api("/api/open-project", {});
    if (!data.project) {
      setStatus("Proje seçilmedi.");
      return;
    }
    restoreProject(data.project);
    setStatus(`Proje açıldı: ${data.path || data.project.name || ""}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function convertOutputToCut() {
  const path = refs.outputPath?.value.trim() || "";
  if (!path) {
    setStatus("Önce kazıma olarak oluşan G-code dosyasını Çıktı Seç ile seçin.", "warn");
    return;
  }
  const cutPower = clamp(Math.round(mm("cutPower", 1000)), 0, 1000);
  const cutFeed = Math.max(1, mm("cutFeed", 500));
  const message = `Bu işlem mevcut G-code içindeki vektör/SVG kazıma bloklarını kesime çevirir.\n\nS${cutPower}, F${cutFeed.toFixed(0)} kullanılacak.\nOrijinal dosya korunur, yeni _cut.nc dosyası yazılır.\n\nDevam edilsin mi?`;
  if (!window.confirm(message)) return;
  try {
    setStatus("G-code kesime çevriliyor...");
    const data = await api("/api/convert-gcode-to-cut", { path, cutPower, cutFeed });
    const result = data.result;
    pushUndo("G-code kesim dosyasi");
    refs.outputPath.value = result.outputPath;
    clearMachinePreview();
    saveUiSettings();
    updateSummary(
      `\nKesime çevrilen blok: ${result.convertedBlocks}\nGüç komutu: ${result.powerChanges}\nHız komutu: ${result.feedChanges}\nÇıktı: ${result.outputPath}`
    );
    renderMachinePanel();
    setStatus(`G-code kesime çevrildi: ${result.outputPath}`, "ok");
  } catch (error) {
    setStatus(error.message, "danger");
  }
}

async function generateGcode() {
  const analysis = computeJobAnalysis();
  updateUiFromAnalysis(analysis);
  if (!analysis.canGenerate) {
    const first = analysis.warnings.find((item) => item.level === "critical");
    setStatus(`G-code oluşturulamaz: ${first?.title || "kritik sorun var"}.`);
    refs.preflightPanel?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (!refs.outputPath.value) {
    await chooseOutput();
    if (!refs.outputPath.value) return;
  }
  try {
    setStatus("G-code oluşturuluyor...");
    const payload = {
      parts: state.parts.map((part) => ({ id: part.id, path: part.path })),
      placements: state.placements.map((placement) => ({ ...placement, operation: placementOperation(placement) })),
      patterns: state.patterns.map((pattern) => ({ ...pattern, operation: patternOperation(pattern) })),
      settings: getSettings(),
      outputPath: refs.outputPath.value,
    };
    const data = await api("/api/generate", payload);
    const result = data.result;
    setStatus("G-code hazır.");
    updateSummary(
      `\nKesim alanı: ${result.cutWidth.toFixed(2)} x ${result.cutHeight.toFixed(2)} mm\nSatır: ${result.lineCount}`
    );
    ensureMachinePreviewForCurrentOutput(false);
    openProduceFlow(result);
  } catch (error) {
    setStatus(error.message);
  }
}

function clearParts() {
  if (state.parts.length || state.placements.length || state.patterns.length) pushUndo("Temizle");
  state.parts = [];
  state.placements = [];
  state.patterns = [];
  state.images.clear();
  state.layout.appliedSettings = layoutSettingsSnapshot();
  state.layout.previousSettings = null;
  state.layout.dirty = false;
  state.layout.manual = false;
  select(null, null);
  draw();
  setStatus("Temizlendi.");
}

function isTypingTarget(target) {
  return target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function onKeyDown(event) {
  if (state.materialArea.drawing && !isTypingTarget(event.target)) {
    if (event.key === "Enter") {
      finishMaterialAreaDrawing();
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      state.materialArea.drawing = false;
      state.materialArea.previewPoint = null;
      draw();
      setStatus("Alan cizimi durduruldu.");
      event.preventDefault();
      return;
    }
  }
  if (event.code === "Space" && !isTypingTarget(event.target)) {
    state.spaceDown = true;
    event.preventDefault();
    return;
  }
  if (isTypingTarget(event.target)) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
    undoLast();
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && (key === "y" || (key === "z" && event.shiftKey))) {
    redoLast();
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "c") {
    copySelection();
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "v") {
    pasteClipboard();
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "a") {
    selectAllPatterns();
    event.preventDefault();
    return;
  }
  if (!state.selected) return;
  const step = nudgeStep(event);
  if (event.key === "ArrowLeft") {
    moveSelected(-step, 0);
    event.preventDefault();
  } else if (event.key === "ArrowRight") {
    moveSelected(step, 0);
    event.preventDefault();
  } else if (event.key === "ArrowUp") {
    moveSelected(0, step);
    event.preventDefault();
  } else if (event.key === "ArrowDown") {
    moveSelected(0, -step);
    event.preventDefault();
  } else if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelected();
    event.preventDefault();
  } else if (event.key.toLowerCase() === "r") {
    rotateSelected(event.shiftKey ? -1 : 1);
    event.preventDefault();
  }
}

function onKeyUp(event) {
  if (event.code === "Space") {
    state.spaceDown = false;
  }
}

let layoutSettingsTimer = null;

function scheduleTablePreviewUpdate() {
  saveUiSettings();
  window.clearTimeout(layoutSettingsTimer);
  layoutSettingsTimer = window.setTimeout(() => {
    if (!layoutSettingsReady()) {
      draw();
      setStatus("Tabla olculeri ve adet pozitif olmali.");
      return;
    }
    markLayoutSettingsChanged();
  }, 350);
}

function layoutSettingsReady() {
  const width = Number(refs.bedW?.value);
  const height = Number(refs.bedH?.value);
  const gap = Number(refs.gap?.value);
  const margin = Number(refs.margin?.value);
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Number.isFinite(gap) &&
    Number.isFinite(margin) &&
    width > 0 &&
    height > 0 &&
    gap >= 0 &&
    margin >= 0
  );
}

function scheduleLayoutPreviewUpdate() {
  saveUiSettings();
  window.clearTimeout(layoutSettingsTimer);
  layoutSettingsTimer = window.setTimeout(() => {
    if (!layoutSettingsReady()) {
      draw();
      setStatus("Tabla olculeri ve adet pozitif olmali.");
      return;
    }
    markLayoutSettingsChanged();
  }, 250);
}

function applyAlignmentPreviewUpdate() {
  saveUiSettings();
  if (jobBounds()) {
    alignJobToBed(false);
    markManualLayout();
  }
  else draw();
}

function bindControls() {
  undoInputIds.forEach((id) => bindUndoBeforeEdit(refs[id], "Ayar degisikligi"));
  document.getElementById("addDxfBtn").addEventListener("click", addDxfs);
  document.getElementById("addImageBtn").addEventListener("click", addImage);
  // Ust bardaki "Foto→Vektör" artik ayar panelini acar (dogrudan tekrar
  // vektorlestirmek yerine); asil eylem panel icindeki butondadir.
  document.getElementById("vectorizeBtn").addEventListener("click", openVectorPanel);
  document.getElementById("vectorizePhotoBtn").addEventListener("click", vectorizePhoto);
  document.getElementById("revectorizeBtn").addEventListener("click", revectorizeSelected);
  document.getElementById("vectorAutoPresetBtn")?.addEventListener("click", applyAutoVectorPreset);
  document.getElementById("saveVectorSvgBtn").addEventListener("click", saveSelectedVectorSvg);
  document.getElementById("autoLayoutBtn").addEventListener("click", autoLayout);
  refs.drawAreaToolBtn?.addEventListener("click", beginMaterialAreaDrawing);
  refs.finishAreaBtn?.addEventListener("click", finishMaterialAreaDrawing);
  refs.clearAreaBtn?.addEventListener("click", clearMaterialArea);
  document.getElementById("alignJobBtn").addEventListener("click", () => alignJobToBed(true));
  document.getElementById("applyJobOffsetBtn").addEventListener("click", applyJobOffset);
  document.getElementById("openProjectBtn")?.addEventListener("click", openProject);
  document.getElementById("saveProjectBtn")?.addEventListener("click", saveProject);
  document.getElementById("chooseOutputBtn").addEventListener("click", chooseOutput);
  document.getElementById("convertOutputToCutBtn")?.addEventListener("click", convertOutputToCut);
  document.getElementById("generateBtn").addEventListener("click", generateGcode);
  document.getElementById("generateBtn2")?.addEventListener("click", generateGcode);
  initRibbon();
  document.getElementById("machineNavBtn")?.addEventListener("click", () => setMachineTabOpen(true));
  document.getElementById("closeMachineTabBtn")?.addEventListener("click", () => setMachineTabOpen(false));
  document.getElementById("refreshMachinePortsBtn")?.addEventListener("click", refreshMachinePorts);
  document.getElementById("autoConnectMachineBtn")?.addEventListener("click", autoConnectMachine);
  document.getElementById("connectMachineBtn")?.addEventListener("click", connectMachine);
  document.getElementById("disconnectMachineBtn")?.addEventListener("click", disconnectMachine);
  document.getElementById("machineStatusBtn")?.addEventListener("click", () => refreshMachineStatus(true));
  document.getElementById("sendMachineCommandBtn")?.addEventListener("click", sendMachineCommand);
  document.getElementById("sendGcodeToMachineBtn")?.addEventListener("click", sendGcodeToMachine);
  document.getElementById("machinePreviewBtn")?.addEventListener("click", () => loadMachinePreview(true));
  document.querySelectorAll("[data-flow-close]").forEach((el) => el.addEventListener("click", closeProduceFlow));
  document.getElementById("addTextBtn")?.addEventListener("click", addTextPattern);
  refs.textFont?.addEventListener("change", () => {
    updateTextFontHint();
    saveUiSettings();
  });
  refs.textWeight?.addEventListener("change", updateTextFontHint);
  refs.textStyle?.addEventListener("change", updateTextFontHint);
  refs.textOperation?.addEventListener("change", () => {
    updateTextFontHint();
    saveUiSettings();
  });
  refs.textFontUpload?.addEventListener("change", handleTextFontUpload);
  refs.textInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addTextPattern(); }
  });
  document.querySelectorAll("[data-add-shape]").forEach((button) => {
    button.addEventListener("click", () => addShapePattern(button.dataset.addShape));
  });
  document.getElementById("applyProfileBtn")?.addEventListener("click", applyMaterialProfile);
  document.getElementById("saveProfileBtn")?.addEventListener("click", saveMaterialProfile);
  document.getElementById("deleteProfileBtn")?.addEventListener("click", deleteMaterialProfile);
  document.getElementById("materialProfile")?.addEventListener("change", () => renderProfileSelect(document.getElementById("materialProfile").value));
  renderProfileSelect();
  document.getElementById("flowFrameBtn")?.addEventListener("click", () => frameMachineJob());
  document.getElementById("flowSendBtn")?.addEventListener("click", () => sendGcodeToMachine());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && produceFlowOpen()) closeProduceFlow();
  });
  document.getElementById("machinePreviewClearBtn")?.addEventListener("click", clearMachinePreview);
  document.querySelectorAll("[data-machine-override]").forEach((button) => {
    button.addEventListener("click", () => {
      const [kind, action] = button.dataset.machineOverride.split(",");
      machineOverride(kind, action);
    });
  });
  document.getElementById("machineFrameBtn")?.addEventListener("click", frameMachineJob);
  document.getElementById("setMachineOriginBtn")?.addEventListener("click", () => setMachineOrigin(false));
  document.getElementById("clearMachineOriginBtn")?.addEventListener("click", () => setMachineOrigin(true));
  document.getElementById("focusPulseBtn")?.addEventListener("click", focusPulse);
  document.querySelectorAll("[data-machine-action]").forEach((button) => {
    button.addEventListener("click", () => machineControl(button.dataset.machineAction));
  });
  document.querySelectorAll("[data-machine-jog]").forEach((button) => {
    button.addEventListener("click", () => {
      const [axis, direction] = button.dataset.machineJog.split(",");
      jogMachine(axis, Number(direction));
    });
  });
  refs.preflightBtn?.addEventListener("click", () => {
    updateUiFromAnalysis(computeJobAnalysis());
    refs.preflightPanel?.scrollIntoView({ block: "nearest" });
    setStatus("G-code ön kontrolü güncellendi.");
  });
  document.getElementById("clearPartsBtn").addEventListener("click", clearParts);
  document.getElementById("centerBtn").addEventListener("click", centerSelectedPattern);
  document.getElementById("fitBtn").addEventListener("click", fitSelectedPattern);
  document.getElementById("zoomInBtn").addEventListener("click", () => zoomView(1.25));
  document.getElementById("zoomOutBtn").addEventListener("click", () => zoomView(1 / 1.25));
  document.getElementById("fitViewBtn").addEventListener("click", fitView);
  document.getElementById("rotateLeftBtn").addEventListener("click", () => rotateSelected(-15));
  document.getElementById("rotateRightBtn").addEventListener("click", () => rotateSelected(15));
  document.getElementById("rotate90Btn").addEventListener("click", () => rotateSelected(90));
  document.getElementById("layoutRecalculateBtn")?.addEventListener("click", autoLayout);
  document.getElementById("layoutKeepBtn")?.addEventListener("click", keepCurrentLayoutPositions);
  document.getElementById("layoutParkBtn")?.addEventListener("click", parkOutsideItems);
  document.getElementById("layoutUndoBtn")?.addEventListener("click", restoreLayoutSettings);
  document.querySelectorAll("[data-bed-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const [width, height] = button.dataset.bedPreset.split(",").map(Number);
      applyBedPreset(width, height);
    });
  });

  document.querySelectorAll("#laserCmd button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.value !== state.laserCmd) pushUndo("Lazer modu");
      document.querySelectorAll("#laserCmd button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.laserCmd = button.dataset.value;
      syncLaserButtons();
      saveUiSettings();
      if (state.laserCmd === "M3") {
        setStatus("M3 sabit güç modu seçildi; yanma riskini operatör kontrol etmeli.", "warn");
      } else {
        setStatus("M4 dinamik güç modu seçildi.", "info");
      }
    });
  });

  ["bedW", "bedH", "gap", "margin"].forEach((id) => {
    const input = refs[id];
    if (!input) return;
    input.addEventListener("input", id === "bedW" || id === "bedH" ? scheduleTablePreviewUpdate : scheduleLayoutPreviewUpdate);
  });
  refs.allowRotate?.addEventListener("change", scheduleLayoutPreviewUpdate);
  refs.bedAlignMode?.addEventListener("change", applyAlignmentPreviewUpdate);

  ["innerFirst", "returnOrigin", "outputPath"].forEach((id) => {
    const input = refs[id];
    if (!input) return;
    input.addEventListener("input", () => {
      if (id === "outputPath" && state.machine.previewPath !== refs.outputPath.value.trim()) clearMachinePreview();
      draw();
      saveUiSettings();
      renderMachinePanel();
    });
  });

  persistedInputIds.forEach((id) => {
    const input = refs[id];
    if (!input) return;
    input.addEventListener("change", saveUiSettings);
  });

  ["cutPower", "engravePower"].forEach((id) => {
    refs[id].addEventListener("change", () => {
      refs[id].value = clamp(Math.round(mm(id, 0)), 0, 1000);
    });
  });
  const updateKerfUi = () => {
    refs.kerf.value = Math.min(1, Math.max(0, mm("kerf", 0))).toFixed(2);
    updateUiFromAnalysis(computeJobAnalysis());
  };
  refs.kerf?.addEventListener("input", () => updateUiFromAnalysis(computeJobAnalysis()));
  refs.kerf?.addEventListener("change", updateKerfUi);

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("hashchange", syncMachineTabFromHash);
  window.addEventListener("popstate", syncMachineTabFromHash);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("machineTab")?.classList.contains("hidden")) {
      setMachineTabOpen(false);
    }
  });
}

renderTextFontOptions();
loadUiSettings();
renderTextFontOptions(refs.textFont?.value || "laser-single");
state.layout.appliedSettings = layoutSettingsSnapshot();
syncLaserButtons();
startClientLifecycleTracking();
bindControls();
resizeCanvas();
updateSelectionPanel();
updateSummary();
renderMachinePanel();
refreshMachinePorts({ silent: true });
refreshMachineStatus(false, { silent: true });
startMachinePolling();
syncMachineTabFromHash();
