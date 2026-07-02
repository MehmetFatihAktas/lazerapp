const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");

const refs = {
  status: document.getElementById("jobStatus"),
  partsList: document.getElementById("partsList"),
  selectionPanel: document.getElementById("selectionPanel"),
  summary: document.getElementById("summaryBox"),
  readout: document.getElementById("canvasReadout"),
  outputPath: document.getElementById("outputPath"),
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
  travelFeed: document.getElementById("travelFeed"),
  pierceDelay: document.getElementById("pierceDelay"),
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
};

const state = {
  parts: [],
  placements: [],
  patterns: [],
  images: new Map(),
  selected: null,
  drag: null,
  view: { scale: 1, offsetX: 0, offsetY: 0, width: 1, height: 1, zoom: 1, panX: 0, panY: 0 },
  laserCmd: "M4",
  spaceDown: false,
};

const SETTINGS_KEY = "laser-editor-settings-v3";
const VECTOR_SETTINGS_VERSION = 7;
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
  "travelFeed",
  "pierceDelay",
  "innerFirst",
  "returnOrigin",
  "engravePower",
  "engraveFeed",
  "lineStep",
  "threshold",
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
];

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function mm(id, fallback = 0) {
  const value = Number(refs[id].value);
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

function setStatus(text) {
  refs.status.textContent = text;
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
}

function saveUiSettings() {
  const payload = { laserCmd: state.laserCmd, vectorSettingsVersion: VECTOR_SETTINGS_VERSION };
  for (const id of persistedInputIds) {
    const input = refs[id];
    if (!input) continue;
    payload[id] = input.type === "checkbox" ? input.checked : input.value;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

function syncLaserButtons() {
  document.querySelectorAll("#laserCmd button").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === state.laserCmd);
  });
}

function bed() {
  return {
    width: Math.max(1, mm("bedW", 400)),
    height: Math.max(1, mm("bedH", 400)),
  };
}

function getSettings() {
  return {
    feed: mm("cutFeed", 500),
    power: clamp(Math.round(mm("cutPower", 1000)), 0, 1000),
    passes: Math.max(1, Math.round(mm("passes", 1))),
    overcut: Math.max(0, mm("overcut", 0.8)),
    travelFeed: Math.max(1, mm("travelFeed", 3000)),
    pierceDelay: Math.max(0, mm("pierceDelay", 0)),
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

function partById(id) {
  return state.parts.find((part) => part.id === id);
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

function patternWorldPoint(pattern, localPoint) {
  const point = patternPoint(pattern, localPoint.x, localPoint.y);
  return { x: point.x, y: point.y };
}

function vectorWorldPath(pattern, vectorPath) {
  return (vectorPath.points || []).map((point) => patternWorldPoint(pattern, vectorLocalPoint(pattern, point)));
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

function patternClipRegion(pattern) {
  const placements = pattern.parentId
    ? [placementById(pattern.parentId)].filter(Boolean)
    : state.placements;
  const polygons = placements.flatMap(closedPolygonsForPlacement);
  if (!polygons.length) return null;
  return { polygons, margin: Math.max(0, Number(pattern.clipMargin) || 0) };
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
  const result = [];
  let currentStart = null;
  let currentEnd = null;
  for (let index = 0; index < divisions; index += 1) {
    const t0 = index / divisions;
    const t1 = (index + 1) / divisions;
    const p0 = { x: start.x + (end.x - start.x) * t0, y: start.y + (end.y - start.y) * t0 };
    const p1 = { x: start.x + (end.x - start.x) * t1, y: start.y + (end.y - start.y) * t1 };
    const midpoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    if (clipRegionContains(midpoint, region)) {
      if (!currentStart) currentStart = p0;
      currentEnd = p1;
    } else if (currentStart && currentEnd) {
      if (Math.hypot(currentEnd.x - currentStart.x, currentEnd.y - currentStart.y) >= 0.03) result.push([currentStart, currentEnd]);
      currentStart = null;
      currentEnd = null;
    }
  }
  if (currentStart && currentEnd && Math.hypot(currentEnd.x - currentStart.x, currentEnd.y - currentStart.y) >= 0.03) {
    result.push([currentStart, currentEnd]);
  }
  return result;
}

function clipPolylineToRegion(points, region, step = 0.25) {
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
  return clipped;
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
  refs.readout.textContent = `${b.width.toFixed(0)} x ${b.height.toFixed(0)} mm  |  ${Math.round(state.view.zoom * 100)}%`;
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
  moveAll(targetX - bounds.minX, targetY - bounds.minY);
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
  moveAll(dx, dy);
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

function drawGrid() {
  const b = bed();
  const bottomLeft = worldToScreen({ x: 0, y: 0 });
  const topLeft = worldToScreen({ x: 0, y: b.height });
  const bottomRight = worldToScreen({ x: b.width, y: 0 });
  ctx.fillStyle = "#101820";
  ctx.fillRect(topLeft.x, topLeft.y, b.width * state.view.scale, b.height * state.view.scale);
  ctx.strokeStyle = "#536273";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(topLeft.x, topLeft.y, b.width * state.view.scale, b.height * state.view.scale);
  ctx.strokeStyle = "#243240";
  ctx.lineWidth = 1;
  for (let x = 0; x <= b.width; x += 50) {
    const sx = worldToScreen({ x, y: 0 }).x;
    ctx.beginPath();
    ctx.moveTo(sx, topLeft.y);
    ctx.lineTo(sx, bottomLeft.y);
    ctx.stroke();
  }
  for (let y = 0; y <= b.height; y += 50) {
    const sy = worldToScreen({ x: 0, y }).y;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, sy);
    ctx.lineTo(bottomRight.x, sy);
    ctx.stroke();
  }
  ctx.fillStyle = "#d7dee8";
  ctx.font = "12px Segoe UI";
  ctx.fillText("0,0", topLeft.x + 8, bottomLeft.y - 8);
}

function drawPlacements() {
  for (const placement of state.placements) {
    const part = partById(placement.partId);
    if (!part) continue;
    const size = placementSize(placement);
    const a = worldToScreen({ x: placement.x, y: placement.y });
    const b = worldToScreen({ x: placement.x + size.width, y: placement.y + size.height });
    ctx.save();
    ctx.strokeStyle = selectedIs("placement", placement.id) ? "#ffffff" : "#405468";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);
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
      ctx.strokeStyle = Math.abs(pathArea(path)) > largeArea ? "#f0a32f" : "#18a6b8";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  }
}

function drawPatterns() {
  for (const pattern of state.patterns) {
    if (pattern.kind === "vector") {
      drawVectorPattern(pattern);
    } else {
      drawWithPatternClip(pattern, () => {
        const image = state.images.get(pattern.id);
        const center = worldToScreen({ x: pattern.x + pattern.width / 2, y: pattern.y + pattern.height / 2 });
        const width = pattern.width * state.view.scale;
        const height = pattern.height * state.view.scale;
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate((-pattern.rotation * Math.PI) / 180);
        ctx.globalAlpha = pattern.kind === "svg" ? 1 : 0.7;
        if (image && image.complete) {
          ctx.drawImage(image, -width / 2, -height / 2, width, height);
        } else {
          ctx.fillStyle = "rgba(143, 75, 214, 0.18)";
          ctx.fillRect(-width / 2, -height / 2, width, height);
        }
        ctx.restore();
      });
    }

    if (pattern.kind !== "vector" && pattern.kind !== "svg") {
      const corners = patternCorners(pattern).map(worldToScreen);
      ctx.beginPath();
      corners.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      const patternSelected = selectedIs("pattern", pattern.id);
      ctx.strokeStyle = patternSelected ? "#ffffff" : "#c084fc";
      ctx.lineWidth = patternSelected ? 2.4 : 1.6;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }
}

function drawVectorPattern(pattern) {
  const clipRegion = patternClipRegion(pattern);
  const filledPreview = vectorPatternFilledPreview(pattern);
  const preview = state.images.get(pattern.id);
  if (preview && preview.complete) {
    drawWithPatternClip(pattern, () => {
      const center = worldToScreen({ x: pattern.x + pattern.width / 2, y: pattern.y + pattern.height / 2 });
      const width = pattern.width * state.view.scale;
      const height = pattern.height * state.view.scale;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate((-pattern.rotation * Math.PI) / 180);
      ctx.globalAlpha = filledPreview ? 0.04 : 0.18;
      ctx.drawImage(preview, -width / 2, -height / 2, width, height);
      ctx.restore();
    });
  }

  if (filledPreview) {
    drawWithPatternClip(pattern, () => {
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
        if (vectorPath.removed || !vectorPath.closed) continue;
        const points = vectorWorldPath(pattern, vectorPath).map(worldToScreen);
        if (points.length < 3) continue;
        points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = patternOperation(pattern) === "cut" ? "rgba(245, 158, 11, 0.38)" : "rgba(226, 232, 240, 0.76)";
      ctx.fill("evenodd");
      ctx.setLineDash([]);
    });
  }

  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed) continue;
    const worldPoints = vectorWorldPath(pattern, vectorPath);
    if (vectorPath.closed && worldPoints.length > 1) worldPoints.push(worldPoints[0]);
    const clippedPaths = clipPolylineToRegion(worldPoints, clipRegion);
    const selectedPath =
      state.selected?.type === "vectorPath" &&
      state.selected.id === pattern.id &&
      state.selected.pathId === vectorPath.id;
    if (filledPreview && vectorPath.closed && !selectedPath) continue;
    for (const clipped of clippedPaths) {
      const points = clipped.map(worldToScreen);
      if (points.length < 2) continue;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = selectedPath ? "#ffffff" : patternOperation(pattern) === "cut" ? "#f59e0b" : "#22c55e";
      ctx.lineWidth = selectedPath ? 2.6 : 1.4;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  }
}

function drawSelectedPatternHandles() {
  if (state.selected?.type === "pattern") {
    const pattern = selectedPattern();
    if (pattern) drawPatternHandles(pattern);
  }
}

function drawPatternHandles(pattern) {
  const handles = patternHandles(pattern);
  for (const handle of handles) {
    ctx.beginPath();
    if (handle.type === "rotate") {
      ctx.arc(handle.screen.x, handle.screen.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#f7c948";
    } else {
      ctx.rect(handle.screen.x - 5, handle.screen.y - 5, 10, 10);
      ctx.fillStyle = "#ffffff";
    }
    ctx.fill();
    ctx.strokeStyle = "#17202a";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function vectorPatternFilledPreview(pattern) {
  if (!pattern || pattern.kind !== "vector") return false;
  if (patternOperation(pattern) === "cut") return false;
  if (vectorEngraveMode(pattern) !== "fill") return false;
  if (pattern.vectorStats?.traceEngine === "potrace") return true;
  const paths = pattern.vectorPaths || [];
  return paths.length > 0 && paths.some((item) => item.sourceEngine === "potrace");
}

function vectorEngraveMode(pattern) {
  return pattern?.vectorEngraveMode === "fill" ? "fill" : "contour";
}

function vectorCanFillEngrave(pattern) {
  if (!pattern || pattern.kind !== "vector") return false;
  if (pattern.vectorStats?.traceEngine === "potrace") return true;
  return (pattern.vectorPaths || []).some((item) => item.sourceEngine === "potrace");
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
  updatePartsList();
  updateSummary();
}

function selectedIs(type, id) {
  return state.selected && state.selected.type === type && state.selected.id === id;
}

function selectedVectorPath() {
  if (state.selected?.type !== "vectorPath") return null;
  const pattern = patternById(state.selected.id);
  if (!pattern) return null;
  const vectorPath = (pattern.vectorPaths || []).find((item) => item.id === state.selected.pathId);
  return vectorPath ? { pattern, vectorPath } : null;
}

function selectedVectorPattern() {
  if (state.selected?.type === "vectorPath") return patternById(state.selected.id);
  const pattern = selectedPattern();
  return pattern?.kind === "vector" ? pattern : null;
}

function isVectorLikePattern(pattern) {
  return pattern?.kind === "svg" || pattern?.kind === "vector";
}

function patternOperation(pattern) {
  if (!isVectorLikePattern(pattern)) return "engrave";
  return pattern.operation === "cut" ? "cut" : "engrave";
}

function operationLabel(operation) {
  return operation === "cut" ? "Kesim" : "Kazıma";
}

function applyPatternOperation(pattern, operation) {
  if (!isVectorLikePattern(pattern)) return;
  pattern.operation = operation === "cut" ? "cut" : "engrave";
  if (pattern.operation === "cut") {
    pattern.power = clamp(Math.round(mm("cutPower", 1000)), 0, 1000);
    pattern.feed = Math.max(1, mm("cutFeed", 500));
  } else {
    pattern.power = clamp(Math.round(mm("engravePower", 250)), 0, 1000);
    pattern.feed = Math.max(1, mm("engraveFeed", 1800));
  }
  draw();
  updateSelectionPanel();
}

function updatePartsList() {
  if (!state.parts.length) {
    refs.partsList.innerHTML = `<div class="selection-empty">DXF yok</div>`;
    return;
  }
  refs.partsList.innerHTML = state.parts
    .map((part) => {
      const count = state.placements.filter((placement) => placement.partId === part.id).length;
      return `<div class="item">
        <div><strong>${escapeHtml(part.name)}</strong><span>${part.width.toFixed(2)} x ${part.height.toFixed(2)} mm</span></div>
        <span>${count}</span>
      </div>`;
    })
    .join("");
}

function updateSummary(extra = "") {
  const b = bed();
  const bounds = jobBounds();
  const boundsLines = bounds
    ? [
        `İş alanı: ${boundsSize(bounds).width.toFixed(2)} x ${boundsSize(bounds).height.toFixed(2)} mm`,
        `Sol alt: X${bounds.minX.toFixed(2)} Y${bounds.minY.toFixed(2)}`,
      ]
    : [];
  refs.summary.textContent = [
    `Tabla: ${b.width.toFixed(0)} x ${b.height.toFixed(0)} mm`,
    `DXF: ${state.parts.length}`,
    `Parça: ${state.placements.length}`,
    `Desen: ${state.patterns.length}`,
    ...boundsLines,
    `Çıktı: ${refs.outputPath.value || "-"}`,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

function select(type, id, extra = {}) {
  state.selected = type && id ? { type, id, ...extra } : null;
  updateSelectionPanel();
  draw();
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
  refs.selectionPanel.innerHTML = `
    <div class="property-title"><strong>${escapeHtml(part?.name || "Parça")}</strong><span>${size.width.toFixed(2)} x ${size.height.toFixed(2)} mm</span></div>
    <div class="form-grid">
      <label>X <input data-placement="x" type="number" step="0.01" value="${placement.x.toFixed(2)}" /></label>
      <label>Y <input data-placement="y" type="number" step="0.01" value="${placement.y.toFixed(2)}" /></label>
      <label>Açı <input data-placement="rotation" type="number" step="90" value="${placement.rotation}" /></label>
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
    input.addEventListener("input", () => {
      const key = input.dataset.placement;
      placement[key] = key === "rotation" ? Math.round(Number(input.value) || 0) : Number(input.value) || 0;
      draw();
    });
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
    state.placements = state.placements.filter((item) => item.id !== placement.id);
    state.patterns = state.patterns.filter((item) => item.parentId !== placement.id);
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
  const canFillVectorEngrave = vectorCanFillEngrave(pattern);
  const vectorMode = vectorEngraveMode(pattern);
  const filledVectorEngrave = operation === "engrave" && vectorPatternFilledPreview(pattern);
  const operationControl = isVectorLikePattern(pattern)
    ? `<div class="operation-card">
        <div>
          <strong>İşlem</strong>
          <span>${
            operation === "cut"
              ? "Kes: vektör konturlarını takip eder, dolgu/tarama satırı üretmez."
              : filledVectorEngrave
                ? "Kazı: dolu vektör alanını yatay tarama satırlarıyla işler. Kesim için Kes'i seç."
                : "Kazı: vektör konturlarını takip eder, yatay tarama satırı üretmez."
          }</span>
        </div>
        <div class="operation-toggle">
          <button data-operation="engrave" class="${operation === "engrave" ? "active" : ""}">Kazı</button>
          <button data-operation="cut" class="${operation === "cut" ? "active danger-mode" : ""}">Kes</button>
        </div>
      </div>`
    : "";
  const vectorModeControl =
    canFillVectorEngrave && operation === "engrave"
      ? `<div class="operation-card">
        <div>
          <strong>G-code tipi</strong>
          <span>${vectorMode === "fill" ? "Dolu tarama siyah alanın içini yatay satırlarla kazır." : "Kontur çizgilerin sınırlarını/path'lerini takip eder; tek merkez çizgi için yeniden işlemede Merkez Çizgi modunu kullan."}</span>
        </div>
        <div class="operation-toggle">
          <button data-vector-engrave-mode="contour" class="${vectorMode === "contour" ? "active" : ""}">Kontur</button>
          <button data-vector-engrave-mode="fill" class="${vectorMode === "fill" ? "active" : ""}">Dolu tarama</button>
        </div>
      </div>`
      : "";
  const svgInfo =
    pattern.kind === "svg" && pattern.cleanStats
      ? `<div class="svg-clean-info">
          <strong>SVG hazırlandı</strong>
          <span>Şekil→path: ${pattern.cleanStats.converted_shape_count ?? 0}</span>
          <span>Ayrılan path: ${pattern.cleanStats.split_path_count ?? 0}</span>
          <span>Temiz ölçü: ${Number(pattern.cleanStats.normalized_width || pattern.width).toFixed(2)} x ${Number(pattern.cleanStats.normalized_height || pattern.height).toFixed(2)} mm</span>
        </div>`
      : "";
  const activeVectorCount = pattern.kind === "vector" ? (pattern.vectorPaths || []).filter((item) => !item.removed).length : 0;
  const vectorSettings = pattern.vectorSettings || {};
  const vectorStats = pattern.vectorStats || {};
  const vectorTiming = vectorStats.timings?.total ? ` · Süre: ${Number(vectorStats.timings.total).toFixed(2)} sn` : "";
  const vectorInfo =
    pattern.kind === "vector"
      ? `<div class="svg-clean-info">
          <strong>Foto vektör hazır</strong>
          <span>Aktif kontur: ${activeVectorCount} / ${(pattern.vectorPaths || []).length}</span>
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
    <div class="property-title"><strong>${escapeHtml(pattern.name || "Desen")}</strong><span>${kindText} · ${operationLabel(operation)} · ${pattern.width.toFixed(2)} x ${pattern.height.toFixed(2)} mm</span></div>
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
      <label>Parça iç payı <input data-pattern="clipMargin" type="number" min="0" step="0.1" value="${Number(pattern.clipMargin || 0).toFixed(1)}" /></label>
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
    <div class="nudge-pad">
      <span></span><button data-nudge="0,1">↑</button><span></span>
      <button data-nudge="-1,0">←</button><button data-nudge="0,-1">↓</button><button data-nudge="1,0">→</button>
    </div>
    <div class="button-grid">
      <button id="panelCenterPattern">Ortala</button>
      <button id="panelFitPattern">Sığdır</button>
      <button id="panelScaleDown">Küçült</button>
      <button id="panelScaleUp">Büyüt</button>
      <button id="panelRotatePattern">90° Döndür</button>
      ${
        pattern.kind === "vector"
          ? `<button id="panelRevectorize">Yeniden İşle</button><button id="panelSmoothVector">Yumuşat</button><button id="panelSaveVectorSvg">SVG Kaydet</button><button id="panelRestoreVectorPaths">Konturları Geri Al</button>`
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
  const activeCount = (pattern.vectorPaths || []).filter((item) => !item.removed).length;
  const totalCount = (pattern.vectorPaths || []).length;
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
    </div>
    <div class="button-grid">
      <button id="panelDeleteVectorPath" class="danger">Konturu Sil</button>
      <button id="panelSelectVectorPattern">Tum Deseni Sec</button>
    </div>
  `;
  document.getElementById("panelDeleteVectorPath").addEventListener("click", () => {
    vectorPath.removed = true;
    select("pattern", pattern.id);
  });
  document.getElementById("panelSelectVectorPattern").addEventListener("click", () => {
    select("pattern", pattern.id);
  });
}

function bindPatternPanel(pattern) {
  refs.selectionPanel.querySelectorAll("[data-pattern]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.pattern;
      pattern[key] = Number(input.value) || 0;
      if (key === "power") pattern[key] = clamp(Math.round(pattern[key]), 0, 1000);
      if (key === "threshold") pattern[key] = clamp(Math.round(pattern[key]), 0, 255);
      if (key === "clipMargin") pattern[key] = Math.max(0, pattern[key]);
      draw();
    });
  });
  refs.selectionPanel.querySelectorAll("[data-operation]").forEach((button) => {
    button.addEventListener("click", () => applyPatternOperation(pattern, button.dataset.operation));
  });
  refs.selectionPanel.querySelectorAll("[data-vector-engrave-mode]").forEach((button) => {
    button.addEventListener("click", () => {
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
  document.getElementById("panelRotatePattern").addEventListener("click", () => rotateSelected(90));
  document.getElementById("panelRevectorize")?.addEventListener("click", revectorizeSelected);
  document.getElementById("panelSmoothVector")?.addEventListener("click", () => smoothSelectedVector(pattern));
  document.getElementById("panelSaveVectorSvg")?.addEventListener("click", saveSelectedVectorSvg);
  document.getElementById("panelRestoreVectorPaths")?.addEventListener("click", () => {
    if (pattern.originalVectorPaths?.length) {
      pattern.vectorPaths = cloneVectorPaths(pattern.originalVectorPaths);
    } else {
      for (const vectorPath of pattern.vectorPaths || []) vectorPath.removed = false;
    }
    draw();
    updateSelectionPanel();
  });
  document.getElementById("panelDeletePattern").addEventListener("click", () => {
    state.patterns = state.patterns.filter((item) => item.id !== pattern.id);
    state.images.delete(pattern.id);
    select(null, null);
  });
}

function autoLayout() {
  const b = bed();
  const quantity = Math.max(1, Math.round(mm("quantity", 1)));
  const gap = Math.max(0, mm("gap", 3));
  const margin = Math.max(0, mm("margin", 1));
  const allowRotate = refs.allowRotate.checked;
  state.placements = [];
  let x = margin;
  let y = margin;
  let rowHeight = 0;
  const items = [];
  for (let set = 0; set < quantity; set += 1) {
    for (const part of state.parts) items.push(part);
  }
  items.sort((a, bPart) => bPart.width * bPart.height - a.width * a.height);

  for (const part of items) {
    let rotation = 0;
    let width = part.width;
    let height = part.height;
    if (allowRotate && x + width > b.width - margin && x + part.height <= b.width - margin) {
      rotation = 90;
      width = part.height;
      height = part.width;
    }
    if (x + width > b.width - margin + 0.001) {
      x = margin;
      y += rowHeight + gap;
      rowHeight = 0;
      if (allowRotate && part.height <= b.width - margin * 2) {
        rotation = 90;
        width = part.height;
        height = part.width;
      } else {
        rotation = 0;
        width = part.width;
        height = part.height;
      }
    }
    state.placements.push({
      id: uid("pl"),
      partId: part.id,
      x,
      y,
      rotation,
    });
    x += width + gap;
    rowHeight = Math.max(rowHeight, height);
  }
  alignJobToBed(false);
  const tooTall = state.placements.some((placement) => {
    const size = placementSize(placement);
    return placement.y + size.height > b.height - margin + 0.001;
  });
  if (tooTall) setStatus("Bazı parçalar tabla dışına taşıyor.");
  else setStatus("Yerleşim hazır.");
  select(null, null);
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
    state.parts.push(...data.parts);
    autoLayout();
    setStatus(`${data.parts.length} DXF eklendi.`);
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
  return {
    id,
    parentId: placement?.id || null,
    path: imageData.path,
    originalPath: imageData.originalPath || imageData.path,
    kind: imageData.kind || "raster",
    operation: imageData.kind === "svg" || imageData.kind === "vector" ? "engrave" : "engrave",
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
    clipMargin: 0,
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

function cloneVectorPaths(paths) {
  return (paths || []).map((item) => ({
    ...item,
    points: (item.points || []).map((point) => [Number(point[0]), Number(point[1])]),
    warnings: item.warnings ? [...item.warnings] : item.warnings,
  }));
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
}

function smoothSelectedVector(pattern) {
  if (!pattern || pattern.kind !== "vector") return;
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
  if (!pattern || pattern.kind !== "vector") {
    setStatus("Önce bir foto vektör deseni seçin.");
    return;
  }
  const activePaths = (pattern.vectorPaths || []).filter((item) => !item.removed);
  if (!activePaths.length) {
    setStatus("Kaydedilecek aktif kontur kalmadı.");
    return;
  }
  try {
    setStatus("SVG kaydediliyor...");
    const data = await api("/api/save-vector-svg", {
      name: pattern.name || "vectorized.svg",
      vectorPaths: vectorPathsForCurrentSize(pattern),
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

function centerSelectedPattern() {
  const pattern = selectedPattern();
  const placement = selectedPlacement();
  if (!pattern) return;
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
  pattern.width = width;
  pattern.height = height;
  pattern.parentId = placement.id;
  centerSelectedPattern();
}

function selectedPattern() {
  if (state.selected?.type !== "pattern" && state.selected?.type !== "vectorPath") return null;
  return patternById(state.selected.id);
}

function rotateSelected(delta) {
  if (!state.selected) return;
  if (state.selected.type === "pattern") {
    const pattern = selectedPattern();
    if (!pattern) return;
    pattern.rotation = (pattern.rotation + delta + 360) % 360;
  }
  if (state.selected.type === "placement") {
    const placement = placementById(state.selected.id);
    if (!placement) return;
    placement.rotation = (placement.rotation + delta + 360) % 360;
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
  const object = selectedObject();
  if (!object) return;
  object.x += dx;
  object.y += dy;
  if (state.selected.type === "placement") {
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
  const cx = pattern.x + pattern.width / 2;
  const cy = pattern.y + pattern.height / 2;
  pattern.width = Math.max(1, pattern.width * factor);
  pattern.height = Math.max(1, pattern.height * factor);
  pattern.x = cx - pattern.width / 2;
  pattern.y = cy - pattern.height / 2;
  draw();
  updateSelectionPanel();
}

function deleteSelected() {
  if (!state.selected) return;
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
    state.placements = state.placements.filter((item) => item.id !== id);
    state.patterns = state.patterns.filter((item) => item.parentId !== id);
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
  const top = patternPoint(pattern, pattern.width / 2, pattern.height + 16 / state.view.scale);
  return [
    ...corners.map((world, index) => ({ type: "resize", index, world, screen: worldToScreen(world) })),
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
    if (pattern.kind === "vector") {
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
    state.drag = {
      mode: handle.type,
      id: pattern.id,
      startWorld: world,
      startPattern: { ...pattern },
      center,
      startDistance: Math.max(0.01, Math.hypot(world.x - center.x, world.y - center.y)),
      startAngle: Math.atan2(world.y - center.y, world.x - center.x),
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
    select("vectorPath", hit.id, { pathId: hit.pathId });
    return;
  }
  select(hit.type, hit.id);
  const selectedObject = hit.type === "pattern" ? patternById(hit.id) : placementById(hit.id);
  state.drag = {
    mode: hit.type === "pattern" ? "movePattern" : "movePlacement",
    id: hit.id,
    startWorld: world,
    startObject: { ...selectedObject },
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
  if (!state.drag) {
    const handle = hitPatternHandle(screen);
    canvas.style.cursor = handle ? (handle.type === "rotate" ? "grab" : "nwse-resize") : hitTest(world) ? "move" : "grab";
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
    pattern.width = Math.max(1, state.drag.startPattern.width * factor);
    pattern.height = Math.max(1, state.drag.startPattern.height * factor);
    pattern.x = state.drag.center.x - pattern.width / 2;
    pattern.y = state.drag.center.y - pattern.height / 2;
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
  state.drag = null;
  canvas.releasePointerCapture?.(event.pointerId);
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
      refs.outputPath.value = data.path;
      updateSummary();
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function generateGcode() {
  if (!refs.outputPath.value) {
    await chooseOutput();
    if (!refs.outputPath.value) return;
  }
  try {
    setStatus("G-code oluşturuluyor...");
    const payload = {
      parts: state.parts.map((part) => ({ id: part.id, path: part.path })),
      placements: state.placements.map((placement) => ({ ...placement })),
      patterns: state.patterns.map((pattern) => ({ ...pattern })),
      settings: getSettings(),
      outputPath: refs.outputPath.value,
    };
    const data = await api("/api/generate", payload);
    const result = data.result;
    setStatus("G-code hazır.");
    updateSummary(
      `\nKesim alanı: ${result.cutWidth.toFixed(2)} x ${result.cutHeight.toFixed(2)} mm\nSatır: ${result.lineCount}`
    );
  } catch (error) {
    setStatus(error.message);
  }
}

function clearParts() {
  state.parts = [];
  state.placements = [];
  state.patterns = [];
  state.images.clear();
  select(null, null);
  draw();
  setStatus("Temizlendi.");
}

function isTypingTarget(target) {
  return target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function onKeyDown(event) {
  if (event.code === "Space" && !isTypingTarget(event.target)) {
    state.spaceDown = true;
    event.preventDefault();
    return;
  }
  if (isTypingTarget(event.target)) return;
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

function bindControls() {
  document.getElementById("addDxfBtn").addEventListener("click", addDxfs);
  document.getElementById("addImageBtn").addEventListener("click", addImage);
  document.getElementById("vectorizeBtn").addEventListener("click", vectorizePhoto);
  document.getElementById("vectorizePhotoBtn").addEventListener("click", vectorizePhoto);
  document.getElementById("revectorizeBtn").addEventListener("click", revectorizeSelected);
  document.getElementById("vectorAutoPresetBtn")?.addEventListener("click", applyAutoVectorPreset);
  document.getElementById("saveVectorSvgBtn").addEventListener("click", saveSelectedVectorSvg);
  document.getElementById("autoLayoutBtn").addEventListener("click", autoLayout);
  document.getElementById("alignJobBtn").addEventListener("click", () => alignJobToBed(true));
  document.getElementById("applyJobOffsetBtn").addEventListener("click", applyJobOffset);
  document.getElementById("chooseOutputBtn").addEventListener("click", chooseOutput);
  document.getElementById("generateBtn").addEventListener("click", generateGcode);
  document.getElementById("clearPartsBtn").addEventListener("click", clearParts);
  document.getElementById("centerBtn").addEventListener("click", centerSelectedPattern);
  document.getElementById("fitBtn").addEventListener("click", fitSelectedPattern);
  document.getElementById("zoomInBtn").addEventListener("click", () => zoomView(1.25));
  document.getElementById("zoomOutBtn").addEventListener("click", () => zoomView(1 / 1.25));
  document.getElementById("fitViewBtn").addEventListener("click", fitView);
  document.getElementById("rotateLeftBtn").addEventListener("click", () => rotateSelected(-15));
  document.getElementById("rotateRightBtn").addEventListener("click", () => rotateSelected(15));
  document.getElementById("rotate90Btn").addEventListener("click", () => rotateSelected(90));

  document.querySelectorAll("#laserCmd button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#laserCmd button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.laserCmd = button.dataset.value;
      saveUiSettings();
    });
  });

  [
    "bedW",
    "bedH",
    "quantity",
    "gap",
    "margin",
    "bedAlignMode",
    "allowRotate",
    "innerFirst",
    "returnOrigin",
    "outputPath",
  ].forEach((id) => {
    const input = refs[id];
    if (input)
      input.addEventListener("input", () => {
        draw();
        saveUiSettings();
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

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

loadUiSettings();
syncLaserButtons();
bindControls();
resizeCanvas();
updateSelectionPanel();
updateSummary();
