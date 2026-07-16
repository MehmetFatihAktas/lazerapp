const ProjectState = window.LaserProjectState;
if (!ProjectState) throw new Error("Proje durumu modülü yüklenemedi.");
const BoxMaker = window.LaserBoxMaker;
if (!BoxMaker) throw new Error("Kutu üretici modülü yüklenemedi.");
const AssetLibrary = window.LaserAssetLibrary;
if (!AssetLibrary) throw new Error("Tasarım kütüphanesi modülü yüklenemedi.");
const ProductionState = window.LaserProductionState;
if (!ProductionState) throw new Error("Üretim durumu modülü yüklenemedi.");
const CalibrationGrid = window.LaserCalibrationGrid;
if (!CalibrationGrid) throw new Error("Kalibrasyon modülü yüklenemedi.");
const SelectionLayout = window.LaserSelectionLayout;
if (!SelectionLayout) throw new Error("Hizalama modülü yüklenemedi.");
const ProductTour = window.LaserProductTour;
if (!ProductTour) throw new Error("Ürün tanıtımı modülü yüklenemedi.");

const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");

const refs = {
  status: document.getElementById("jobStatus"),
  projectTitle: document.getElementById("projectTitle"),
  projectDirtyMark: document.getElementById("projectDirtyMark"),
  projectHub: document.getElementById("projectHub"),
  recentProjectsList: document.getElementById("recentProjectsList"),
  recentProjectsEmpty: document.getElementById("recentProjectsEmpty"),
  recoverySection: document.getElementById("recoverySection"),
  recoverySummary: document.getElementById("recoverySummary"),
  projectInfoModal: document.getElementById("projectInfoModal"),
  projectInfoContent: document.getElementById("projectInfoContent"),
  preferencesModal: document.getElementById("preferencesModal"),
  preferencesForm: document.getElementById("preferencesForm"),
  prefAutosaveEnabled: document.getElementById("prefAutosaveEnabled"),
  prefAutosaveDelay: document.getElementById("prefAutosaveDelay"),
  prefMaxRecent: document.getElementById("prefMaxRecent"),
  prefConfirmClear: document.getElementById("prefConfirmClear"),
  prefTheme: document.getElementById("prefTheme"),
  prefUserMode: document.getElementById("prefUserMode"),
  prefShowGrid: document.getElementById("prefShowGrid"),
  prefShowTravel: document.getElementById("prefShowTravel"),
  prefPrepareStrategy: document.getElementById("prefPrepareStrategy"),
  prefReopenLastProject: document.getElementById("prefReopenLastProject"),
  helpModal: document.getElementById("helpModal"),
  capabilityList: document.getElementById("capabilityList"),
  diagnosticsSummary: document.getElementById("diagnosticsSummary"),
  productTour: document.getElementById("productTour"),
  tourSpotlight: document.getElementById("tourSpotlight"),
  tourCard: document.getElementById("tourCard"),
  tourCategory: document.getElementById("tourCategory"),
  tourCounter: document.getElementById("tourCounter"),
  tourProgressBar: document.getElementById("tourProgressBar"),
  tourTitle: document.getElementById("productTourTitle"),
  tourDescription: document.getElementById("tourDescription"),
  tourFeatureList: document.getElementById("tourFeatureList"),
  tourPreviousBtn: document.getElementById("tourPreviousBtn"),
  tourNextBtn: document.getElementById("tourNextBtn"),
  workflowNextTitle: document.getElementById("workflowNextTitle"),
  workflowContinueBtn: document.getElementById("workflowContinueBtn"),
  boxMakerModal: document.getElementById("boxMakerModal"),
  boxMakerForm: document.getElementById("boxMakerForm"),
  boxMakerPreview: document.getElementById("boxMakerPreview"),
  boxMakerStats: document.getElementById("boxMakerStats"),
  boxMakerValidation: document.getElementById("boxMakerValidation"),
  boxWidth: document.getElementById("boxWidth"),
  boxDepth: document.getElementById("boxDepth"),
  boxHeight: document.getElementById("boxHeight"),
  boxThickness: document.getElementById("boxThickness"),
  boxFingerWidth: document.getElementById("boxFingerWidth"),
  boxFit: document.getElementById("boxFit"),
  calibrationModal: document.getElementById("calibrationModal"),
  calibrationForm: document.getElementById("calibrationForm"),
  calibrationColumns: document.getElementById("calibrationColumns"),
  calibrationRows: document.getElementById("calibrationRows"),
  calibrationTile: document.getElementById("calibrationTile"),
  calibrationGap: document.getElementById("calibrationGap"),
  calibrationMinPower: document.getElementById("calibrationMinPower"),
  calibrationMaxPower: document.getElementById("calibrationMaxPower"),
  calibrationMinFeed: document.getElementById("calibrationMinFeed"),
  calibrationMaxFeed: document.getElementById("calibrationMaxFeed"),
  calibrationOperation: document.getElementById("calibrationOperation"),
  calibrationSummary: document.getElementById("calibrationSummary"),
  libraryModal: document.getElementById("libraryModal"),
  libraryList: document.getElementById("libraryList"),
  libraryEmpty: document.getElementById("libraryEmpty"),
  librarySearch: document.getElementById("librarySearch"),
  notificationsModal: document.getElementById("notificationsModal"),
  notificationsList: document.getElementById("notificationsList"),
  notificationsEmpty: document.getElementById("notificationsEmpty"),
  notificationBadge: document.getElementById("notificationBadge"),
  productionHistoryModal: document.getElementById("productionHistoryModal"),
  productionHistoryList: document.getElementById("productionHistoryList"),
  productionHistoryEmpty: document.getElementById("productionHistoryEmpty"),
  productionPreviewTab: document.getElementById("productionPreviewTab"),
  productionPreviewCanvas: document.getElementById("productionPreviewCanvas"),
  productionPreviewPath: document.getElementById("productionPreviewPath"),
  productionPreviewProgress: document.getElementById("productionPreviewProgress"),
  productionPreviewProgressText: document.getElementById("productionPreviewProgressText"),
  productionOperationList: document.getElementById("productionOperationList"),
  productionPreviewSafety: document.getElementById("productionPreviewSafety"),
  productionPreviewPlay: document.getElementById("productionPreviewPlayBtn"),
  productionPreviewSpeed: document.getElementById("productionPreviewSpeed"),
  productionPreviewPosition: document.getElementById("productionPreviewPosition"),
  laserModeHint: document.getElementById("laserModeHint"),
  unitChip: document.getElementById("unitChip"),
  bedChip: document.getElementById("bedChip"),
  layoutChip: document.getElementById("layoutChip"),
  warningChip: document.getElementById("warningChip"),
  preflightBtn: document.getElementById("preflightBtn"),
  generateBtn: document.getElementById("generateBtn"),
  generateBtn2: document.getElementById("generateBtn2"),
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
  textFontPicker: document.getElementById("textFontPicker"),
  textFontButton: document.getElementById("textFontButton"),
  textFontButtonLabel: document.getElementById("textFontButtonLabel"),
  textFontMenu: document.getElementById("textFontMenu"),
  textFontSearch: document.getElementById("textFontSearch"),
  textFontFilters: document.getElementById("textFontFilters"),
  textFontCount: document.getElementById("textFontCount"),
  textFontLoading: document.getElementById("textFontLoading"),
  textFontOptions: document.getElementById("textFontOptions"),
  textFontEmpty: document.getElementById("textFontEmpty"),
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
  dxfQuantityModal: document.getElementById("dxfQuantityModal"),
  dxfQuantityForm: document.getElementById("dxfQuantityForm"),
  dxfQuantitySummary: document.getElementById("dxfQuantitySummary"),
  dxfQuantityInput: document.getElementById("dxfQuantityInput"),
  dxfQuantityCancelBtn: document.getElementById("dxfQuantityCancelBtn"),
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
  selectionArrange: document.getElementById("selectionArrange"),
  canvasSelectionMode: document.getElementById("canvasSelectionMode"),
  vecThreshold: document.getElementById("vecThreshold"),
  vecMode: document.getElementById("vecMode"),
  vecThresholdMode: document.getElementById("vecThresholdMode"),
  vecProfessionalMode: document.getElementById("vecProfessionalMode"),
  vectorModeHint: document.getElementById("vectorModeHint"),
  vectorQualityBox: document.getElementById("vectorQualityBox"),
  applyVectorModeBtn: document.getElementById("applyVectorModeBtn"),
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
  imageEditPanel: document.getElementById("imageEditPanel"),
  imageSharpness: document.getElementById("imageSharpness"),
  imageSharpnessValue: document.getElementById("imageSharpnessValue"),
  imageBrightness: document.getElementById("imageBrightness"),
  imageBrightnessValue: document.getElementById("imageBrightnessValue"),
  imageContrast: document.getElementById("imageContrast"),
  imageContrastValue: document.getElementById("imageContrastValue"),
  imageNegative: document.getElementById("imageNegative"),
  imageMaskBrush: document.getElementById("imageMaskBrush"),
  imageEditHint: document.getElementById("imageEditHint"),
  removeImageBackgroundBtn: document.getElementById("removeImageBackgroundBtn"),
  cropImageBtn: document.getElementById("cropImageBtn"),
  traceImageBtn: document.getElementById("traceImageBtn"),
  maskImageBtn: document.getElementById("maskImageBtn"),
  finishImageToolBtn: document.getElementById("finishImageToolBtn"),
  resetImageAdjustmentsBtn: document.getElementById("resetImageAdjustmentsBtn"),
  resetImageOriginalBtn: document.getElementById("resetImageOriginalBtn"),
  drawingOperation: document.getElementById("drawingOperation"),
  drawingSmoothing: document.getElementById("drawingSmoothing"),
  drawingClosePath: document.getElementById("drawingClosePath"),
  drawingHint: document.getElementById("drawingHint"),
  startDrawingBtn: document.getElementById("startDrawingBtn"),
  finishDrawingBtn: document.getElementById("finishDrawingBtn"),
  cancelDrawingBtn: document.getElementById("cancelDrawingBtn"),
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
  selectionCursor: document.getElementById("selectionCursor"),
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
    warning: cssColor("--warning", "#D97706"),
    success: cssColor("--success", "#14965F"),
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
  systemFonts: [],
  textFontFilter: "all",
  systemFontsLoaded: false,
  selected: null,
  selectedItems: [],
  selectedVectorPaths: [],
  canvasSelectionMode: "object",
  vectorSelectionRegion: null,
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
  vectorRegionTool: {
    active: false,
    pending: false,
    patternId: null,
  },
  vectorRepairTool: {
    active: false,
    mode: "straighten",
    operation: "engrave_line",
    drawing: false,
    patternId: null,
    pathId: null,
    radius: 1,
    widenRadius: 7,
    widenAmount: 1.5,
    startIndex: null,
    startAnchor: null,
    draftWorldPoints: [],
    pointerId: null,
  },
  vectorObjectTool: {
    active: false,
    pending: false,
    drawing: false,
    patternId: null,
    policy: "emit-underlay",
    attachmentPolicy: "detached",
    gateOverrides: {},
    startSource: null,
    currentSource: null,
    pointerId: null,
    review: null,
  },
  imageTool: {
    active: false,
    mode: "",
    patternId: null,
    drawing: false,
    startSource: null,
    currentSource: null,
    draftSourcePoints: [],
    pointerId: null,
  },
  drawingTool: {
    active: false,
    mode: "vector",
    operation: "engrave_line",
    closePath: false,
    smoothing: 45,
    drawing: false,
    points: [],
    pointerId: null,
  },
  currentAnalysis: null,
  lastGeneratedRevision: null,
  lastGeneratedPath: "",
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
  project: ProjectState.createSession({ name: "Adsız iş" }),
  preferences: ProjectState.normalizePreferences(),
  recentProjects: [],
  recovery: {
    store: ProjectState.createRecoveryStore(),
    key: "active-project",
    snapshot: null,
    saveTimer: null,
    saving: false,
  },
  boxMaker: {
    closed: false,
    result: null,
  },
  library: {
    store: AssetLibrary.createStore(),
    assets: [],
    loading: false,
  },
  activity: {
    store: ProductionState.createLocalStore(),
    notifications: [],
    notificationFilter: "all",
    history: [],
    activeHistoryId: "",
    lastMachineAlarm: "",
    lastMachineFinishedAt: null,
  },
  productionPreview: {
    open: false,
    layers: { cut: true, engrave: true, travel: false },
    progress: null,
    playing: false,
    playbackTimer: null,
    playbackStartedAt: 0,
    playbackStartProgress: 0,
  },
  support: {
    capabilities: null,
    diagnostics: null,
    errors: [],
  },
  workspaceMode: "design",
  tour: {
    active: false,
    index: 0,
    target: null,
    returnContext: null,
  },
};

const SETTINGS_KEY = "laser-editor-settings-v3";
const VECTOR_SETTINGS_VERSION = 10;
const CLIENT_SESSION_KEY = "laser-editor-client-id-v1";
let jobAnalysisTimer = null;
let pendingDxfQuantityResolve = null;
let dxfQuantityReturnFocus = null;
let activeTextFontPreview = null;
let textFontApplyToken = 0;
let canvasDrawFrame = null;
let canvasResizeFrame = null;
let canvasResizeObserver = null;
let canvasInteraction = null;
let canvasInteractionTimer = null;
let selectedVectorPathKeys = new Set();
let previewVectorPathKeys = new Set();
let selectedVectorMoveTargetsCache = null;
let nativeDialogActivePath = "";
let nativeDialogButtonStates = new Map();
let gcodeGenerationActive = false;
let vectorReprocessActive = false;
let imageAdjustmentTimer = null;
let imageAdjustmentToken = 0;
const imageAdjustmentBases = new Map();

const NATIVE_DIALOG_BUTTON_IDS = [
  "addDxfBtn",
  "addImageBtn",
  "vectorizePhotoBtn",
  "saveVectorSvgBtn",
  "openProjectBtn",
  "saveProjectBtn",
  "chooseOutputBtn",
  "generateBtn",
  "generateBtn2",
];

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
const DEFAULT_TEXT_FONT_VALUE = "arial-black";
const TEXT_FILL_LINE_STEP_MM = 0.12;
const TEXT_SETTINGS_VERSION = 2;

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
  vecProfessionalMode: "cad-line-art",
  vecMode: "centerline",
  vecThresholdMode: "otsu",
  vecBlur: "0",
  vecContrast: "1.08",
  vecMorphClose: "1",
  vecMorphOpen: "0",
  vecDenoise: "0",
  vecMinArea: "4",
  vecMinLength: "3",
  vecSimplify: "0.9",
  vecSmooth: "3",
  vecMaxContours: "8000",
  vecStitchGap: "0.5",
  vecMaxDimension: "4800",
  vecAdaptiveBlock: "35",
  vecAdaptiveC: "5",
  vecInvert: true,
  vecRemoveBorder: false,
  vecBackgroundNormalize: false,
};

const vectorProfessionalModes = {
  "cad-line-art": {
    label: "CAD tek çizgi · dış kesim",
    hint: "Siyah çizgileri merkezden tek ve pürüzsüz yol olarak çıkarır. Çerçeve silinirse yalnız büyük yeni dış konturlar kesime geçer; küçük ayrıntılar kazımada kalır.",
    operation: "engrave_line",
    productMode: "cad_line_art",
    mixedOperations: true,
    values: {
      vecMode: "centerline",
      vecThresholdMode: "otsu",
      vecBlur: "0",
      vecContrast: "1.08",
      vecMorphClose: "1",
      vecMorphOpen: "0",
      vecDenoise: "0",
      vecMinArea: "4",
      vecMinLength: "3",
      vecSimplify: "0.9",
      vecSmooth: "3",
      vecMaxContours: "8000",
      vecStitchGap: "0.5",
      vecMaxDimension: "4800",
      vecAdaptiveBlock: "35",
      vecAdaptiveC: "5",
      vecInvert: true,
      vecRemoveBorder: false,
      vecBackgroundNormalize: false,
    },
  },
  "cut-stencil": {
    label: "Kesim şablonu",
    hint: "Koyu motifleri kapalı kesim konturlarına çevirir; çerçeve ve küçük gürültü temizliği açıktır.",
    operation: "cut",
    productMode: "cut_template",
    values: {
      vecMode: "auto",
      vecThresholdMode: "otsu",
      vecBlur: "1",
      vecContrast: "1.08",
      vecMorphClose: "1",
      vecMorphOpen: "0",
      vecDenoise: "5",
      vecMinArea: "35",
      vecMinLength: "10",
      vecSimplify: "0.45",
      vecSmooth: "3",
      vecMaxContours: "2500",
      vecStitchGap: "0.8",
      vecMaxDimension: "2400",
      vecAdaptiveBlock: "35",
      vecAdaptiveC: "5",
      vecInvert: true,
      vecRemoveBorder: true,
      vecBackgroundNormalize: true,
    },
  },
  "line-engrave": {
    label: "Çizgi kazıma",
    hint: "İnce çizimleri merkez çizgi olarak çıkarır; açık konturlar kazıma için kabul edilir.",
    operation: "engrave_line",
    productMode: "line_engrave",
    values: {
      vecMode: "centerline",
      vecThresholdMode: "otsu",
      vecBlur: "0",
      vecContrast: "1.12",
      vecMorphClose: "1",
      vecMorphOpen: "0",
      vecDenoise: "4",
      vecMinArea: "4",
      vecMinLength: "8",
      vecSimplify: "0.6",
      vecSmooth: "1",
      vecMaxContours: "8000",
      vecStitchGap: "2",
      vecMaxDimension: "2200",
      vecAdaptiveBlock: "35",
      vecAdaptiveC: "5",
      vecInvert: true,
      vecRemoveBorder: true,
      vecBackgroundNormalize: true,
    },
  },
  "filled-ornament": {
    label: "Dolgu motif",
    hint: "Dolu siyah motifleri kapalı alanlara çevirir; G-code dolgu tarama satırlarıyla kazır.",
    operation: "engrave_fill",
    productMode: "fill_motif",
    values: {
      vecMode: "potrace",
      vecThresholdMode: "otsu",
      vecBlur: "1",
      vecContrast: "1.18",
      vecMorphClose: "2",
      vecMorphOpen: "1",
      vecDenoise: "5",
      vecMinArea: "20",
      vecMinLength: "12",
      vecSimplify: "1",
      vecSmooth: "2",
      vecMaxContours: "4000",
      vecStitchGap: "0",
      vecMaxDimension: "2400",
      vecAdaptiveBlock: "35",
      vecAdaptiveC: "5",
      vecInvert: true,
      vecRemoveBorder: true,
      vecBackgroundNormalize: true,
    },
  },
  "photo-engrave": {
    label: "Foto gravür hazırlık",
    hint: "Gerçek fotoğrafları SVG kontura çevirmez; raster gri ton G-code için desen olarak hazırlar.",
    operation: "engrave_fill",
    productMode: "photo_engrave",
    rasterPhoto: true,
    values: {
      vecMode: "auto",
      vecThresholdMode: "adaptive",
      vecBlur: "1",
      vecContrast: "1.15",
      vecMorphClose: "0",
      vecMorphOpen: "0",
      vecDenoise: "5",
      vecMinArea: "18",
      vecMinLength: "6",
      vecSimplify: "0.5",
      vecSmooth: "2",
      vecMaxContours: "3500",
      vecStitchGap: "0",
      vecMaxDimension: "2200",
      vecAdaptiveBlock: "35",
      vecAdaptiveC: "5",
      vecInvert: true,
      vecRemoveBorder: true,
      vecBackgroundNormalize: true,
    },
  },
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
  "vecProfessionalMode",
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

function captureImageAdjustmentBases(imageSources = captureImageSources()) {
  const bases = {};
  for (const [id, src] of imageAdjustmentBases.entries()) {
    if (src && src !== imageSources[id]) bases[id] = src;
  }
  return bases;
}

function restoreImageSources(sources = {}, adjustmentBases = {}) {
  state.images = new Map();
  imageAdjustmentBases.clear();
  for (const [id, src] of Object.entries(sources)) {
    if (!src) continue;
    const image = new Image();
    image.src = src;
    image.addEventListener("load", draw, { once: true });
    state.images.set(id, image);
    imageAdjustmentBases.set(id, adjustmentBases[id] || src);
  }
}

function createUndoSnapshot(label = "islem") {
  const imageSources = captureImageSources();
  return {
    label,
    parts: clonePlain(state.parts),
    placements: clonePlain(state.placements),
    patterns: clonePlain(state.patterns),
    customFonts: clonePlain(state.customFonts),
    selected: state.selected ? clonePlain(state.selected) : null,
    selectedItems: clonePlain(state.selectedItems || []),
    selectedVectorPaths: clonePlain(state.selectedVectorPaths || []),
    vectorSelectionRegion: state.vectorSelectionRegion ? clonePlain(state.vectorSelectionRegion) : null,
    clipboardPasteCount: state.clipboardPasteCount,
    laserCmd: state.laserCmd,
    layout: clonePlain(state.layout),
    materialArea: clonePlain(state.materialArea),
    inputs: undoInputSnapshot(),
    imageSources,
    imageAdjustmentBases: captureImageAdjustmentBases(imageSources),
  };
}

function pushUndo(label = "islem") {
  if (undoRestoring) return;
  if (canvasInteraction) finishCanvasInteraction({ redraw: false, updateUi: false });
  undoStack.push(createUndoSnapshot(label));
  redoStack.length = 0;
  while (undoStack.length > UNDO_LIMIT) undoStack.shift();
  markProjectDirty(label);
}

function restoreUndoSnapshot(snapshot) {
  window.clearTimeout(canvasInteractionTimer);
  canvasInteractionTimer = null;
  canvasInteraction = null;
  undoRestoring = true;
  try {
    state.parts = clonePlain(snapshot.parts || []);
    state.placements = clonePlain(snapshot.placements || []);
    state.patterns = clonePlain(snapshot.patterns || []);
    state.customFonts = clonePlain(snapshot.customFonts || []).map((font) => ({ ...font, installed: false }));
    state.selected = snapshot.selected ? clonePlain(snapshot.selected) : null;
    state.selectedItems = clonePlain(snapshot.selectedItems || []);
    state.selectedVectorPaths = clonePlain(snapshot.selectedVectorPaths || []);
    state.vectorSelectionRegion = snapshot.vectorSelectionRegion ? clonePlain(snapshot.vectorSelectionRegion) : null;
    rebuildVectorPathSelectionKeys();
    invalidateSelectedVectorMoveTargets();
    state.clipboardPasteCount = Number(snapshot.clipboardPasteCount) || 0;
    state.laserCmd = snapshot.laserCmd || state.laserCmd;
    state.layout = clonePlain(snapshot.layout || state.layout);
    state.materialArea = normalizeMaterialArea(snapshot.materialArea || state.materialArea);
    state.drag = null;
    cancelImageTool();
    cancelDrawingTool();
    state.currentAnalysis = null;
    applyUndoInputSnapshot(snapshot.inputs || {});
    restoreImageSources(snapshot.imageSources || {}, snapshot.imageAdjustmentBases || {});
    installCustomFonts().then(() => renderTextFontOptions(refs.textFont?.value)).catch(() => renderTextFontOptions(refs.textFont?.value));
    syncLaserButtons();
    saveUiSettings();
    clearMachinePreview();
    updateUiFromAnalysis(computeJobAnalysis());
    updateSelectionPanel();
    syncImageEditUi();
    draw();
    renderMachinePanel();
  } finally {
    undoRestoring = false;
  }
}

function undoLast() {
  if (canvasInteraction) finishCanvasInteraction({ redraw: false, updateUi: false });
  const snapshot = undoStack.pop();
  if (!snapshot) {
    setStatus("Geri alınacak işlem yok.", "warn");
    return;
  }
  redoStack.push(createUndoSnapshot(snapshot.label || "işlem"));
  while (redoStack.length > UNDO_LIMIT) redoStack.shift();
  restoreUndoSnapshot(snapshot);
  markProjectDirty(`Geri al: ${snapshot.label || "işlem"}`);
  setStatus(`Geri alındı: ${snapshot.label || "işlem"}.`, "ok");
}

function redoLast() {
  if (canvasInteraction) finishCanvasInteraction({ redraw: false, updateUi: false });
  const snapshot = redoStack.pop();
  if (!snapshot) {
    setStatus("Yinelenecek işlem yok.", "warn");
    return;
  }
  undoStack.push(createUndoSnapshot(snapshot.label || "işlem"));
  while (undoStack.length > UNDO_LIMIT) undoStack.shift();
  restoreUndoSnapshot(snapshot);
  markProjectDirty(`Yinele: ${snapshot.label || "işlem"}`);
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

function textFontValue(font) {
  return font.custom ? customFontValue(font) : font.id;
}

function inferredFontCategory(font) {
  if (font?.category) return font.category;
  if (font?.kind === "single") return "monospace";
  const value = `${font?.id || ""} ${font?.name || font?.label || ""}`.toLocaleLowerCase("tr-TR");
  if (/(script|hand|brush|calligraphy|corsiva|mistral|lucida)/.test(value)) return "handwriting";
  if (/(alger|broadway|decor|stencil|papyrus|comic)/.test(value)) return "decorative";
  if (/(times|georgia|garamond|cambria|baskerville|book antiqua)/.test(value)) return "serif";
  if (/(consolas|courier|mono|code)/.test(value)) return "monospace";
  return "sans";
}

function fontIsThickSuitable(font) {
  if (typeof font?.thickSuitable === "boolean") return font.thickSuitable;
  if ((font?.weights || []).some((weight) => Number(weight) >= 700)) return true;
  const value = `${font?.id || ""} ${font?.name || font?.label || ""}`.toLocaleLowerCase("tr-TR");
  return /(black|heavy|bold|impact|poster|fat|cooper|broadway|bauhaus)/.test(value);
}

function cssQuotedFontFamily(family) {
  const escaped = String(family || "Arial").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}", Arial, sans-serif`;
}

function systemFontDefinitions() {
  const curatedNames = new Set(
    TEXT_FONT_PRESETS
      .filter((font) => font.kind !== "single")
      .map((font) => String(font.name || font.label || "").toLocaleLowerCase("tr-TR")),
  );
  return (state.systemFonts || [])
    .filter((font) => !curatedNames.has(String(font.family || "").toLocaleLowerCase("tr-TR")))
    .map((font) => ({
      ...font,
      name: font.family,
      label: font.family,
      family: cssQuotedFontFamily(font.family),
      kind: "outline",
      system: true,
    }));
}

function curatedFontDefinitions() {
  const systemByName = new Map(
    (state.systemFonts || []).map((font) => [String(font.family || "").toLocaleLowerCase("tr-TR"), font]),
  );
  return TEXT_FONT_PRESETS.map((font) => {
    const system = systemByName.get(String(font.name || font.label || "").toLocaleLowerCase("tr-TR"));
    return system ? { ...font, ...system, id: font.id, family: font.family, label: font.label } : font;
  });
}

function customFontDefinitions() {
  return state.customFonts.map((font) => ({ ...font, kind: "outline", custom: true, category: "other" }));
}

function textFontDefinitions() {
  return [
    ...curatedFontDefinitions(),
    ...systemFontDefinitions(),
    ...customFontDefinitions(),
  ];
}

function textFontDefinitionByValue(value) {
  const normalized = value || DEFAULT_TEXT_FONT_VALUE;
  if (normalized.startsWith("custom:")) {
    const id = normalized.slice("custom:".length);
    const font = state.customFonts.find((item) => item.id === id);
    if (font) return { ...font, kind: "outline", custom: true, value: normalized };
  }
  const definitions = textFontDefinitions();
  return definitions.find((item) => textFontValue(item) === normalized)
    || definitions.find((item) => textFontValue(item) === DEFAULT_TEXT_FONT_VALUE)
    || curatedFontDefinitions()[0];
}

function selectedTextFontDefinition() {
  return textFontDefinitionByValue(refs.textFont?.value || DEFAULT_TEXT_FONT_VALUE);
}

function filledTextFontDefinition() {
  return textFontDefinitionByValue(DEFAULT_TEXT_FONT_VALUE);
}

function textFontForOperation(font, operation) {
  const normalizedOperation = normalizeOperation(operation, "engrave_line");
  return font?.kind === "single" && normalizedOperation !== "engrave_line"
    ? filledTextFontDefinition()
    : font;
}

function textFontCssFamily(font) {
  if (font?.kind === "single") return "Consolas, 'Courier New', monospace";
  return font?.family || "Arial, sans-serif";
}

function editableTextValue(pattern) {
  const stored = pattern?.textSettings?.text;
  if (typeof stored === "string" && stored.trim()) return stored;
  const name = String(pattern?.name || "");
  if (!name.startsWith("Metin: ")) return "";
  const recovered = name.slice("Metin: ".length);
  if (!recovered.endsWith("…")) return recovered;
  const currentInput = String(refs.textInput?.value || "").trim();
  return currentInput.startsWith(recovered.slice(0, -1)) ? currentInput : "";
}

function editableTextPattern(pattern = selectedPattern()) {
  if (!pattern) return null;
  return pattern.generatedKind === "text" || pattern.textSettings?.mode ? pattern : null;
}

function outlineTextPattern(pattern = selectedPattern()) {
  const textPattern = editableTextPattern(pattern);
  return textPattern?.textSettings?.mode === "outline" ? textPattern : null;
}

function textFillLineStep(pattern) {
  const saved = Number(pattern?.textSettings?.fillLineStep);
  if (Number.isFinite(saved) && saved > 0) return clamp(saved, 0.05, 1);
  const current = Number(pattern?.lineStep);
  if (patternOperation(pattern) === "engrave_fill" && Number.isFinite(current) && current > 0 && current <= 0.2) {
    return clamp(current, 0.05, 1);
  }
  return TEXT_FILL_LINE_STEP_MM;
}

function textFontValueForPattern(pattern) {
  const settings = pattern?.textSettings || {};
  const definitions = textFontDefinitions();
  if (settings.fontValue && definitions.some((font) => textFontValue(font) === settings.fontValue)) {
    return settings.fontValue;
  }
  const byFamily = definitions.find((font) => font.family && settings.family === font.family);
  if (byFamily) return textFontValue(byFamily);
  const byName = definitions.find((font) => (font.name || font.label) === settings.font);
  return byName ? textFontValue(byName) : settings.mode === "single-line" ? "laser-single" : "arial";
}

function updateTextFontSelectionUi(value = refs.textFont?.value || DEFAULT_TEXT_FONT_VALUE) {
  const font = textFontDefinitionByValue(value);
  if (refs.textFontButtonLabel) {
    refs.textFontButtonLabel.textContent = font.name || font.label;
    refs.textFontButtonLabel.style.fontFamily = textFontCssFamily(font);
  }
  refs.textFontOptions?.querySelectorAll("[data-font-value]").forEach((button) => {
    button.setAttribute("aria-selected", button.dataset.fontValue === value ? "true" : "false");
  });
}

function setTextFontControlValue(value) {
  if (!refs.textFont) return;
  const values = Array.from(refs.textFont.options).map((option) => option.value);
  refs.textFont.value = values.includes(value) ? value : DEFAULT_TEXT_FONT_VALUE;
  updateTextFontSelectionUi(refs.textFont.value);
  updateTextFontHint();
}

function syncTextControlsFromPattern(pattern) {
  const editable = editableTextPattern(pattern);
  if (!editable) return;
  const settings = editable.textSettings || {};
  const text = editableTextValue(editable);
  if (text && refs.textInput) refs.textInput.value = text;
  if (refs.textHeight && Number(settings.height) > 0) refs.textHeight.value = Number(settings.height);
  if (refs.textTracking && Number.isFinite(Number(settings.tracking))) refs.textTracking.value = Number(settings.tracking);
  if (refs.textWeight && settings.weight) refs.textWeight.value = String(settings.weight);
  if (refs.textStyle && settings.style) refs.textStyle.value = settings.style;
  if (refs.textOperation) refs.textOperation.value = settings.operation || patternOperation(editable);
  setTextFontControlValue(textFontValueForPattern(editable));
}

function previewSelectedTextFont(value) {
  const pattern = editableTextPattern();
  const text = editableTextValue(pattern);
  if (!pattern || !text) return;
  activeTextFontPreview = {
    patternId: pattern.id,
    value,
    font: textFontDefinitionByValue(value),
    text,
    settings: { ...(pattern.textSettings || {}) },
  };
  draw();
}

function clearTextFontPreview() {
  if (!activeTextFontPreview) return;
  activeTextFontPreview = null;
  draw();
}

function positionTextFontMenu() {
  if (!refs.textFontMenu || !refs.textFontButton || refs.textFontMenu.classList.contains("hidden")) return;
  const rect = refs.textFontButton.getBoundingClientRect();
  const width = Math.min(Math.max(420, rect.width), Math.max(280, window.innerWidth - 16));
  refs.textFontMenu.style.width = `${width}px`;
  const downSpace = window.innerHeight - rect.bottom - 8;
  const upSpace = rect.top - 8;
  const openDown = downSpace >= Math.min(300, upSpace);
  const available = Math.max(150, openDown ? downSpace : upSpace);
  refs.textFontMenu.style.maxHeight = `${Math.min(560, available)}px`;
  const measuredHeight = Math.min(refs.textFontMenu.scrollHeight, Math.min(560, available));
  const top = openDown ? rect.bottom + 4 : Math.max(8, rect.top - measuredHeight - 4);
  const left = clamp(rect.left, 8, Math.max(8, window.innerWidth - width - 8));
  refs.textFontMenu.style.left = `${left}px`;
  refs.textFontMenu.style.top = `${top}px`;
}

function textFontMenuIsOpen() {
  return Boolean(refs.textFontMenu && !refs.textFontMenu.classList.contains("hidden"));
}

function filterTextFontOptions(query = "") {
  const normalized = String(query).trim().toLocaleLowerCase("tr-TR");
  const activeFilter = state.textFontFilter || "all";
  let visibleCount = 0;
  refs.textFontOptions?.querySelectorAll(".font-option-section").forEach((section) => {
    let sectionCount = 0;
    section.querySelectorAll("[data-font-value]").forEach((button) => {
      const matchesQuery = !normalized || String(button.dataset.fontName || "").toLocaleLowerCase("tr-TR").includes(normalized);
      const matchesFilter = activeFilter === "all"
        || (activeFilter === "thick" && button.dataset.fontThick === "true")
        || button.dataset.fontCategory === activeFilter;
      const visible = matchesQuery && matchesFilter;
      button.classList.toggle("hidden", !visible);
      if (visible) {
        visibleCount += 1;
        sectionCount += 1;
      }
    });
    section.classList.toggle("hidden", sectionCount === 0);
  });
  refs.textFontEmpty?.classList.toggle("hidden", visibleCount > 0);
  if (refs.textFontCount) refs.textFontCount.textContent = `${visibleCount.toLocaleString("tr-TR")} font`;
  refs.textFontFilters?.querySelectorAll("[data-font-filter]").forEach((button) => {
    const active = button.dataset.fontFilter === activeFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  return visibleCount;
}

function closeTextFontMenu(options = {}) {
  if (!refs.textFontMenu) return;
  refs.textFontMenu.classList.add("hidden");
  refs.textFontButton?.setAttribute("aria-expanded", "false");
  if (refs.textFontSearch) refs.textFontSearch.value = "";
  filterTextFontOptions();
  if (!options.keepPreview) clearTextFontPreview();
  if (options.restoreFocus) refs.textFontButton?.focus();
}

function openTextFontMenu() {
  if (!refs.textFontMenu || !refs.textFontButton) return;
  refs.textFontMenu.classList.remove("hidden");
  refs.textFontButton.setAttribute("aria-expanded", "true");
  updateTextFontSelectionUi();
  filterTextFontOptions();
  positionTextFontMenu();
  refs.textFontSearch?.focus();
}

function visibleTextFontButtons() {
  return Array.from(refs.textFontOptions?.querySelectorAll("[data-font-value]") || []).filter(
    (button) => !button.classList.contains("hidden")
  );
}

function focusTextFontOption(current, delta) {
  const buttons = visibleTextFontButtons();
  if (!buttons.length) return;
  const currentIndex = buttons.indexOf(current);
  const index = currentIndex < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (currentIndex + delta + buttons.length) % buttons.length;
  buttons[index].focus();
}

async function chooseTextFont(value) {
  setTextFontControlValue(value);
  saveUiSettings();
  const pattern = editableTextPattern();
  const text = editableTextValue(pattern);
  if (!pattern || !text) {
    closeTextFontMenu();
    return;
  }
  previewSelectedTextFont(value);
  closeTextFontMenu({ keepPreview: true });
  await applyFontToSelectedText(pattern, value);
}

function appendTextFontGroup(label, fonts) {
  if (!fonts.length || !refs.textFontOptions) return;
  const section = document.createElement("div");
  section.className = "font-option-section";
  const heading = document.createElement("div");
  heading.className = "font-option-group";
  heading.textContent = label;
  section.appendChild(heading);
  fonts.forEach((font) => {
    const value = textFontValue(font);
    const category = inferredFontCategory(font);
    const thickSuitable = fontIsThickSuitable(font);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "font-option";
    button.dataset.fontValue = value;
    button.dataset.fontName = font.name || font.label;
    button.dataset.fontCategory = category;
    button.dataset.fontThick = thickSuitable ? "true" : "false";
    button.dataset.fontTurkish = font.supportsTurkish ? "true" : "false";
    button.setAttribute("role", "option");
    const labelWrap = document.createElement("span");
    labelWrap.className = "font-option-label";
    const name = document.createElement("span");
    name.className = "font-option-name";
    name.textContent = font.name || font.label;
    name.style.fontFamily = textFontCssFamily(font);
    const badges = document.createElement("span");
    badges.className = "font-option-badges";
    if (thickSuitable) {
      const badge = document.createElement("b");
      badge.className = "is-thick";
      badge.textContent = "Kalın";
      badges.appendChild(badge);
    }
    if (font.supportsTurkish) {
      const badge = document.createElement("b");
      badge.className = "is-tr";
      badge.textContent = "TR";
      badges.appendChild(badge);
    }
    labelWrap.append(name, badges);
    const sample = document.createElement("span");
    sample.className = "font-option-sample";
    sample.textContent = "Aa Çğ 123";
    sample.style.fontFamily = textFontCssFamily(font);
    button.append(labelWrap, sample);
    button.addEventListener("pointerenter", () => previewSelectedTextFont(value));
    button.addEventListener("focus", () => previewSelectedTextFont(value));
    button.addEventListener("click", () => chooseTextFont(value));
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        focusTextFontOption(button, event.key === "ArrowDown" ? 1 : -1);
      }
    });
    section.appendChild(button);
  });
  refs.textFontOptions.appendChild(section);
}

function renderTextFontOptions(selectedValue = "") {
  const select = refs.textFont;
  if (!select) return;
  const selected = selectedValue || select.value || DEFAULT_TEXT_FONT_VALUE;
  select.innerHTML = "";
  if (refs.textFontOptions) refs.textFontOptions.innerHTML = "";
  const appendGroup = (label, fonts) => {
    if (!fonts.length) return;
    const group = document.createElement("optgroup");
    group.label = label;
    fonts.forEach((font) => {
      const option = document.createElement("option");
      option.value = textFontValue(font);
      option.textContent = font.name || font.label;
      option.style.fontFamily = textFontCssFamily(font);
      group.appendChild(option);
    });
    select.appendChild(group);
    appendTextFontGroup(label, fonts);
  };
  const curatedFonts = curatedFontDefinitions();
  appendGroup("Lazer fontu", curatedFonts.filter((font) => font.kind === "single"));
  appendGroup("Öne çıkan fontlar", curatedFonts.filter((font) => font.kind !== "single"));
  const systemGroups = [
    ["El yazısı", "handwriting"],
    ["Dekoratif", "decorative"],
    ["Sans serif", "sans"],
    ["Serif", "serif"],
    ["Monospace", "monospace"],
    ["Diğer sistem fontları", "other"],
  ];
  const systemFonts = systemFontDefinitions();
  for (const [label, category] of systemGroups) {
    appendGroup(label, systemFonts.filter((font) => inferredFontCategory(font) === category));
  }
  appendGroup("Yüklenen fontlar", customFontDefinitions());
  const values = Array.from(select.options).map((option) => option.value);
  select.value = values.includes(selected) ? selected : DEFAULT_TEXT_FONT_VALUE;
  updateTextFontSelectionUi(select.value);
  updateTextFontHint();
  filterTextFontOptions(refs.textFontSearch?.value || "");
}

async function loadSystemFonts(preferredValue = "") {
  if (refs.textFontLoading) {
    refs.textFontLoading.classList.remove("hidden");
    refs.textFontLoading.textContent = "Bilgisayardaki fontlar taranıyor…";
  }
  try {
    const response = await fetch("/api/system-fonts");
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || "Sistem fontları okunamadı.");
    state.systemFonts = (data.fonts || [])
      .filter((font) => font?.id && font?.family)
      .map((font) => ({
        id: String(font.id),
        family: String(font.family),
        weights: Array.isArray(font.weights) ? font.weights.map(Number).filter(Number.isFinite) : [],
        styles: Array.isArray(font.styles) ? font.styles.map(String) : [],
        category: ["handwriting", "decorative", "sans", "serif", "monospace", "other"].includes(font.category)
          ? font.category
          : "other",
        supportsTurkish: Boolean(font.supportsTurkish),
        thickSuitable: Boolean(font.thickSuitable),
      }));
    state.systemFontsLoaded = true;
    const activeText = editableTextPattern();
    const selected = activeText ? textFontValueForPattern(activeText) : preferredValue || refs.textFont?.value;
    renderTextFontOptions(selected || DEFAULT_TEXT_FONT_VALUE);
    if (refs.textFontLoading) {
      refs.textFontLoading.textContent = `${state.systemFonts.length.toLocaleString("tr-TR")} sistem fontu hazır.`;
      window.setTimeout(() => refs.textFontLoading?.classList.add("hidden"), 1400);
    }
    if (textFontMenuIsOpen()) positionTextFontMenu();
    return state.systemFonts;
  } catch (error) {
    state.systemFontsLoaded = true;
    if (refs.textFontLoading) refs.textFontLoading.textContent = "Sistem fontları okunamadı; font dosyası yüklemeyi kullanabilirsiniz.";
    return [];
  }
}

function updateTextFontHint() {
  const hint = refs.textFontHint;
  if (!hint) return;
  const font = selectedTextFontDefinition();
  const op = refs.textOperation?.value || "engrave_line";
  if (font.kind === "single" && op !== "engrave_line") {
    hint.textContent = "Dolgu veya kesim seçildiğinde Arial Black kontur fontu otomatik kullanılacak.";
  } else if (font.kind === "single") {
    hint.textContent = "Laser tek çizgi font hızlı kazıma içindir; kesim/dolgu için kontur font seç.";
  } else if (op === "cut") {
    hint.textContent = `"${font.name || font.label}" kontur olarak kesime çevrilecek. İnce yazılarda küçük iç adalar düşmeyebilir.`;
  } else if (op === "engrave_fill") {
    hint.textContent = `"${font.name || font.label}" bütün harf gövdesi ${TEXT_FILL_LINE_STEP_MM.toFixed(2)} mm sık taramayla kalın kazınacak.`;
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
  if ((normalized === "warn" || normalized === "danger") && state?.activity) {
    addActivityNotification({ text, level: normalized, source: "Uygulama" });
  }
}

function loadActivityState() {
  state.activity.notifications = state.activity.store.loadNotifications();
  state.activity.history = state.activity.store.loadHistory();
  renderNotificationCenter();
  renderProductionHistory();
}

function saveNotifications() {
  state.activity.store.saveNotifications(state.activity.notifications);
  renderNotificationCenter();
}

function saveProductionHistory() {
  state.activity.store.saveHistory(state.activity.history);
  renderProductionHistory();
}

function addActivityNotification(entry) {
  state.activity.notifications = ProductionState.addNotification(state.activity.notifications, entry);
  saveNotifications();
}

function installClientErrorBoundary() {
  const record = (reason, source) => {
    const message = String(reason?.message || reason || "Bilinmeyen uygulama hatası").slice(0, 600);
    const entry = { message, source, at: new Date().toISOString() };
    state.support.errors = [entry, ...state.support.errors.filter((item) => item.message !== message)].slice(0, 25);
    addActivityNotification({ text: message, detail: source, level: "danger", source: "Uygulama" });
  };
  window.addEventListener("error", (event) => record(event.error || event.message, "JavaScript error"));
  window.addEventListener("unhandledrejection", (event) => record(event.reason, "Unhandled promise"));
}

function activityTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function renderNotificationCenter() {
  const unread = ProductionState.unreadCount(state.activity.notifications);
  if (refs.notificationBadge) {
    refs.notificationBadge.textContent = unread > 99 ? "99+" : String(unread);
    refs.notificationBadge.classList.toggle("hidden", unread === 0);
  }
  if (!refs.notificationsList) return;
  const filter = state.activity.notificationFilter;
  const items = state.activity.notifications.filter((item) => {
    if (filter === "unread") return !item.read;
    if (filter === "danger") return item.level === "danger";
    return true;
  });
  refs.notificationsList.replaceChildren();
  for (const item of items) {
    const row = document.createElement("article");
    row.className = `activity-row ${item.level}${item.read ? "" : " unread"}`;
    const dot = document.createElement("i");
    dot.className = "activity-dot";
    const main = document.createElement("div");
    main.className = "activity-main";
    const title = document.createElement("strong");
    title.textContent = item.text;
    main.append(title);
    if (item.detail) {
      const detail = document.createElement("span");
      detail.textContent = item.detail;
      main.append(detail);
    }
    const meta = document.createElement("div");
    meta.className = "activity-meta";
    const source = document.createElement("span");
    source.textContent = item.source;
    const time = document.createElement("time");
    time.dateTime = item.createdAt;
    time.textContent = activityTime(item.createdAt);
    meta.append(source, time);
    if (item.code) {
      const code = document.createElement("code");
      code.textContent = item.code;
      meta.append(code);
    }
    row.append(dot, main, meta);
    refs.notificationsList.append(row);
  }
  refs.notificationsEmpty?.classList.toggle("hidden", items.length > 0);
  document.querySelectorAll("[data-notification-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.notificationFilter === filter);
  });
}

function openNotifications() {
  refs.notificationsModal?.classList.remove("hidden");
  state.activity.notifications = ProductionState.markAllRead(state.activity.notifications);
  saveNotifications();
}

function closeNotifications() {
  refs.notificationsModal?.classList.add("hidden");
}

function historyStatusLabel(status) {
  return ({
    generated: "G-code hazır",
    sent: "Gönderildi",
    running: "Üretiliyor",
    paused: "Duraklatıldı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    failed: "Hata",
  })[status] || status;
}

function historyStatusLevel(status) {
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "paused") return "warn";
  if (status === "completed") return "ok";
  return "info";
}

function renderProductionHistory() {
  if (!refs.productionHistoryList) return;
  refs.productionHistoryList.replaceChildren();
  for (const item of state.activity.history) {
    const row = document.createElement("article");
    row.className = `activity-row production-history-row ${historyStatusLevel(item.status)}`;
    const dot = document.createElement("i");
    dot.className = "activity-dot";
    const main = document.createElement("div");
    main.className = "activity-main";
    const title = document.createElement("strong");
    title.textContent = `${item.projectName} · ${item.fileName}`;
    const path = document.createElement("span");
    path.textContent = item.path;
    const metrics = document.createElement("div");
    metrics.className = "history-metrics";
    const bounds = item.bounds || {};
    const metricValues = [
      Number(bounds.width) > 0 ? `${Number(bounds.width).toFixed(1)} × ${Number(bounds.height).toFixed(1)} mm` : "",
      item.estimatedSeconds ? `~${formatDuration(item.estimatedSeconds)}` : "",
      item.cutLength ? `Kesim ${Number(item.cutLength).toFixed(0)} mm` : "",
      item.engraveLength ? `Kazıma ${Number(item.engraveLength).toFixed(0)} mm` : "",
    ].filter(Boolean);
    for (const value of metricValues) {
      const span = document.createElement("span");
      span.textContent = value;
      metrics.append(span);
    }
    main.append(title, path, metrics);
    const meta = document.createElement("div");
    meta.className = "activity-meta";
    const status = document.createElement("span");
    status.className = "history-status";
    status.textContent = historyStatusLabel(item.status);
    const time = document.createElement("time");
    time.dateTime = item.updatedAt;
    time.textContent = activityTime(item.updatedAt);
    meta.append(status, time);
    if (item.fileHash) {
      const hash = document.createElement("code");
      hash.title = item.fileHash;
      hash.textContent = `SHA-256 ${item.fileHash.slice(0, 12)}…`;
      meta.append(hash);
    }
    row.append(dot, main, meta);
    refs.productionHistoryList.append(row);
  }
  refs.productionHistoryEmpty?.classList.toggle("hidden", state.activity.history.length > 0);
}

function openProductionHistory() {
  refs.productionHistoryModal?.classList.remove("hidden");
  renderProductionHistory();
}

function closeProductionHistory() {
  refs.productionHistoryModal?.classList.add("hidden");
}

function recordProductionHistory(status, options = {}) {
  const preview = state.machine.preview;
  const path = refs.outputPath?.value?.trim() || "";
  if (!path) return null;
  const activeEntry = state.activity.history.find((item) => item.id === state.activity.activeHistoryId);
  const currentId = options.id || (activeEntry?.path === path ? activeEntry.id : "");
  state.activity.history = ProductionState.upsertHistory(state.activity.history, {
    id: currentId || undefined,
    path,
    fileHash: preview?.fileHash || "",
    projectId: state.project.id,
    projectName: state.project.name,
    status,
    estimatedSeconds: preview?.estimatedSeconds || 0,
    bounds: preview?.bounds || null,
    cutLength: preview?.processCutLength || 0,
    engraveLength: preview?.engraveLength || 0,
    sentLines: options.sentLines || 0,
    totalLines: options.totalLines || preview?.lineCount || 0,
    message: options.message || "",
  });
  const match = state.activity.history.find((item) => item.path === path && (!preview?.fileHash || item.fileHash === preview.fileHash));
  state.activity.activeHistoryId = match?.id || currentId;
  saveProductionHistory();
  return match || null;
}

function captureMachineActivity(previous, next) {
  const previousWarnings = new Set(previous?.warnings || []);
  for (const warning of next?.warnings || []) {
    if (!previousWarnings.has(warning)) addActivityNotification({ text: warning, level: "warn", source: "Makine" });
  }
  const machineState = String(next?.lastStatus?.state || "");
  if (/^alarm/i.test(machineState) && machineState !== state.activity.lastMachineAlarm) {
    state.activity.lastMachineAlarm = machineState;
    addActivityNotification({ text: `Makine ${machineState} durumunda`, level: "danger", source: "Makine", code: next?.lastStatus?.raw || "" });
  } else if (!/^alarm/i.test(machineState)) {
    state.activity.lastMachineAlarm = "";
  }
  const job = next?.job || {};
  const previousJob = previous?.job || {};
  if (job.running && !previousJob.running) recordProductionHistory("running", { sentLines: job.sent, totalLines: job.total, message: job.message });
  if (job.paused && !previousJob.paused) recordProductionHistory("paused", { sentLines: job.sent, totalLines: job.total, message: job.message });
  if (job.finishedAt && job.finishedAt !== state.activity.lastMachineFinishedAt) {
    state.activity.lastMachineFinishedAt = job.finishedAt;
    const failed = Number(job.errors || 0) > 0;
    const cancelled = /iptal/i.test(String(job.message || ""));
    const status = failed ? (cancelled ? "cancelled" : "failed") : "completed";
    recordProductionHistory(status, { sentLines: job.sent, totalLines: job.total, message: job.message });
    addActivityNotification({
      text: failed ? `Üretim tamamlanamadı: ${job.message || "Makine hatası"}` : "Üretim tamamlandı.",
      level: failed ? "danger" : "ok",
      source: "Makine",
      detail: refs.outputPath?.value || "",
    });
  }
}

function readLocalJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch (_error) {
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_error) {
    return false;
  }
}

function projectHasContent() {
  return Boolean(state.parts.length || state.placements.length || state.patterns.length || state.materialArea.points.length);
}

function ensureStateEntityIdentities() {
  ProjectState.normalizeProjectEntities(state);
}

function projectCounts() {
  return ProjectState.deriveCounts(state);
}

function loadProjectPreferences() {
  state.preferences = ProjectState.normalizePreferences(
    readLocalJson(ProjectState.STORAGE_KEYS.preferences, ProjectState.DEFAULT_PREFERENCES)
  );
  state.recentProjects = ProjectState.normalizeRecentProjects(
    readLocalJson(ProjectState.STORAGE_KEYS.recentProjects, []),
    state.preferences.maxRecentProjects
  );
}

function saveProjectPreferences() {
  state.preferences = ProjectState.normalizePreferences(state.preferences);
  state.recentProjects = ProjectState.normalizeRecentProjects(state.recentProjects, state.preferences.maxRecentProjects);
  writeLocalJson(ProjectState.STORAGE_KEYS.preferences, state.preferences);
  writeLocalJson(ProjectState.STORAGE_KEYS.recentProjects, state.recentProjects);
}

function updateProjectChrome() {
  if (refs.projectTitle) refs.projectTitle.textContent = state.project.name || "Adsız iş";
  refs.projectDirtyMark?.classList.toggle("hidden", !state.project.dirty);
  document.title = `${state.project.dirty ? "*" : ""}${state.project.name || "Adsız iş"} - Lazer İş Editörü`;
  renderProjectInfo();
}

function markProjectDirty(action = "Değişiklik") {
  if (undoRestoring) return;
  state.project = ProjectState.markDirty(state.project, action);
  updateProjectChrome();
  scheduleProjectAutosave();
}

function recoveryMetadata(snapshot) {
  const session = snapshot?.session || {};
  const counts = ProjectState.deriveCounts(snapshot?.project || {});
  return {
    projectId: session.id || "",
    name: session.name || snapshot?.project?.name || "Adsız iş",
    path: session.path || "",
    autosavedAt: snapshot?.autosavedAt || session.lastAutosavedAt || null,
    counts,
  };
}

function updateRecoveryUi() {
  const snapshot = state.recovery.snapshot;
  refs.recoverySection?.classList.toggle("hidden", !snapshot);
  if (!snapshot || !refs.recoverySummary) return;
  const meta = recoveryMetadata(snapshot);
  const time = meta.autosavedAt ? new Date(meta.autosavedAt).toLocaleString("tr-TR") : "bilinmiyor";
  refs.recoverySummary.textContent = `${meta.name} · ${meta.counts.totalObjects} nesne · ${time}`;
}

async function saveProjectRecovery() {
  if (!state.preferences.autosaveEnabled || !state.project.dirty || state.recovery.saving) return;
  state.recovery.saving = true;
  try {
    ensureStateEntityIdentities();
    const autosavedAt = new Date().toISOString();
    state.project = ProjectState.markAutosaved(state.project, new Date(autosavedAt));
    const snapshot = {
      version: 1,
      autosavedAt,
      session: clonePlain(state.project),
      project: projectPayload({ autosave: true }),
    };
    await state.recovery.store.save(state.recovery.key, snapshot);
    state.recovery.snapshot = snapshot;
    writeLocalJson(ProjectState.STORAGE_KEYS.recoveryMeta, recoveryMetadata(snapshot));
    updateRecoveryUi();
    updateProjectChrome();
  } catch (error) {
    console.warn("Otomatik kurtarma yazılamadı:", error);
  } finally {
    state.recovery.saving = false;
  }
}

function scheduleProjectAutosave() {
  window.clearTimeout(state.recovery.saveTimer);
  state.recovery.saveTimer = null;
  if (!state.preferences.autosaveEnabled || !state.project.dirty) return;
  state.recovery.saveTimer = window.setTimeout(() => {
    state.recovery.saveTimer = null;
    saveProjectRecovery();
  }, state.preferences.autosaveDelayMs);
}

async function clearProjectRecovery() {
  window.clearTimeout(state.recovery.saveTimer);
  state.recovery.saveTimer = null;
  try {
    await state.recovery.store.remove(state.recovery.key);
  } catch (error) {
    console.warn("Kurtarma verisi silinemedi:", error);
  }
  state.recovery.snapshot = null;
  localStorage.removeItem(ProjectState.STORAGE_KEYS.recoveryMeta);
  updateRecoveryUi();
}

async function loadRecoveryCandidate() {
  try {
    const snapshot = await state.recovery.store.load(state.recovery.key);
    if (snapshot?.project && snapshot?.session?.dirty) state.recovery.snapshot = snapshot;
  } catch (error) {
    console.warn("Kurtarma verisi okunamadı:", error);
  }
  updateRecoveryUi();
  if (state.recovery.snapshot && !projectHasContent()) openProjectHub();
}

function addCurrentProjectToRecent(path = state.project.path) {
  if (!path) return;
  state.recentProjects = ProjectState.upsertRecentProject(
    state.recentProjects,
    {
      ...state.project,
      path,
      counts: projectCounts(),
    },
    state.preferences.maxRecentProjects
  );
  saveProjectPreferences();
  renderRecentProjects();
}

function formatRecentTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("tr-TR");
}

function renderRecentProjects() {
  if (!refs.recentProjectsList) return;
  refs.recentProjectsList.innerHTML = state.recentProjects.map((project) => {
    const counts = project.counts;
    const meta = [counts ? `${Number(counts.totalObjects || 0)} nesne` : "", formatRecentTime(project.openedAt)].filter(Boolean).join(" · ");
    return `<button class="recent-project-card" data-recent-project="${escapeHtml(project.path)}">
      <span class="recent-project-main">
        <strong>${escapeHtml(project.name)}</strong>
        <span class="recent-project-path">${escapeHtml(project.path)}</span>
        <span class="recent-project-meta">${escapeHtml(meta)}</span>
      </span>
      <span class="recent-project-open">Aç</span>
    </button>`;
  }).join("");
  refs.recentProjectsEmpty?.classList.toggle("hidden", state.recentProjects.length > 0);
  refs.recentProjectsList.querySelectorAll("[data-recent-project]").forEach((button) => {
    button.addEventListener("click", () => openProject({ path: button.dataset.recentProject }));
  });
}

function openProjectHub() {
  renderRecentProjects();
  updateRecoveryUi();
  refs.projectHub?.classList.remove("hidden");
}

function closeProjectHub() {
  refs.projectHub?.classList.add("hidden");
  scheduleCanvasResize();
}

function renderProjectInfo() {
  if (!refs.projectInfoContent) return;
  const counts = projectCounts();
  const saved = state.project.lastSavedAt ? formatRecentTime(state.project.lastSavedAt) : "Henüz kaydedilmedi";
  const autosaved = state.project.lastAutosavedAt ? formatRecentTime(state.project.lastAutosavedAt) : "Yok";
  const rows = [
    ["Ad", state.project.name || "Adsız iş"],
    ["Dosya", state.project.path || "Henüz dosya seçilmedi"],
    ["Durum", state.project.dirty ? "Kaydedilmemiş değişiklikler var" : "Kaydedildi"],
    ["İçerik", `${counts.sourceFiles} kaynak · ${counts.placements} parça · ${counts.patterns} desen`],
    ["Son kayıt", saved],
    ["Otomatik kurtarma", autosaved],
  ];
  refs.projectInfoContent.innerHTML = rows.map(([label, value]) => `<div class="project-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function openProjectInfo() {
  renderProjectInfo();
  refs.projectInfoModal?.classList.remove("hidden");
}

function closeProjectInfo() {
  refs.projectInfoModal?.classList.add("hidden");
}

function openPreferences() {
  if (refs.prefAutosaveEnabled) refs.prefAutosaveEnabled.checked = state.preferences.autosaveEnabled;
  if (refs.prefAutosaveDelay) refs.prefAutosaveDelay.value = String(state.preferences.autosaveDelayMs);
  if (refs.prefMaxRecent) refs.prefMaxRecent.value = String(state.preferences.maxRecentProjects);
  if (refs.prefConfirmClear) refs.prefConfirmClear.checked = state.preferences.confirmBeforeClear;
  if (refs.prefTheme) refs.prefTheme.value = state.preferences.theme;
  if (refs.prefUserMode) refs.prefUserMode.value = state.preferences.userMode;
  if (refs.prefShowGrid) refs.prefShowGrid.checked = state.preferences.showGrid;
  if (refs.prefShowTravel) refs.prefShowTravel.checked = state.preferences.showTravelInPreview;
  if (refs.prefPrepareStrategy) refs.prefPrepareStrategy.value = state.preferences.prepareStrategy;
  if (refs.prefReopenLastProject) refs.prefReopenLastProject.checked = state.preferences.reopenLastProject;
  refs.preferencesModal?.classList.remove("hidden");
}

function closePreferences() {
  refs.preferencesModal?.classList.add("hidden");
}

function applyPreferencesToUi(redraw = true) {
  const theme = state.preferences.theme === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light")
    : state.preferences.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.userMode = state.preferences.userMode;
  state.productionPreview.layers.travel = Boolean(state.preferences.showTravelInPreview);
  const travelLayer = document.querySelector('[data-preview-layer="travel"]');
  if (travelLayer) travelLayer.checked = state.productionPreview.layers.travel;
  if (redraw && canvas) draw();
}

function savePreferences(event) {
  event?.preventDefault();
  state.preferences = ProjectState.normalizePreferences({
    autosaveEnabled: refs.prefAutosaveEnabled?.checked,
    autosaveDelayMs: refs.prefAutosaveDelay?.value,
    maxRecentProjects: refs.prefMaxRecent?.value,
    confirmBeforeClear: refs.prefConfirmClear?.checked,
    theme: refs.prefTheme?.value,
    userMode: refs.prefUserMode?.value,
    showGrid: refs.prefShowGrid?.checked,
    showTravelInPreview: refs.prefShowTravel?.checked,
    prepareStrategy: refs.prefPrepareStrategy?.value,
    reopenLastProject: refs.prefReopenLastProject?.checked,
  });
  saveProjectPreferences();
  renderRecentProjects();
  closePreferences();
  scheduleProjectAutosave();
  applyPreferencesToUi();
  setStatus("Tercihler kaydedildi.", "ok");
}

const CAPABILITY_LABELS = {
  serial: "GRBL seri bağlantı",
  frame: "Lazer kapalı çerçeve turu",
  workOrigin: "İş sıfırı",
  feedOverride: "Canlı hız override",
  powerOverride: "Canlı güç override",
  camera: "Kamera hizalama",
  rotary: "Rotary eksen",
  curvedSurface: "Eğri yüzey telafisi",
  blade: "Bıçak aracı",
  pen: "Kalem aracı",
  networkPairing: "Yerel ağ eşleştirme",
  safetySensors: "Kapı / alev sensörleri",
};

const PRODUCT_TOUR_STEPS = [
  {
    category: "İş Akışı",
    title: "Lazer işini dört kontrollü aşamada yönetin",
    description: "Uygulama; tasarımdan makineye gönderime kadar aynı üretim dosyasını izleyen, geri dönülebilir bir süreç kullanır.",
    features: [
      "Tasarımda kaynakları ve geometrileri oluşturun.",
      "Hazırla aşamasında tabla, yerleşim ve işlem parametrelerini doğrulayın.",
      "Önizleme ile gerçek G-code yollarını, süreyi ve boş hareketleri inceleyin.",
      "Cihaz aşamasında GRBL bağlantısını ve üretimi güvenli biçimde yönetin.",
    ],
    target: () => document.querySelector("#projectHub:not(.hidden) .project-hub-header") || document.querySelector(".titlebar .brand"),
  },
  {
    category: "Proje Yönetimi",
    title: "Çalışmalarınız kaybolmadan kaldığınız yerden devam edin",
    description: "Proje merkezi; disk dosyaları, otomatik kurtarma ve tekrar kullanılabilir tasarım varlıklarını tek noktada toplar.",
    features: [
      "Yeni proje, aç, kaydet, farklı kaydet ve son projeler.",
      "Kaydedilmemiş değişiklikler için yerel otomatik kurtarma.",
      "DXF ve desenler için aranabilir tasarım kütüphanesi.",
      "Ölçülü kutu üretici, kalibrasyon plakası ve üretim geçmişi.",
    ],
    prepare: () => openProjectHub(),
    target: ".project-hub-content",
  },
  {
    category: "Aşama Kontrolü",
    title: "Canlı durum göstergeleri sıradaki işi açıkça gösterir",
    description: "Her aşama; işteki nesne, ön kontrol, G-code ve makine durumuna göre güncellenir. Sağdaki Devam düğmesi sizi doğru sonraki adıma taşır.",
    features: [
      "Boş iş, nesne sayısı, ön kontrol ve bağlantı durumu anlık görünür.",
      "Aşamalar arasında veri kaybetmeden ileri veya geri geçebilirsiniz.",
      "G-code hazır değilse akış sizi önce Çıktı ve Ön Kontrol bölümüne yönlendirir.",
    ],
    prepare: () => {
      closeProjectHub();
      setProductionPreviewTabOpen(false, false);
      setMachineTabOpen(false, false, false);
      activateRibbonTab("ekle");
      setWorkflowActive("design");
    },
    target: ".workflow-tabs",
  },
  {
    category: "İçerik Araçları",
    title: "Araç şeridi işi amacına göre gruplandırır",
    description: "Sekmeler artık yalnız araç adı değil, hangi üretim görevini çözdüğünü de gösterir. İlgili ayarlar tek şeritte birlikte açılır.",
    features: [
      "DXF, SVG, JPG/PNG, metin ve temel şekiller ekleyin.",
      "Kütüphane, kutu üretici ve otomatik yerleşime doğrudan erişin.",
      "Vektör, görsel, çizim ve çıktı araçlarını ayrı görev gruplarında kullanın.",
    ],
    prepare: () => activateRibbonTab("ekle"),
    target: ".ribbon-tabs",
  },
  {
    category: "Hassas Düzenleme",
    title: "Canvas gerçek milimetre ölçüsünü korur",
    description: "Tabla görünümü yalnız bir önizleme değildir; yerleşim, sınır, merkez eksenleri ve üretime girecek geometri aynı belge modelinden çizilir.",
    features: [
      "Çoklu seçim, grup taşıma, kopyala/kes/yapıştır ve hizalama.",
      "Hassas adım, döndürme, aynalama, tabla merkezleri ve dinamik grid.",
      "DXF sınırına göre desen kırpma ve ayarlanabilir iç kenar payı.",
    ],
    target: ".canvas-panel",
  },
  {
    category: "Nesne ve Ön Kontrol",
    title: "Parça ağacı ile üretim güvenliği aynı ekranda kalır",
    description: "Sol panel işteki gerçek nesneleri, sağ panel seçili nesnenin özelliklerini ve G-code ön kontrolünü gösterir.",
    features: [
      "Sayaçlar belge modelinden anlık türetilir; silme ve kopyalama sonrası güncel kalır.",
      "Kesim, çizgi kazıma, dolgu ve yok say işlemleri nesne bazında atanır.",
      "Tabla dışı, boş işlem ve riskli üretim durumları G-code öncesinde engellenir.",
    ],
    target: ".workspace",
  },
  {
    category: "Hazırlama",
    title: "Tabla ve yerleşimi malzeme kaybını azaltacak şekilde hazırlayın",
    description: "Hazırla araçları, tasarım geometrisini değiştirmeden üretim alanını ve yerleşim stratejisini yönetir.",
    features: [
      "Tabla ölçüsü, kenar payı, parça aralığı ve kalan malzeme poligonu.",
      "Döndürmeye izin veren kompakt otomatik yerleşim ve düzeni koruma seçeneği.",
      "Tüm işi hizalama, ofsetleme, dışarıdakileri park etme ve yerleşimi geri alma.",
    ],
    prepare: () => activateRibbonTab("tabla"),
    target: '.ribbon-panel[data-tab="tabla"]',
  },
  {
    category: "Kesim ve Kazıma",
    title: "Her işlem için üretim parametrelerini ayrı yönetin",
    description: "Kesim ve kazıma değerleri birbirine karışmaz; G-code derleyicisi nesne işlemini ve güvenlik sırasını korur.",
    features: [
      "S0–S1000 güç, F hızı, pass, kerf, overcut ve kontrollü boş hareket hızı.",
      "M4 dinamik güç, hava desteği ve delme beklemesi.",
      "İç detayları önce, dış konturu en son kesme ve mikro köprü desteği.",
      "Malzeme profilleri ve bağımsız güç/hız kalibrasyon matrisi.",
    ],
    prepare: () => activateRibbonTab("kesim"),
    target: '.ribbon-panel[data-tab="kesim"]',
  },
  {
    category: "Vektör ve Görsel",
    title: "Fotoğraftan üretilebilir kontura kadar ayrıntılı işlem hattı",
    description: "Görsel dönüşümü, ham kenar algılama yerine lazer üretimine uygun çizgi veya dolgu geometrisi oluşturur.",
    features: [
      "OpenCV, Potrace ve VTracer tabanlı otomatik fotoğraf→vektör hattı.",
      "Gürültü temizliği, kopuk çizgi onarımı, köşe koruma ve pürüzsüzleştirme.",
      "Kontur silme/geri alma, işlem atama, manuel köprü ve yeni kontur çizme.",
      "Raster filtreleri, arka plan temizleme, crop, maske ve serbest çizim.",
    ],
    prepare: () => activateRibbonTab("vektor"),
    target: '.ribbon-panel[data-tab="vektor"]',
  },
  {
    category: "Çıktı Güvenliği",
    title: "G-code oluşturulmadan önce tek bir ön kontrolden geçer",
    description: "Canvas görünümü yerine normalize edilmiş üretim modeli kullanılır; aynı sınır kontrolleri dosya yazılırken çekirdekte yeniden uygulanır.",
    features: [
      "Tabla ve kalan malzeme sınırı, aktif işlem ve yol bütünlüğü denetimi.",
      "Kesim/kazıma sırası, M4/S0 güvenliği ve dosya sonunda lazer kapatma.",
      "Dosya kimliği, güç/hız aralığı, süre ve mesafe raporu.",
    ],
    prepare: () => activateRibbonTab("cikti"),
    target: ".right-panel",
  },
  {
    category: "Önizleme ve Cihaz",
    title: "Üretmeden önce gerçek makine hareketini inceleyin",
    description: "Önizleme ve cihaz aşamaları tasarımdan ayrıdır; operatör gönderilecek dosyayı ve makinenin durumunu açıkça görür.",
    features: [
      "Kesim, kazıma ve boş hareket katmanları; oynat, duraklat ve zaman çizelgesi.",
      "Anlık XY konumu, tahmini süre, yol mesafesi ve harici dosya hash uyarısı.",
      "GRBL seri bağlantı, çerçeve gezdirme, iş sıfırı, jog ve canlı override.",
      "Çalışan iş sırasında tehlikeli komut kilidi, alarm ve acil durdurma takibi.",
    ],
    target: '.workflow-tab[data-workspace-mode="preview"]',
  },
  {
    category: "İzlenebilirlik",
    title: "Bildirim, geçmiş, tercihler ve tanılama üretimi tamamlar",
    description: "Destek araçları proje içeriğini ifşa etmeden uygulama ve cihaz durumunu anlaşılır biçimde raporlar.",
    features: [
      "Kalıcı bildirim merkezi ve dosya hash'i ile üretim geçmişi.",
      "Basit/uzman görünüm, tema, grid, autosave ve Prepare/Preview tercihleri.",
      "Klavye kısayolları, cihaz kabiliyetleri ve gizlilik güvenli tanılama çıktısı.",
      "Tanıtım düğmesi bu rehberi istediğiniz zaman yeniden açar.",
    ],
    target: ".title-actions",
  },
];

function productTourTarget(step) {
  const candidate = typeof step?.target === "function" ? step.target() : document.querySelector(step?.target || "");
  if (candidate?.getClientRects().length) return candidate;
  return document.querySelector(".titlebar") || document.body;
}

function updateProductTourPosition() {
  if (!state.tour.active || !refs.tourCard || !refs.tourSpotlight) return;
  const target = state.tour.target || document.querySelector(".titlebar");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const padding = 7;
  const left = clamp(rect.left - padding, 6, Math.max(6, window.innerWidth - 12));
  const top = clamp(rect.top - padding, 6, Math.max(6, window.innerHeight - 12));
  const right = clamp(rect.right + padding, left + 1, window.innerWidth - 6);
  const bottom = clamp(rect.bottom + padding, top + 1, window.innerHeight - 6);
  Object.assign(refs.tourSpotlight.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(1, right - left)}px`,
    height: `${Math.max(1, bottom - top)}px`,
  });

  const cardRect = refs.tourCard.getBoundingClientRect();
  const position = ProductTour.computeCardPosition(
    { left, top, right, bottom, width: right - left, height: bottom - top },
    { width: cardRect.width, height: cardRect.height },
    { width: window.innerWidth, height: window.innerHeight }
  );
  refs.tourCard.dataset.placement = position.placement;
  refs.tourCard.style.left = `${position.left}px`;
  refs.tourCard.style.top = `${position.top}px`;
  refs.tourCard.style.visibility = "visible";
}

function showProductTourStep(index) {
  if (!state.tour.active) return;
  const progress = ProductTour.progress(index, PRODUCT_TOUR_STEPS.length);
  state.tour.index = progress.current - 1;
  const step = PRODUCT_TOUR_STEPS[state.tour.index];
  step.prepare?.();
  if (refs.tourCategory) refs.tourCategory.textContent = step.category;
  if (refs.tourCounter) refs.tourCounter.textContent = `${progress.current} / ${progress.total}`;
  if (refs.tourProgressBar) refs.tourProgressBar.style.width = `${progress.percent}%`;
  if (refs.tourTitle) refs.tourTitle.textContent = step.title;
  if (refs.tourDescription) refs.tourDescription.textContent = step.description;
  if (refs.tourFeatureList) refs.tourFeatureList.innerHTML = step.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
  if (refs.tourPreviousBtn) refs.tourPreviousBtn.disabled = progress.first;
  if (refs.tourNextBtn) refs.tourNextBtn.textContent = progress.last ? "Tanıtımı Bitir" : "Sonraki";
  if (refs.tourCard) refs.tourCard.style.visibility = "hidden";
  state.tour.target = productTourTarget(step);
  state.tour.target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  window.requestAnimationFrame(() => window.requestAnimationFrame(updateProductTourPosition));
}

function restoreProductTourContext() {
  const context = state.tour.returnContext;
  if (!context) return;
  if (context.productionPreviewOpen) {
    setProductionPreviewTabOpen(true);
  } else if (context.machineOpen) {
    setMachineTabOpen(true, false, true);
  } else {
    setProductionPreviewTabOpen(false, false);
    setMachineTabOpen(false, false, false);
    activateRibbonTab(context.ribbonTab || "ekle");
    setWorkflowActive(context.workspaceMode || "design");
  }
  if (context.projectHubOpen) openProjectHub();
  else closeProjectHub();
}

function finishProductTour({ skipped = false } = {}) {
  if (!state.tour.active) return;
  refs.productTour?.classList.add("hidden");
  document.body.classList.remove("tour-active");
  state.tour.active = false;
  state.tour.target = null;
  state.preferences = ProjectState.normalizePreferences({
    ...state.preferences,
    productTourVersion: ProductTour.TOUR_VERSION,
  });
  saveProjectPreferences();
  restoreProductTourContext();
  state.tour.returnContext = null;
  setStatus(skipped ? "Tanıtım atlandı. Tanıtım düğmesinden yeniden açabilirsiniz." : "Tanıtım tamamlandı.", "ok");
}

function startProductTour() {
  if (state.tour.active) return;
  state.tour.returnContext = {
    workspaceMode: state.workspaceMode || "design",
    ribbonTab: document.querySelector(".ribbon-tab.active")?.dataset.tab || "ekle",
    projectHubOpen: !refs.projectHub?.classList.contains("hidden"),
    machineOpen: !document.getElementById("machineTab")?.classList.contains("hidden"),
    productionPreviewOpen: Boolean(state.productionPreview.open),
  };
  closeHelp();
  closePreferences();
  closeProjectInfo();
  closeNotifications();
  closeProductionHistory();
  closeLibrary();
  closeBoxMaker();
  closeCalibration();
  state.tour.active = true;
  refs.productTour?.classList.remove("hidden");
  document.body.classList.add("tour-active");
  showProductTourStep(0);
}

function nextProductTourStep() {
  if (!state.tour.active) return;
  if (state.tour.index >= PRODUCT_TOUR_STEPS.length - 1) finishProductTour();
  else showProductTourStep(state.tour.index + 1);
}

function previousProductTourStep() {
  if (!state.tour.active) return;
  showProductTourStep(state.tour.index - 1);
}

function scheduleAutomaticProductTour() {
  if (!ProductTour.shouldAutoStart(state.preferences)) return;
  window.setTimeout(() => {
    if (!state.tour.active && ProductTour.shouldAutoStart(state.preferences)) startProductTour();
  }, 700);
}

function renderSupportInfo() {
  const capabilities = state.support.capabilities || {};
  if (refs.capabilityList) {
    refs.capabilityList.innerHTML = Object.entries(CAPABILITY_LABELS).map(([key, label]) => {
      const supported = Boolean(capabilities[key]);
      return `<div class="capability-row ${supported ? "supported" : "unsupported"}"><span>${escapeHtml(label)}</span><strong>${supported ? "Hazır" : "Desteklenmiyor"}</strong></div>`;
    }).join("");
  }
  const diagnostics = state.support.diagnostics;
  if (refs.diagnosticsSummary && diagnostics) {
    const machine = diagnostics.machine || {};
    refs.diagnosticsSummary.innerHTML = `
      <div><span>Sürüm</span><strong>${escapeHtml(diagnostics.app?.version || "-")}</strong></div>
      <div><span>Çalışma zamanı</span><strong>Python ${escapeHtml(diagnostics.runtime?.python || "-")}</strong></div>
      <div><span>Makine</span><strong>${machine.connected ? `${escapeHtml(machine.port || "GRBL")} bağlı` : "Bağlı değil"}</strong></div>
      <div><span>Gizlilik</span><strong>Proje ve G-code içeriği dahil değil</strong></div>`;
  }
}

async function loadSupportInfo() {
  try {
    const [capabilityResponse, diagnosticsResponse] = await Promise.all([
      fetch("/api/capabilities"),
      fetch("/api/diagnostics"),
    ]);
    const capabilityData = await capabilityResponse.json();
    const diagnosticsData = await diagnosticsResponse.json();
    if (!capabilityResponse.ok || capabilityData.ok === false) throw new Error(capabilityData.error || "Kabiliyet bilgisi alınamadı.");
    if (!diagnosticsResponse.ok || diagnosticsData.ok === false) throw new Error(diagnosticsData.error || "Tanılama bilgisi alınamadı.");
    state.support.capabilities = capabilityData.capabilities || {};
    state.support.diagnostics = diagnosticsData.diagnostics || null;
    renderSupportInfo();
  } catch (error) {
    if (refs.diagnosticsSummary) refs.diagnosticsSummary.textContent = error.message || "Tanılama bilgisi alınamadı.";
    setStatus(error.message || "Tanılama bilgisi alınamadı.", "warn");
  }
}

function openHelp() {
  closeProjectHub();
  refs.helpModal?.classList.remove("hidden");
  void loadSupportInfo();
}

function closeHelp() {
  refs.helpModal?.classList.add("hidden");
  scheduleCanvasResize();
}

async function downloadDiagnostics() {
  if (!state.support.diagnostics) await loadSupportInfo();
  if (!state.support.diagnostics) return;
  const diagnostics = {
    ...clonePlain(state.support.diagnostics),
    client: {
      objectCounts: projectCounts(),
      notificationCount: state.activity.notifications.length,
      historyCount: state.activity.history.length,
      recentErrors: clonePlain(state.support.errors),
    },
  };
  const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `laser-editor-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Tanılama özeti indirildi; proje geometrisi ve G-code içeriği eklenmedi.", "ok");
}

function resetEditorState() {
  state.parts = [];
  state.placements = [];
  state.patterns = [];
  state.images.clear();
  imageAdjustmentBases.clear();
  state.customFonts = [];
  state.lastGeneratedRevision = null;
  state.lastGeneratedPath = "";
  state.selected = null;
  state.selectedItems = [];
  state.selectedVectorPaths = [];
  state.vectorSelectionRegion = null;
  state.materialArea = normalizeMaterialArea({});
  state.layout = {
    appliedSettings: layoutSettingsSnapshot(),
    previousSettings: null,
    dirty: false,
    manual: false,
    acceptedSmallBed: "",
  };
  if (refs.outputPath) refs.outputPath.value = "";
  undoStack.length = 0;
  redoStack.length = 0;
  clearMachinePreview();
  select(null, null);
  updateUiFromAnalysis(computeJobAnalysis());
  updateSelectionPanel();
  draw();
}

async function newProject() {
  if (state.project.dirty && state.preferences.confirmBeforeClear) {
    const proceed = window.confirm("Geçerli projede kaydedilmemiş değişiklikler var. Yeni proje açılsın mı?");
    if (!proceed) return;
  }
  resetEditorState();
  state.project = ProjectState.createSession({ name: "Adsız iş" });
  await clearProjectRecovery();
  updateProjectChrome();
  closeProjectHub();
  setStatus("Yeni proje hazır.", "ok");
}

async function restoreRecoveryProject() {
  const snapshot = state.recovery.snapshot;
  if (!snapshot?.project) return;
  restoreProject(snapshot.project, {
    session: { ...snapshot.session, dirty: true, lastAutosavedAt: snapshot.autosavedAt },
    recovery: true,
  });
  closeProjectHub();
  setStatus("Otomatik kurtarma açıldı. Dosyaya kaydetmeyi unutmayın.", "warn");
}

async function discardRecoveryProject() {
  if (!window.confirm("Kurtarılabilir çalışma kalıcı olarak silinsin mi?")) return;
  await clearProjectRecovery();
  setStatus("Kurtarma kaydı silindi.");
}

function loadUiSettings() {
  let saved = {};
  let migratedTextDefaults = false;
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    saved = parsed && typeof parsed === "object" ? parsed : {};
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
    if (
      saved.textSettingsVersion !== TEXT_SETTINGS_VERSION
      && (!saved.textFont || saved.textFont === "laser-single")
      && (!saved.textOperation || saved.textOperation === "engrave_line")
    ) {
      refs.textFont.value = DEFAULT_TEXT_FONT_VALUE;
      refs.textOperation.value = "engrave_fill";
      saved.textFont = DEFAULT_TEXT_FONT_VALUE;
      saved.textOperation = "engrave_fill";
      saved.textSettingsVersion = TEXT_SETTINGS_VERSION;
      migratedTextDefaults = true;
    }
    if (saved.laserCmd) state.laserCmd = saved.laserCmd;
    if (["object", "contour"].includes(saved.canvasSelectionMode)) {
      state.canvasSelectionMode = saved.canvasSelectionMode;
    }
  } catch (_error) {
    localStorage.removeItem(SETTINGS_KEY);
  }
  enforceAirAssistDefaults();
  syncVectorProfessionalModeUi();
  syncCanvasSelectionModeUi();
  if (migratedTextDefaults) saveUiSettings();
  return saved;
}

function saveUiSettings() {
  enforceAirAssistDefaults();
  const payload = {
    laserCmd: state.laserCmd,
    canvasSelectionMode: state.canvasSelectionMode,
    vectorSettingsVersion: VECTOR_SETTINGS_VERSION,
    textSettingsVersion: TEXT_SETTINGS_VERSION,
  };
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
  const professionalMode = vectorProfessionalMode();
  return {
    productMode: professionalMode.productMode || "cut_template",
    productOperation: professionalMode.operation || "cut",
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

function vectorProfessionalMode() {
  const modeId = refs.vecProfessionalMode?.value || "cad-line-art";
  const mode = vectorProfessionalModes[modeId] || vectorProfessionalModes["cad-line-art"];
  return { id: modeId, ...mode };
}

function setVectorSettingInput(id, value) {
  const input = refs[id];
  if (!input) return;
  if (input.type === "checkbox") input.checked = Boolean(value);
  else input.value = String(value);
}

function syncVectorProfessionalModeUi() {
  const mode = vectorProfessionalMode();
  if (refs.vectorModeHint) refs.vectorModeHint.textContent = mode.hint;
  if (refs.vectorizePhotoBtn) refs.vectorizePhotoBtn.textContent = mode.rasterPhoto ? "Foto Seç ve Gravür Hazırla" : "Foto Seç ve Vektörleştir";
}

function applyVectorProfessionalMode(recordUndo = true) {
  const mode = vectorProfessionalMode();
  if (recordUndo) pushUndo("Vektor profesyonel mod");
  for (const [id, value] of Object.entries(mode.values || {})) {
    setVectorSettingInput(id, value);
  }
  syncVectorProfessionalModeUi();
  saveUiSettings();
  renderVectorQualityBox();
  setStatus(`${mode.label} ayarı uygulandı. ${mode.rasterPhoto ? "Foto Seç ve Gravür Hazırla" : "Foto Seç ve Vektörleştir"} ile yeniden üretin.`, "ok");
}

function applyAutoVectorPreset() {
  applyVectorProfessionalMode(true);
}

function apiRequestUsesNativeDialog(path, payload = {}) {
  if (["/api/open-dxf", "/api/save-gcode-dialog"].includes(path)) return true;
  if (["/api/open-image", "/api/open-raster-image", "/api/vectorize-image", "/api/open-project"].includes(path)) {
    return !payload.path && !payload.dataUrl;
  }
  if (["/api/save-vector-svg", "/api/save-project"].includes(path)) return !payload.outputPath;
  return false;
}

function setNativeDialogButtonsLocked(locked) {
  if (locked) {
    nativeDialogButtonStates = new Map();
    for (const id of NATIVE_DIALOG_BUTTON_IDS) {
      const button = document.getElementById(id);
      if (!button) continue;
      nativeDialogButtonStates.set(id, button.disabled);
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    return;
  }
  for (const [id, wasDisabled] of nativeDialogButtonStates) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = Boolean(wasDisabled);
    button.removeAttribute("aria-busy");
  }
  nativeDialogButtonStates = new Map();
}

async function api(path, payload = {}) {
  const usesNativeDialog = apiRequestUsesNativeDialog(path, payload);
  if (usesNativeDialog && nativeDialogActivePath) {
    throw new Error("Bir dosya seçme veya kaydetme penceresi zaten açık.");
  }
  if (usesNativeDialog) {
    nativeDialogActivePath = path;
    setNativeDialogButtonsLocked(true);
  }
  try {
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
  } finally {
    if (usesNativeDialog && nativeDialogActivePath === path) {
      nativeDialogActivePath = "";
      setNativeDialogButtonsLocked(false);
    }
  }
}

function defaultImageAdjustments() {
  return { brightness: 0, contrast: 0, sharpness: 0, negative: false };
}

function selectedRasterPattern() {
  if (!state.selected || !["pattern", "vectorPath", "vectorObject"].includes(state.selected.type)) return null;
  const pattern = patternById(state.selected.id);
  return pattern?.kind === "raster" ? pattern : null;
}

function rasterImageForPattern(pattern) {
  return pattern ? state.images.get(pattern.id) || null : null;
}

function loadBrowserImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Görsel tarayıcı tarafında açılamadı."));
    image.src = src;
  });
}

function imageToCanvas(image) {
  const canvasEl = document.createElement("canvas");
  canvasEl.width = Math.max(1, image.naturalWidth || image.width || 1);
  canvasEl.height = Math.max(1, image.naturalHeight || image.height || 1);
  canvasEl.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0);
  return canvasEl;
}

async function setPatternRasterSource(pattern, dataUrl, dimensions = null) {
  const image = await loadBrowserImage(dataUrl);
  state.images.set(pattern.id, image);
  if (dimensions) {
    pattern.sourceWidth = Math.max(1, Number(dimensions.width) || image.naturalWidth || 1);
    pattern.sourceHeight = Math.max(1, Number(dimensions.height) || image.naturalHeight || 1);
  }
  draw();
  updateSelectionPanel();
  updateJobAnalysisNow();
  return image;
}

function ensureImageAdjustmentBase(pattern) {
  const image = rasterImageForPattern(pattern);
  if (!pattern || !image?.src) return "";
  if (!imageAdjustmentBases.has(pattern.id)) imageAdjustmentBases.set(pattern.id, image.src);
  return imageAdjustmentBases.get(pattern.id) || image.src;
}

function commitImageAdjustmentBase(pattern, dataUrl) {
  if (!pattern || !dataUrl) return;
  imageAdjustmentBases.set(pattern.id, dataUrl);
  pattern.imageAdjustments = defaultImageAdjustments();
}

function imageAdjustmentValues(pattern = selectedRasterPattern()) {
  const values = { ...defaultImageAdjustments(), ...(pattern?.imageAdjustments || {}) };
  return {
    brightness: clamp(Math.round(Number(values.brightness) || 0), -100, 100),
    contrast: clamp(Math.round(Number(values.contrast) || 0), -100, 100),
    sharpness: clamp(Math.round(Number(values.sharpness) || 0), 0, 100),
    negative: Boolean(values.negative),
  };
}

function syncImageEditUi() {
  const pattern = selectedRasterPattern();
  const enabled = Boolean(pattern && rasterImageForPattern(pattern)?.src);
  refs.imageEditPanel?.classList.toggle("is-disabled", !enabled);
  refs.imageEditPanel?.querySelectorAll("button, input").forEach((control) => {
    control.disabled = !enabled;
  });
  const values = imageAdjustmentValues(pattern);
  if (refs.imageSharpness) refs.imageSharpness.value = String(values.sharpness);
  if (refs.imageBrightness) refs.imageBrightness.value = String(values.brightness);
  if (refs.imageContrast) refs.imageContrast.value = String(values.contrast);
  if (refs.imageNegative) refs.imageNegative.checked = values.negative;
  if (refs.imageSharpnessValue) refs.imageSharpnessValue.value = String(values.sharpness);
  if (refs.imageBrightnessValue) refs.imageBrightnessValue.value = String(values.brightness);
  if (refs.imageContrastValue) refs.imageContrastValue.value = String(values.contrast);
  document.querySelectorAll("[data-image-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.imageFilter === (pattern?.imageFilterPreset || "original"));
  });
  refs.cropImageBtn?.classList.toggle("active", enabled && state.imageTool.active && state.imageTool.mode === "crop");
  refs.maskImageBtn?.classList.toggle("active", enabled && state.imageTool.active && state.imageTool.mode === "mask");
  if (refs.finishImageToolBtn) refs.finishImageToolBtn.disabled = !enabled || !state.imageTool.active;
  if (refs.imageEditHint) {
    refs.imageEditHint.textContent = enabled
      ? `${pattern.name || "Görsel"} seçili. Düzenlemeler projedeki kopyaya uygulanır.`
      : "Düzenlemek için raster bir JPG veya PNG seçin.";
  }
}

function applyPixelAdjustments(imageData, values) {
  const data = imageData.data;
  const brightness = values.brightness * 2.55;
  const contrast = clamp(values.contrast, -100, 100);
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      let value = contrastFactor * (data[i + channel] - 128) + 128 + brightness;
      if (values.negative) value = 255 - value;
      data[i + channel] = clamp(Math.round(value), 0, 255);
    }
  }
  if (values.sharpness <= 0 || imageData.width < 3 || imageData.height < 3) return imageData;
  const source = new Uint8ClampedArray(data);
  const amount = values.sharpness / 100;
  const width = imageData.width;
  const height = imageData.height;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel] * (1 + 4 * amount);
        const neighbors =
          source[index - 4 + channel] + source[index + 4 + channel] +
          source[index - width * 4 + channel] + source[index + width * 4 + channel];
        data[index + channel] = clamp(Math.round(center - amount * neighbors), 0, 255);
      }
    }
  }
  return imageData;
}

async function renderImageAdjustments(pattern = selectedRasterPattern()) {
  if (!pattern) return;
  const base = ensureImageAdjustmentBase(pattern);
  if (!base) return;
  const token = ++imageAdjustmentToken;
  const image = await loadBrowserImage(base);
  if (token !== imageAdjustmentToken) return;
  const canvasEl = imageToCanvas(image);
  const context = canvasEl.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvasEl.width, canvasEl.height);
  context.putImageData(applyPixelAdjustments(pixels, imageAdjustmentValues(pattern)), 0, 0);
  if (token !== imageAdjustmentToken) return;
  await setPatternRasterSource(pattern, canvasEl.toDataURL("image/png"));
}

function scheduleImageAdjustmentRender() {
  const pattern = selectedRasterPattern();
  if (!pattern) return;
  pattern.imageAdjustments = {
    brightness: Number(refs.imageBrightness?.value || 0),
    contrast: Number(refs.imageContrast?.value || 0),
    sharpness: Number(refs.imageSharpness?.value || 0),
    negative: Boolean(refs.imageNegative?.checked),
  };
  pattern.imageFilterPreset = "custom";
  syncImageEditUi();
  window.clearTimeout(imageAdjustmentTimer);
  imageAdjustmentTimer = window.setTimeout(() => {
    renderImageAdjustments(pattern).catch((error) => setStatus(error.message, "danger"));
  }, 90);
}

async function applyImageFilterPreset(preset) {
  const pattern = selectedRasterPattern();
  if (!pattern) return;
  const presets = {
    original: defaultImageAdjustments(),
    clean: { brightness: 8, contrast: 20, sharpness: 20, negative: false },
    line: { brightness: 16, contrast: 70, sharpness: 38, negative: false },
    engrave: { brightness: 0, contrast: 28, sharpness: 14, negative: false },
  };
  pushUndo("Görsel filtresi");
  pattern.imageAdjustments = { ...(presets[preset] || presets.original) };
  pattern.imageFilterPreset = preset;
  syncImageEditUi();
  await renderImageAdjustments(pattern);
  setStatus("Görsel filtresi uygulandı.", "ok");
}

async function resetImageAdjustments() {
  const pattern = selectedRasterPattern();
  if (!pattern) return;
  pushUndo("Görsel ayarlarını sıfırla");
  pattern.imageAdjustments = defaultImageAdjustments();
  pattern.imageFilterPreset = "original";
  syncImageEditUi();
  await renderImageAdjustments(pattern);
}

async function removeSelectedImageBackground() {
  const pattern = selectedRasterPattern();
  const image = rasterImageForPattern(pattern);
  if (!pattern || !image?.src) return;
  pushUndo("Görsel arka planını sil");
  const canvasEl = imageToCanvas(await loadBrowserImage(image.src));
  const context = canvasEl.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvasEl.width, canvasEl.height);
  const sample = Math.max(1, Math.min(12, Math.round(Math.min(canvasEl.width, canvasEl.height) * 0.025)));
  const corners = [[0, 0], [canvasEl.width - sample, 0], [0, canvasEl.height - sample], [canvasEl.width - sample, canvasEl.height - sample]];
  let red = 0; let green = 0; let blue = 0; let count = 0;
  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sample; y += 1) {
      for (let x = startX; x < startX + sample; x += 1) {
        const index = (y * canvasEl.width + x) * 4;
        red += pixels.data[index]; green += pixels.data[index + 1]; blue += pixels.data[index + 2]; count += 1;
      }
    }
  }
  const background = [red / count, green / count, blue / count];
  for (let index = 0; index < pixels.data.length; index += 4) {
    const distance = Math.hypot(
      pixels.data[index] - background[0],
      pixels.data[index + 1] - background[1],
      pixels.data[index + 2] - background[2]
    );
    if (distance < 72) pixels.data[index + 3] = Math.round(pixels.data[index + 3] * clamp((distance - 24) / 48, 0, 1));
  }
  context.putImageData(pixels, 0, 0);
  const dataUrl = canvasEl.toDataURL("image/png");
  commitImageAdjustmentBase(pattern, dataUrl);
  await setPatternRasterSource(pattern, dataUrl);
  syncImageEditUi();
  setStatus("Arka plan silindi. Maske ile kalan bölgeleri düzeltebilirsiniz.", "ok");
}

function cancelImageTool(message = "") {
  if (state.imageTool.pointerId !== null && canvas.hasPointerCapture?.(state.imageTool.pointerId)) {
    canvas.releasePointerCapture(state.imageTool.pointerId);
  }
  state.imageTool.active = false;
  state.imageTool.mode = "";
  state.imageTool.patternId = null;
  state.imageTool.drawing = false;
  state.imageTool.startSource = null;
  state.imageTool.currentSource = null;
  state.imageTool.draftSourcePoints = [];
  state.imageTool.pointerId = null;
  canvas.style.cursor = "";
  syncImageEditUi();
  if (message) setStatus(message, "info");
  draw();
}

function beginImageTool(mode) {
  const pattern = selectedRasterPattern();
  if (!pattern) {
    setStatus("Önce raster bir görsel seçin.", "warn");
    return;
  }
  cancelDrawingTool();
  state.imageTool.active = true;
  state.imageTool.mode = mode;
  state.imageTool.patternId = pattern.id;
  state.imageTool.drawing = false;
  state.imageTool.startSource = null;
  state.imageTool.currentSource = null;
  state.imageTool.draftSourcePoints = [];
  canvas.style.cursor = mode === "crop" ? "crosshair" : "none";
  syncImageEditUi();
  setStatus(mode === "crop" ? "Kırpılacak dikdörtgeni görsel üzerinde sürükleyin." : "Silmek istediğiniz alanları kalemle boyayın.", "info");
  draw();
}

function imageToolPattern() {
  const pattern = patternById(state.imageTool.patternId);
  return pattern?.kind === "raster" ? pattern : null;
}

async function applyImageCrop(pattern, startSource, endSource) {
  const image = rasterImageForPattern(pattern);
  if (!image?.src) return;
  const sourceWidth = Math.max(1, Number(pattern.sourceWidth) || image.naturalWidth || 1);
  const sourceHeight = Math.max(1, Number(pattern.sourceHeight) || image.naturalHeight || 1);
  const minX = clamp(Math.min(startSource[0], endSource[0]), 0, sourceWidth);
  const maxX = clamp(Math.max(startSource[0], endSource[0]), 0, sourceWidth);
  const minY = clamp(Math.min(startSource[1], endSource[1]), 0, sourceHeight);
  const maxY = clamp(Math.max(startSource[1], endSource[1]), 0, sourceHeight);
  if (maxX - minX < 3 || maxY - minY < 3) throw new Error("Kırpma alanı çok küçük.");
  pushUndo("Görseli kırp");
  if (!pattern.imageOriginalFrame) {
    pattern.imageOriginalFrame = {
      x: pattern.x,
      y: pattern.y,
      width: pattern.width,
      height: pattern.height,
      sourceWidth,
      sourceHeight,
    };
  }
  const sourceCanvas = imageToCanvas(await loadBrowserImage(image.src));
  const scaleX = sourceCanvas.width / sourceWidth;
  const scaleY = sourceCanvas.height / sourceHeight;
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.round((maxX - minX) * scaleX));
  cropCanvas.height = Math.max(1, Math.round((maxY - minY) * scaleY));
  cropCanvas.getContext("2d").drawImage(
    sourceCanvas,
    minX * scaleX,
    (sourceHeight - maxY) * scaleY,
    (maxX - minX) * scaleX,
    (maxY - minY) * scaleY,
    0, 0, cropCanvas.width, cropCanvas.height
  );
  const centerSource = [(minX + maxX) / 2, (minY + maxY) / 2];
  const centerWorld = vectorSourcePointToWorld(pattern, centerSource);
  pattern.width *= (maxX - minX) / sourceWidth;
  pattern.height *= (maxY - minY) / sourceHeight;
  pattern.x = centerWorld.x - pattern.width / 2;
  pattern.y = centerWorld.y - pattern.height / 2;
  const dataUrl = cropCanvas.toDataURL("image/png");
  commitImageAdjustmentBase(pattern, dataUrl);
  await setPatternRasterSource(pattern, dataUrl, { width: cropCanvas.width, height: cropCanvas.height });
  markManualLayout();
  syncImageEditUi();
}

async function applyImageMask(pattern, sourcePoints) {
  const image = rasterImageForPattern(pattern);
  if (!image?.src || !sourcePoints.length) return;
  pushUndo("Görsel maskesi");
  const sourceCanvas = imageToCanvas(await loadBrowserImage(image.src));
  const sourceWidth = Math.max(1, Number(pattern.sourceWidth) || sourceCanvas.width);
  const sourceHeight = Math.max(1, Number(pattern.sourceHeight) || sourceCanvas.height);
  const scaleX = sourceCanvas.width / sourceWidth;
  const scaleY = sourceCanvas.height / sourceHeight;
  const brush = clamp(Number(refs.imageMaskBrush?.value || 6), 1, 30) / 100 * Math.min(sourceCanvas.width, sourceCanvas.height);
  const context = sourceCanvas.getContext("2d");
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, brush);
  if (sourcePoints.length === 1) {
    const point = sourcePoints[0];
    context.beginPath();
    context.arc(point[0] * scaleX, (sourceHeight - point[1]) * scaleY, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    sourcePoints.forEach((point, index) => {
      const x = point[0] * scaleX;
      const y = (sourceHeight - point[1]) * scaleY;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
  }
  context.restore();
  const dataUrl = sourceCanvas.toDataURL("image/png");
  commitImageAdjustmentBase(pattern, dataUrl);
  await setPatternRasterSource(pattern, dataUrl);
  syncImageEditUi();
}

async function restoreSelectedImageOriginal() {
  const pattern = selectedRasterPattern();
  const path = pattern?.originalPath || pattern?.sourcePath;
  if (!pattern || !path) return;
  pushUndo("Görsel orijinaline dön");
  const data = await api("/api/open-raster-image", { path });
  if (!data.image) return;
  pattern.sourceWidth = data.image.sourceWidth || data.image.width || pattern.sourceWidth;
  pattern.sourceHeight = data.image.sourceHeight || data.image.height || pattern.sourceHeight;
  if (pattern.imageOriginalFrame) {
    pattern.x = pattern.imageOriginalFrame.x;
    pattern.y = pattern.imageOriginalFrame.y;
    pattern.width = pattern.imageOriginalFrame.width;
    pattern.height = pattern.imageOriginalFrame.height;
    delete pattern.imageOriginalFrame;
  }
  pattern.imageAdjustments = defaultImageAdjustments();
  pattern.imageFilterPreset = "original";
  imageAdjustmentBases.set(pattern.id, data.image.dataUrl);
  await setPatternRasterSource(pattern, data.image.dataUrl);
  syncImageEditUi();
  setStatus("Görsel, orijinal dosyadaki hâline döndürüldü.", "ok");
}

function syncDrawingUi() {
  const tool = state.drawingTool;
  document.querySelectorAll("[data-drawing-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.drawingMode === tool.mode);
    button.disabled = tool.active;
  });
  if (refs.drawingOperation) refs.drawingOperation.value = tool.operation;
  if (refs.drawingSmoothing) {
    refs.drawingSmoothing.value = String(tool.smoothing);
    refs.drawingSmoothing.disabled = tool.mode !== "freehand";
  }
  if (refs.drawingClosePath) refs.drawingClosePath.checked = tool.closePath;
  if (refs.drawingHint) {
    refs.drawingHint.textContent = tool.active
      ? tool.mode === "vector"
        ? "Noktaları tıklayın. Enter ile bitirin, Backspace ile son noktayı silin."
        : "Kalemi bastırıp serbestçe çizin; bırakınca çizgi oluşur."
      : "Vektör kalemi hassas düğümler, serbest kalem yumuşatılmış el çizgisi üretir.";
  }
  if (refs.startDrawingBtn) refs.startDrawingBtn.disabled = tool.active;
  if (refs.finishDrawingBtn) refs.finishDrawingBtn.disabled = !tool.active || tool.points.length < 2;
  if (refs.cancelDrawingBtn) refs.cancelDrawingBtn.disabled = !tool.active;
}

function cancelDrawingTool(message = "") {
  if (state.drawingTool.pointerId !== null && canvas.hasPointerCapture?.(state.drawingTool.pointerId)) {
    canvas.releasePointerCapture(state.drawingTool.pointerId);
  }
  state.drawingTool.active = false;
  state.drawingTool.drawing = false;
  state.drawingTool.points = [];
  state.drawingTool.pointerId = null;
  canvas.style.cursor = "";
  syncDrawingUi();
  draw();
  if (message) setStatus(message, "info");
}

function beginDrawingTool() {
  cancelImageTool();
  cancelVectorRepairTool();
  cancelVectorRegionSelection();
  cancelVectorObjectSeparation();
  state.drawingTool.active = true;
  state.drawingTool.mode = document.querySelector("[data-drawing-mode].active")?.dataset.drawingMode || state.drawingTool.mode;
  state.drawingTool.operation = refs.drawingOperation?.value || "engrave_line";
  state.drawingTool.closePath = Boolean(refs.drawingClosePath?.checked);
  state.drawingTool.smoothing = clamp(Number(refs.drawingSmoothing?.value || 45), 0, 100);
  state.drawingTool.drawing = false;
  state.drawingTool.points = [];
  state.drawingTool.pointerId = null;
  state.selected = null;
  state.selectedItems = [];
  state.selectedVectorPaths = [];
  rebuildVectorPathSelectionKeys();
  canvas.style.cursor = "crosshair";
  syncDrawingUi();
  updateSelectionPanel();
  draw();
  setStatus(state.drawingTool.mode === "vector" ? "Vektör kalemi hazır: noktaları tıklayın." : "Serbest kalem hazır: bastırıp çizin.", "info");
}

function drawingWorldPoints() {
  const sampled = state.drawingTool.points.map((point) => [Number(point.x), Number(point.y)]);
  const raw = [];
  const minDistance = Math.max(0.0001, 0.5 / Math.max(0.001, state.view.scale));
  for (const point of sampled) {
    const previous = raw[raw.length - 1];
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= minDistance) raw.push(point);
  }
  if (state.drawingTool.mode !== "freehand" || raw.length < 3 || state.drawingTool.smoothing <= 0 || !window.LaserVectorEdit?.fitOpenPolyline) return raw;
  const factor = state.drawingTool.smoothing / 100;
  return window.LaserVectorEdit.fitOpenPolyline(raw, {
    tolerance: 0.02 + factor * 0.45,
    minDistance: 0.025 + factor * 0.12,
    passes: factor > 0.65 ? 2 : 1,
  }) || raw;
}

function finishDrawingTool() {
  const tool = state.drawingTool;
  if (!tool.active) return null;
  const points = drawingWorldPoints();
  if (points.length < 2) {
    setStatus("Çizgiyi bitirmek için en az iki nokta gerekir.", "warn");
    return null;
  }
  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const minY = Math.min(...points.map((point) => point[1]));
  const maxY = Math.max(...points.map((point) => point[1]));
  const width = Math.max(0.5, maxX - minX);
  const height = Math.max(0.5, maxY - minY);
  const operation = tool.operation || "engrave_line";
  const vectorPath = {
    id: uid("vp"),
    points: points.map((point) => [point[0] - minX, height - (point[1] - minY)]),
    closed: Boolean(tool.closePath && points.length >= 3),
    operation,
    removed: false,
    locked: false,
    deformable: true,
    warnings: [],
  };
  refreshVectorPathMetrics(vectorPath);
  const modeLabel = tool.mode === "vector" ? "Vektör kalemi" : "Serbest kalem";
  const pattern = addGeneratedVector({
    kind: tool.mode === "vector" ? "vector-pen" : "freehand-pen",
    sourceWidth: width,
    sourceHeight: height,
    vectorPaths: [vectorPath],
  }, { name: modeLabel, operation });
  if (pattern) {
    pattern.x = minX;
    pattern.y = minY;
    pattern.width = width;
    pattern.height = height;
    pattern.originalVectorPaths = cloneVectorPaths(pattern.vectorPaths);
    markManualLayout();
  }
  state.drawingTool.active = false;
  state.drawingTool.drawing = false;
  state.drawingTool.points = [];
  state.drawingTool.pointerId = null;
  canvas.style.cursor = "";
  syncDrawingUi();
  draw();
  if (pattern) setStatus(`${modeLabel} çizgisi eklendi. CAD tek çizgi modu değişmedi.`, "ok");
  return pattern;
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

function setWorkflowActive(mode) {
  state.workspaceMode = mode || "design";
  document.querySelectorAll("[data-workspace-mode]").forEach((button) => {
    const active = button.dataset.workspaceMode === state.workspaceMode;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  renderWorkflowProgress();
}

function renderWorkflowProgress(analysis = state.currentAnalysis) {
  const objectCount = state.placements.length + state.patterns.length;
  const generatedReady = Boolean(state.lastGeneratedPath);
  const selectedOutput = Boolean(refs.outputPath?.value.trim());
  const criticalCount = Number(analysis?.criticalCount || 0);
  const warningCount = Number(analysis?.warningCount || 0);
  const statuses = {
    design: {
      text: objectCount ? `${objectCount} nesne` : "Boş iş",
      className: objectCount ? "ready" : "",
    },
    prepare: {
      text: analysis?.canGenerate ? "Kontrol geçti" : criticalCount ? `${criticalCount} kritik` : warningCount ? `${warningCount} uyarı` : "Bekliyor",
      className: analysis?.canGenerate ? "ready" : criticalCount || warningCount ? "warn" : "",
    },
    preview: {
      text: generatedReady ? "G-code hazır" : selectedOutput ? "Çıktı seçildi" : "Bekliyor",
      className: generatedReady ? "ready" : selectedOutput ? "warn" : "",
    },
    device: {
      text: state.machine.connected ? "Bağlı" : "Bağlı değil",
      className: state.machine.connected ? "connected" : "",
    },
  };
  document.querySelectorAll("[data-workflow-status]").forEach((element) => {
    const status = statuses[element.dataset.workflowStatus] || { text: "Bekliyor", className: "" };
    element.textContent = status.text;
    element.classList.remove("ready", "warn", "connected");
    if (status.className) element.classList.add(status.className);
  });

  const next = state.workspaceMode === "design"
    ? { title: "Hazırla", button: "Devam" }
    : state.workspaceMode === "prepare"
      ? generatedReady ? { title: "Önizleme", button: "Aç" } : { title: "Çıktı ve Kontrol", button: "Devam" }
      : state.workspaceMode === "preview"
        ? { title: "Cihaz", button: "Devam" }
        : { title: "Tasarım", button: "Geri Dön" };
  if (refs.workflowNextTitle) refs.workflowNextTitle.textContent = next.title;
  if (refs.workflowContinueBtn) {
    refs.workflowContinueBtn.textContent = next.button;
    refs.workflowContinueBtn.setAttribute("aria-label", `${next.title} aşamasına geç`);
  }
}

function advanceWorkflow() {
  if (state.workspaceMode === "design") {
    setWorkspaceMode("prepare");
    return;
  }
  if (state.workspaceMode === "prepare") {
    if (state.lastGeneratedPath) setWorkspaceMode("preview");
    else {
      activateRibbonTab("cikti");
      setWorkflowActive("prepare");
      setStatus("Ön kontrolü tamamlayın, çıktı yolunu seçin ve G-code oluşturun.", "info");
    }
    return;
  }
  if (state.workspaceMode === "preview") {
    setWorkspaceMode("device");
    return;
  }
  setWorkspaceMode("design");
}

function setWorkspaceMode(mode) {
  if (mode === "preview") {
    setProductionPreviewTabOpen(true);
    return;
  }
  if (mode === "device") {
    setProductionPreviewTabOpen(false, false);
    setMachineTabOpen(true, true, true);
    return;
  }
  setProductionPreviewTabOpen(false, false);
  setMachineTabOpen(false, true, false);
  if (mode === "prepare") {
    if (state.preferences.prepareStrategy === "auto" && projectHasContent() && state.layout.dirty) autoLayout();
    activateRibbonTab("tabla");
    setWorkflowActive("prepare");
  } else {
    activateRibbonTab("ekle");
    setWorkflowActive("design");
  }
}

function setMachineTabOpen(open, updateHash = true, syncWorkflow = true) {
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
    if (syncWorkflow) setWorkflowActive("device");
  } else {
    home.appendChild(content);
    tab.classList.add("hidden");
    nav?.classList.remove("active");
    document.body.classList.remove("machine-tab-open");
    if (updateHash && location.hash === "#machine") history.pushState(null, "", `${location.pathname}${location.search}`);
    if (syncWorkflow) setWorkflowActive("design");
  }
  renderMachinePanel();
}

function syncMachineTabFromHash() {
  setMachineTabOpen(location.hash === "#machine", false);
}

function applyMachineSnapshot(machine) {
  if (!machine) return;
  const previousMachine = state.machine;
  state.machine = {
    ...state.machine,
    ...machine,
    job: machine.job || {},
    lastStatus: machine.lastStatus || {},
    log: machine.log || [],
  };
  captureMachineActivity(previousMachine, state.machine);
  renderMachinePanel();
  renderWorkflowProgress();
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
  if (state.productionPreview.open) {
    renderProductionPreviewInfo();
    drawProductionPreview();
  }
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

function productionOperationCategory(segment) {
  if (Number(segment?.[4]) !== 1) return "travel";
  const operation = String(segment?.[6] || "laser");
  if (operation.startsWith("engrave")) return "engrave";
  return "cut";
}

function productionOperationLabel(operation) {
  return ({
    cut: "Kesim",
    engrave_line: "Çizgi kazıma",
    engrave_fill: "Dolgu kazıma",
    engrave_photo: "Foto kazıma",
    laser: "Lazer yolu",
    travel: "Boş hareket",
  })[operation] || operation;
}

function productionStat(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderProductionPreviewInfo() {
  const preview = state.machine.preview;
  const path = refs.outputPath?.value?.trim() || "";
  if (refs.productionPreviewPath) refs.productionPreviewPath.textContent = path || "G-code seçilmedi";
  if (!preview) {
    for (const id of ["previewStatDimensions", "previewStatDuration", "previewStatCut", "previewStatEngrave", "previewStatGeneric", "previewStatTravel", "previewStatPowerFeed"]) productionStat(id, "-");
    refs.productionOperationList?.replaceChildren();
  } else {
    const bounds = preview.bounds || {};
    const power = preview.powerRange || {};
    const feed = preview.feedRange || {};
    productionStat("previewStatDimensions", `${Number(bounds.width || 0).toFixed(1)} × ${Number(bounds.height || 0).toFixed(1)} mm`);
    productionStat("previewStatDuration", `~${formatDuration(preview.estimatedSeconds)}`);
    productionStat("previewStatCut", `${Number(preview.processCutLength || 0).toFixed(0)} mm`);
    productionStat("previewStatEngrave", `${Number(preview.engraveLength || 0).toFixed(0)} mm`);
    productionStat("previewStatGeneric", `${Number(preview.genericLaserLength || 0).toFixed(0)} mm`);
    productionStat("previewStatTravel", `${Number(preview.travelLength || 0).toFixed(0)} mm`);
    productionStat("previewStatPowerFeed", `S${Number(power.min || 0).toFixed(0)}–${Number(power.max || 0).toFixed(0)} · F${Number(feed.min || 0).toFixed(0)}–${Number(feed.max || 0).toFixed(0)}`);
    if (refs.productionOperationList) {
      refs.productionOperationList.replaceChildren();
      const entries = Object.entries(preview.operationLengths || {});
      entries.push(["travel", Number(preview.travelLength || 0)]);
      for (const [operation, length] of entries) {
        if (Number(length) <= 0) continue;
        const row = document.createElement("div");
        const category = operation.startsWith("engrave") ? "engrave" : operation === "travel" ? "travel" : "cut";
        row.className = `production-operation-row ${category}`;
        const swatch = document.createElement("i");
        const label = document.createElement("span");
        label.textContent = productionOperationLabel(operation);
        const value = document.createElement("strong");
        value.textContent = `${Number(length).toFixed(0)} mm`;
        row.append(swatch, label, value);
        refs.productionOperationList.append(row);
      }
    }
  }

  if (refs.productionPreviewSafety) {
    const analysis = computeJobAnalysis();
    const generatedMatchesPath = state.lastGeneratedRevision !== null && state.lastGeneratedPath === path;
    let level = "";
    let message = "G-code sınırları, lazer kapanışı ve proje sürümü doğrulandı.";
    if (!preview || !path) {
      level = "warn";
      message = "Önizlenecek G-code yok. Önce G-code oluşturun veya çıktı yolu seçin.";
    } else if (Number(preview.laserLength || 0) <= 0) {
      level = "danger";
      message = "G-code içinde gücü açık bir lazer hareketi bulunamadı.";
    } else if (
      Number(preview.bounds?.minX || 0) < -1e-6 ||
      Number(preview.bounds?.minY || 0) < -1e-6 ||
      Number(preview.bounds?.maxX || 0) > bed().width + 1e-6 ||
      Number(preview.bounds?.maxY || 0) > bed().height + 1e-6
    ) {
      level = "danger";
      message = `G-code sınırı ${bed().width.toFixed(1)} × ${bed().height.toFixed(1)} mm tabla dışına taşıyor.`;
    } else if (generatedMatchesPath && analysis.criticalCount) {
      level = "danger";
      message = analysis.warnings.find((item) => item.level === "critical")?.title || "Kritik üretim sorunu var.";
    } else if (!generatedMatchesPath) {
      level = "warn";
      message = `Dış G-code yüklendi. Dosya kimliği: ${String(preview.fileHash || "yok").slice(0, 12)}${preview.fileHash ? "…" : ""}. Tasarımla eşleşmesini doğrulayın.`;
    } else if (state.lastGeneratedRevision !== state.project.revision) {
      level = "warn";
      message = "Proje G-code oluşturulduktan sonra değişti. Üretmeden önce G-code'u yeniden oluşturun.";
    } else if (Array.isArray(preview.safetyWarnings) && preview.safetyWarnings.length) {
      level = "warn";
      message = `${preview.safetyWarnings[0]}${preview.safetyWarnings.length > 1 ? ` (+${preview.safetyWarnings.length - 1} uyarı)` : ""}`;
    } else if (analysis.warningCount) {
      level = "warn";
      message = `${analysis.warningCount} üretim uyarısı var. Ön Kontrol bölümünü inceleyin.`;
    }
    refs.productionPreviewSafety.className = `production-preview-safety${level ? ` ${level}` : ""}`;
    refs.productionPreviewSafety.textContent = message;
  }

  const connected = Boolean(state.machine.connected);
  const running = machineJobActive();
  const hasPath = Boolean(path);
  const frameButton = document.getElementById("previewFrameBtn");
  const sendButton = document.getElementById("previewSendBtn");
  if (frameButton) frameButton.disabled = !connected || running || !hasPath;
  if (sendButton) sendButton.disabled = !connected || running || !hasPath;
  if (refs.productionPreviewPlay) refs.productionPreviewPlay.disabled = !preview?.segments?.length;
  if (refs.productionPreviewSpeed) refs.productionPreviewSpeed.disabled = !preview?.segments?.length;
}

function productionProgressSnapshot() {
  const preview = state.machine.preview;
  const segments = preview?.segments || [];
  const progress = Math.max(0, Math.min(segments.length, Number(state.productionPreview.progress) || 0));
  const segment = progress > 0 ? segments[progress - 1] : null;
  const lineIndex = segment ? Math.max(0, Number(segment[5]) || 0) : -1;
  let elapsed = 0;
  if (lineIndex >= 0 && Array.isArray(preview.lineSeconds)) {
    for (let index = 0; index <= lineIndex && index < preview.lineSeconds.length; index += 1) elapsed += Number(preview.lineSeconds[index]) || 0;
  }
  return {
    progress,
    x: segment ? Number(segment[2]) || 0 : 0,
    y: segment ? Number(segment[3]) || 0 : 0,
    elapsed,
  };
}

function renderProductionPlaybackStatus() {
  const snapshot = productionProgressSnapshot();
  if (refs.productionPreviewPosition) {
    refs.productionPreviewPosition.textContent = `X ${snapshot.x.toFixed(2)} · Y ${snapshot.y.toFixed(2)} · ${formatDuration(snapshot.elapsed)}`;
  }
  if (refs.productionPreviewPlay) refs.productionPreviewPlay.textContent = state.productionPreview.playing ? "Duraklat" : "Oynat";
}

function stopProductionPlayback() {
  state.productionPreview.playing = false;
  if (state.productionPreview.playbackTimer) window.clearInterval(state.productionPreview.playbackTimer);
  state.productionPreview.playbackTimer = null;
  renderProductionPlaybackStatus();
}

function startProductionPlayback() {
  const preview = state.machine.preview;
  const total = preview?.segments?.length || 0;
  if (!total) return;
  if (state.productionPreview.progress === null || state.productionPreview.progress >= total) state.productionPreview.progress = 0;
  state.productionPreview.playing = true;
  state.productionPreview.playbackStartedAt = performance.now();
  state.productionPreview.playbackStartProgress = Number(state.productionPreview.progress) || 0;
  if (state.productionPreview.playbackTimer) window.clearInterval(state.productionPreview.playbackTimer);
  state.productionPreview.playbackTimer = window.setInterval(() => {
    const duration = Math.max(0.1, Number(preview.estimatedSeconds || 0));
    const speed = Math.max(0.1, Number(refs.productionPreviewSpeed?.value || 1));
    const elapsed = (performance.now() - state.productionPreview.playbackStartedAt) / 1000 * speed;
    const added = Math.max(1, Math.floor(elapsed / duration * total));
    state.productionPreview.progress = Math.min(total, state.productionPreview.playbackStartProgress + added);
    drawProductionPreview();
    if (state.productionPreview.progress >= total) stopProductionPlayback();
  }, 40);
  renderProductionPlaybackStatus();
}

function toggleProductionPlayback() {
  if (state.productionPreview.playing) stopProductionPlayback();
  else startProductionPlayback();
}

function drawProductionPreview() {
  const canvas = refs.productionPreviewCanvas;
  if (!canvas || !state.productionPreview.open) return;
  const cssWidth = Math.max(320, Math.round(canvas.clientWidth || 900));
  const cssHeight = Math.max(320, Math.round(canvas.clientHeight || 600));
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(cssHeight * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const previewContext = canvas.getContext("2d");
  previewContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  const palette = canvasPalette();
  previewContext.clearRect(0, 0, cssWidth, cssHeight);
  previewContext.fillStyle = palette.canvas;
  previewContext.fillRect(0, 0, cssWidth, cssHeight);
  const preview = state.machine.preview;
  const segments = Array.isArray(preview?.segments) ? preview.segments : [];
  if (!segments.length) {
    previewContext.fillStyle = palette.ruler;
    previewContext.font = "13px sans-serif";
    previewContext.textAlign = "center";
    previewContext.fillText("G-code önizlemesi hazır değil", cssWidth / 2, cssHeight / 2);
    if (refs.productionPreviewProgress) {
      refs.productionPreviewProgress.max = "0";
      refs.productionPreviewProgress.value = "0";
    }
    if (refs.productionPreviewProgressText) refs.productionPreviewProgressText.textContent = "0 / 0";
    renderProductionPlaybackStatus();
    return;
  }

  const bounds = preview.bounds || { minX: 0, minY: 0, width: 1, height: 1 };
  const padding = 28;
  const spanX = Math.max(0.001, Number(bounds.width) || 1);
  const spanY = Math.max(0.001, Number(bounds.height) || 1);
  const scale = Math.min((cssWidth - padding * 2) / spanX, (cssHeight - padding * 2) / spanY);
  const drawWidth = spanX * scale;
  const drawHeight = spanY * scale;
  const offsetX = (cssWidth - drawWidth) / 2 - Number(bounds.minX || 0) * scale;
  const offsetY = (cssHeight - drawHeight) / 2 + (Number(bounds.minY || 0) + spanY) * scale;
  const mapX = (x) => offsetX + Number(x) * scale;
  const mapY = (y) => offsetY - Number(y) * scale;
  const total = segments.length;
  if (state.productionPreview.progress === null || state.productionPreview.progress > total) state.productionPreview.progress = total;
  const progress = Math.max(0, Math.min(total, Number(state.productionPreview.progress) || 0));
  if (refs.productionPreviewProgress) {
    refs.productionPreviewProgress.max = String(total);
    refs.productionPreviewProgress.value = String(progress);
  }
  if (refs.productionPreviewProgressText) refs.productionPreviewProgressText.textContent = `${progress.toLocaleString("tr-TR")} / ${total.toLocaleString("tr-TR")}`;
  renderProductionPlaybackStatus();

  previewContext.fillStyle = palette.bed;
  previewContext.strokeStyle = palette.bedBorder;
  previewContext.lineWidth = 1;
  previewContext.fillRect((cssWidth - drawWidth) / 2, (cssHeight - drawHeight) / 2, drawWidth, drawHeight);
  previewContext.strokeRect((cssWidth - drawWidth) / 2, (cssHeight - drawHeight) / 2, drawWidth, drawHeight);

  const paths = new Map();
  const ensurePath = (category, future) => {
    const key = `${category}:${future ? "future" : "done"}`;
    if (!paths.has(key)) paths.set(key, new Path2D());
    return paths.get(key);
  };
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const category = productionOperationCategory(segment);
    if (!state.productionPreview.layers[category]) continue;
    const path = ensurePath(category, index >= progress);
    path.moveTo(mapX(segment[0]), mapY(segment[1]));
    path.lineTo(mapX(segment[2]), mapY(segment[3]));
  }
  const colors = { cut: palette.cut, engrave: palette.engraveLine, travel: palette.travel || "#A855F7" };
  for (const category of ["travel", "engrave", "cut"]) {
    for (const future of [true, false]) {
      const path = paths.get(`${category}:${future ? "future" : "done"}`);
      if (!path) continue;
      previewContext.save();
      previewContext.globalAlpha = future ? 0.17 : category === "travel" ? 0.55 : 0.95;
      previewContext.strokeStyle = colors[category];
      previewContext.lineWidth = category === "travel" ? 0.8 : 1.25;
      if (category === "travel") previewContext.setLineDash([4, 4]);
      previewContext.stroke(path);
      previewContext.restore();
    }
  }
}

async function setProductionPreviewTabOpen(open, syncWorkflow = true) {
  state.productionPreview.open = Boolean(open);
  refs.productionPreviewTab?.classList.toggle("hidden", !open);
  document.body.classList.toggle("production-preview-open", Boolean(open));
  if (!open) {
    stopProductionPlayback();
    if (syncWorkflow) setWorkflowActive("design");
    return;
  }
  setMachineTabOpen(false, false, false);
  if (syncWorkflow) setWorkflowActive("preview");
  const path = refs.outputPath?.value?.trim() || "";
  if (path && (!state.machine.preview || state.machine.previewPath !== path)) await loadMachinePreview(false);
  renderProductionPreviewInfo();
  requestAnimationFrame(drawProductionPreview);
}

async function loadMachinePreview(showErrors = true) {
  const path = refs.outputPath?.value?.trim() || "";
  if (!path) {
    clearMachinePreview();
    if (showErrors) setStatus("Önce G-code çıktı yolu gerekli.", "warn");
    return;
  }
  try {
    stopProductionPlayback();
    const data = await api("/api/machine/gcode-info", { path });
    state.machine.preview = data.info || null;
    state.machine.previewPath = path;
    state.productionPreview.progress = null;
    renderMachinePreviewInfo();
    drawMachinePreview();
    renderProductionPreviewInfo();
    drawProductionPreview();
  } catch (error) {
    state.machine.preview = null;
    state.machine.previewPath = "";
    renderMachinePreviewInfo();
    drawMachinePreview();
    renderProductionPreviewInfo();
    drawProductionPreview();
    if (showErrors) setStatus(`Önizleme yüklenemedi: ${error.message}`, "danger");
  }
}

function clearMachinePreview() {
  stopProductionPlayback();
  state.machine.preview = null;
  state.machine.previewPath = "";
  state.productionPreview.progress = null;
  renderMachinePreviewInfo();
  drawMachinePreview();
  renderProductionPreviewInfo();
  drawProductionPreview();
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
    if (Number(result.excludedObjectCount || 0) > 0) parts.push(`${result.excludedObjectCount} nesne üretim dışı`);
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
  const preferred = state.machine.preferredPort || "";
  if (!preferred) {
    setStatus("Otomatik bağlanacak uygun USB seri port bulunamadı. Bluetooth portları güvenlik için otomatik seçilmez.", "warn");
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
    recordProductionHistory("sent", { totalLines: data.machine?.job?.total || state.machine.preview?.lineCount || 0 });
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

function dxfQuantityDialogOpen() {
  return Boolean(refs.dxfQuantityModal && !refs.dxfQuantityModal.classList.contains("hidden"));
}

function closeDxfQuantityDialog(quantity = null) {
  if (!dxfQuantityDialogOpen() && !pendingDxfQuantityResolve) return;
  refs.dxfQuantityModal?.classList.add("hidden");
  refs.dxfQuantityInput?.setCustomValidity("");
  const resolve = pendingDxfQuantityResolve;
  pendingDxfQuantityResolve = null;
  const returnFocus = dxfQuantityReturnFocus;
  dxfQuantityReturnFocus = null;
  resolve?.(quantity);
  window.requestAnimationFrame(() => returnFocus?.focus?.());
}

function requestDxfQuantity(parts) {
  if (!refs.dxfQuantityModal || !refs.dxfQuantityInput) {
    return Promise.resolve(defaultPartQuantity());
  }
  if (pendingDxfQuantityResolve) closeDxfQuantityDialog(null);
  const count = parts.length;
  const firstName = String(parts[0]?.name || "DXF");
  refs.dxfQuantitySummary.textContent = count === 1
    ? firstName
    : `${count} DXF seçildi. Adet her DXF için uygulanır.`;
  refs.dxfQuantityInput.value = String(Math.min(999, defaultPartQuantity()));
  refs.dxfQuantityInput.setCustomValidity("");
  dxfQuantityReturnFocus = document.activeElement;
  refs.dxfQuantityModal.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    refs.dxfQuantityInput.focus();
    refs.dxfQuantityInput.select();
  });
  return new Promise((resolve) => {
    pendingDxfQuantityResolve = resolve;
  });
}

function submitDxfQuantityDialog(event) {
  event.preventDefault();
  const quantity = Number(refs.dxfQuantityInput?.value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    refs.dxfQuantityInput?.setCustomValidity("1 ile 999 arasında tam sayı girin.");
    refs.dxfQuantityInput?.reportValidity();
    refs.dxfQuantityInput?.focus();
    refs.dxfQuantityInput?.select();
    return;
  }
  closeDxfQuantityDialog(quantity);
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

function syncPartQuantityToPlacements(partId) {
  const part = partById(partId);
  if (!part) return 0;
  const remaining = state.placements.filter((placement) => placement.partId === partId).length;
  if (remaining > 0) part.quantity = remaining;
  return remaining;
}

function deletePlacementById(id) {
  const placement = placementById(id);
  const childPatterns = state.patterns.filter((item) => item.parentId === id);
  for (const pattern of childPatterns) state.images.delete(pattern.id);
  state.placements = state.placements.filter((item) => item.id !== id);
  state.patterns = state.patterns.filter((item) => item.parentId !== id);
  if (placement) syncPartQuantityToPlacements(placement.partId);
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

function productionJobBounds(analysis) {
  const bounds = emptyBounds();
  for (const item of analysis?.productionPlacements || []) {
    includePoint(bounds, { x: item.bounds.minX, y: item.bounds.minY });
    includePoint(bounds, { x: item.bounds.maxX, y: item.bounds.maxY });
  }
  for (const item of analysis?.productionPatterns || []) {
    if (!item.bounds) continue;
    includePoint(bounds, { x: item.bounds.minX, y: item.bounds.minY });
    includePoint(bounds, { x: item.bounds.maxX, y: item.bounds.maxY });
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

function vectorPatternPointCount(pattern) {
  const reported = Number(pattern?.vectorStats?.pointsKept);
  if (Number.isFinite(reported) && reported > 0) return reported;
  return (pattern?.vectorPaths || []).reduce(
    (total, vectorPath) => total + (vectorPath.removed ? 0 : (vectorPath.points || []).length),
    0
  );
}

function vectorScreenAffine(pattern) {
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const center = worldToScreen({ x: pattern.x + pattern.width / 2, y: pattern.y + pattern.height / 2 });
  const angle = ((Number(pattern.rotation) || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scaleX = ((pattern.mirrorX ? -1 : 1) * pattern.width * state.view.scale) / sourceWidth;
  const scaleY = ((pattern.mirrorY ? -1 : 1) * pattern.height * state.view.scale) / sourceHeight;
  return {
    centerX: center.x,
    centerY: center.y,
    halfSourceWidth: sourceWidth / 2,
    halfSourceHeight: sourceHeight / 2,
    ax: scaleX * cos,
    bx: scaleY * sin,
    ay: -scaleX * sin,
    by: scaleY * cos,
  };
}

function appendAffineVectorPath(points, affine, stride = 1, closed = false) {
  if (!points || points.length < 2) return false;
  const step = Math.max(1, Math.floor(stride));
  const appendPoint = (point, first) => {
    const sourceX = Number(point[0]) - affine.halfSourceWidth;
    const sourceY = Number(point[1]) - affine.halfSourceHeight;
    const x = affine.centerX + sourceX * affine.ax + sourceY * affine.bx;
    const y = affine.centerY + sourceX * affine.ay + sourceY * affine.by;
    if (first) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  };
  ctx.beginPath();
  appendPoint(points[0], true);
  let lastIndex = 0;
  for (let index = step; index < points.length; index += step) {
    appendPoint(points[index], false);
    lastIndex = index;
  }
  if (lastIndex !== points.length - 1) appendPoint(points[points.length - 1], false);
  if (closed) ctx.closePath();
  return true;
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

function vectorPatternNeedsResizePreserve(pattern) {
  if (!vectorPatternHasPaths(pattern)) return false;
  return (pattern.vectorPaths || []).some((vectorPath) => vectorPathPreservesDuringPatternResize(pattern, vectorPath));
}

function updatePatternGeometry(pattern, updates = {}, options = {}) {
  if (!pattern) return;
  const needsPreserve = options.preserveLocked !== false && vectorPatternNeedsResizePreserve(pattern);
  const oldPattern = needsPreserve
    ? {
        x: Number(pattern.x) || 0,
        y: Number(pattern.y) || 0,
        width: Number(pattern.width) || 1,
        height: Number(pattern.height) || 1,
        rotation: Number(pattern.rotation) || 0,
        mirrorX: Boolean(pattern.mirrorX),
        mirrorY: Boolean(pattern.mirrorY),
        sourceWidth: pattern.sourceWidth,
        sourceHeight: pattern.sourceHeight,
      }
    : null;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) continue;
    pattern[key] = Number(value);
  }
  pattern.width = Math.max(1, Number(pattern.width) || 1);
  pattern.height = Math.max(1, Number(pattern.height) || 1);
  if (oldPattern && (oldPattern.width !== pattern.width || oldPattern.height !== pattern.height || oldPattern.x !== pattern.x || oldPattern.y !== pattern.y)) {
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

function drawTransformedPatternImage(pattern, image, alpha) {
  const center = worldToScreen({ x: pattern.x + pattern.width / 2, y: pattern.y + pattern.height / 2 });
  const width = pattern.width * state.view.scale;
  const height = pattern.height * state.view.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((-pattern.rotation * Math.PI) / 180);
  ctx.scale(pattern.mirrorX ? -1 : 1, pattern.mirrorY ? -1 : 1);
  ctx.globalAlpha = alpha;
  if (image && (image.complete === undefined || image.complete)) {
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    ctx.fillStyle = cssAlpha("--travel", 0.18, "#A855F7");
    ctx.fillRect(-width / 2, -height / 2, width, height);
  }
  ctx.restore();
}

function drawPatternBitmap(pattern, alpha) {
  drawTransformedPatternImage(pattern, state.images.get(pattern.id), alpha);
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

function scheduleCanvasResize() {
  if (canvasResizeFrame !== null) cancelAnimationFrame(canvasResizeFrame);
  canvasResizeFrame = requestAnimationFrame(() => {
    canvasResizeFrame = null;
    const rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - state.view.width) > 0.5 || Math.abs(rect.height - state.view.height) > 0.5) {
      resizeCanvas();
    }
  });
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
    const gridText = state.preferences.showGrid ? `${grid.toFixed(grid < 10 ? 1 : 0)} mm` : "kapalı";
    refs.safetyReadout.textContent = `Grid: ${gridText} · Zoom: ${Math.round(state.view.zoom * 100)}% · İmleç: ${cursor}`;
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
  beginCanvasInteraction("view-zoom");
  const point = screenPoint || { x: state.view.width / 2, y: state.view.height / 2 };
  const before = screenToWorld(point);
  state.view.zoom = clamp(state.view.zoom * factor, 0.25, 16);
  computeView();
  const after = worldToScreen(before);
  state.view.panX += point.x - after.x;
  state.view.panY += point.y - after.y;
  requestCanvasDraw();
  scheduleCanvasInteractionEnd();
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

function drawMaterialAreaCursor() {
  if (!state.materialArea.drawing || !state.materialArea.previewPoint) return;
  const palette = canvasPalette();
  const points = materialAreaPoints();
  const preview = state.materialArea.previewPoint;
  const screen = worldToScreen(preview);
  const label = points.length
    ? `Nokta X ${preview.x.toFixed(1)} / Y ${preview.y.toFixed(1)} mm`
    : `İlk nokta X ${preview.x.toFixed(1)} / Y ${preview.y.toFixed(1)} mm`;
  const step = materialAreaGridStep();
  const labelAbove = screen.y > state.view.height - 88;
  const labelY = labelAbove ? screen.y - 58 : screen.y + 12;
  const gridLabelY = labelAbove ? screen.y - 30 : screen.y + 42;

  const labelBox = (text, x, y, options = {}) => {
    ctx.font = options.font || "800 13px Segoe UI";
    const width = ctx.measureText(text).width + 16;
    const height = options.height || 25;
    const boxX = clamp(x, 6, Math.max(6, state.view.width - width - 6));
    const boxY = clamp(y, 6, Math.max(6, state.view.height - height - 6));
    ctx.fillStyle = "rgba(255, 255, 255, 0.97)";
    ctx.strokeStyle = options.stroke || palette.selection;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, width, height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.text;
    ctx.fillText(text, boxX + 8, boxY + 17);
  };

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineCap = "round";

  ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(screen.x - 16, screen.y);
  ctx.lineTo(screen.x + 16, screen.y);
  ctx.moveTo(screen.x, screen.y - 16);
  ctx.lineTo(screen.x, screen.y + 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = points.length ? palette.selection : palette.materialArea;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(screen.x - 16, screen.y);
  ctx.lineTo(screen.x + 16, screen.y);
  ctx.moveTo(screen.x, screen.y - 16);
  ctx.lineTo(screen.x, screen.y + 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = points.length ? palette.selection : palette.materialArea;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 3.8, 0, Math.PI * 2);
  ctx.fill();

  labelBox(label, screen.x + 12, labelY, { stroke: points.length ? palette.selection : palette.materialArea });
  if (!points.length) {
    labelBox(`Grid ${step.toFixed(step < 10 ? 1 : 0)} mm`, screen.x + 12, gridLabelY, {
      font: "700 12px Segoe UI",
      height: 24,
      stroke: palette.materialArea,
    });
  }
  ctx.restore();
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
  drawMaterialAreaCursor();
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

  if (state.preferences.showGrid) {
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
    ctx.fillText("Tabla dışında kalanlar - G-code'a dahil edilmez", Math.max(12, topLeft.x), shelfY + 18);
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

function drawSelectedPlacementFrames() {
  const placements = selectedPlacementObjects();
  if (!placements.length) return;
  const palette = canvasPalette();
  ctx.save();
  ctx.strokeStyle = palette.selection;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([7, 4]);
  for (const placement of placements) {
    const bounds = placementBounds(placement);
    const topLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY });
    const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.minY });
    ctx.strokeRect(
      Math.min(topLeft.x, bottomRight.x),
      Math.min(topLeft.y, bottomRight.y),
      Math.abs(bottomRight.x - topLeft.x),
      Math.abs(bottomRight.y - topLeft.y),
    );
  }
  ctx.restore();
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

function drawTextFontPreview(pattern, preview) {
  if (!preview?.text || !preview.font) return pattern;
  const settings = preview.settings || {};
  const centerX = pattern.x + pattern.width / 2;
  const centerY = pattern.y + pattern.height / 2;
  if (preview.font.kind === "single" && window.LaserGeometry) {
    const geometry = window.LaserGeometry.buildText(preview.text, {
      height: Math.max(2, Number(settings.height) || 20),
      tracking: Number(settings.tracking) || 0,
    });
    if (geometry?.vectorPaths?.length) {
      const temporary = {
        ...pattern,
        id: `${pattern.id}:font-preview`,
        x: centerX - geometry.sourceWidth / 2,
        y: centerY - geometry.sourceHeight / 2,
        width: geometry.sourceWidth,
        height: geometry.sourceHeight,
        sourceWidth: geometry.sourceWidth,
        sourceHeight: geometry.sourceHeight,
        vectorPaths: geometry.vectorPaths.map((path) => ({ ...path, operation: "engrave_line" })),
        operation: "engrave_line",
        vectorEngraveMode: "contour",
      };
      drawVectorPattern(temporary);
      return temporary;
    }
  }

  const lines = String(preview.text).split(/\r?\n/);
  const fontPx = Math.max(8, (Number(settings.height) || 20) * state.view.scale);
  const trackingPx = (Number(settings.tracking) || 0) * state.view.scale;
  const lineHeight = fontPx * 1.28;
  ctx.save();
  ctx.font = textCanvasFont(fontPx, preview.font, settings);
  const widths = lines.map((line) => measureTrackedText(ctx, line, trackingPx));
  const widthPx = Math.max(1, ...widths);
  const heightPx = Math.max(fontPx, lines.length * lineHeight);
  const center = worldToScreen({ x: centerX, y: centerY });
  ctx.translate(center.x, center.y);
  ctx.rotate((-pattern.rotation * Math.PI) / 180);
  ctx.scale(pattern.mirrorX ? -1 : 1, pattern.mirrorY ? -1 : 1);
  const operation = settings.operation || patternOperation(pattern);
  const palette = canvasPalette();
  ctx.fillStyle = operation === "cut" ? palette.cut : operation === "engrave_fill" ? palette.engraveFill : palette.engraveLine;
  ctx.globalAlpha = 0.82;
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, index) => {
    const x = -widths[index] / 2;
    const y = -heightPx / 2 + fontPx + index * lineHeight;
    drawTrackedText(ctx, line, x, y, trackingPx);
  });
  ctx.restore();
  const previewWidth = widthPx / Math.max(0.001, state.view.scale);
  const previewHeight = heightPx / Math.max(0.001, state.view.scale);
  return {
    ...pattern,
    x: centerX - previewWidth / 2,
    y: centerY - previewHeight / 2,
    width: previewWidth,
    height: previewHeight,
  };
}

function drawPatterns() {
  for (const pattern of state.patterns) {
    const ignored = patternOperation(pattern) === "ignore";
    const fontPreview = activeTextFontPreview?.patternId === pattern.id ? activeTextFontPreview : null;
    let selectionPattern = pattern;
    ctx.save();
    if (ignored) ctx.globalAlpha = 0.38;
    if (fontPreview) {
      selectionPattern = drawTextFontPreview(pattern, fontPreview);
    } else if (vectorPatternHasPaths(pattern)) {
      drawVectorPattern(pattern);
    } else {
      if (patternClipRegion(pattern)) {
        drawPatternBitmap(pattern, pattern.kind === "svg" ? 0.16 : 0.12);
      }
      drawWithPatternClip(pattern, () => {
        drawPatternBitmap(pattern, pattern.kind === "svg" ? 1 : 0.7);
      });
    }

    if (patternObjectSelectedForCanvas(pattern)) {
      drawPatternSelectionOutline(selectionPattern, state.selected?.type === "pattern" && state.selected.id === pattern.id);
    }
    if (isCadLineArtPattern(pattern) && state.selected?.id === pattern.id) {
      drawCadCutRegionMarkers(pattern);
    }
    ctx.restore();
  }
}

function patternObjectSelectedForCanvas(pattern) {
  if (!pattern) return false;
  if (state.selected?.type === "pattern" && state.selected.id === pattern.id) return true;
  if (["vectorPath", "vectorObject"].includes(state.selected?.type) && state.selected.id === pattern.id) return false;
  return state.selectedItems.some((item) => item.type === "pattern" && item.id === pattern.id);
}

function drawCadCutRegionMarkers(pattern) {
  const seeds = pattern.cutRegionSeeds || [];
  if (!seeds.length) return;
  const palette = canvasPalette();
  ctx.save();
  ctx.font = "700 10px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  seeds.forEach((seed, index) => {
    const world = patternWorldPoint(pattern, vectorLocalPoint(pattern, [Number(seed.x) || 0, Number(seed.y) || 0]));
    const screen = worldToScreen(world);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = palette.panel;
    ctx.fill();
    ctx.strokeStyle = palette.cut;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = palette.cut;
    ctx.fillText(String(index + 1), screen.x, screen.y + 0.5);
  });
  ctx.restore();
}

function drawVectorRegionCursor() {
  if (!state.vectorRegionTool.active || !state.cursor) return;
  const pattern = patternById(state.vectorRegionTool.patternId);
  if (!isCadLineArtPattern(pattern)) return;
  const palette = canvasPalette();
  const screen = worldToScreen(state.cursor);
  const inside = pointInPolygon(state.cursor, patternCorners(pattern));
  const color = inside ? palette.cut : palette.outside;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = palette.panel;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(screen.x - 15, screen.y);
  ctx.lineTo(screen.x + 15, screen.y);
  ctx.moveTo(screen.x, screen.y - 15);
  ctx.lineTo(screen.x, screen.y + 15);
  ctx.stroke();
  const label = inside ? "Kapalı alanı kesime al" : "Desenin içine gelin";
  ctx.font = "700 11px Segoe UI";
  const width = ctx.measureText(label).width + 14;
  const labelX = clamp(screen.x + 16, 4, Math.max(4, state.view.width - width - 4));
  const labelY = clamp(screen.y - 27, 4, Math.max(4, state.view.height - 26));
  ctx.fillStyle = palette.panel;
  ctx.fillRect(labelX, labelY, width, 22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(labelX + 0.5, labelY + 0.5, width - 1, 21);
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelX + 7, labelY + 11);
  ctx.restore();
}

function cancelVectorRepairTool(message = "") {
  state.vectorRepairTool.active = false;
  state.vectorRepairTool.mode = "straighten";
  state.vectorRepairTool.operation = "engrave_line";
  state.vectorRepairTool.drawing = false;
  state.vectorRepairTool.patternId = null;
  state.vectorRepairTool.pathId = null;
  state.vectorRepairTool.startIndex = null;
  state.vectorRepairTool.startAnchor = null;
  state.vectorRepairTool.draftWorldPoints = [];
  state.vectorRepairTool.pointerId = null;
  canvas.style.cursor = "";
  if (message) setStatus(message);
}

function vectorPatternOpenEndpoints(pattern) {
  const model = patternVectorModel(pattern);
  if (!pattern || !model) return [];
  const edges = new Map((model.vectorGraph?.edges || []).map((edge) => [String(edge.id || ""), edge]));
  const nodes = new Map((model.vectorGraph?.nodes || []).map((node) => [String(node.id || ""), node]));
  const endpoints = new Map();
  for (const vectorPath of pattern.vectorPaths || []) {
    if (!vectorPathIsActive(vectorPath, pattern) || vectorPath.closed || (vectorPath.points || []).length < 2) continue;
    const edgeId = String(vectorPath.edgeId || vectorPath.provenance?.edgeId || "");
    const edge = edges.get(edgeId);
    if (!edge || edge.removed || edge.closed) continue;
    for (const side of ["start", "end"]) {
      const nodeId = String(side === "start" ? edge.startNodeId : edge.endNodeId);
      const node = nodes.get(nodeId);
      if (!node || !Array.isArray(node.position)) continue;
      const sourcePoint = [Number(node.position[0]), Number(node.position[1])];
      if (!sourcePoint.every(Number.isFinite)) continue;
      const worldPoint = vectorSourcePointToWorld(pattern, sourcePoint);
      if (endpoints.has(nodeId)) continue;
      endpoints.set(nodeId, {
        key: `node:${nodeId}`,
        edgeId,
        nodeId,
        side,
        pathId: vectorPath.id,
        sourcePoint,
        worldPoint,
      });
    }
  }
  return [...endpoints.values()];
}

function nearestVectorPatternEndpoint(pattern, worldPoint, excludedNodeId = "") {
  let nearest = null;
  for (const endpoint of vectorPatternOpenEndpoints(pattern)) {
    if (excludedNodeId && String(endpoint.nodeId) === String(excludedNodeId)) continue;
    const distance = Math.hypot(endpoint.worldPoint.x - worldPoint.x, endpoint.worldPoint.y - worldPoint.y);
    if (!nearest || distance < nearest.distance) nearest = { ...endpoint, distance };
  }
  return nearest;
}

function nearestVectorPatternSegmentAnchor(pattern, worldPoint) {
  let nearest = null;
  for (const vectorPath of pattern?.vectorPaths || []) {
    if (!vectorPathIsActive(vectorPath, pattern) || (vectorPath.points || []).length < 2) continue;
    const candidate = nearestVectorPathSegment(
      vectorWorldPath(pattern, vectorPath),
      worldPoint,
      Boolean(vectorPath.closed)
    );
    if (!candidate || (nearest && candidate.distance >= nearest.distance)) continue;
    const snappedWorld = { x: Number(candidate.point[0]), y: Number(candidate.point[1]) };
    nearest = {
      kind: "segment",
      edgeId: String(vectorPath.edgeId || vectorPath.provenance?.edgeId || ""),
      nodeId: "",
      pathId: vectorPath.id,
      sourcePoint: clampPatternSourcePoint(pattern, patternSourcePointFromWorld(pattern, snappedWorld)),
      worldPoint: snappedWorld,
      distance: candidate.distance,
      snapped: true,
    };
  }
  return nearest;
}

function newVectorPathAnchor(pattern, worldPoint, excludedNodeId = "") {
  const snapDistance = vectorRedrawSnapDistance();
  const endpoint = nearestVectorPatternEndpoint(pattern, worldPoint, excludedNodeId);
  if (endpoint && endpoint.distance <= snapDistance) {
    return { ...endpoint, kind: "endpoint", snapped: true };
  }
  const segment = nearestVectorPatternSegmentAnchor(pattern, worldPoint);
  if (segment && segment.distance <= snapDistance) return segment;
  const sourcePoint = clampPatternSourcePoint(pattern, patternSourcePointFromWorld(pattern, worldPoint));
  return {
    kind: "free",
    edgeId: "",
    nodeId: "",
    pathId: "",
    sourcePoint,
    worldPoint: vectorSourcePointToWorld(pattern, sourcePoint),
    distance: 0,
    snapped: false,
  };
}

function vectorSourceSnapDistance(pattern) {
  const sourceWidth = Math.max(0.001, Number(pattern?.sourceWidth) || Number(pattern?.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern?.sourceHeight) || Number(pattern?.height) || 1);
  const scaleX = sourceWidth / Math.max(0.001, Number(pattern?.width) || 1);
  const scaleY = sourceHeight / Math.max(0.001, Number(pattern?.height) || 1);
  return Math.max(1e-5, vectorRedrawSnapDistance() * Math.max(scaleX, scaleY));
}

function drawVectorRepairCursor() {
  const tool = state.vectorRepairTool;
  if (!tool.active || !state.cursor) return;
  const pattern = patternById(tool.patternId);
  const vectorPath = (pattern?.vectorPaths || []).find((item) => item.id === tool.pathId);
  const widen = tool.mode === "widen";
  const create = tool.mode === "create";
  if (!pattern || (!widen && !create && !vectorPath)) return;
  const palette = canvasPalette();
  const screen = worldToScreen(state.cursor);
  const redraw = tool.mode === "redraw";
  const pathDrawing = redraw || create;
  const radius = widen ? Math.max(0.2, Number(tool.widenRadius || 7)) : Math.max(0.1, Number(tool.radius || 1));
  const radiusPx = pathDrawing ? 10 : Math.max(8, radius * state.view.scale);
  ctx.save();
  ctx.strokeStyle = palette.warning;
  ctx.fillStyle = cssAlpha("--warning", pathDrawing ? 0.14 : widen ? 0.12 : 0.08, "#D97706");
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(screen.x - 5, screen.y);
  ctx.lineTo(screen.x + 5, screen.y);
  ctx.moveTo(screen.x, screen.y - 5);
  ctx.lineTo(screen.x, screen.y + 5);
  ctx.stroke();
  if (widen) {
    const local = patternLocalPointFromWorld(pattern, state.cursor);
    const left = worldToScreen(patternWorldPoint(pattern, { x: local.x - radius * 0.62, y: local.y }));
    const right = worldToScreen(patternWorldPoint(pattern, { x: local.x + radius * 0.62, y: local.y }));
    const arrowAngle = Math.atan2(right.y - left.y, right.x - left.x);
    const drawArrowHead = (point, direction) => {
      const angle = arrowAngle + direction * Math.PI;
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + Math.cos(angle - 0.45) * 8, point.y + Math.sin(angle - 0.45) * 8);
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + Math.cos(angle + 0.45) * 8, point.y + Math.sin(angle + 0.45) * 8);
    };
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    drawArrowHead(left, 0);
    drawArrowHead(right, 1);
    ctx.strokeStyle = palette.selection;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = "700 11px Segoe UI";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = palette.text;
    ctx.fillText(`+${Math.max(0.05, Number(tool.widenAmount || 1.5)).toFixed(2)} mm`, screen.x + 10, screen.y - 10);
  }
  if (pathDrawing && tool.draftWorldPoints.length > 1) {
    ctx.beginPath();
    tool.draftWorldPoints.map(worldToScreen).forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = palette.selection;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.stroke();
  }
  if (create) {
    const endpoints = vectorPatternOpenEndpoints(pattern);
    const nearest = nearestVectorPatternEndpoint(pattern, state.cursor, tool.drawing ? tool.startAnchor?.nodeId : "");
    const visibleEndpoints = endpoints.length <= 300
      ? endpoints
      : endpoints.filter((endpoint) => {
          const point = worldToScreen(endpoint.worldPoint);
          return Math.hypot(point.x - screen.x, point.y - screen.y) <= 80;
        });
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.success;
    for (const endpoint of visibleEndpoints) {
      if (tool.drawing && String(endpoint.nodeId) === String(tool.startAnchor?.nodeId)) continue;
      const point = worldToScreen(endpoint.worldPoint);
      if (point.x < -8 || point.y < -8 || point.x > state.view.width + 8 || point.y > state.view.height + 8) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (nearest && nearest.distance <= vectorRedrawSnapDistance()) {
      const snapped = worldToScreen(nearest.worldPoint);
      if (tool.drawing && tool.draftWorldPoints.length) {
        const previous = worldToScreen(tool.draftWorldPoints[tool.draftWorldPoints.length - 1]);
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(snapped.x, snapped.y);
        ctx.strokeStyle = palette.success;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(snapped.x, snapped.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = palette.success;
      ctx.fill();
      ctx.strokeStyle = palette.panel;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
      const label = tool.drawing ? "BİTİR" : "BAŞLA";
      ctx.font = "700 10px Segoe UI";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = palette.success;
      ctx.fillText(label, snapped.x + 9, snapped.y - 6);
    }
    const guide = tool.drawing ? "BIRAKINCA KAYDEDİLİR" : "BASILI TUT VE ÇİZ";
    ctx.font = "700 10px Segoe UI";
    ctx.textBaseline = "middle";
    const guideWidth = ctx.measureText(guide).width + 14;
    const guideX = clamp(screen.x + 13, 6, Math.max(6, state.view.width - guideWidth - 6));
    const guideY = clamp(screen.y + 14, 6, Math.max(6, state.view.height - 25));
    ctx.fillStyle = palette.panel;
    ctx.strokeStyle = palette.selection;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.fillRect(guideX, guideY, guideWidth, 21);
    ctx.strokeRect(guideX + 0.5, guideY + 0.5, guideWidth - 1, 20);
    ctx.fillStyle = palette.selection;
    ctx.fillText(guide, guideX + 7, guideY + 11);
  }
  if (redraw) {
    const nearest = nearestVectorPathSegment(
      vectorWorldPath(pattern, vectorPath),
      state.cursor,
      Boolean(vectorPath.closed)
    );
    if (nearest && nearest.distance <= vectorRedrawSnapDistance()) {
      const snapped = worldToScreen({ x: nearest.point[0], y: nearest.point[1] });
      if (tool.drawing && tool.draftWorldPoints.length) {
        const previous = worldToScreen(tool.draftWorldPoints[tool.draftWorldPoints.length - 1]);
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(snapped.x, snapped.y);
        ctx.strokeStyle = palette.success;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(snapped.x, snapped.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = palette.success;
      ctx.fill();
      ctx.strokeStyle = palette.panel;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function vectorModelBlocksLocalWiden(model) {
  if (!model) return false;
  if ((model.occlusionMasks || []).some((mask) => !mask.removed)) return true;
  return (model.vectorObjects || []).some((object) => {
    const transform = Array.isArray(object.transform) ? object.transform.map(Number) : [1, 0, 0, 1, 0, 0];
    const transformed = transform.some((value, index) => Math.abs(value - [1, 0, 0, 1, 0, 0][index]) > 1e-9);
    return transformed || (object.attachments || []).length > 0;
  });
}

function widenVectorRegionAtWorld(worldPoint) {
  const tool = state.vectorRepairTool;
  const pattern = patternById(tool.patternId);
  if (!pattern || !vectorPatternHasPaths(pattern)) {
    cancelVectorRepairTool("Kalınlaştırılacak vektör deseni bulunamadı.");
    return false;
  }
  if (!pointInPolygon(worldPoint, patternCorners(pattern))) {
    setStatus("Kalınlaştırma çemberini seçili desenin içine getirin.", "warn");
    return false;
  }

  const radius = Math.max(0.2, Number(tool.widenRadius || 7));
  const amount = Math.min(radius * 0.45, Math.max(0.05, Number(tool.widenAmount || 1.5)));
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const centerSource = patternSourcePointFromWorld(pattern, worldPoint);
  const options = {
    radiusX: (radius / Math.max(0.001, Number(pattern.width) || 1)) * sourceWidth,
    radiusY: (radius / Math.max(0.001, Number(pattern.height) || 1)) * sourceHeight,
    amountX: (amount / Math.max(0.001, Number(pattern.width) || 1)) * sourceWidth,
    amountY: 0,
    centerSoftness: 0.06,
  };
  const editablePaths = (pattern.vectorPaths || []).filter(
    (vectorPath) => !vectorPath.removed && !vectorPathPreservesDuringPatternResize(pattern, vectorPath)
  );
  if (!editablePaths.length) {
    setStatus("Bu desendeki konturlar kilitli veya deformasyondan korunuyor.", "warn");
    return false;
  }
  const model = patternVectorModel(pattern);
  let changedPaths = 0;
  let changedPoints = 0;
  let applyChange = null;
  const selectedBefore = (pattern.vectorPaths || []).find((path) => String(path.id) === String(tool.pathId));
  const selectedEdgeId = String(
    selectedBefore?.edgeId || selectedBefore?.provenance?.edgeId || (selectedBefore?.id ? `edge:${selectedBefore.id}` : "")
  );

  if (model) {
    if (vectorModelBlocksLocalWiden(model)) {
      setStatus("Bu desende taşınmış veya bağlantılı semantik nesneler var. Önce ilgili nesneyi ayırıp nesne ölçeğini kullanın.", "warn");
      return false;
    }
    const editableEdgeIds = [...new Set(editablePaths.map((path) => String(
      path.edgeId || path.provenance?.edgeId || (path.id ? `edge:${path.id}` : "")
    )).filter(Boolean))];
    const result = window.LaserVectorEdit?.widenVectorModelRegion(model, centerSource, { ...options, edgeIds: editableEdgeIds });
    if (!result?.changedEdges) {
      setStatus("İşaretlenen çemberde kalınlaştırılabilecek kilitsiz çizgi bulunamadı.", "warn");
      return false;
    }
    changedPaths = result.changedEdges;
    changedPoints = result.changedPoints;
    applyChange = () => {
      applyPatternVectorModel(pattern, result.model);
      compilePatternVectorModel(pattern);
    };
  } else {
    const updates = [];
    for (const vectorPath of editablePaths) {
      const result = window.LaserVectorEdit?.widenPolylineRegion(vectorPath.points || [], centerSource, options);
      if (!result?.changedPoints) continue;
      updates.push({ vectorPath, points: result.points });
      changedPoints += result.changedPoints;
    }
    if (!updates.length) {
      setStatus("İşaretlenen çemberde kalınlaştırılabilecek kilitsiz çizgi bulunamadı.", "warn");
      return false;
    }
    changedPaths = updates.length;
    applyChange = () => {
      for (const update of updates) {
        update.vectorPath.points = update.points;
        refreshVectorPathMetrics(update.vectorPath);
      }
    };
  }

  const selectedPathId = tool.pathId;
  pushUndo("Yerel enine kalınlaştır");
  applyChange();
  cancelVectorRepairTool();
  const selectedAfter = (pattern.vectorPaths || []).find((path) => (
    String(path.id) === String(selectedPathId)
    || (selectedEdgeId && String(path.edgeId || path.provenance?.edgeId || "") === selectedEdgeId)
  ));
  select(selectedAfter ? "vectorPath" : "pattern", pattern.id, selectedAfter ? { pathId: selectedAfter.id } : {});
  updateJobAnalysisNow();
  setStatus(`${changedPaths} konturda ${changedPoints} nokta enine kalınlaştırıldı (+${amount.toFixed(2)} mm). Gerekirse aynı bölgeye yeniden uygulayın; Ctrl+Z ile geri alabilirsiniz.`, "ok");
  return true;
}

function repairVectorPathAtWorld(worldPoint) {
  const tool = state.vectorRepairTool;
  if (tool.mode === "widen") return widenVectorRegionAtWorld(worldPoint);
  const pattern = patternById(tool.patternId);
  const vectorPath = (pattern?.vectorPaths || []).find((item) => item.id === tool.pathId);
  const points = vectorPath?.points || [];
  if (!pattern || !vectorPath || points.length < 4) {
    cancelVectorRepairTool("Düzeltilecek kontur bulunamadı.");
    return false;
  }

  const worldPoints = vectorWorldPath(pattern, vectorPath);
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  worldPoints.forEach((point, index) => {
    const distance = Math.hypot(point.x - worldPoint.x, point.y - worldPoint.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  const radius = Math.max(0.1, Number(tool.radius || 1));
  if (nearestDistance > radius * 1.35) {
    setStatus("Düzeltme çemberini seçili konturun üzerine getirin.", "warn");
    return false;
  }

  const metricPoints = worldPoints.map((point) => [point.x, point.y]);
  const nextPoints = window.LaserVectorEdit?.repairPolylineArc(
    points,
    metricPoints,
    Boolean(vectorPath.closed),
    nearestIndex,
    radius
  );
  if (!nextPoints) {
    setStatus("Bu noktada düzeltilecek yeterli kontur aralığı yok.", "warn");
    return false;
  }

  pushUndo("Yerel kontur düzelt");
  vectorPath.points = nextPoints.map((point) => [Number(point[0]) || 0, Number(point[1]) || 0]);
  refreshVectorPathMetrics(vectorPath);
  cancelVectorRepairTool();
  draw();
  updateSelectionPanel();
  updateJobAnalysisNow();
  setStatus("Seçili konturun işaretlenen bölümü düzleştirildi.", "ok");
  return true;
}

function vectorRepairTarget() {
  const tool = state.vectorRepairTool;
  const pattern = patternById(tool.patternId);
  const vectorPath = (pattern?.vectorPaths || []).find((item) => item.id === tool.pathId);
  return pattern && vectorPath ? { pattern, vectorPath, worldPoints: vectorWorldPath(pattern, vectorPath) } : null;
}

function nearestVectorPathSegment(worldPoints, worldPoint, closed = false) {
  return window.LaserVectorEdit?.nearestPointOnPolyline(
    worldPoints.map((point) => [point.x, point.y]),
    [worldPoint.x, worldPoint.y],
    closed
  ) || null;
}

function vectorRedrawSnapDistance() {
  return clamp(12 / Math.max(0.01, state.view.scale), 0.4, 3);
}

function beginNewVectorPathDrawing(pattern, requestedOperation = "engrave_line") {
  if (!pattern || !vectorPatternHasPaths(pattern)) {
    setStatus("Yeni kontur için vektör desen gerekir.", "warn");
    return false;
  }
  try {
    const model = ensurePatternVectorModel(pattern);
    if (vectorModelBlocksLocalWiden(model)) {
      setStatus("Taşınmış, maskelenmiş veya bağlantılı nesneler varken yeni kontur eklenemez. Önce nesne dönüşümünü sıfırlayın veya bağlantıyı ayırın.", "warn");
      return false;
    }
    cancelVectorRegionSelection();
    cancelVectorObjectSeparation();
    cancelVectorRepairTool();
    state.vectorRepairTool.active = true;
    state.vectorRepairTool.mode = "create";
    state.vectorRepairTool.operation = requestedOperation === "cut" ? "cut" : "engrave_line";
    state.vectorRepairTool.patternId = pattern.id;
    state.vectorRepairTool.pathId = null;
    state.vectorRepairTool.drawing = false;
    state.vectorRepairTool.startAnchor = null;
    state.vectorRepairTool.draftWorldPoints = [];
    state.vectorRepairTool.pointerId = null;
    select("pattern", pattern.id);
    setStatus("Desenin içinde başlangıç noktasına basın, fareyi basılı tutarak çizip bitişte bırakın. Yakındaki konturlara otomatik bağlanır; Esc aracı kapatır.", "info");
    return true;
  } catch (error) {
    setStatus(error.message || "Yeni kontur aracı başlatılamadı.", "danger");
    return false;
  }
}

function beginNewVectorPathDraw(worldPoint, pointerId) {
  const tool = state.vectorRepairTool;
  const pattern = patternById(tool.patternId);
  if (!pattern) {
    cancelVectorRepairTool("Yeni kontur için desen bulunamadı.");
    return false;
  }
  if (!pointInPolygon(worldPoint, patternCorners(pattern))) {
    setStatus("Çizime seçili vektör deseninin içinde başlayın.", "warn");
    return false;
  }
  const anchor = newVectorPathAnchor(pattern, worldPoint);
  tool.drawing = true;
  tool.startAnchor = anchor;
  tool.pointerId = pointerId;
  tool.draftWorldPoints = [{ ...anchor.worldPoint }];
  setStatus("Fareyi basılı tutup eksik konturu çizin. Bitişte bırakınca çizgi yumuşatılıp kaydedilir.", "info");
  requestCanvasDraw();
  return true;
}

function beginVectorPathRedraw(worldPoint, pointerId) {
  const target = vectorRepairTarget();
  if (!target || target.worldPoints.length < 2) {
    cancelVectorRepairTool("Yeniden çizilecek kontur bulunamadı.");
    return false;
  }
  const nearest = nearestVectorPathSegment(target.worldPoints, worldPoint, Boolean(target.vectorPath.closed));
  if (!nearest || nearest.distance > vectorRedrawSnapDistance()) {
    setStatus("Çizime seçili konturun üzerinden başlayın.", "warn");
    return false;
  }
  const start = { x: nearest.point[0], y: nearest.point[1] };
  state.vectorRepairTool.drawing = true;
  state.vectorRepairTool.startIndex = null;
  state.vectorRepairTool.startAnchor = nearest;
  state.vectorRepairTool.pointerId = pointerId;
  state.vectorRepairTool.draftWorldPoints = [{ ...start }];
  setStatus("Fareyi basılı tutup yeni eğriyi çizin; mevcut konturun üzerinde bırakın.");
  requestCanvasDraw();
  return true;
}

function appendVectorPathRedraw(worldPoint) {
  const tool = state.vectorRepairTool;
  const points = tool.draftWorldPoints;
  const previous = points[points.length - 1];
  const minDistance = clamp(2 / Math.max(0.01, state.view.scale), 0.04, 0.4);
  if (!previous || Math.hypot(worldPoint.x - previous.x, worldPoint.y - previous.y) >= minDistance) {
    points.push({ ...worldPoint });
  }
}

function finishNewVectorPathDraw(worldPoint) {
  const tool = state.vectorRepairTool;
  const pattern = patternById(tool.patternId);
  if (!pattern || !tool.drawing || !tool.startAnchor) return false;
  appendVectorPathRedraw(worldPoint);
  const endAnchor = newVectorPathAnchor(pattern, worldPoint, tool.startAnchor.nodeId);
  tool.drawing = false;
  tool.pointerId = null;
  const clearDraft = () => {
    tool.startAnchor = null;
    tool.draftWorldPoints = [];
  };
  if (endAnchor.nodeId && tool.startAnchor.nodeId && String(endAnchor.nodeId) === String(tool.startAnchor.nodeId)) {
    clearDraft();
    setStatus("Kontur başladığı bağlantı noktasında bitti. Daha uzun çizin veya farklı bir noktada bırakın.", "warn");
    draw();
    return false;
  }

  const drawnWorld = tool.draftWorldPoints.map((point) => [point.x, point.y]);
  drawnWorld[0] = [tool.startAnchor.worldPoint.x, tool.startAnchor.worldPoint.y];
  drawnWorld[drawnWorld.length - 1] = [endAnchor.worldPoint.x, endAnchor.worldPoint.y];
  const drawnLength = drawnWorld.slice(1).reduce((total, point, index) => (
    total + Math.hypot(point[0] - drawnWorld[index][0], point[1] - drawnWorld[index][1])
  ), 0);
  if (drawnWorld.length < 2 || drawnLength < 0.1) {
    clearDraft();
    setStatus("Yeni kontur çok kısa. Fareyi basılı tutarak daha uzun bir çizgi çizin.", "warn");
    draw();
    return false;
  }

  const sampleDistance = clamp(0.38 / Math.max(0.01, state.view.scale), 0.015, 0.12);
  const smoothedWorld = window.LaserVectorEdit?.fitOpenPolyline(drawnWorld, {
    minDistance: sampleDistance,
    tolerance: clamp(0.65 / Math.max(0.01, state.view.scale), 0.025, 0.14),
    passes: 1,
  });
  if (!smoothedWorld || smoothedWorld.length < 2) {
    clearDraft();
    setStatus("Çizilen kontur yumuşatılamadı.", "danger");
    draw();
    return false;
  }

  const sourcePoints = smoothedWorld.map((point) => clampPatternSourcePoint(
    pattern,
    patternSourcePointFromWorld(pattern, { x: point[0], y: point[1] })
  ));
  sourcePoints[0] = [...tool.startAnchor.sourcePoint];
  sourcePoints[sourcePoints.length - 1] = [...endAnchor.sourcePoint];
  try {
    const currentModel = patternVectorModel(pattern);
    if (!currentModel) throw new Error("Vektör graph modeli bulunamadı.");
    const reconciled = window.LaserVectorEdit?.reconcileVectorModel(currentModel, pattern.vectorPaths || []);
    if (!reconciled) throw new Error("Mevcut konturlar graph modeliyle eşleşmiyor; önce konturları geri alın.");
    const anchorPoint = window.LaserVectorEdit?.anchorPointToVectorModel;
    if (!anchorPoint) throw new Error("Kontur bağlantı motoru yüklenemedi; sayfayı yenileyin.");
    const snapTolerance = vectorSourceSnapDistance(pattern);
    const startAnchored = anchorPoint(reconciled.model, tool.startAnchor.sourcePoint, {
      nodeId: tool.startAnchor.nodeId,
      edgeId: tool.startAnchor.edgeId,
      snapTolerance,
      allowFree: true,
    });
    const endAnchored = anchorPoint(startAnchored.model, endAnchor.sourcePoint, {
      nodeId: endAnchor.nodeId,
      edgeId: endAnchor.edgeId,
      snapTolerance,
      allowFree: true,
    });
    if (String(startAnchored.nodeId) === String(endAnchored.nodeId)) {
      throw new Error("Başlangıç ve bitiş aynı bağlantı noktasına yapıştı; çizgiyi farklı bir noktada bitirin.");
    }
    sourcePoints[0] = [...startAnchored.sourcePoint];
    sourcePoints[sourcePoints.length - 1] = [...endAnchored.sourcePoint];
    const operation = tool.operation === "cut" ? "cut" : "engrave_line";
    const appended = window.LaserVectorEdit?.appendOpenPathToVectorModel(endAnchored.model, {
      id: uid("manual-contour"),
      points: sourcePoints,
      closed: false,
      operation,
      removed: false,
      locked: false,
      deformable: true,
      manualContour: true,
    }, {
      startNodeId: startAnchored.nodeId,
      endNodeId: endAnchored.nodeId,
      fallbackOperation: operation,
      name: "Elle çizilen kontur",
    });
    if (!appended?.model) throw new Error("Yeni kontur graph modeline eklenemedi.");
    const validation = window.LaserVectorEdit.compileVectorObjects(appended.model, { fallbackOperation: patternOperation(pattern) });
    if (validation.errors?.length) throw new Error(validation.errors[0]);

    pushUndo("Yeni kontur çiz");
    applyPatternVectorModel(pattern, appended.model);
    compilePatternVectorModel(pattern);
    clearDraft();
    select("pattern", pattern.id);
    updateJobAnalysisNow();
    const snappedCount = Number(startAnchored.snapped) + Number(endAnchored.snapped);
    const connectionText = snappedCount === 2
      ? "İki ucu da mevcut kontura bağlandı."
      : snappedCount === 1
        ? "Bir ucu mevcut kontura bağlandı; diğer uç serbest bırakıldı."
        : "İki uç da serbest bırakıldı.";
    setStatus(`Yeni kontur yumuşatılıp kaydedildi. ${connectionText} Çizmeye devam edebilir veya Bitir'e basabilirsiniz.`, "ok");
    return true;
  } catch (error) {
    clearDraft();
    setStatus(error.message || "Yeni kontur eklenemedi.", "danger");
    draw();
    return false;
  }
}

function finishVectorPathRedraw(worldPoint) {
  const tool = state.vectorRepairTool;
  const target = vectorRepairTarget();
  if (!target || !tool.drawing) return false;
  appendVectorPathRedraw(worldPoint);
  const nearest = nearestVectorPathSegment(target.worldPoints, worldPoint, Boolean(target.vectorPath.closed));
  tool.drawing = false;
  tool.pointerId = null;
  if (!nearest || nearest.distance > vectorRedrawSnapDistance()) {
    tool.startIndex = null;
    tool.startAnchor = null;
    tool.draftWorldPoints = [];
    setStatus("Çizimi bitirmek için fareyi seçili konturun üzerinde bırakın.", "warn");
    draw();
    return false;
  }
  const prepared = window.LaserVectorEdit?.preparePolylineAnchors(
    target.vectorPath.points,
    target.worldPoints.map((point) => [point.x, point.y]),
    Boolean(target.vectorPath.closed),
    tool.startAnchor,
    nearest
  );
  if (!prepared || tool.draftWorldPoints.length < 3) {
    tool.startIndex = null;
    tool.startAnchor = null;
    tool.draftWorldPoints = [];
    setStatus("Başlangıçtan farklı bir kontur noktasına kadar çizim yapın.", "warn");
    draw();
    return false;
  }

  const startMetric = prepared.metricPoints[prepared.startIndex];
  const endMetric = prepared.metricPoints[prepared.endIndex];
  const drawnWorld = tool.draftWorldPoints.map((point) => [point.x, point.y]);
  drawnWorld[0] = [...startMetric];
  drawnWorld[drawnWorld.length - 1] = [...endMetric];
  const sampleDistance = clamp(0.45 / Math.max(0.01, state.view.scale), 0.02, 0.16);
  const smoothedWorld = window.LaserVectorEdit?.fitOpenPolyline(drawnWorld, {
    minDistance: sampleDistance,
    tolerance: clamp(0.8 / Math.max(0.01, state.view.scale), 0.04, 0.18),
    passes: 1,
  });
  if (!smoothedWorld?.length) {
    tool.startIndex = null;
    tool.startAnchor = null;
    tool.draftWorldPoints = [];
    setStatus("Çizilen kontur yumuşatılamadı.", "danger");
    draw();
    return false;
  }
  const replacement = smoothedWorld.map((point) => patternSourcePointFromWorld(target.pattern, { x: point[0], y: point[1] }));
  replacement[0] = [...prepared.points[prepared.startIndex]];
  replacement[replacement.length - 1] = [...prepared.points[prepared.endIndex]];
  const nextPoints = window.LaserVectorEdit?.replacePolylineSection(
    prepared.points,
    prepared.metricPoints,
    Boolean(target.vectorPath.closed),
    prepared.startIndex,
    prepared.endIndex,
    replacement
  );
  if (!nextPoints) {
    tool.startIndex = null;
    tool.startAnchor = null;
    tool.draftWorldPoints = [];
    setStatus("Bu iki nokta arasında kontur değiştirilemedi.", "danger");
    draw();
    return false;
  }

  pushUndo("Konturu yeniden çiz");
  target.vectorPath.points = nextPoints;
  refreshVectorPathMetrics(target.vectorPath);
  cancelVectorRepairTool();
  draw();
  updateSelectionPanel();
  updateJobAnalysisNow();
  setStatus("Çizdiğiniz bölüm kontura yapıştırıldı ve otomatik yumuşatıldı.", "ok");
  return true;
}

function vectorObjectPolicyLabel(policy) {
  return {
    "emit-underlay": "Alt çizgiyi koru",
    "mask-underlay": "Nesne altında maskele",
    "cut-at-boundary": "Alt çizgiyi sınırda kes",
    "include-crossing": "Kesişen iç parçayı nesneye kat",
  }[policy] || "Alt çizgiyi koru";
}

function clampPatternSourcePoint(pattern, point) {
  const sourceWidth = Math.max(0.001, Number(pattern?.sourceWidth) || Number(pattern?.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern?.sourceHeight) || Number(pattern?.height) || 1);
  return [clamp(Number(point?.[0]) || 0, 0, sourceWidth), clamp(Number(point?.[1]) || 0, 0, sourceHeight)];
}

function vectorSourcePointToWorld(pattern, point) {
  return patternWorldPoint(pattern, vectorLocalPoint(pattern, point));
}

function vectorObjectToolRect() {
  const tool = state.vectorObjectTool;
  if (!tool.startSource || !tool.currentSource) return null;
  return {
    minX: Math.min(tool.startSource[0], tool.currentSource[0]),
    minY: Math.min(tool.startSource[1], tool.currentSource[1]),
    maxX: Math.max(tool.startSource[0], tool.currentSource[0]),
    maxY: Math.max(tool.startSource[1], tool.currentSource[1]),
  };
}

function cancelVectorObjectSeparation(message = "") {
  state.vectorObjectTool.active = false;
  state.vectorObjectTool.pending = false;
  state.vectorObjectTool.drawing = false;
  state.vectorObjectTool.patternId = null;
  state.vectorObjectTool.startSource = null;
  state.vectorObjectTool.currentSource = null;
  state.vectorObjectTool.pointerId = null;
  state.vectorObjectTool.review = null;
  state.vectorObjectTool.gateOverrides = {};
  canvas.style.cursor = "";
  if (message) setStatus(message, "warn");
}

function beginVectorObjectSeparation(pattern, policy = "emit-underlay", attachmentPolicy = "detached") {
  if (!vectorPatternHasPaths(pattern)) return;
  try {
    ensurePatternVectorModel(pattern);
  } catch (error) {
    setStatus(error.message, "danger");
    return;
  }
  cancelVectorRepairTool();
  cancelVectorRegionSelection();
  state.materialArea.drawing = false;
  state.materialArea.previewPoint = null;
  state.vectorObjectTool.active = true;
  state.vectorObjectTool.pending = false;
  state.vectorObjectTool.drawing = false;
  state.vectorObjectTool.patternId = pattern.id;
  state.vectorObjectTool.policy = ["emit-underlay", "mask-underlay", "cut-at-boundary", "include-crossing"].includes(policy) ? policy : "emit-underlay";
  state.vectorObjectTool.attachmentPolicy = ["detached", "pinned", "shared-joint"].includes(attachmentPolicy) ? attachmentPolicy : "detached";
  state.vectorObjectTool.gateOverrides = {};
  state.vectorObjectTool.startSource = null;
  state.vectorObjectTool.currentSource = null;
  state.vectorObjectTool.pointerId = null;
  state.vectorObjectTool.review = null;
  canvas.style.cursor = "crosshair";
  draw();
  setStatus(`Nesne Ayır: motifin çevresine dikdörtgen çizin. Politika: ${vectorObjectPolicyLabel(state.vectorObjectTool.policy)}. Esc iptal eder.`, "info");
}

async function requestSemanticVectorPreview(pattern, request, metadata = {}) {
  const tool = state.vectorObjectTool;
  const previousReview = tool.review;
  try {
    ensurePatternVectorModel(pattern);
    syncPatternVectorModelFromPaths(pattern);
    const revision = Number(pattern.vectorGraph?.revision) || 0;
    tool.pending = true;
    tool.review = previousReview;
    canvas.style.cursor = "wait";
    setStatus("Edge graph-cut hesaplanıyor...", "info");
    const response = await api("/api/analyze-vector-separation", {
      graphRevision: revision,
      patternId: pattern.id,
      foregroundEdgeIds: request.foregroundEdgeIds || [],
      backgroundEdgeIds: request.backgroundEdgeIds || [],
      gateOverrides: tool.gateOverrides || {},
      vectorModel: patternVectorModel(pattern),
    });
    const separation = response.separation || {};
    const proposal = (pattern.objectProposals || []).find((item) => String(item.id) === String(separation.proposalId || metadata.proposalId || ""));
    const result = window.LaserVectorEdit.separateVectorModelByEdgeIds(
      patternVectorModel(pattern),
      separation.foregroundEdgeIds || [],
      {
        graphRevision: separation.graphRevision,
        gateNodeIds: separation.cutGates || proposal?.gateNodeIds || [],
        name: metadata.name || proposal?.name || "Yapısal nesne",
        proposalId: separation.proposalId || proposal?.id || metadata.proposalId || "seed-only",
        confidence: separation.confidence,
        crossingEdges: Number(metadata.crossingEdges) || 0,
        fallbackOperation: patternOperation(pattern),
        attachmentPolicy: tool.attachmentPolicy,
        manufacturingPolicy: tool.policy,
      }
    );
    const separatedObject = (result.model.vectorObjects || []).find((item) => String(item.id) === String(result.objectId));
    const resolvedAttachmentPolicy = separatedObject?.attachmentPolicy || "detached";
    const policyWarnings = [...(separation.warnings || [])];
    if (tool.attachmentPolicy !== "detached" && resolvedAttachmentPolicy === "detached") {
      policyWarnings.push("Bu ayrımda bağlantı gate'i bulunamadığı için nesne Serbest olarak oluşturulacak.");
    }
    tool.attachmentPolicy = resolvedAttachmentPolicy;
    tool.pending = false;
    tool.review = {
      model: result.model,
      objectId: result.objectId,
      stats: result.stats,
      graphRevision: revision,
      edgeIds: [...(separation.foregroundEdgeIds || [])],
      gateNodeIds: [...(separation.cutGates || [])],
      candidateGateNodeIds: [...new Set([...(separation.candidateGateNodeIds || []), ...(previousReview?.candidateGateNodeIds || [])])],
      gateOverrides: { ...(separation.gateOverrides || tool.gateOverrides || {}) },
      seedForegroundEdgeIds: [...(request.foregroundEdgeIds || [])],
      seedBackgroundEdgeIds: [...(request.backgroundEdgeIds || [])],
      proposalId: separation.proposalId || metadata.proposalId || "seed-only",
      name: metadata.name || proposal?.name || "Yapısal nesne",
      crossingEdges: Number(metadata.crossingEdges) || 0,
      confidence: Number(separation.confidence) || 0,
      semantic: true,
      attachmentPolicy: resolvedAttachmentPolicy,
      warnings: policyWarnings,
    };
    tool.gateOverrides = { ...tool.review.gateOverrides };
    canvas.style.cursor = "default";
    updateSelectionPanel();
    draw();
    const warningText = policyWarnings.length ? ` ${policyWarnings[0]}` : "";
    setStatus(`Graph-cut önizlemesi: ${result.stats.selectedEdges} edge · ${result.stats.gateCount} kesilen gate · güven %${Math.round((Number(separation.confidence) || 0) * 100)}.${warningText}`, policyWarnings.length ? "warn" : "info");
    return true;
  } catch (error) {
    tool.pending = false;
    tool.review = previousReview || null;
    canvas.style.cursor = "";
    updateSelectionPanel();
    draw();
    setStatus(error.message || "Yapısal öneri doğrulanamadı.", "danger");
    return false;
  }
}

async function previewSemanticVectorProposal(pattern, proposalId, policy = "emit-underlay", attachmentPolicy = "detached") {
  if (!pattern || !proposalId) return false;
  try {
    ensurePatternVectorModel(pattern);
  } catch (error) {
    setStatus(error.message || "Vektör nesne modeli hazırlanamadı.", "danger");
    return false;
  }
  if (policy === "cut-at-boundary") {
    setStatus("Sınırda fiziksel bölme için Tuvalde Alan Çiz aracını kullanın. Yapısal önerilerde Altından devam veya Maskele seçilebilir.", "warn");
    return false;
  }
  const proposal = (pattern.objectProposals || []).find((item) => String(item.id) === String(proposalId));
  if (!proposal) {
    setStatus("Yapısal öneri artık geçerli değil; vektörü yeniden analiz edin.", "danger");
    return false;
  }
  const revision = Number(pattern.vectorGraph?.revision) || 0;
  if (Number(proposal.graphRevision) !== revision) {
    setStatus("Graph değişti; yapısal öneri yeniden hesaplanmalı.", "warn");
    return false;
  }
  cancelVectorRepairTool();
  cancelVectorRegionSelection();
  state.vectorObjectTool.active = true;
  state.vectorObjectTool.pending = false;
  state.vectorObjectTool.drawing = false;
  state.vectorObjectTool.patternId = pattern.id;
  state.vectorObjectTool.policy = ["emit-underlay", "mask-underlay", "cut-at-boundary"].includes(policy) ? policy : "emit-underlay";
  state.vectorObjectTool.attachmentPolicy = ["detached", "pinned", "shared-joint"].includes(attachmentPolicy) ? attachmentPolicy : "detached";
  state.vectorObjectTool.gateOverrides = {};
  state.vectorObjectTool.startSource = null;
  state.vectorObjectTool.currentSource = null;
  state.vectorObjectTool.review = null;
  return requestSemanticVectorPreview(pattern, { foregroundEdgeIds: proposal.edgeIds || [], backgroundEdgeIds: [] }, {
    proposalId: proposal.id,
    name: proposal.name || "Kompakt motif",
  });
}

async function toggleVectorObjectGate(pattern, nodeId) {
  const tool = state.vectorObjectTool;
  const review = tool.review;
  if (!pattern || !review || tool.pending) return false;
  const previous = tool.gateOverrides?.[nodeId];
  const currentlyCut = review.gateNodeIds.includes(nodeId) && previous !== "keep";
  tool.gateOverrides = { ...(tool.gateOverrides || {}), [nodeId]: currentlyCut ? "keep" : "cut" };
  const ok = await requestSemanticVectorPreview(pattern, {
    foregroundEdgeIds: review.seedForegroundEdgeIds || [],
    backgroundEdgeIds: review.seedBackgroundEdgeIds || [],
  }, {
    proposalId: review.proposalId,
    name: review.name,
    crossingEdges: review.crossingEdges,
  });
  if (!ok) {
    tool.gateOverrides = { ...(tool.gateOverrides || {}) };
    if (previous === undefined) delete tool.gateOverrides[nodeId];
    else tool.gateOverrides[nodeId] = previous;
    updateSelectionPanel();
    draw();
  }
  return ok;
}

function drawVectorObjectTool() {
  const tool = state.vectorObjectTool;
  const pattern = patternById(tool.patternId);
  if (!tool.active || !pattern) return;
  const palette = canvasPalette();
  const current = tool.currentSource;
  ctx.save();
  if (current && !tool.startSource) {
    const screen = worldToScreen(vectorSourcePointToWorld(pattern, current));
    ctx.strokeStyle = palette.selection;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x - 10, screen.y);
    ctx.lineTo(screen.x + 10, screen.y);
    ctx.moveTo(screen.x, screen.y - 10);
    ctx.lineTo(screen.x, screen.y + 10);
    ctx.stroke();
  }
  if (tool.review?.semantic && Array.isArray(tool.review.edgeIds)) {
    const edgeIds = new Set(tool.review.edgeIds.map(String));
    for (const edge of pattern.vectorGraph?.edges || []) {
      if (!edgeIds.has(String(edge.id))) continue;
      const worldPoints = (edge.points || []).map((point) => vectorSourcePointToWorld(pattern, point));
      if (edge.closed && worldPoints.length > 1) worldPoints.push(worldPoints[0]);
      strokeWorldPolyline(worldPoints, palette.success, 3, 0.95);
    }
    const gateIds = new Set((tool.review.gateNodeIds || []).map(String));
    const candidateGateIds = new Set((tool.review.candidateGateNodeIds || tool.review.gateNodeIds || []).map(String));
    for (const node of pattern.vectorGraph?.nodes || []) {
      const nodeId = String(node.id);
      if (!candidateGateIds.has(nodeId)) continue;
      const screen = worldToScreen(vectorSourcePointToWorld(pattern, node.position));
      const kept = tool.review.gateOverrides?.[nodeId] === "keep";
      const cut = gateIds.has(nodeId) && !kept;
      ctx.fillStyle = palette.panel;
      ctx.strokeStyle = kept ? palette.success : cut ? palette.warning : palette.selection;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = "700 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(kept ? "K" : "X", screen.x, screen.y + 0.5);
    }
    const label = `Graph-cut · ${edgeIds.size} edge · ${gateIds.size} gate · güven %${Math.round((Number(tool.review.confidence) || 0) * 100)}`;
    ctx.font = "700 11px Segoe UI";
    const labelWidth = ctx.measureText(label).width + 16;
    const labelX = clamp(12, 4, Math.max(4, state.view.width - labelWidth - 4));
    const labelY = 12;
    ctx.fillStyle = palette.panel;
    ctx.fillRect(labelX, labelY, labelWidth, 22);
    ctx.strokeStyle = palette.success;
    ctx.strokeRect(labelX + 0.5, labelY + 0.5, labelWidth - 1, 21);
    ctx.fillStyle = palette.text;
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX + 8, labelY + 11);
    ctx.restore();
    return;
  }
  const rect = vectorObjectToolRect();
  if (!rect) {
    ctx.restore();
    return;
  }
  const corners = [
    [rect.minX, rect.minY],
    [rect.maxX, rect.minY],
    [rect.maxX, rect.maxY],
    [rect.minX, rect.maxY],
  ].map((point) => worldToScreen(vectorSourcePointToWorld(pattern, point)));
  ctx.beginPath();
  corners.forEach((point, index) => {
    if (!index) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = colorWithAlpha(palette.selection, 0.08);
  ctx.fill();
  ctx.strokeStyle = palette.selection;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed || !(vectorPath.points || []).length) continue;
    const fragments = window.LaserVectorEdit.splitPolylineByRect(vectorPath.points, Boolean(vectorPath.closed), rect);
    const hasInside = fragments.some((fragment) => fragment.inside);
    if (!hasInside) continue;
    const hasOutside = fragments.some((fragment) => !fragment.inside);
    const worldPoints = vectorWorldPath(pattern, vectorPath);
    if (vectorPath.closed && worldPoints.length > 1) worldPoints.push(worldPoints[0]);
    strokeWorldPolyline(worldPoints, hasOutside ? palette.warning : palette.success, hasOutside ? 2.2 : 2.8, 0.92);
  }

  const matrix = pattern.sourceToDesign?.matrix || [
    Number(pattern.width) / Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width)), 0, 0,
    -Number(pattern.height) / Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height)), 0, Number(pattern.height),
  ];
  const first = window.LaserVectorEdit.affinePoint(matrix, [rect.minX, rect.minY]);
  const second = window.LaserVectorEdit.affinePoint(matrix, [rect.maxX, rect.maxY]);
  const reviewPrefix = tool.review ? "Önizleme · " : "";
  const label = `${reviewPrefix}${Math.abs(second[0] - first[0]).toFixed(1)} × ${Math.abs(second[1] - first[1]).toFixed(1)} mm · ${vectorObjectPolicyLabel(tool.policy)}`;
  ctx.font = "700 11px Segoe UI";
  const labelWidth = ctx.measureText(label).width + 16;
  const labelX = clamp(Math.min(...corners.map((point) => point.x)), 4, Math.max(4, state.view.width - labelWidth - 4));
  const labelY = clamp(Math.min(...corners.map((point) => point.y)) - 27, 4, Math.max(4, state.view.height - 26));
  ctx.fillStyle = palette.panel;
  ctx.fillRect(labelX, labelY, labelWidth, 22);
  ctx.strokeStyle = palette.selection;
  ctx.strokeRect(labelX + 0.5, labelY + 0.5, labelWidth - 1, 21);
  ctx.fillStyle = palette.text;
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelX + 8, labelY + 11);
  ctx.restore();
}

async function finishVectorObjectSeparation() {
  const tool = state.vectorObjectTool;
  const pattern = patternById(tool.patternId);
  const rect = vectorObjectToolRect();
  if (!pattern || !rect) {
    cancelVectorObjectSeparation("Nesne ayırma iptal edildi.");
    draw();
    return false;
  }
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  if ((rect.maxX - rect.minX) / sourceWidth < 0.005 || (rect.maxY - rect.minY) / sourceHeight < 0.005) {
    tool.drawing = false;
    tool.startSource = null;
    setStatus("Seçim çok küçük. Motifin çevresinde daha geniş bir dikdörtgen çizin.", "warn");
    draw();
    return false;
  }
  try {
    tool.pending = true;
    canvas.style.cursor = "wait";
    syncPatternVectorModelFromPaths(pattern);
    const model = patternVectorModel(pattern);
    const rectSelection = window.LaserVectorEdit.edgeIdsInRect(model, rect);
    if (!rectSelection.edgeIds.length) throw new Error("Seçim hiçbir graph edge'ine temas etmiyor.");
    if (tool.policy === "emit-underlay" || tool.policy === "mask-underlay") {
      tool.pending = false;
      tool.gateOverrides = {};
      const foregroundEdgeIds = rectSelection.completeEdgeIds.length
        ? rectSelection.completeEdgeIds
        : rectSelection.edgeIds;
      return requestSemanticVectorPreview(pattern, { foregroundEdgeIds, backgroundEdgeIds: [] }, {
        proposalId: "lasso-seed",
        name: "Alanla ayrılan nesne",
        crossingEdges: rectSelection.crossingEdgeIds.length,
      });
    }
    const result = window.LaserVectorEdit.separateVectorModelByRect(model, rect, {
      policy: tool.policy,
      fallbackOperation: patternOperation(pattern),
    });
    tool.pending = false;
    tool.review = {
      model: result.model,
      objectId: result.objectId,
      stats: result.stats,
      graphRevision: Number(pattern.vectorGraph?.revision) || 0,
      edgeIds: null,
      gateNodeIds: [],
      candidateGateNodeIds: [],
      gateOverrides: {},
      confidence: 1,
      semantic: false,
      warnings: [],
    };
    canvas.style.cursor = "default";
    updateSelectionPanel();
    draw();
    setStatus(
      `Nesne ayırma önizlemesi: ${result.stats.selectedEdges} kontur · ${result.stats.crossingEdges} kesişen yol · ${result.stats.hiddenFragments} gizlenen alt parça. Onaylamadan model değişmez.`,
      "info"
    );
    return true;
  } catch (error) {
    tool.pending = false;
    tool.drawing = false;
    tool.startSource = null;
    setStatus(error.message === "selection contains no complete vector object"
      ? "Seçimin içinde bütünüyle kalan kontur yok. Alanı genişletin veya 'Kesişen iç parçayı nesneye kat' politikasını seçin."
      : error.message, "danger");
    draw();
    return false;
  }
}

function commitVectorObjectSeparation() {
  const tool = state.vectorObjectTool;
  const pattern = patternById(tool.patternId);
  const review = tool.review;
  if (!pattern || !review) {
    setStatus("Onaylanacak nesne ayırma önizlemesi yok.", "warn");
    return false;
  }
  if ((Number(pattern.vectorGraph?.revision) || 0) !== Number(review.graphRevision)) {
    tool.review = null;
    tool.startSource = null;
    tool.currentSource = null;
    canvas.style.cursor = "crosshair";
    updateSelectionPanel();
    draw();
    setStatus("Vektör modeli önizlemeden sonra değişti. Alanı yeniden çizin.", "warn");
    return false;
  }
  pushUndo("Vektör nesnesi ayır");
  applyPatternVectorModel(pattern, review.model);
  compilePatternVectorModel(pattern);
  const objectId = review.objectId;
  const stats = review.stats;
  cancelVectorObjectSeparation();
  select("vectorObject", pattern.id, { objectId });
  updateJobAnalysisNow();
  setStatus(
    `Nesne ayrıldı: ${stats.selectedEdges} kontur · ${stats.crossingEdges} kesişen yol · ${stats.hiddenFragments} gizlenen alt parça.`,
    "ok"
  );
  return true;
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

function vectorMarqueeWorldRect(drag = state.drag) {
  const start = drag?.startWorld;
  const current = drag?.currentWorld || start;
  if (!start || !current) return null;
  return {
    minX: Math.min(start.x, current.x),
    minY: Math.min(start.y, current.y),
    maxX: Math.max(start.x, current.x),
    maxY: Math.max(start.y, current.y),
  };
}

function vectorMarqueeSelectionRegion(drag, items) {
  if (!drag || drag.selectionMode !== "replace" || !(items || []).length) return null;
  const patternIds = [...new Set(items.map((item) => String(item.patternId || "")))];
  if (patternIds.length !== 1) return null;
  const pattern = patternById(patternIds[0]);
  const worldRect = vectorMarqueeWorldRect(drag);
  if (!pattern || !worldRect) return null;
  const sourceCorners = [
    { x: worldRect.minX, y: worldRect.minY },
    { x: worldRect.maxX, y: worldRect.minY },
    { x: worldRect.maxX, y: worldRect.maxY },
    { x: worldRect.minX, y: worldRect.maxY },
  ].map((point) => patternSourcePointFromWorld(pattern, point));
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const sourceRect = {
    minX: clamp(Math.min(...sourceCorners.map((point) => point[0])), 0, sourceWidth),
    minY: clamp(Math.min(...sourceCorners.map((point) => point[1])), 0, sourceHeight),
    maxX: clamp(Math.max(...sourceCorners.map((point) => point[0])), 0, sourceWidth),
    maxY: clamp(Math.max(...sourceCorners.map((point) => point[1])), 0, sourceHeight),
  };
  if (sourceRect.maxX - sourceRect.minX <= 1e-6 || sourceRect.maxY - sourceRect.minY <= 1e-6) return null;
  return {
    patternId: String(pattern.id),
    worldRect: { ...worldRect },
    sourceRect,
    pathIds: items.map((item) => String(item.pathId)).sort(),
  };
}

function createVectorMarqueeCandidates() {
  const candidates = [];
  for (const pattern of state.patterns) {
    if (!vectorPatternHasPaths(pattern)) continue;
    for (const vectorPath of pattern.vectorPaths || []) {
      if (vectorPath.removed || (vectorPath.points || []).length < 2) continue;
      const sourceBounds = (vectorPath.bbox || []).length === 4
        ? { minX: Number(vectorPath.bbox[0]), minY: Number(vectorPath.bbox[1]), maxX: Number(vectorPath.bbox[2]), maxY: Number(vectorPath.bbox[3]) }
        : vectorPathBounds(vectorPath);
      if (!sourceBounds) continue;
      const worldCorners = [
        [sourceBounds.minX, sourceBounds.minY],
        [sourceBounds.maxX, sourceBounds.minY],
        [sourceBounds.maxX, sourceBounds.maxY],
        [sourceBounds.minX, sourceBounds.maxY],
      ].map((point) => patternWorldPoint(pattern, vectorLocalPoint(pattern, point)));
      const bounds = boundsFromPoints(worldCorners);
      if (!bounds) continue;
      candidates.push({
        patternId: pattern.id,
        pathId: vectorPath.id,
        closed: Boolean(vectorPath.closed),
        pattern,
        vectorPath,
        points: null,
        bounds,
      });
    }
  }
  return candidates;
}

function vectorMarqueeBoundsOverlap(first, second) {
  return first.maxX >= second.minX && first.minX <= second.maxX && first.maxY >= second.minY && first.minY <= second.maxY;
}

function vectorMarqueeHitItems(drag) {
  const rect = vectorMarqueeWorldRect(drag);
  if (!rect || rect.maxX - rect.minX <= 1e-6 || rect.maxY - rect.minY <= 1e-6) return [];
  const intersects = window.LaserVectorEdit?.polylineIntersectsRect;
  return (drag.candidates || [])
    .filter((candidate) => vectorMarqueeBoundsOverlap(candidate.bounds, rect))
    .filter((candidate) => {
      if (!intersects) return true;
      if (!candidate.points) {
        candidate.points = vectorWorldPath(candidate.pattern, candidate.vectorPath)
          .map((point) => [Number(point.x), Number(point.y)]);
      }
      return intersects(candidate.points, candidate.closed, rect);
    })
    .map((candidate) => ({ patternId: candidate.patternId, pathId: candidate.pathId }));
}

function combineVectorMarqueeItems(baseItems, hitItems, mode) {
  const combined = new Map();
  for (const item of baseItems || []) combined.set(vectorPathSelectionKey(item.patternId, item.pathId), item);
  if (mode === "replace") combined.clear();
  for (const item of hitItems || []) {
    const key = vectorPathSelectionKey(item.patternId, item.pathId);
    if (mode === "toggle" && combined.has(key)) combined.delete(key);
    else combined.set(key, item);
  }
  return [...combined.values()];
}

function updateVectorMarqueePreview(drag) {
  const movedPixels = Math.hypot(
    Number(drag.currentScreen?.x) - Number(drag.startScreen?.x),
    Number(drag.currentScreen?.y) - Number(drag.startScreen?.y),
  );
  const hitItems = movedPixels >= 3 ? vectorMarqueeHitItems(drag) : [];
  drag.previewItems = combineVectorMarqueeItems(drag.baseItems, hitItems, drag.selectionMode);
  drag.hitCount = hitItems.length;
  setVectorPathPreview(drag.previewItems);
}

function objectMarqueeHitItems(drag) {
  const rect = vectorMarqueeWorldRect(drag);
  if (!rect || rect.maxX - rect.minX <= 1e-6 || rect.maxY - rect.minY <= 1e-6) return [];
  const patterns = state.patterns
    .map((pattern) => ({ type: "pattern", id: pattern.id, bounds: patternBounds(pattern) }))
    .filter((item) => item.bounds && vectorMarqueeBoundsOverlap(item.bounds, rect));
  if (patterns.length) return patterns.map(({ type, id }) => ({ type, id }));
  return state.placements
    .map((placement) => ({ type: "placement", id: placement.id, bounds: placementBounds(placement) }))
    .filter((item) => item.bounds && vectorMarqueeBoundsOverlap(item.bounds, rect))
    .map(({ type, id }) => ({ type, id }));
}

function combineObjectMarqueeItems(baseItems, hitItems, mode) {
  const normalizedBase = uniqueSelectionItems(baseItems);
  const normalizedHits = uniqueSelectionItems(hitItems);
  const targetType = normalizedHits[0]?.type || normalizedBase[0]?.type || "";
  const combined = new Map();
  for (const item of normalizedBase.filter((entry) => !targetType || entry.type === targetType)) {
    combined.set(selectionKey(item), item);
  }
  if (mode === "replace") combined.clear();
  for (const item of normalizedHits) {
    const key = selectionKey(item);
    if (mode === "toggle" && combined.has(key)) combined.delete(key);
    else combined.set(key, item);
  }
  return [...combined.values()];
}

function updateObjectMarqueePreview(drag) {
  const movedPixels = Math.hypot(
    Number(drag.currentScreen?.x) - Number(drag.startScreen?.x),
    Number(drag.currentScreen?.y) - Number(drag.startScreen?.y),
  );
  const hitItems = movedPixels >= 3 ? objectMarqueeHitItems(drag) : [];
  drag.previewItems = combineObjectMarqueeItems(drag.baseItems, hitItems, drag.selectionMode);
  drag.hitCount = hitItems.length;
}

function drawSelectionMarqueeFrame(drag, label) {
  if (!drag?.startScreen || !drag.currentScreen) return;
  const palette = canvasPalette();
  const x = Math.min(drag.startScreen.x, drag.currentScreen.x);
  const y = Math.min(drag.startScreen.y, drag.currentScreen.y);
  const width = Math.abs(drag.currentScreen.x - drag.startScreen.x);
  const height = Math.abs(drag.currentScreen.y - drag.startScreen.y);

  ctx.save();
  ctx.fillStyle = colorWithAlpha(palette.selection, 0.12);
  ctx.strokeStyle = palette.selection;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  ctx.setLineDash([]);
  ctx.font = "600 12px Segoe UI, sans-serif";
  const labelWidth = Math.ceil(ctx.measureText(label).width) + 16;
  const labelX = clamp(x, 6, Math.max(6, state.view.width - labelWidth - 6));
  const labelY = y >= 30 ? y - 26 : Math.min(state.view.height - 26, y + height + 6);
  ctx.fillStyle = colorWithAlpha(palette.text, 0.92);
  ctx.fillRect(labelX, labelY, labelWidth, 22);
  ctx.fillStyle = palette.panel;
  ctx.fillText(label, labelX + 8, labelY + 15);
  ctx.restore();
}

function drawVectorSelectionMarquee() {
  const drag = state.drag;
  if (drag?.mode !== "vectorMarquee") return;
  const worldRect = vectorMarqueeWorldRect(drag);
  const worldWidth = Math.max(0, Number(worldRect?.maxX) - Number(worldRect?.minX));
  const worldHeight = Math.max(0, Number(worldRect?.maxY) - Number(worldRect?.minY));
  drawSelectionMarqueeFrame(
    drag,
    `${worldWidth.toFixed(1)} × ${worldHeight.toFixed(1)} mm · ${(drag.previewItems || []).length} kontur`
  );
}

function drawObjectSelectionMarquee() {
  const drag = state.drag;
  if (drag?.mode !== "objectMarquee") return;
  const palette = canvasPalette();
  ctx.save();
  for (const item of drag.previewItems || []) {
    if (item.type === "pattern") {
      const pattern = patternById(item.id);
      if (pattern) drawPatternSelectionOutline(pattern);
      continue;
    }
    const placement = placementById(item.id);
    if (!placement) continue;
    const bounds = placementBounds(placement);
    const topLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY });
    const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.minY });
    ctx.strokeStyle = palette.selection;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  }
  ctx.restore();
  const worldRect = vectorMarqueeWorldRect(drag);
  const worldWidth = Math.max(0, Number(worldRect?.maxX) - Number(worldRect?.minX));
  const worldHeight = Math.max(0, Number(worldRect?.maxY) - Number(worldRect?.minY));
  drawSelectionMarqueeFrame(
    drag,
    `${worldWidth.toFixed(1)} × ${worldHeight.toFixed(1)} mm · ${(drag.previewItems || []).length} nesne`
  );
}

const vectorFillNestingCache = new WeakMap();

function classifiedVectorFillPaths(pattern, fillPaths) {
  const cached = vectorFillNestingCache.get(pattern);
  const unchanged = cached
    && cached.paths.length === fillPaths.length
    && cached.paths.every((entry, index) => {
      const path = fillPaths[index];
      const points = path?.points || [];
      return entry.path === path
        && entry.points === points
        && entry.length === points.length
        && entry.area === Number(path.area || 0)
        && entry.firstX === Number(points[0]?.[0] || 0)
        && entry.firstY === Number(points[0]?.[1] || 0)
        && entry.lastX === Number(points[points.length - 1]?.[0] || 0)
        && entry.lastY === Number(points[points.length - 1]?.[1] || 0);
    });
  if (unchanged) return cached.classified;
  const classified = window.LaserVectorEdit.classifyClosedPathNesting(fillPaths);
  vectorFillNestingCache.set(pattern, {
    paths: fillPaths.map((path) => ({
      path,
      points: path.points,
      length: (path.points || []).length,
      area: Number(path.area || 0),
      firstX: Number(path.points?.[0]?.[0] || 0),
      firstY: Number(path.points?.[0]?.[1] || 0),
      lastX: Number(path.points?.[(path.points || []).length - 1]?.[0] || 0),
      lastY: Number(path.points?.[(path.points || []).length - 1]?.[1] || 0),
    })),
    classified,
  });
  return classified;
}

function drawVectorFillShape(pattern, alpha = 1) {
  const palette = canvasPalette();
  const fillPaths = (pattern.vectorPaths || []).filter((vectorPath) => (
    vectorPathIsActive(vectorPath, pattern)
    && vectorPathOperation(vectorPath, pattern) === "engrave_fill"
    && vectorPath.closed
  ));
  if (!fillPaths.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const inverted = vectorPatternFillInvert(pattern);
  if (inverted) {
    const corners = patternCorners(pattern).map(worldToScreen);
    corners.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
  }
  const classified = classifiedVectorFillPaths(pattern, fillPaths);
  for (const entry of classified) {
    const wantsPositiveArea = entry.depth % 2 === 0;
    const pointsSource = (entry.signedArea > 0) === wantsPositiveArea
      ? entry.polygon
      : [...entry.polygon].reverse();
    const points = pointsSource
      .map((point) => patternWorldPoint(pattern, vectorLocalPoint(pattern, point)))
      .map(worldToScreen);
    if (points.length < 3) continue;
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
  }
  ctx.fillStyle = colorWithAlpha(palette.engraveFill, 0.58);
  ctx.fill(inverted ? "evenodd" : "nonzero");
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
    const selectedPath = vectorPathSelectedForCanvas(pattern, vectorPath);
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

function vectorStrokeColor(palette, operation, selectedPath) {
  if (selectedPath) return palette.selection;
  if (operation === "cut") return palette.cut;
  if (operation === "ignore") return palette.ignored;
  if (operation === "engrave_fill") return palette.engraveFill;
  return palette.engraveLine;
}

function vectorPathSelectedForCanvas(pattern, vectorPath) {
  const pathKey = vectorPathSelectionKey(pattern?.id, vectorPath?.id);
  if (state.drag?.mode === "vectorMarquee") return previewVectorPathKeys.has(pathKey);
  if (selectedVectorPathKeys.has(pathKey) || previewVectorPathKeys.has(pathKey)) return true;
  if (state.selected?.id !== pattern?.id) return false;
  if (state.selected.type === "vectorPath") return state.selected.pathId === vectorPath?.id;
  if (state.selected.type === "vectorObject") {
    return String(state.selected.objectId || "") === String(vectorPath?.objectId || vectorPath?.provenance?.objectId || "");
  }
  return false;
}

function createInteractionVectorBitmap(pattern) {
  if (!vectorPatternHasPaths(pattern)) return null;
  const sourceWidth = Math.max(1, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(1, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const displayedMax = Math.max(pattern.width, pattern.height) * Math.max(0.001, state.view.scale);
  const bitmapMax = clamp(Math.round(displayedMax), 480, 2400);
  const bitmapScale = bitmapMax / Math.max(sourceWidth, sourceHeight);
  const bitmap = document.createElement("canvas");
  bitmap.width = Math.max(1, Math.round(sourceWidth * bitmapScale));
  bitmap.height = Math.max(1, Math.round(sourceHeight * bitmapScale));
  const bitmapContext = bitmap.getContext("2d");
  if (!bitmapContext) return null;

  const palette = canvasPalette();
  const pointCount = vectorPatternPointCount(pattern);
  const stride = Math.max(1, Math.ceil(pointCount / 24000));
  const appendPoint = (point, first) => {
    const x = Number(point[0]) * bitmapScale;
    const y = Number(point[1]) * bitmapScale;
    if (first) bitmapContext.moveTo(x, y);
    else bitmapContext.lineTo(x, y);
  };

  const fillPaths = (pattern.vectorPaths || []).filter((vectorPath) => (
    vectorPathIsActive(vectorPath, pattern)
    && vectorPathOperation(vectorPath, pattern) === "engrave_fill"
    && vectorPath.closed
  ));
  if (fillPaths.length) {
    const inverted = vectorPatternFillInvert(pattern);
    bitmapContext.beginPath();
    if (inverted) bitmapContext.rect(0, 0, bitmap.width, bitmap.height);
    for (const entry of classifiedVectorFillPaths(pattern, fillPaths)) {
      const wantsPositiveArea = entry.depth % 2 === 0;
      const points = (entry.signedArea > 0) === wantsPositiveArea
        ? entry.polygon
        : [...entry.polygon].reverse();
      if (points.length < 3) continue;
      appendPoint(points[0], true);
      let lastIndex = 0;
      for (let index = stride; index < points.length; index += stride) {
        appendPoint(points[index], false);
        lastIndex = index;
      }
      if (lastIndex !== points.length - 1) appendPoint(points[points.length - 1], false);
      bitmapContext.closePath();
    }
    bitmapContext.fillStyle = colorWithAlpha(palette.engraveFill, 0.42);
    bitmapContext.fill(inverted ? "evenodd" : "nonzero");
  }

  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed) continue;
    const points = vectorPath.points || [];
    if (points.length < 2) continue;
    const operation = vectorPathOperation(vectorPath, pattern);
    const selectedPath = vectorPathSelectedForCanvas(pattern, vectorPath);
    bitmapContext.beginPath();
    appendPoint(points[0], true);
    let lastIndex = 0;
    for (let index = stride; index < points.length; index += stride) {
      appendPoint(points[index], false);
      lastIndex = index;
    }
    if (lastIndex !== points.length - 1) appendPoint(points[points.length - 1], false);
    if (vectorPath.closed) bitmapContext.closePath();
    bitmapContext.strokeStyle = vectorStrokeColor(palette, operation, selectedPath);
    bitmapContext.lineWidth = selectedPath ? 2.6 : operation === "cut" ? 1.6 : 1.4;
    bitmapContext.setLineDash(operation === "ignore" ? [6, 4] : []);
    bitmapContext.stroke();
  }
  bitmapContext.setLineDash([]);
  bitmap.vectorPreviewResolution = bitmapMax;
  return bitmap;
}

function interactionVectorBitmap(pattern) {
  if (!canvasInteraction) return null;
  if (!canvasInteraction.vectorBitmaps) canvasInteraction.vectorBitmaps = new Map();
  const displayedMax = Math.max(pattern.width, pattern.height) * Math.max(0.001, state.view.scale);
  const desiredResolution = clamp(Math.round(displayedMax), 480, 2400);
  const cached = canvasInteraction.vectorBitmaps.get(pattern.id);
  if (cached && Number(cached.vectorPreviewResolution || 0) >= desiredResolution * 0.8) {
    return cached;
  }
  const bitmap = createInteractionVectorBitmap(pattern);
  canvasInteraction.vectorBitmaps.set(pattern.id, bitmap);
  return bitmap;
}

function drawAffineVectorStrokes(pattern, stride = 1, alpha = 1) {
  const palette = canvasPalette();
  const affine = vectorScreenAffine(pattern);
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed) continue;
    const points = vectorPath.points || [];
    if (points.length < 2) continue;
    const operation = vectorPathOperation(vectorPath, pattern);
    const selectedPath = vectorPathSelectedForCanvas(pattern, vectorPath);
    if (!appendAffineVectorPath(points, affine, stride, Boolean(vectorPath.closed))) continue;
    ctx.strokeStyle = vectorStrokeColor(palette, operation, selectedPath);
    ctx.lineWidth = selectedPath ? 2.6 : operation === "cut" ? 1.6 : 1.4;
    ctx.setLineDash(operation === "ignore" ? [6, 4] : []);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawFastVectorPattern(pattern) {
  const bitmap = interactionVectorBitmap(pattern);
  if (bitmap) {
    drawWithPatternClip(pattern, () => drawTransformedPatternImage(pattern, bitmap, 0.96));
    return;
  }
  const sourceImage = state.images.get(pattern.id);
  if (sourceImage && sourceImage.complete) {
    drawWithPatternClip(pattern, () => drawTransformedPatternImage(pattern, sourceImage, 0.32));
    return;
  }
  const pointCount = vectorPatternPointCount(pattern);
  const stride = Math.max(1, Math.ceil(pointCount / 1800));
  const clipRegion = patternClipRegion(pattern);
  if (!clipRegion) {
    drawAffineVectorStrokes(pattern, stride, 0.9);
    return;
  }
  ctx.save();
  applyCanvasClipRegion(clipRegion);
  drawAffineVectorStrokes(pattern, stride, 0.9);
  eraseClipMarginBand(clipRegion);
  ctx.restore();
}

function drawVectorPattern(pattern) {
  const pointCount = vectorPatternPointCount(pattern);
  if (state.drag?.mode === "moveVectorPaths" && pointCount > 2500) {
    const stride = Math.max(1, Math.ceil(pointCount / 2400));
    drawAffineVectorStrokes(pattern, stride, 0.94);
    return;
  }
  const transformDrag = state.drag && !["vectorMarquee", "moveVectorPaths"].includes(state.drag.mode);
  if ((transformDrag || canvasInteraction) && pointCount > 2500) {
    drawFastVectorPattern(pattern);
    return;
  }
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

  if (!clipRegion && !filledPreview) {
    drawAffineVectorStrokes(pattern);
    return;
  }

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
    const selectedPath = vectorPathSelectedForCanvas(pattern, vectorPath);
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
  if (editableTextPattern(pattern)) return false;
  return Boolean(pattern?.vectorStats?.filledTraceInvert);
}

function patternTransformSnapshot(pattern) {
  if (!pattern) return null;
  return {
    x: Number(pattern.x) || 0,
    y: Number(pattern.y) || 0,
    width: Number(pattern.width) || 1,
    height: Number(pattern.height) || 1,
    rotation: Number(pattern.rotation) || 0,
    mirrorX: Boolean(pattern.mirrorX),
    mirrorY: Boolean(pattern.mirrorY),
    sourceWidth: pattern.sourceWidth,
    sourceHeight: pattern.sourceHeight,
  };
}

function beginCanvasInteraction(kind, options = {}) {
  const pattern = options.pattern || null;
  const patternId = pattern?.id || null;
  if (canvasInteraction?.kind === kind && canvasInteraction.patternId === patternId) {
    if (options.preserveLocked && !canvasInteraction.preserveLocked) {
      canvasInteraction.preserveLocked = true;
      canvasInteraction.startPattern = patternTransformSnapshot(pattern);
    }
    canvasInteraction.updatePanel ||= Boolean(options.updatePanel);
    canvasInteraction.updateAnalysis ||= Boolean(options.updateAnalysis);
    return canvasInteraction;
  }
  if (canvasInteraction) finishCanvasInteraction({ redraw: false });
  if (options.undoLabel) pushUndo(options.undoLabel);
  canvasInteraction = {
    kind,
    patternId,
    startPattern: options.preserveLocked ? patternTransformSnapshot(pattern) : null,
    preserveLocked: Boolean(options.preserveLocked),
    updatePanel: Boolean(options.updatePanel),
    updateAnalysis: Boolean(options.updateAnalysis),
    vectorBitmaps: new Map(),
  };
  return canvasInteraction;
}

function scheduleCanvasInteractionEnd(delay = 160) {
  window.clearTimeout(canvasInteractionTimer);
  canvasInteractionTimer = window.setTimeout(() => {
    canvasInteractionTimer = null;
    finishCanvasInteraction();
  }, delay);
}

function finishCanvasInteraction(options = {}) {
  const redraw = options.redraw !== false;
  const updateUi = options.updateUi !== false;
  window.clearTimeout(canvasInteractionTimer);
  canvasInteractionTimer = null;
  const interaction = canvasInteraction;
  if (!interaction) return;
  canvasInteraction = null;
  if (interaction.preserveLocked && interaction.startPattern && interaction.patternId) {
    const pattern = patternById(interaction.patternId);
    if (pattern && vectorPatternNeedsResizePreserve(pattern)) {
      preserveLockedVectorPaths(interaction.startPattern, pattern);
    }
  }
  if (redraw) flushCanvasDraw();
  if (updateUi && interaction.updatePanel) {
    const pattern = interaction.patternId ? patternById(interaction.patternId) : null;
    if (!syncPatternPanelGeometry(pattern)) updateSelectionPanel();
  }
  if (updateUi && interaction.updateAnalysis) updateJobAnalysisNow();
}

function requestCanvasDraw() {
  if (canvasDrawFrame !== null) return;
  canvasDrawFrame = window.requestAnimationFrame(() => {
    canvasDrawFrame = null;
    draw();
  });
}

function flushCanvasDraw() {
  if (canvasDrawFrame !== null) {
    window.cancelAnimationFrame(canvasDrawFrame);
    canvasDrawFrame = null;
  }
  draw();
}

function drawImageTool() {
  const tool = state.imageTool;
  const pattern = imageToolPattern();
  if (!tool.active || !pattern) return;
  const palette = canvasPalette();
  ctx.save();
  if (tool.mode === "crop" && tool.startSource && tool.currentSource) {
    const minX = Math.min(tool.startSource[0], tool.currentSource[0]);
    const maxX = Math.max(tool.startSource[0], tool.currentSource[0]);
    const minY = Math.min(tool.startSource[1], tool.currentSource[1]);
    const maxY = Math.max(tool.startSource[1], tool.currentSource[1]);
    const corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
      .map((point) => worldToScreen(vectorSourcePointToWorld(pattern, point)));
    ctx.beginPath();
    corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = colorWithAlpha(palette.selection, 0.12);
    ctx.fill();
    ctx.strokeStyle = palette.selection;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
  }
  if (tool.mode === "mask") {
    const points = tool.draftSourcePoints.map((point) => worldToScreen(vectorSourcePointToWorld(pattern, point)));
    if (points.length) {
      ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = colorWithAlpha(palette.warning, 0.82);
      ctx.lineWidth = Math.max(4, Number(refs.imageMaskBrush?.value || 6) / 100 * Math.min(pattern.width, pattern.height) * state.view.scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    if (tool.currentSource) {
      const center = worldToScreen(vectorSourcePointToWorld(pattern, tool.currentSource));
      const radius = Math.max(3, Number(refs.imageMaskBrush?.value || 6) / 200 * Math.min(pattern.width, pattern.height) * state.view.scale);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = palette.warning;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawDrawingTool() {
  const tool = state.drawingTool;
  if (!tool.active) return;
  const palette = canvasPalette();
  const worldPoints = [...tool.points];
  if (tool.mode === "vector" && state.cursor && worldPoints.length) worldPoints.push(state.cursor);
  const screenPoints = worldPoints.map(worldToScreen);
  ctx.save();
  if (screenPoints.length) {
    ctx.beginPath();
    screenPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    if (tool.closePath && tool.points.length >= 3) {
      const first = worldToScreen(tool.points[0]);
      ctx.lineTo(first.x, first.y);
    }
    ctx.strokeStyle = tool.operation === "cut" ? palette.cut : palette.engraveLine;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  for (const point of tool.points) {
    const screen = worldToScreen(point);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = "#63d32f";
    ctx.fill();
    ctx.strokeStyle = "#173d12";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  computeView();
  ctx.clearRect(0, 0, state.view.width, state.view.height);
  drawGrid();
  drawPatterns();
  drawPlacements();
  drawSelectedPlacementFrames();
  drawSelectedVectorGroupBounds();
  drawObjectSelectionMarquee();
  drawVectorSelectionMarquee();
  drawVectorRegionCursor();
  drawVectorRepairCursor();
  drawVectorObjectTool();
  drawImageTool();
  drawDrawingTool();
  drawSelectedPatternHandles();
  if (!["vectorMarquee", "objectMarquee"].includes(state.drag?.mode)) {
    scheduleJobAnalysis(state.drag ? 220 : canvasInteraction ? 500 : 80);
  }
}

function selectionKey(item) {
  return `${item.type}:${item.id}`;
}

function vectorPathSelectionKey(patternId, pathId) {
  return `${String(patternId || "")}::${String(pathId || "")}`;
}

function normalizeVectorPathSelectionItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const patternId = String(item?.patternId ?? item?.id ?? "");
    const pathId = String(item?.pathId || "");
    const pattern = patternById(patternId);
    const vectorPath = (pattern?.vectorPaths || []).find((path) => String(path.id) === pathId);
    if (!pattern || !vectorPath || vectorPath.removed) continue;
    const key = vectorPathSelectionKey(patternId, pathId);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ patternId, pathId });
  }
  return result;
}

function rebuildVectorPathSelectionKeys() {
  let items = normalizeVectorPathSelectionItems(state.selectedVectorPaths || []);
  if (!items.length && state.selected?.type === "vectorPath" && state.selected.pathId) {
    items = normalizeVectorPathSelectionItems([{ patternId: state.selected.id, pathId: state.selected.pathId }]);
  }
  state.selectedVectorPaths = items;
  if (!items.length) state.vectorSelectionRegion = null;
  const nextKeys = new Set(items.map((item) => vectorPathSelectionKey(item.patternId, item.pathId)));
  const selectionChanged = nextKeys.size !== selectedVectorPathKeys.size
    || [...nextKeys].some((key) => !selectedVectorPathKeys.has(key));
  selectedVectorPathKeys = nextKeys;
  if (selectionChanged) selectedVectorMoveTargetsCache = null;
}

function setVectorPathPreview(items = []) {
  previewVectorPathKeys = new Set(
    (items || []).map((item) => vectorPathSelectionKey(item?.patternId ?? item?.id, item?.pathId))
  );
}

function selectedVectorPathEntries() {
  rebuildVectorPathSelectionKeys();
  return state.selectedVectorPaths.map((item) => {
    const pattern = patternById(item.patternId);
    const vectorPath = (pattern?.vectorPaths || []).find((path) => String(path.id) === String(item.pathId));
    return pattern && vectorPath ? { pattern, vectorPath, patternId: pattern.id, pathId: vectorPath.id } : null;
  }).filter(Boolean);
}

function invalidateSelectedVectorMoveTargets() {
  selectedVectorMoveTargetsCache = null;
}

function selectedVectorMoveTargets() {
  if (selectedVectorMoveTargetsCache) return selectedVectorMoveTargetsCache;
  const targets = selectedVectorPathEntries().map((entry) => {
    const points = vectorWorldPath(entry.pattern, entry.vectorPath);
    return { ...entry, points, bounds: boundsFromPoints(points) };
  }).filter((entry) => entry.bounds && entry.points.length >= 2);
  selectedVectorMoveTargetsCache = {
    targets,
    bounds: boundsFromPoints(targets.flatMap((target) => [
      { x: target.bounds.minX, y: target.bounds.minY },
      { x: target.bounds.maxX, y: target.bounds.maxY },
    ])),
  };
  return selectedVectorMoveTargetsCache;
}

function selectedVectorFrameSelection() {
  if (state.selected?.type !== "vectorObject") return selectedVectorMoveTargets();
  const targets = selectedVectorOperationEntries()
    .filter((entry) => !entry.vectorPath.removed)
    .map((entry) => {
      const points = vectorWorldPath(entry.pattern, entry.vectorPath);
      return { ...entry, points, bounds: boundsFromPoints(points) };
    })
    .filter((entry) => entry.bounds && entry.points.length >= 2);
  return {
    targets,
    bounds: boundsFromPoints(targets.flatMap((target) => [
      { x: target.bounds.minX, y: target.bounds.minY },
      { x: target.bounds.maxX, y: target.bounds.maxY },
    ])),
  };
}

function pointInsideExpandedBounds(point, bounds, padding = 0) {
  return Boolean(bounds)
    && point.x >= bounds.minX - padding
    && point.x <= bounds.maxX + padding
    && point.y >= bounds.minY - padding
    && point.y <= bounds.maxY + padding;
}

function selectedVectorMoveHit(worldPoint) {
  const selection = selectedVectorMoveTargets();
  if (!selection.targets.length) return null;
  const tolerance = Math.max(12 / Math.max(0.001, state.view.scale), 0.8);
  const activeTarget = selection.targets.find((target) => (
    String(target.patternId) === String(state.selected?.id)
    && String(target.pathId) === String(state.selected?.pathId)
  )) || selection.targets[selection.targets.length - 1];
  if (selection.targets.length > 1 && pointInsideExpandedBounds(worldPoint, selection.bounds, tolerance * 0.5)) {
    return { type: "vectorPath", id: activeTarget.patternId, pathId: activeTarget.pathId };
  }
  for (let index = selection.targets.length - 1; index >= 0; index -= 1) {
    const target = selection.targets[index];
    if (!pointInsideExpandedBounds(worldPoint, target.bounds, tolerance)) continue;
    if (distanceToPolyline(worldPoint, target.points, Boolean(target.vectorPath.closed)) <= tolerance) {
      return { type: "vectorPath", id: target.patternId, pathId: target.pathId };
    }
  }
  return null;
}

function drawSelectedVectorGroupBounds() {
  if (state.drag?.mode === "vectorMarquee") return;
  const selection = selectedVectorFrameSelection();
  if (!selection.targets.length || !selection.bounds) return;
  const topLeft = worldToScreen({ x: selection.bounds.minX, y: selection.bounds.minY });
  const bottomRight = worldToScreen({ x: selection.bounds.maxX, y: selection.bounds.maxY });
  const palette = canvasPalette();
  ctx.save();
  ctx.strokeStyle = colorWithAlpha(palette.selection, 0.9);
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(
    Math.min(topLeft.x, bottomRight.x),
    Math.min(topLeft.y, bottomRight.y),
    Math.abs(bottomRight.x - topLeft.x),
    Math.abs(bottomRight.y - topLeft.y),
  );
  ctx.restore();
}

function hideSelectionCursor() {
  if (!refs.selectionCursor) return;
  refs.selectionCursor.hidden = true;
}

function showSelectionCursor(screenPoint, mode = "select") {
  if (!refs.selectionCursor || !screenPoint) return;
  const panelRect = refs.selectionCursor.parentElement.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  refs.selectionCursor.style.left = `${canvasRect.left - panelRect.left + Number(screenPoint.x)}px`;
  refs.selectionCursor.style.top = `${canvasRect.top - panelRect.top + Number(screenPoint.y)}px`;
  refs.selectionCursor.classList.toggle("is-move", mode === "move");
  refs.selectionCursor.hidden = false;
}

function canvasSelectionIsContour() {
  return state.canvasSelectionMode === "contour";
}

function syncCanvasSelectionModeUi() {
  refs.canvasSelectionMode?.querySelectorAll("[data-selection-mode]").forEach((button) => {
    const active = button.dataset.selectionMode === state.canvasSelectionMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setCanvasSelectionMode(mode, options = {}) {
  const next = mode === "contour" ? "contour" : "object";
  const changed = state.canvasSelectionMode !== next;
  state.canvasSelectionMode = next;
  if (next === "object" && ["vectorPath", "vectorObject"].includes(state.selected?.type)) {
    select("pattern", state.selected.id);
  } else if (next === "object" && state.selectedVectorPaths.length) {
    state.selectedVectorPaths = [];
    state.vectorSelectionRegion = null;
    rebuildVectorPathSelectionKeys();
    setVectorPathPreview([]);
    updateSelectionPanel();
    draw();
  }
  syncCanvasSelectionModeUi();
  if (options.persist !== false) saveUiSettings();
  if (changed && options.announce !== false) {
    setStatus(
      next === "object"
        ? "Nesne seçimi açık: metin, SVG, görsel ve DXF parçaları bütün olarak seçilir."
        : "Kontur seçimi açık: vektör içindeki çizgileri tek tek veya kutuyla seçebilirsiniz.",
      "info"
    );
  }
}

function vectorPathSelectionHas(patternId, pathId) {
  return selectedVectorPathKeys.has(vectorPathSelectionKey(patternId, pathId));
}

function setVectorPathSelection(items, activeItem = null, options = {}) {
  const normalized = normalizeVectorPathSelectionItems(items);
  state.selectedVectorPaths = normalized;
  state.vectorSelectionRegion = options.region ? clonePlain(options.region) : null;
  rebuildVectorPathSelectionKeys();
  setVectorPathPreview([]);
  if (!normalized.length) {
    state.selected = null;
    state.selectedItems = [];
  } else {
    const requestedKey = activeItem
      ? vectorPathSelectionKey(activeItem.patternId ?? activeItem.id, activeItem.pathId)
      : "";
    const active = normalized.find((item) => vectorPathSelectionKey(item.patternId, item.pathId) === requestedKey)
      || normalized[normalized.length - 1];
    state.selected = { type: "vectorPath", id: active.patternId, pathId: active.pathId };
    state.selectedItems = [{ type: "pattern", id: active.patternId }];
    syncTextControlsFromPattern(patternById(active.patternId));
  }
  if (options.updateUi !== false) updateSelectionPanel();
  if (options.redraw !== false) draw();
}

function toggleVectorPathSelection(item) {
  const normalized = normalizeVectorPathSelectionItems(state.selectedVectorPaths || []);
  const key = vectorPathSelectionKey(item.patternId ?? item.id, item.pathId);
  const index = normalized.findIndex((entry) => vectorPathSelectionKey(entry.patternId, entry.pathId) === key);
  if (index >= 0) normalized.splice(index, 1);
  else normalized.push({ patternId: String(item.patternId ?? item.id), pathId: String(item.pathId) });
  setVectorPathSelection(normalized, index >= 0 ? normalized[normalized.length - 1] : item);
}

function uniqueSelectionItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    if (!item || !["pattern", "placement"].includes(item.type)) continue;
    if (item.type === "pattern" && !patternById(item.id)) continue;
    if (item.type === "placement" && !placementById(item.id)) continue;
    const key = selectionKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type: item.type, id: item.id });
  }
  return result;
}

function selectedPatternObjects() {
  let items = uniqueSelectionItems(state.selectedItems).filter((item) => item.type === "pattern");
  if (!items.length && (state.selected?.type === "pattern" || state.selected?.type === "vectorPath")) {
    items = uniqueSelectionItems([{ type: "pattern", id: state.selected.id }]);
  }
  return items.map((item) => patternById(item.id)).filter(Boolean);
}

function selectedPlacementObjects() {
  let items = uniqueSelectionItems(state.selectedItems).filter((item) => item.type === "placement");
  if (!items.length && state.selected?.type === "placement") {
    items = uniqueSelectionItems([{ type: "placement", id: state.selected.id }]);
  }
  return items.map((item) => placementById(item.id)).filter(Boolean);
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
const vectorModelValidationCache = new WeakMap();

function vectorModelValidation(pattern) {
  const model = patternVectorModel(pattern);
  if (!model) return { errors: [], warnings: [] };
  const signature = [
    Number(model.vectorGraph?.revision) || 0,
    Number(model.objectTransformRevision) || 0,
    (model.vectorObjects || []).length,
    (model.vectorGraph?.edges || []).length,
  ].join(":");
  const cached = vectorModelValidationCache.get(pattern);
  if (cached?.signature === signature) return cached.result;
  const compiled = window.LaserVectorEdit.compileVectorObjects(model, { fallbackOperation: patternOperation(pattern) });
  const result = { errors: compiled.errors || [], warnings: compiled.warnings || [] };
  vectorModelValidationCache.set(pattern, { signature, result });
  return result;
}

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

function selectedVectorOperationEntries() {
  const selectedPaths = selectedVectorPathEntries();
  if (selectedPaths.length) return selectedPaths;

  const selectedObject = selectedVectorObject();
  if (selectedObject) {
    const edgeIds = new Set((selectedObject.vectorObject.edgeRefs || []).map((item) => String(item.edgeId || "")));
    return (selectedObject.pattern.vectorPaths || [])
      .filter((vectorPath) => (
        !vectorPath.removed
        && (
          String(vectorPath.objectId || vectorPath.provenance?.objectId || "") === String(selectedObject.vectorObject.id)
          || edgeIds.has(String(vectorPath.edgeId || vectorPath.provenance?.edgeId || ""))
        )
      ))
      .map((vectorPath) => ({ pattern: selectedObject.pattern, vectorPath }));
  }

  const entries = [];
  const seen = new Set();
  for (const pattern of selectedPatternObjects()) {
    if (!vectorPatternHasPaths(pattern)) continue;
    for (const vectorPath of pattern.vectorPaths || []) {
      if (vectorPath.removed) continue;
      const key = vectorPathSelectionKey(pattern.id, vectorPath.id);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ pattern, vectorPath });
    }
  }
  return entries;
}

function vectorFillSettings(entries = selectedVectorOperationEntries()) {
  const pattern = entries[0]?.pattern || selectedVectorPattern() || selectedPatternObjects().find(vectorPatternHasPaths);
  return {
    lineStep: Math.max(0.05, Number(pattern?.lineStep ?? mm("lineStep", 0.25))),
  };
}

function vectorFillSettingsHtml(entries) {
  const settings = vectorFillSettings(entries);
  return `<div class="vector-fill-settings">
    <label>Tarama aralığı <span class="unit-input"><input id="vectorSelectionFillStep" type="number" min="0.05" max="5" step="0.05" value="${settings.lineStep.toFixed(2)}" /><b>mm</b></span></label>
  </div>`;
}

function readVectorFillSettings(entries) {
  const defaults = vectorFillSettings(entries);
  return {
    lineStep: clamp(Number(document.getElementById("vectorSelectionFillStep")?.value ?? defaults.lineStep), 0.05, 5),
  };
}

function patternUsesCustomProcess(pattern) {
  return Boolean(pattern?.processOverride);
}

function enablePatternProcessOverride(pattern) {
  if (!pattern || patternUsesCustomProcess(pattern)) return;
  const cutPower = clamp(Math.round(mm("cutPower", 1000)), 0, 1000);
  const cutFeed = Math.max(1, mm("cutFeed", 500));
  const engravePower = clamp(Math.round(mm("engravePower", 250)), 0, 1000);
  const engraveFeed = Math.max(1, mm("engraveFeed", 1800));
  pattern.cutPower = cutPower;
  pattern.cutFeed = cutFeed;
  pattern.engravePower = engravePower;
  pattern.engraveFeed = engraveFeed;
  const cutPattern = patternOperation(pattern) === "cut";
  pattern.power = cutPattern ? cutPower : engravePower;
  pattern.feed = cutPattern ? cutFeed : engraveFeed;
  pattern.processOverride = true;
}

function vectorEntryDefaultPower(entry) {
  const operation = vectorPathOperation(entry.vectorPath, entry.pattern);
  if (operation === "cut") {
    const globalPower = clamp(Math.round(mm("cutPower", 1000)), 0, 1000);
    if (!patternUsesCustomProcess(entry.pattern)) return globalPower;
    const fallback = patternOperation(entry.pattern) === "cut" ? entry.pattern?.power : globalPower;
    const value = Number(entry.pattern?.cutPower ?? fallback);
    return clamp(Math.round(Number.isFinite(value) ? value : globalPower), 0, 1000);
  }
  const globalPower = clamp(Math.round(mm("engravePower", 250)), 0, 1000);
  if (!patternUsesCustomProcess(entry.pattern)) return globalPower;
  const fallback = patternOperation(entry.pattern) !== "cut" ? entry.pattern?.power : globalPower;
  const value = Number(entry.pattern?.engravePower ?? fallback);
  return clamp(Math.round(Number.isFinite(value) ? value : globalPower), 0, 1000);
}

function vectorPowerOverrideSettings(entries = selectedVectorOperationEntries()) {
  const validEntries = expandVectorPowerEntries(entries)
    .filter((entry) => entry?.pattern && entry.vectorPath && !entry.vectorPath.removed);
  const overrideFlags = validEntries.map((entry) => (
    entry.vectorPath.powerOverride !== undefined
    && entry.vectorPath.powerOverride !== null
    && entry.vectorPath.powerOverride !== ""
    && Number.isFinite(Number(entry.vectorPath.powerOverride))
  ));
  const overrides = validEntries.map((entry, index) => overrideFlags[index] ? Number(entry.vectorPath.powerOverride) : NaN);
  const inherited = validEntries.map(vectorEntryDefaultPower);
  const allOverride = overrideFlags.length > 0 && overrideFlags.every(Boolean);
  const anyOverride = overrideFlags.some(Boolean);
  const commonOverride = allOverride && overrides.every((value) => value === overrides[0]) ? overrides[0] : null;
  const commonInherited = inherited.length && inherited.every((value) => value === inherited[0]) ? inherited[0] : null;
  return {
    enabled: allOverride,
    mixed: anyOverride && (!allOverride || commonOverride === null),
    power: clamp(Math.round(commonOverride ?? commonInherited ?? inherited[0] ?? mm("engravePower", 250)), 0, 1000),
    inheritedLabel: commonInherited === null ? "işleme göre" : `S${commonInherited}`,
  };
}

function vectorPowerOverrideHtml(entries) {
  const settings = vectorPowerOverrideSettings(entries);
  return `<div class="operation-card vector-power-override-card">
    <div>
      <strong>Kontur lazer gücü</strong>
      <span>Özel güç kapalıyken Kesim &amp; Kazıma sekmesindeki veya desenin varsayılan ${settings.inheritedLabel} değeri kullanılır. Dolgu iç boşlukları aynı bileşik grupla korunur.</span>
    </div>
    <label class="checkline">
      <input id="vectorSelectionPowerOverrideEnabled" type="checkbox" ${settings.enabled ? "checked" : ""} />
      <span>Bu kontur grubu için özel güç kullan</span>
    </label>
    <label>Güç S <input id="vectorSelectionPowerOverride" type="number" min="0" max="1000" step="10" value="${settings.power}" ${settings.enabled ? "" : "disabled"} /></label>
  </div>`;
}

function applyVectorPowerOverride(entries, enabled, rawPower) {
  const validEntries = expandVectorPowerEntries(entries)
    .filter((entry) => entry?.pattern && entry.vectorPath && !entry.vectorPath.removed);
  if (!validEntries.length) return false;
  const power = clamp(Math.round(Number(rawPower) || 0), 0, 1000);
  pushUndo(enabled ? "Kontur gücü" : "Kontur gücünü varsayılana döndür");
  for (const entry of validEntries) {
    if (enabled) entry.vectorPath.powerOverride = power;
    else delete entry.vectorPath.powerOverride;
  }
  syncMovedVectorPatterns(validEntries.map((entry) => entry.pattern.id));
  updateSelectionPanel();
  updateJobAnalysisNow();
  draw();
  setStatus(
    enabled
      ? `${validEntries.length} kontur için özel lazer gücü S${power} uygulandı.`
      : `${validEntries.length} kontur Kesim & Kazıma varsayılan gücüne döndü.`,
    "ok"
  );
  return true;
}

function bindVectorPowerOverride(entries) {
  const enabled = document.getElementById("vectorSelectionPowerOverrideEnabled");
  const input = document.getElementById("vectorSelectionPowerOverride");
  if (!enabled || !input) return;
  const settings = vectorPowerOverrideSettings(entries);
  enabled.indeterminate = settings.mixed;
  const apply = () => {
    enabled.indeterminate = false;
    input.disabled = !enabled.checked;
    applyVectorPowerOverride(entries, enabled.checked, input.value);
  };
  enabled.addEventListener("change", apply);
  input.addEventListener("change", () => {
    input.value = String(clamp(Math.round(Number(input.value) || 0), 0, 1000));
    if (enabled.checked) apply();
  });
}

function expandVectorFillEntries(entries) {
  const grouped = new Map();
  for (const entry of entries || []) {
    if (!entry?.pattern || !entry.vectorPath) continue;
    if (!grouped.has(entry.pattern)) grouped.set(entry.pattern, []);
    grouped.get(entry.pattern).push(entry.vectorPath);
  }
  const expanded = [];
  const seen = new Set();
  for (const [pattern, selectedPaths] of grouped.entries()) {
    const paths = window.LaserVectorEdit.expandNestedClosedPaths(pattern.vectorPaths || [], selectedPaths);
    for (const vectorPath of paths) {
      const key = vectorPathSelectionKey(pattern.id, vectorPath.id);
      if (seen.has(key)) continue;
      seen.add(key);
      expanded.push({
        pattern,
        vectorPath,
        patternId: pattern.id,
        pathId: vectorPath.id,
      });
    }
  }
  return expanded;
}

function expandVectorPowerEntries(entries) {
  const grouped = new Map();
  const expanded = [];
  const seen = new Set();
  const add = (pattern, vectorPath) => {
    if (!pattern || !vectorPath || vectorPath.removed) return;
    const key = vectorPathSelectionKey(pattern.id, vectorPath.id);
    if (seen.has(key)) return;
    seen.add(key);
    expanded.push({ pattern, vectorPath, patternId: pattern.id, pathId: vectorPath.id });
  };
  for (const entry of entries || []) {
    if (!entry?.pattern || !entry.vectorPath) continue;
    if (!grouped.has(entry.pattern)) grouped.set(entry.pattern, []);
    grouped.get(entry.pattern).push(entry.vectorPath);
  }
  for (const [pattern, selectedPaths] of grouped.entries()) {
    const fillPaths = (pattern.vectorPaths || []).filter((vectorPath) => (
      !vectorPath.removed
      && vectorPath.closed
      && vectorPathOperation(vectorPath, pattern) === "engrave_fill"
    ));
    const classified = fillPaths.length ? classifiedVectorFillPaths(pattern, fillPaths) : [];
    for (const selectedPath of selectedPaths) {
      const selectedEntry = classified.find((entry) => entry.path === selectedPath);
      if (!selectedEntry) {
        add(pattern, selectedPath);
        continue;
      }
      let rootEntry = selectedEntry;
      if (selectedEntry.depth % 2 === 1) {
        const parentCandidates = classified
          .filter((entry) => entry.depth === selectedEntry.depth - 1 && entry.depth % 2 === 0)
          .filter((entry) => window.LaserVectorEdit.expandNestedClosedPaths(fillPaths, [entry.path]).includes(selectedPath));
        if (parentCandidates.length) rootEntry = parentCandidates.sort((first, second) => first.area - second.area)[0];
      }
      const compoundPaths = window.LaserVectorEdit.expandNestedClosedPaths(fillPaths, [rootEntry.path]);
      compoundPaths.forEach((vectorPath) => add(pattern, vectorPath));
    }
  }
  return expanded;
}

function applySelectedVectorOperation(operation, options = {}) {
  let entries = selectedVectorOperationEntries();
  if (!entries.length) {
    activateRibbonTab("vektor");
    setStatus("Önce bir vektör, vektör nesnesi veya kontur grubu seçin. Bir bölümü seçmek için boş alandan seçim çerçevesi çizin.", "warn");
    return null;
  }
  const nextOperation = normalizeOperation(operation, "engrave_line");
  const selectedPowerSettings = vectorPowerOverrideSettings(entries);
  const explicitPathSelection = selectedVectorPathEntries().length > 0;
  const originalEntryCount = entries.length;
  if (nextOperation === "engrave_fill") entries = expandVectorFillEntries(entries);
  const autoNestedCount = Math.max(0, entries.length - originalEntryCount);
  const fillableCount = entries.filter((entry) => vectorPathSupportsFill(entry.vectorPath)).length;
  if (nextOperation === "engrave_fill" && fillableCount === 0) {
    setStatus("Dolgu Motif için en az bir kapalı kontur gerekir. Açık tek çizgiler dolguya çevrilemez.", "warn");
    return null;
  }

  const fillSettings = nextOperation === "engrave_fill"
    ? { ...readVectorFillSettings(entries), ...(options.fillSettings || {}) }
    : null;
  pushUndo(nextOperation === "engrave_fill" ? "Dolgu motif uygula" : "Kontur işlemi");
  const result = window.LaserVectorEdit.assignPathOperation(
    entries.map((entry) => entry.vectorPath),
    nextOperation,
  );
  if (nextOperation === "engrave_fill" && selectedPowerSettings.enabled) {
    for (const entry of entries) entry.vectorPath.powerOverride = selectedPowerSettings.power;
  }
  if (nextOperation === "engrave_fill" && explicitPathSelection && autoNestedCount) {
    setVectorPathSelection(
      entries.map((entry) => ({ patternId: entry.pattern.id, pathId: entry.vectorPath.id })),
      entries[entries.length - 1],
      { updateUi: false, redraw: false },
    );
  }
  const patterns = [...new Set(entries.map((entry) => entry.pattern))];
  for (const pattern of patterns) {
    if (patternOperation(pattern) === "ignore") pattern.operation = "engrave_line";
    pattern.vectorEngraveMode = "contour";
    if (fillSettings) {
      pattern.lineStep = fillSettings.lineStep;
    }
    const remainingOperations = (pattern.vectorPaths || [])
      .filter((vectorPath) => !vectorPath.removed && (vectorPath.points || []).length >= 2)
      .map((vectorPath) => baseVectorPathOperation(vectorPath, pattern));
    if (remainingOperations.length && remainingOperations.every((value) => value === "engrave_fill")) {
      pattern.operation = "engrave_fill";
      pattern.vectorEngraveMode = "fill";
    }
  }
  draw();
  updateSelectionPanel();
  renderVectorQualityBox();
  updateJobAnalysisNow();

  const operationText = nextOperation === "engrave_fill" ? "Dolgu Motif" : operationLabel(nextOperation);
  const skippedText = result.skippedOpen
    ? ` ${result.skippedOpen} açık çizgi dolguya uygun olmadığı için çizgi olarak kaldı.`
    : "";
  const nestedText = autoNestedCount
    ? ` ${autoNestedCount} iç boşluk konturu otomatik korunacak şekilde eklendi.`
    : "";
  setStatus(`${result.changed || fillableCount} kontur ${operationText} olarak ayarlandı.${nestedText}${skippedText}`, result.skippedOpen ? "warn" : "ok");
  return result;
}

function vectorPathIsActive(vectorPath, pattern) {
  return Boolean(vectorPath) && !vectorPath.removed && (vectorPath.points || []).length >= 2 && vectorPathOperation(vectorPath, pattern) !== "ignore";
}

function vectorPathTabCount(vectorPath) {
  return Math.max(0, Math.round(Number(vectorPath?.tabCount ?? vectorPath?.microTabCount ?? 0) || 0));
}

function vectorPathTabWidth(vectorPath) {
  return Math.max(0, Number(vectorPath?.tabWidth ?? vectorPath?.microTabWidth ?? 0) || 0);
}

function vectorPathSourceLength(vectorPath) {
  const points = vectorPath?.points || [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    total += Math.hypot((Number(current[0]) || 0) - (Number(previous[0]) || 0), (Number(current[1]) || 0) - (Number(previous[1]) || 0));
  }
  return total;
}

function latestVectorPattern() {
  return [...state.patterns].reverse().find((pattern) => vectorPatternHasPaths(pattern) && pattern.kind === "vector") || null;
}

function vectorQualitySummary(pattern) {
  if (!vectorPatternHasPaths(pattern)) return null;
  const paths = pattern.vectorPaths || [];
  const operation = vectorPatternCommonOperation(pattern) || patternOperation(pattern);
  const autoIgnored = autoIgnoredCutInnerPaths(pattern);
  const active = paths.filter((path) => vectorPathIsActive(path, pattern));
  const open = active.filter((path) => !path.closed).length;
  const closed = active.length - open;
  const tiny = active.filter((path) => {
    const length = Number(path.length) || vectorPathSourceLength(path);
    const area = Math.abs(Number(path.area) || 0);
    return length < 8 || (path.closed && area > 0 && area < 1);
  }).length;
  const removedManual = paths.filter((path) => path.removed).length;
  const stats = pattern.vectorStats || {};
  const hiddenAuto = Number(stats.removedBorder || 0) + Number(stats.removedShortPost || 0) + autoIgnored.size;
  const warnings = [];
  if (operation === "cut" && open > 0) warnings.push(`${open} açık kontur kesimde elle kontrol edilmeli.`);
  if (active.length > 1200) warnings.push("Kontur sayısı yüksek; kesim süresi ve titreşim artabilir.");
  if (tiny > 30) warnings.push("Çok küçük kontur var; min alan/min çizgi artırılabilir.");
  if (Number(stats.removedBorder || 0) > 0) warnings.push("Fotoğraf çerçevesi otomatik temizlendi.");
  return {
    operation,
    total: paths.length,
    active: active.length,
    closed,
    open,
    tiny,
    removedManual,
    hiddenAuto,
    stitched: Number(stats.stitchedGap || 0),
    junctionAnchors: Number(stats.preservedJunctionAnchors || 0),
    contoursFound: Number(stats.contoursFound || 0),
    duration: Number(stats.timings?.total || 0),
    warnings,
  };
}

function vectorQualityHtml(pattern) {
  const summary = vectorQualitySummary(pattern);
  if (!summary) return "Kalite raporu: vektör üretildikten sonra görünür.";
  const warningText = summary.warnings.length ? `<span><b>Uyarı:</b> ${escapeHtml(summary.warnings.join(" "))}</span>` : "<span><b>Durum:</b> Üretim için temel kontrol temiz.</span>";
  const durationText = summary.duration ? ` · ${summary.duration.toFixed(2)} sn` : "";
  return `<div class="vector-quality-list">
    <span><b>${escapeHtml(patternOperationDisplayLabel(pattern))}</b> · aktif ${summary.active}/${summary.total} kontur${durationText}</span>
    <span>Kapalı ${summary.closed} · açık ${summary.open} · küçük ${summary.tiny}</span>
    <span>Gizlenen ${summary.hiddenAuto} · elle silinen ${summary.removedManual} · birleşen ${summary.stitched}${summary.junctionAnchors ? ` · korunan bağlantı ${summary.junctionAnchors}` : ""}</span>
    ${warningText}
  </div>`;
}

function renderVectorQualityBox(pattern = selectedVectorPattern() || latestVectorPattern()) {
  if (!refs.vectorQualityBox) return;
  const summary = vectorQualitySummary(pattern);
  refs.vectorQualityBox.classList.toggle("warn", Boolean(summary?.warnings?.length));
  refs.vectorQualityBox.innerHTML = vectorQualityHtml(pattern);
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
  if (vectorPath.locked) return false;
  const { sourceDx, sourceDy } = patternSourceDeltaFromWorld(pattern, dxMm, dyMm);
  if (!sourceDx && !sourceDy) return false;
  vectorPath.points = (vectorPath.points || []).map((point) => [
    Number(point[0]) + sourceDx,
    Number(point[1]) + sourceDy,
  ]);
  refreshVectorPathMetrics(vectorPath);
  return true;
}

function patternSourceDeltaFromWorld(pattern, dxMm = 0, dyMm = 0) {
  const dx = Number(dxMm) || 0;
  const dy = Number(dyMm) || 0;
  if (!pattern || (!dx && !dy)) return { sourceDx: 0, sourceDy: 0 };
  const anchor = { x: Number(pattern.x) || 0, y: Number(pattern.y) || 0 };
  const start = patternSourcePointFromWorld(pattern, anchor);
  const end = patternSourcePointFromWorld(pattern, { x: anchor.x + dx, y: anchor.y + dy });
  return { sourceDx: Number(end[0]) - Number(start[0]), sourceDy: Number(end[1]) - Number(start[1]) };
}

function applyVectorPathWorldDelta(pattern, vectorPath, startPoints, dxMm = 0, dyMm = 0) {
  if (!pattern || !vectorPath || vectorPath.locked || !(startPoints || []).length) return false;
  const { sourceDx, sourceDy } = patternSourceDeltaFromWorld(pattern, dxMm, dyMm);
  vectorPath.points = startPoints.map((point) => [Number(point[0]) + sourceDx, Number(point[1]) + sourceDy]);
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
      engrave_fill: "Dolgu Motif",
      ignore: "Yok say",
    }[normalizeOperation(operation, "engrave_line")] || "Kazıma çizgi"
  );
}

function vectorPatternCommonOperation(pattern) {
  if (!vectorPatternHasPaths(pattern)) return "";
  const operations = (pattern.vectorPaths || [])
    .filter((vectorPath) => !vectorPath.removed && (vectorPath.points || []).length >= 2)
    .map((vectorPath) => vectorPathOperation(vectorPath, pattern));
  if (!operations.length) return "";
  return operations.every((operation) => operation === operations[0]) ? operations[0] : "";
}

function patternOperationDisplayLabel(pattern) {
  if (isCadLineArtPattern(pattern) && pattern.regionClassificationMode === "exterior-cut") {
    return "Karma · dış kesim / iç kazıma";
  }
  const commonOperation = vectorPatternCommonOperation(pattern);
  if (commonOperation) {
    if (commonOperation === "engrave_fill" && editableTextPattern(pattern)) return "Kalın yazı kazıma";
    return operationLabel(commonOperation);
  }
  if (vectorPatternHasPaths(pattern)) {
    const operations = new Set(
      (pattern.vectorPaths || [])
        .filter((vectorPath) => !vectorPath.removed && (vectorPath.points || []).length >= 2)
        .map((vectorPath) => vectorPathOperation(vectorPath, pattern)),
    );
    if (operations.size > 1) return "Karma · kontur bazlı işlemler";
  }
  const operation = patternOperation(pattern);
  return operation === "engrave_fill" && editableTextPattern(pattern) ? "Kalın yazı kazıma" : operationLabel(operation);
}

function setPatternOperationDefaults(pattern, operation) {
  if (!pattern) return;
  const nextOperation = normalizeOperation(operation, pattern.kind === "raster" ? "engrave_fill" : "engrave_line");
  pattern.operation = nextOperation;
  pattern.processOverride = false;
  if (vectorPatternHasPaths(pattern) && nextOperation !== "ignore") {
    for (const vectorPath of pattern.vectorPaths || []) {
      if (!vectorPath.removed) vectorPath.operation = nextOperation;
    }
  }
  if (nextOperation === "cut") {
    pattern.power = clamp(Math.round(mm("cutPower", 1000)), 0, 1000);
    pattern.feed = Math.max(1, mm("cutFeed", 500));
    pattern.cutPower = pattern.power;
    pattern.cutFeed = pattern.feed;
    pattern.vectorEngraveMode = "contour";
  } else if (nextOperation === "engrave_line" || nextOperation === "engrave_fill") {
    pattern.power = clamp(Math.round(mm("engravePower", 250)), 0, 1000);
    pattern.feed = Math.max(1, mm("engraveFeed", 1800));
    pattern.engravePower = pattern.power;
    pattern.engraveFeed = pattern.feed;
    pattern.vectorEngraveMode = nextOperation === "engrave_fill" ? "fill" : "contour";
  }
  const textPattern = editableTextPattern(pattern);
  if (textPattern?.textSettings) {
    textPattern.textSettings = { ...textPattern.textSettings, operation: nextOperation };
    if (nextOperation === "engrave_fill" && textPattern.textSettings.mode === "outline") {
      textPattern.lineStep = textFillLineStep(textPattern);
      textPattern.textSettings.fillLineStep = textPattern.lineStep;
      textPattern.vectorStats = { ...(textPattern.vectorStats || {}), filledTraceInvert: false };
    }
  }
}

function wholeTextFillSettings(pattern) {
  const defaultPower = clamp(Math.round(mm("engravePower", 250)), 0, 1000);
  const defaultFeed = Math.max(1, mm("engraveFeed", 1800));
  if (!patternUsesCustomProcess(pattern)) {
    return {
      power: defaultPower,
      feed: defaultFeed,
      lineStep: textFillLineStep(pattern),
    };
  }
  const overallOperation = patternOperation(pattern);
  return {
    power: clamp(Math.round(Number(pattern?.engravePower ?? (overallOperation === "cut" ? defaultPower : pattern?.power ?? defaultPower))), 0, 1000),
    feed: Math.max(1, Number(pattern?.engraveFeed ?? (overallOperation === "cut" ? defaultFeed : pattern?.feed ?? defaultFeed))),
    lineStep: textFillLineStep(pattern),
  };
}

function wholeTextFillActionHtml(pattern) {
  const textPattern = editableTextPattern(pattern);
  if (!textPattern) return "";
  if (!outlineTextPattern(textPattern)) {
    return `<div class="operation-card text-fill-action-card">
      <div>
        <strong>Kalın yazı kazıma</strong>
        <span>Tek çizgi yazı otomatik olarak Arial Black konturuna çevrilir ve bütün harf gövdeleri yakılarak doldurulur.</span>
      </div>
      <button id="panelApplyWholeTextFill" class="primary">Yazıyı Dolgulu Kazımaya Çevir</button>
    </div>`;
  }
  const settings = wholeTextFillSettings(textPattern);
  const active = vectorPatternCommonOperation(textPattern) === "engrave_fill";
  return `<div class="operation-card text-fill-action-card ${active ? "is-active" : ""}">
    <div>
      <strong>Tüm yazıyı kalın kazı</strong>
      <span>Bütün harf gövdelerini tek bileşik alan yapar; üst üste binen harfleri birleştirir, A/O/B iç boşluklarını korur.</span>
    </div>
    <div class="text-fill-settings">
      <label>Güç S <input id="wholeTextFillPower" type="number" min="0" max="1000" step="10" value="${settings.power}" /></label>
      <label>Hız F <input id="wholeTextFillFeed" type="number" min="1" step="50" value="${settings.feed}" /></label>
      <label>Tarama aralığı <span class="unit-input"><input id="wholeTextFillStep" type="number" min="0.05" max="1" step="0.01" value="${settings.lineStep.toFixed(2)}" /><b>mm</b></span></label>
    </div>
    <small class="text-fill-note">Dolu ve düzgün görünüm için önerilen aralık 0,10–0,15 mm. Büyük aralık çizgili sonuç verir.</small>
    <button id="panelApplyWholeTextFill" class="primary">${active ? "Dolgu Ayarlarını Tüm Yazıya Uygula" : "Tüm Yazıyı Kalın Kazı"}</button>
  </div>`;
}

async function applyWholeTextFill(pattern, options = {}) {
  let textPattern = editableTextPattern(pattern);
  if (!textPattern) return false;
  const defaults = wholeTextFillSettings(textPattern);
  const power = clamp(Math.round(Number(options.power ?? document.getElementById("wholeTextFillPower")?.value ?? defaults.power)), 0, 1000);
  const feed = Math.max(1, Number(options.feed ?? document.getElementById("wholeTextFillFeed")?.value ?? defaults.feed));
  const lineStep = clamp(Number(options.lineStep ?? document.getElementById("wholeTextFillStep")?.value ?? defaults.lineStep), 0.05, 1);
  let undoCaptured = false;

  if (!outlineTextPattern(textPattern)) {
    const converted = await applyFontToSelectedText(textPattern, DEFAULT_TEXT_FONT_VALUE, {
      operation: "engrave_fill",
      fillLineStep: lineStep,
      undoLabel: "Tüm yazıyı kalın kazı",
      deferUi: true,
      suppressSuccess: true,
    });
    if (!converted) return false;
    textPattern = outlineTextPattern(converted);
    undoCaptured = true;
  }
  if (!textPattern) {
    setStatus("Yazı dolgu konturuna çevrilemedi.", "danger");
    return false;
  }
  const fillablePaths = (textPattern.vectorPaths || []).filter((vectorPath) => !vectorPath.removed && vectorPathSupportsFill(vectorPath));
  if (!fillablePaths.length) {
    setStatus("Bu yazıda doldurulabilecek kapalı harf gövdesi bulunamadı.", "warn");
    return false;
  }

  if (!undoCaptured) pushUndo("Tüm yazıyı kalın kazı");
  textPattern.operation = "engrave_fill";
  textPattern.vectorEngraveMode = "fill";
  textPattern.power = power;
  textPattern.feed = feed;
  textPattern.engravePower = power;
  textPattern.engraveFeed = feed;
  textPattern.processOverride = patternUsesCustomProcess(textPattern)
    || power !== clamp(Math.round(mm("engravePower", 250)), 0, 1000)
    || feed !== Math.max(1, mm("engraveFeed", 1800));
  textPattern.lineStep = lineStep;
  textPattern.vectorStats = { ...(textPattern.vectorStats || {}), filledTraceInvert: false };
  textPattern.textSettings = {
    ...(textPattern.textSettings || {}),
    operation: "engrave_fill",
    fillLineStep: lineStep,
  };
  for (const vectorPath of textPattern.vectorPaths || []) {
    if (vectorPath.removed) continue;
    vectorPath.operation = vectorPathSupportsFill(vectorPath) ? "engrave_fill" : "engrave_line";
    delete vectorPath.powerOverride;
    vectorPath.operationManual = true;
    vectorPath.regionOperation = "manual";
  }
  select("pattern", textPattern.id);
  updateJobAnalysisNow();
  setStatus(`Tüm yazı kalın kazımaya alındı: ${lineStep.toFixed(2)} mm tarama, S${power}, F${feed}.`, "ok");
  return true;
}

function bindWholeTextFillAction(pattern) {
  document.getElementById("panelApplyWholeTextFill")?.addEventListener("click", () => void applyWholeTextFill(pattern));
  document.getElementById("panelOpenTextFillTools")?.addEventListener("click", () => {
    activateRibbonTab("metin");
    refs.textFontButton?.focus();
    setStatus("Kalın yazı için Arial Black, Impact veya yüklediğiniz dolgun bir kontur font seçin.", "info");
  });
}

function setCadLineArtDefaults(pattern) {
  if (!pattern) return;
  pattern.cadLineArt = true;
  pattern.regionClassificationMode = pattern.regionClassificationMode || "exterior-cut";
  pattern.cutRegionSeeds = clonePlain(pattern.cutRegionSeeds || []);
  pattern.cutPower = clamp(Math.round(Number(pattern.cutPower ?? mm("cutPower", 1000))), 0, 1000);
  pattern.cutFeed = Math.max(1, Number(pattern.cutFeed ?? mm("cutFeed", 500)));
  pattern.engravePower = clamp(Math.round(Number(pattern.engravePower ?? mm("engravePower", 250))), 0, 1000);
  pattern.engraveFeed = Math.max(1, Number(pattern.engraveFeed ?? mm("engraveFeed", 1800)));
  pattern.power = pattern.engravePower;
  pattern.feed = pattern.engraveFeed;
  pattern.operation = "engrave_line";
  pattern.vectorEngraveMode = "contour";
}

function setProfessionalPatternDefaults(pattern, professionalMode) {
  if (professionalMode?.mixedOperations) setCadLineArtDefaults(pattern);
  else setPatternOperationDefaults(pattern, professionalMode?.operation);
}

function applyPatternOperation(pattern, operation) {
  const nextOperation = normalizeOperation(operation, pattern?.kind === "raster" ? "engrave_fill" : "engrave_line");
  if (!pattern) return;
  if (nextOperation === "engrave_fill" && editableTextPattern(pattern)) {
    void applyWholeTextFill(pattern);
    return;
  }
  const needsPathSync =
    vectorPatternHasPaths(pattern) &&
    nextOperation !== "ignore" &&
    (pattern.vectorPaths || []).some((vectorPath) => !vectorPath.removed && baseVectorPathOperation(vectorPath, pattern) !== nextOperation);
  if (pattern.operation === nextOperation && !needsPathSync) return;
  pushUndo("Desen islemi");
  setPatternOperationDefaults(pattern, nextOperation);
  if (pattern.cadLineArt) {
    pattern.regionClassificationMode = "manual";
    for (const vectorPath of pattern.vectorPaths || []) {
      if (!vectorPath.removed) vectorPath.operationManual = true;
    }
  }
  draw();
  updateSelectionPanel();
}

function isCadLineArtPattern(pattern) {
  return Boolean(pattern?.cadLineArt && vectorPatternHasPaths(pattern));
}

function cancelVectorRegionSelection(message = "") {
  state.vectorRegionTool.active = false;
  state.vectorRegionTool.pending = false;
  state.vectorRegionTool.patternId = null;
  canvas.style.cursor = "";
  if (message) setStatus(message, "warn");
}

async function reclassifyCadLineArtPattern(pattern, options = {}) {
  if (!isCadLineArtPattern(pattern)) return null;
  if (options.resetManual) {
    for (const vectorPath of pattern.vectorPaths || []) delete vectorPath.operationManual;
  }
  const data = await api("/api/classify-vector-regions", {
    vectorPaths: pattern.vectorPaths || [],
    sourceWidth: pattern.sourceWidth || pattern.width,
    sourceHeight: pattern.sourceHeight || pattern.height,
    seeds: pattern.cutRegionSeeds || [],
    includeExterior: true,
  });
  const classification = data.classification || {};
  const exteriorIds = new Set(classification.exteriorPathIds || []);
  const markedIds = new Set(classification.markedPathIds || []);
  for (const vectorPath of pattern.vectorPaths || []) {
    if (vectorPath.removed) continue;
    const pathId = String(vectorPath.id || "");
    if (markedIds.has(pathId)) {
      vectorPath.operation = "cut";
      vectorPath.regionOperation = "marked";
      continue;
    }
    if (vectorPath.operationManual) {
      vectorPath.regionOperation = "manual";
      continue;
    }
    vectorPath.operation = exteriorIds.has(pathId) ? "cut" : "engrave_line";
    vectorPath.regionOperation = exteriorIds.has(pathId) ? "exterior" : "inner";
  }
  setCadLineArtDefaults(pattern);
  pattern.regionClassificationMode = "exterior-cut";
  pattern.regionClassification = classification;
  pattern.vectorStats = {
    ...(pattern.vectorStats || {}),
    regionCutPaths: (classification.cutPathIds || []).length,
    regionEngravePaths: Math.max(0, Number(classification.stats?.activePaths || 0) - (classification.cutPathIds || []).length),
    markedCutRegions: (classification.regions || []).filter((item) => item.resolved).length,
  };
  if (options.render !== false) {
    draw();
    updateSelectionPanel();
    updateJobAnalysisNow();
  }
  return classification;
}

function beginVectorRegionSelection(pattern) {
  if (!isCadLineArtPattern(pattern)) return;
  state.vectorRegionTool.active = true;
  state.vectorRegionTool.pending = false;
  state.vectorRegionTool.patternId = pattern.id;
  canvas.style.cursor = "crosshair";
  setStatus("Kesime alınacak kapalı alanın içine tıklayın. Esc ile iptal edebilirsiniz.", "info");
}

function cadContourRemovalStatus(classification) {
  const cutCount = classification?.cutPathIds?.length || 0;
  return cutCount > 0
    ? `Dış çerçeve silindi; ${cutCount} büyük yeni dış kontur kesime geçti. Küçük ayrıntılar kazımada kaldı.`
    : "Dış çerçeve silindi; kesime uygun büyük bir yeni dış kontur bulunamadı. Küçük ayrıntılar kazımada kaldı.";
}

async function markVectorCutRegionAtWorld(worldPoint) {
  const tool = state.vectorRegionTool;
  const pattern = patternById(tool.patternId);
  if (!tool.active || tool.pending || !isCadLineArtPattern(pattern)) return;
  if (!pointInPolygon(worldPoint, patternCorners(pattern))) {
    setStatus("Alan işareti seçili desenin içinde olmalı.", "warn");
    return;
  }
  const [sourceX, sourceY] = patternSourcePointFromWorld(pattern, worldPoint);
  const seed = { x: Number(sourceX), y: Number(sourceY) };
  const duplicate = (pattern.cutRegionSeeds || []).some(
    (item) => Math.hypot(Number(item.x) - seed.x, Number(item.y) - seed.y) <= 2
  );
  if (duplicate) {
    cancelVectorRegionSelection("Bu alan daha önce işaretlendi.");
    return;
  }
  pushUndo("Kesim alanı işaretle");
  pattern.cutRegionSeeds = [...(pattern.cutRegionSeeds || []), seed];
  tool.active = false;
  tool.pending = true;
  canvas.style.cursor = "wait";
  try {
    const classification = await reclassifyCadLineArtPattern(pattern);
    const regions = classification?.regions || [];
    const selectedRegion = regions[regions.length - 1];
    const pathCount = selectedRegion?.pathIds?.length || 0;
    if (!selectedRegion?.resolved || pathCount === 0) {
      pattern.cutRegionSeeds = pattern.cutRegionSeeds.slice(0, -1);
      draw();
      updateSelectionPanel();
      setStatus("Bu noktada kesim sınırı oluşturan kapalı bir alan bulunamadı.", "warn");
    } else {
      setStatus(`Alan işaretlendi; sınırındaki ${pathCount} kontur kesime alındı.`, "ok");
    }
  } catch (error) {
    pattern.cutRegionSeeds = pattern.cutRegionSeeds.slice(0, -1);
    draw();
    updateSelectionPanel();
    setStatus(error.message || "Alan sınıflandırılamadı.", "danger");
  } finally {
    state.vectorRegionTool.pending = false;
    state.vectorRegionTool.patternId = null;
    canvas.style.cursor = "";
  }
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
      const level = !physicalFits || outside ? "warn" : inside ? "ok" : "";
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
  const bounds = productionJobBounds(analysis);
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
  const previousKey = state.selected ? `${state.selected.type}:${state.selected.id}` : "";
  const nextKey = type && id ? `${type}:${id}` : "";
  if (state.vectorRegionTool.active && id !== state.vectorRegionTool.patternId) {
    cancelVectorRegionSelection();
  }
  if (state.vectorObjectTool.active && id !== state.vectorObjectTool.patternId) {
    cancelVectorObjectSeparation();
  }
  if (previousKey !== nextKey) {
    textFontApplyToken += 1;
    activeTextFontPreview = null;
    if (textFontMenuIsOpen()) closeTextFontMenu();
  }
  state.selected = type && id ? { type, id, ...extra } : null;
  state.vectorSelectionRegion = null;
  if (type === "vectorPath" && id && extra.pathId) {
    state.selectedVectorPaths = normalizeVectorPathSelectionItems([{ patternId: id, pathId: extra.pathId }]);
  } else {
    state.selectedVectorPaths = [];
  }
  rebuildVectorPathSelectionKeys();
  setVectorPathPreview([]);
  if (!state.selected) {
    state.selectedItems = [];
  } else if (type === "pattern" || type === "placement") {
    state.selectedItems = [{ type, id }];
  } else if (type === "vectorPath" || type === "vectorObject") {
    state.selectedItems = [{ type: "pattern", id }];
  } else {
    state.selectedItems = [];
  }
  if (type === "pattern" || type === "vectorPath" || type === "vectorObject") syncTextControlsFromPattern(patternById(id));
  if (state.imageTool.active && id !== state.imageTool.patternId) cancelImageTool();
  syncImageEditUi();
  updateSelectionPanel();
  draw();
}

function selectPatternItems(patternIds, activeId = null) {
  state.selectedVectorPaths = [];
  state.vectorSelectionRegion = null;
  rebuildVectorPathSelectionKeys();
  setVectorPathPreview([]);
  state.selectedItems = uniqueSelectionItems(patternIds.map((id) => ({ type: "pattern", id })));
  const active = activeId && state.selectedItems.some((item) => item.id === activeId)
    ? activeId
    : state.selectedItems[0]?.id;
  if (state.vectorRegionTool.active && active !== state.vectorRegionTool.patternId) {
    cancelVectorRegionSelection();
  }
  const previousId = state.selected?.id || "";
  if (previousId !== (active || "")) {
    textFontApplyToken += 1;
    activeTextFontPreview = null;
    if (textFontMenuIsOpen()) closeTextFontMenu();
  }
  state.selected = active ? { type: "pattern", id: active } : null;
  if (active) syncTextControlsFromPattern(patternById(active));
  if (state.imageTool.active && active !== state.imageTool.patternId) cancelImageTool();
  syncImageEditUi();
  updateSelectionPanel();
  draw();
}

function togglePatternSelection(patternId) {
  const items = uniqueSelectionItems(state.selectedItems).filter((item) => item.type === "pattern");
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

function selectPlacementItems(placementIds, activeId = null) {
  state.selectedVectorPaths = [];
  state.vectorSelectionRegion = null;
  rebuildVectorPathSelectionKeys();
  setVectorPathPreview([]);
  state.selectedItems = uniqueSelectionItems(placementIds.map((id) => ({ type: "placement", id })));
  const active = activeId && state.selectedItems.some((item) => item.id === activeId)
    ? activeId
    : state.selectedItems[0]?.id;
  state.selected = active ? { type: "placement", id: active } : null;
  syncImageEditUi();
  updateSelectionPanel();
  draw();
}

function togglePlacementSelection(placementId) {
  const items = uniqueSelectionItems(state.selectedItems).filter((item) => item.type === "placement");
  const index = items.findIndex((item) => item.id === placementId);
  if (index >= 0) {
    items.splice(index, 1);
    if (!items.length) {
      select(null, null);
      return;
    }
    selectPlacementItems(items.map((item) => item.id), items[items.length - 1]?.id);
    return;
  }
  items.push({ type: "placement", id: placementId });
  selectPlacementItems(items.map((item) => item.id), placementId);
}

function updateSelectionPanel() {
  renderVectorQualityBox();
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
    const selectedPaths = selectedVectorPathEntries();
    if (selectedPaths.length > 1) renderVectorPathMultiPanel(selectedPaths);
    else {
      const selected = selectedVectorPath();
      renderVectorPathPanel(selected?.pattern, selected?.vectorPath);
    }
  } else if (state.selected.type === "vectorObject") {
    const selected = selectedVectorObject();
    if (!selected || !vectorObjectIsUserSemantic(selected.vectorObject)) {
      const pattern = patternById(state.selected.id);
      if (pattern) select("pattern", pattern.id);
      else select(null, null);
      return;
    }
    renderVectorObjectPanel(selected.pattern, selected.vectorObject);
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
  const selectedPlacementCount = selectedPlacementObjects().length;
  const multiSelectionText = selectedPlacementCount > 1 ? ` · ${selectedPlacementCount} seçili` : "";
  refs.selectionPanel.innerHTML = `
    <div class="property-title"><strong>${escapeHtml(part?.name || "Parça")}</strong><span>DXF Parça · ${operationLabel(operation)} · ${size.width.toFixed(2)} × ${size.height.toFixed(2)} mm${multiSelectionText}</span></div>
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

function patternPanelKindText(pattern) {
  if (editableTextPattern(pattern)) return "Metin vektörü";
  if (pattern?.kind === "vector") return "Foto vektör";
  if (pattern?.kind === "svg") return "Temiz SVG vektör";
  return "Raster kazıma";
}

function patternPanelGeometrySummary(pattern) {
  const multiSelectionText = state.selectedItems.length > 1 ? ` · ${state.selectedItems.length} secili` : "";
  return `${patternPanelKindText(pattern)} · ${patternOperationDisplayLabel(pattern)} · ${pattern.width.toFixed(2)} x ${pattern.height.toFixed(2)} mm${multiSelectionText}`;
}

function syncPatternPanelGeometry(pattern) {
  if (!pattern || state.selected?.id !== pattern.id) return false;
  const values = {
    x: Number(pattern.x).toFixed(2),
    y: Number(pattern.y).toFixed(2),
    width: Number(pattern.width).toFixed(2),
    height: Number(pattern.height).toFixed(2),
    rotation: Number(pattern.rotation).toFixed(1),
  };
  let found = false;
  for (const [key, value] of Object.entries(values)) {
    const input = refs.selectionPanel.querySelector(`[data-pattern="${key}"]`);
    if (!input) continue;
    found = true;
    if (document.activeElement !== input) input.value = value;
  }
  const summary = refs.selectionPanel.querySelector("[data-pattern-geometry-summary]");
  if (summary) {
    summary.textContent = patternPanelGeometrySummary(pattern);
    found = true;
  }
  return found;
}

function renderPatternPanel(pattern) {
  if (!pattern) {
    select(null, null);
    return;
  }
  const kindText = patternPanelKindText(pattern);
  const operation = vectorPatternCommonOperation(pattern) || patternOperation(pattern);
  const hasVectorPaths = vectorPatternHasPaths(pattern);
  const cadLineArt = isCadLineArtPattern(pattern);
  const canFillVectorEngrave = vectorCanFillEngrave(pattern);
  const filledVectorEngrave = operation === "engrave_fill" && vectorPatternFilledPreview(pattern);
  const textPattern = editableTextPattern(pattern);
  const fillOperationLabel = textPattern ? "Kalın yazı kazıma" : "Dolgu Motif";
  const operationText =
    operation === "cut"
      ? "Kesim: vektör konturlarını kırmızı kesim yolu olarak üretir."
      : operation === "engrave_fill"
        ? textPattern
          ? "Kalın yazı kazıma: bütün harf gövdelerini sık tarama satırlarıyla dolu olarak kazır."
          : "Dolgu Motif: kapalı vektör alanlarını, iç boşlukları koruyarak tarama satırlarıyla kazır."
        : operation === "ignore"
          ? "Yok say: bu nesne G-code çıktısına dahil edilmez."
          : "Kazıma çizgi: mavi çizgi kazıma yolu olarak üretir.";
  const operationControl = cadLineArt ? "" : `<div class="operation-card">
        <div>
          <strong>${textPattern ? "Yazı üretim tipi" : "İşlem"}</strong>
          <span>${operationText}</span>
        </div>
        <div class="operation-toggle">
          ${isVectorLikePattern(pattern) ? `<button data-operation="cut" class="${operation === "cut" ? "active danger-mode" : ""}">Kesim</button>` : ""}
          <button data-operation="engrave_line" class="${operation === "engrave_line" ? "active" : ""}">Kazıma çizgi</button>
          <button data-operation="engrave_fill" class="${operation === "engrave_fill" ? "active" : ""}" ${hasVectorPaths && !canFillVectorEngrave ? "disabled" : ""}>${fillOperationLabel}</button>
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
  const rasterMode = pattern.rasterMode || (pattern.photoEngrave ? "grayscale" : "threshold");
  const rasterControls =
    pattern.kind === "raster"
      ? `<label>Raster modu <select data-pattern-text="rasterMode">
            <option value="threshold" ${rasterMode === "threshold" ? "selected" : ""}>Eşik / aç-kapa</option>
            <option value="grayscale" ${rasterMode === "grayscale" ? "selected" : ""}>Foto gri ton</option>
          </select></label>
          <label>Çizgi <input data-pattern="lineStep" type="number" min="0.05" step="0.05" value="${pattern.lineStep}" /></label>
          ${
            rasterMode === "grayscale"
              ? `<label>Min güç S <input data-pattern="powerMin" type="number" min="0" max="1000" step="10" value="${Number(pattern.powerMin || 0)}" /></label>
                 <label>Gamma <input data-pattern="gamma" type="number" min="0.2" max="4" step="0.1" value="${Number(pattern.gamma || 1).toFixed(1)}" /></label>`
              : `<label>Eşik <input data-pattern="threshold" type="number" min="0" max="255" step="1" value="${pattern.threshold}" /></label>`
          }`
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
  const activeVectorCount = hasVectorPaths ? (pattern.vectorPaths || []).filter((item) => vectorPathIsActive(item, pattern)).length : 0;
  const lockedVectorCount = hasVectorPaths ? (pattern.vectorPaths || []).filter((item) => vectorPathPreservesDuringPatternResize(pattern, item)).length : 0;
  const deformableVectorCount = hasVectorPaths ? (pattern.vectorPaths || []).filter((item) => item.deformable && !item.removed).length : 0;
  const vectorSettings = pattern.vectorSettings || {};
  const vectorStats = pattern.vectorStats || {};
  const multiSelectionText = state.selectedItems.length > 1 ? ` · ${state.selectedItems.length} secili` : "";
  const vectorTiming = vectorStats.timings?.total ? ` · Süre: ${Number(vectorStats.timings.total).toFixed(2)} sn` : "";
  const vectorReadyTitle = textPattern
    ? "Metin konturları hazır"
    : pattern.kind === "svg"
      ? "SVG konturları hazır"
      : "Foto vektör hazır";
  const vectorSourceDetails = textPattern
    ? `<span>Font: ${escapeHtml(textPattern.textSettings?.font || "Kontur font")} · Ağırlık ${escapeHtml(textPattern.textSettings?.weight || "400")} · ${textPattern.textSettings?.style === "italic" ? "İtalik" : "Düz"}</span>
       <span>Dolgu: ${operation === "engrave_fill" ? `${textFillLineStep(textPattern).toFixed(2)} mm sık tarama` : "Kapalı"}</span>`
    : `<span>Kaynak: ${Number(pattern.sourceWidth || 0).toFixed(0)} x ${Number(pattern.sourceHeight || 0).toFixed(0)} px</span>
       <span>Mod: ${vectorSettings.mode || "outline"} · Eşik: ${vectorSettings.thresholdMode || "manual"} ${vectorSettings.usedThreshold > 0 ? `(${Number(vectorSettings.usedThreshold).toFixed(0)})` : ""}</span>
       <span>Otomatik gizlenen: ${Number(vectorStats.removedBorder || 0) + Number(vectorStats.removedShortPost || 0)} · Çerçeve: ${vectorStats.removedBorder ?? 0} · Birleşen: ${vectorStats.stitchedGap ?? 0}${vectorTiming}</span>`;
  const vectorInfo =
    hasVectorPaths
      ? `<div class="svg-clean-info">
          <strong>${vectorReadyTitle}</strong>
          <span>Aktif kontur: ${activeVectorCount} / ${(pattern.vectorPaths || []).length}</span>
          <span>Nokta: ${Number(vectorStats.pointsKept || vectorPatternPointCount(pattern)).toLocaleString("tr-TR")}${vectorStats.detailPreservation ? " · İnce detay koruma açık" : ""}</span>
          <span>Korunan kontur: ${lockedVectorCount}</span>
          <span>Oynatilabilir kontur: ${deformableVectorCount}</span>
          ${vectorSourceDetails}
        </div>`
      : "";
  const vectorQualityCard = hasVectorPaths ? `<div class="svg-clean-info">${vectorQualityHtml(pattern)}</div>` : "";
  const vectorObjectCount = (pattern.vectorObjects || []).filter(vectorObjectIsUserSemantic).length;
  const usedProposalIds = new Set((pattern.vectorObjects || []).map((item) => String(item.proposalId || "")).filter(Boolean));
  const semanticProposals = (pattern.objectProposals || []).filter((item) =>
    Number(item.graphRevision) === Number(pattern.vectorGraph?.revision) && !usedProposalIds.has(String(item.id))
  );
  const semanticProposalControl = semanticProposals.length
    ? `<div class="operation-card semantic-proposal-card">
        <div><strong>Yapısal Nesne Önerileri</strong><span>${semanticProposals.length} doğrulanabilir edge grubu</span></div>
        <div class="semantic-proposal-list">
          ${semanticProposals.map((proposal) => `
            <button type="button" class="semantic-proposal-row" data-vector-object-proposal="${escapeHtml(proposal.id)}">
              <span><b>${escapeHtml(proposal.name || "Kompakt motif")}</b><small>${(proposal.edgeIds || []).length} edge · ${(proposal.gateNodeIds || []).length} kapı</small></span>
              <strong>%${Math.round((Number(proposal.confidence) || 0) * 100)}</strong>
            </button>`).join("")}
        </div>
      </div>`
    : "";
  const vectorObjectReview = state.vectorObjectTool.patternId === pattern.id ? state.vectorObjectTool.review : null;
  const selectedUnderlayPolicy = state.vectorObjectTool.patternId === pattern.id ? state.vectorObjectTool.policy : "emit-underlay";
  const selectedAttachmentPolicy = state.vectorObjectTool.patternId === pattern.id ? state.vectorObjectTool.attachmentPolicy : "detached";
  const vectorGateReviewControl = vectorObjectReview?.candidateGateNodeIds?.length
    ? `<div class="vector-gate-review">
        <strong>Bağlantı gate’leri</strong>
        <span>Tuvaldeki halkaya veya aşağıdaki düğmeye basarak Kes/Koru değiştirin.</span>
        <div class="vector-gate-list">
          ${vectorObjectReview.candidateGateNodeIds.map((nodeId, index) => {
            const kept = vectorObjectReview.gateOverrides?.[nodeId] === "keep";
            const cut = vectorObjectReview.gateNodeIds?.includes(nodeId) && !kept;
            return `<button type="button" data-vector-gate-toggle="${escapeHtml(nodeId)}" class="${kept ? "gate-keep" : cut ? "gate-cut" : ""}">
              <span>Gate ${index + 1}</span><b>${kept ? "Koru" : "Kes"}</b>
            </button>`;
          }).join("")}
        </div>
      </div>`
    : "";
  const vectorObjectReviewHint = vectorObjectReview
    ? `<span class="hint review-hint"><b>Önizleme:</b> ${vectorObjectReview.stats.selectedEdges} edge, ${vectorObjectReview.gateNodeIds?.length || 0} kesilen gate, güven %${Math.round((Number(vectorObjectReview.confidence) || 0) * 100)}. Graph ancak Onayla ile değişir.</span>`
    : `<span class="hint">Ayrılmış nesne: ${vectorObjectCount}. Ayrılmış bir nesneye tıklayın; Alt+tık tek konturu seçer.</span>`;
  const vectorObjectControl = hasVectorPaths
    ? `<div class="operation-card vector-object-separate-card">
        <div>
          <strong>Nesne Ayır</strong>
          <span>Çiçek, yaprak veya yazı gibi motifi dikdörtgenle seçin. Dal ve alt çizgi ayrı kalır; ayrılan nesne bağımsız taşınır ve ölçeklenir.</span>
        </div>
        <label>Temas eden alt çizgi
          <select id="vectorObjectUnderlayPolicy">
            <option value="emit-underlay" ${selectedUnderlayPolicy === "emit-underlay" ? "selected" : ""}>Altından devam et; yakmayı koru</option>
            <option value="mask-underlay" ${selectedUnderlayPolicy === "mask-underlay" ? "selected" : ""}>Nesne silüetinde maskele; alttaki çizgiyi yakma</option>
            <option value="cut-at-boundary" ${selectedUnderlayPolicy === "cut-at-boundary" ? "selected" : ""}>Sınırda fiziksel böl (Alan Çiz ile)</option>
            <option value="include-crossing" ${selectedUnderlayPolicy === "include-crossing" ? "selected" : ""}>Seçim içindeki parçayı nesneye kat</option>
          </select>
        </label>
        <label>Bağlantı davranışı
          <select id="vectorObjectAttachmentPolicy">
            <option value="detached" ${selectedAttachmentPolicy === "detached" ? "selected" : ""}>Serbest — bağlantıyı kopar</option>
            <option value="pinned" ${selectedAttachmentPolicy === "pinned" ? "selected" : ""}>Sabit nokta — gate etrafında ölçekle</option>
            <option value="shared-joint" ${selectedAttachmentPolicy === "shared-joint" ? "selected" : ""}>Ortak mafsal — bağlantıyı koru</option>
          </select>
        </label>
        <div class="button-grid">
          ${vectorObjectReview
            ? `<button id="panelCommitVectorObject" class="primary">Onayla</button><button id="panelSeparateVectorObject">Yeniden Çiz</button>`
            : `<button id="panelSeparateVectorObject">Tuvalde Alan Çiz</button>`}
          <button id="panelCancelVectorObject" ${state.vectorObjectTool.active && state.vectorObjectTool.patternId === pattern.id ? "" : "disabled"}>İptal</button>
        </div>
        ${vectorGateReviewControl}
        ${vectorObjectReviewHint}
      </div>`
    : "";
  const manualContourActive = state.vectorRepairTool.active
    && state.vectorRepairTool.mode === "create"
    && state.vectorRepairTool.patternId === pattern.id;
  const manualContourOperation = manualContourActive && state.vectorRepairTool.operation === "cut" ? "cut" : "engrave_line";
  const manualContourControl = hasVectorPaths
    ? `<div class="operation-card manual-contour-card">
        <div>
          <strong>Yeni açık kontur</strong>
          <span>${manualContourActive ? "Tuvalde çizime hazır" : "Eksik çizgi veya yeni detay ekleme"}</span>
        </div>
        <div class="manual-contour-steps" aria-label="Kontur çizme adımları">
          <span><b>1</b> Başlangıçta bas</span>
          <span><b>2</b> Basılı tutup çiz</span>
          <span><b>3</b> Bitişte bırak</span>
        </div>
        <small class="manual-contour-note">Yakındaki mevcut çizgiye otomatik yapışır. Uzakta bırakırsanız serbest uç olarak kaydolur.</small>
        <label>İşlem
          <select id="manualContourOperation">
            <option value="engrave_line" ${manualContourOperation === "engrave_line" ? "selected" : ""}>Kazıma çizgi</option>
            <option value="cut" ${manualContourOperation === "cut" ? "selected" : ""}>Kesim</option>
          </select>
        </label>
        <div class="button-grid">
          <button id="panelCreateVectorPath" class="${manualContourActive ? "primary" : ""}">${manualContourActive ? "Çizime Hazır" : "Yeni Kontur Çiz"}</button>
          <button id="panelFinishCreateVectorPath" ${manualContourActive ? "" : "disabled"}>Bitir</button>
        </div>
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
  const pathCounts = patternPathOperationCounts(pattern);
  const regionStats = pattern.regionClassification?.stats || {};
  const markedRegionCount = (pattern.regionClassification?.regions || []).filter((item) => item.resolved).length;
  const dominantFrameId = pattern.regionClassification?.dominantExteriorPathId;
  const cadFrameStateText = regionStats.dominantExteriorRemoved || regionStats.exteriorPromotionSuppressed
    ? `Dış çerçeve kaldırıldı. ${Number(regionStats.structuralExteriorPaths || 0)} büyük yeni dış kontur kesimde; kuş, ayak, çiçek gibi küçük ayrıntılar kazımada.`
    : dominantFrameId
      ? "Tasarımı saran baskın dış çerçeve kesimde; içerideki ayrıntılar kazımada."
      : "Baskın bir dış çerçeve bulunamadı. Tüm motifler kazımada; kesilecek kapalı alanları siz işaretleyebilirsiniz.";
  const cadRegionControl = cadLineArt
    ? `<div class="operation-card cad-region-card">
        <div>
          <strong>CAD dış / iç sınıflandırması</strong>
          <span>${cadFrameStateText}</span>
        </div>
        <div class="cad-region-counts">
          <span><b>${pathCounts.cut}</b> kesim konturu</span>
          <span><b>${pathCounts.engrave_line}</b> kazıma konturu</span>
          <span><b>${markedRegionCount}</b> işaretli alan</span>
          <span><b>${Number(regionStats.regionCount || 0)}</b> algılanan alan</span>
        </div>
        <div class="button-grid">
          ${dominantFrameId && !(regionStats.dominantExteriorRemoved || regionStats.exteriorPromotionSuppressed) ? `<button id="panelRemoveCadOuterFrame" class="danger">Dış Çerçeveyi Kaldır</button>` : ""}
          <button id="panelSelectCadCutRegion">Alanı Kesime Al</button>
          <button id="panelReclassifyCadRegions">Dış / İç Yeniden Sınıflandır</button>
          <button id="panelClearCadCutRegions" ${pattern.cutRegionSeeds?.length ? "" : "disabled"}>Alan İşaretlerini Temizle</button>
          <button data-operation="ignore">Deseni Yok Say</button>
        </div>
      </div>`
    : "";
  const customProcess = patternUsesCustomProcess(pattern);
  const cutPowerValue = customProcess ? Number(pattern.cutPower ?? pattern.power ?? mm("cutPower", 1000)) : mm("cutPower", 1000);
  const cutFeedValue = customProcess ? Number(pattern.cutFeed ?? pattern.feed ?? mm("cutFeed", 500)) : mm("cutFeed", 500);
  const engravePowerValue = customProcess ? Number(pattern.engravePower ?? pattern.power ?? mm("engravePower", 250)) : mm("engravePower", 250);
  const engraveFeedValue = customProcess ? Number(pattern.engraveFeed ?? pattern.feed ?? mm("engraveFeed", 1800)) : mm("engraveFeed", 1800);
  const processControls = cadLineArt
    ? `<label>Kesim gücü S <input data-pattern="cutPower" type="number" min="0" max="1000" step="10" value="${cutPowerValue}" /></label>
       <label>Kesim hızı F <input data-pattern="cutFeed" type="number" min="1" step="50" value="${cutFeedValue}" /></label>
       <label>Kazıma gücü S <input data-pattern="engravePower" type="number" min="0" max="1000" step="10" value="${engravePowerValue}" /></label>
       <label>Kazıma hızı F <input data-pattern="engraveFeed" type="number" min="1" step="50" value="${engraveFeedValue}" /></label>`
    : `<label>${operation === "cut" ? "Kesim gücü S" : "Kazıma gücü S"} <input data-pattern="power" type="number" min="0" max="1000" step="10" value="${operation === "cut" ? cutPowerValue : engravePowerValue}" /></label>
       <label>${operation === "cut" ? "Kesim hızı F" : "Kazıma hızı F"} <input data-pattern="feed" type="number" min="1" step="50" value="${operation === "cut" ? cutFeedValue : engraveFeedValue}" /></label>`;
  refs.selectionPanel.innerHTML = `
    <div class="property-title"><strong>${escapeHtml(pattern.name || "Desen")}</strong><span data-pattern-geometry-summary>${kindText} · ${patternOperationDisplayLabel(pattern)} · ${pattern.width.toFixed(2)} x ${pattern.height.toFixed(2)} mm${multiSelectionText}</span></div>
    ${wholeTextFillActionHtml(pattern)}
    ${svgInfo}
    ${vectorInfo}
    ${vectorQualityCard}
    ${semanticProposalControl}
    ${vectorObjectControl}
    ${manualContourControl}
    ${debugInfo}
    ${cadRegionControl}
    ${operationControl}
    ${vectorModeControl}
    <div class="form-grid">
      <label>X <input data-pattern="x" type="number" step="0.01" value="${pattern.x.toFixed(2)}" /></label>
      <label>Y <input data-pattern="y" type="number" step="0.01" value="${pattern.y.toFixed(2)}" /></label>
      <label>Genişlik <input data-pattern="width" type="number" min="1" step="0.01" value="${pattern.width.toFixed(2)}" /></label>
      <label>Yükseklik <input data-pattern="height" type="number" min="1" step="0.01" value="${pattern.height.toFixed(2)}" /></label>
      <label>Açı <input data-pattern="rotation" type="number" step="0.1" value="${pattern.rotation.toFixed(1)}" /></label>
      <label>Ek iç pay <input data-pattern="clipMargin" type="number" min="0" step="0.1" value="${Number(pattern.clipMargin || 0).toFixed(1)}" /></label>
      ${processControls}
      ${
        rasterControls ||
        (filledVectorEngrave
            ? `<label>Tarama aralığı <input data-pattern="lineStep" type="number" min="0.05" step="0.05" value="${pattern.lineStep}" /></label>`
            : "")
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
      <button id="panelDeletePattern" class="danger">Tüm Deseni Sil</button>
    </div>
  `;
  bindPatternPanel(pattern);
}

function renderVectorPathMultiPanel(entries) {
  const patternCount = new Set(entries.map((entry) => String(entry.pattern.id))).size;
  const singlePattern = patternCount === 1 ? entries[0]?.pattern : null;
  const lockedCount = entries.filter((entry) => entry.vectorPath.locked).length;
  const fillableCount = entries.filter((entry) => vectorPathSupportsFill(entry.vectorPath)).length;
  const operations = entries.map((entry) => vectorPathOperation(entry.vectorPath, entry.pattern));
  const commonOperation = operations.every((operation) => operation === operations[0]) ? operations[0] : "";
  refs.selectionPanel.innerHTML = `
    <div class="property-title">
      <strong>Çoklu Kontur Seçimi</strong>
      <span>${entries.length} kontur · ${patternCount} desen · ${fillableCount} kapalı${lockedCount ? ` · ${lockedCount} kilitli` : ""}</span>
    </div>
    ${wholeTextFillActionHtml(singlePattern)}
    <div class="operation-card vector-fill-operation-card">
      <div>
        <strong>Yalnız seçili konturların işlemi</strong>
        <span>Dolgu Motif yalnız kapalı konturları tarayarak kazır. Harflerin iç boşlukları otomatik bulunur ve korunur.</span>
      </div>
      <div class="operation-toggle">
        <button data-vector-selection-operation="cut" class="${commonOperation === "cut" ? "active danger-mode" : ""}">Kesim</button>
        <button data-vector-selection-operation="engrave_line" class="${commonOperation === "engrave_line" ? "active" : ""}">Çizgi kazıma</button>
        <button data-vector-selection-operation="engrave_fill" class="${commonOperation === "engrave_fill" ? "active" : ""}" ${fillableCount ? "" : "disabled"}>Dolgu Motif</button>
        <button data-vector-selection-operation="ignore" class="${commonOperation === "ignore" ? "active" : ""}">Yok say</button>
      </div>
      ${vectorFillSettingsHtml(entries)}
    </div>
    ${vectorPowerOverrideHtml(entries)}
    <div class="operation-card vector-move-card">
      <div><strong>Grup konumu</strong><span>Dünya koordinatında mm hareket</span></div>
      <div class="form-grid">
        <label>X hareket mm <input id="vectorMultiMoveX" type="number" step="0.01" value="0" /></label>
        <label>Y hareket mm <input id="vectorMultiMoveY" type="number" step="0.01" value="0" /></label>
      </div>
      <div class="nudge-pad">
        <span></span><button data-vector-multi-move="0,1" title="Yukarı">↑</button><span></span>
        <button data-vector-multi-move="-1,0" title="Sola">←</button><button data-vector-multi-move="0,-1" title="Aşağı">↓</button><button data-vector-multi-move="1,0" title="Sağa">→</button>
      </div>
      <button id="panelApplyVectorMultiMove" class="primary">Hareketi Uygula</button>
    </div>
    <div class="button-grid">
      <button id="panelClearVectorSelection">Seçimi Temizle</button>
      <button id="panelDeleteVectorSelection" class="danger">Seçilenleri Sil</button>
    </div>
  `;
  bindWholeTextFillAction(singlePattern);
  bindVectorPowerOverride(entries);
  refs.selectionPanel.querySelectorAll("[data-vector-selection-operation]").forEach((button) => {
    button.addEventListener("click", () => applySelectedVectorOperation(button.dataset.vectorSelectionOperation));
  });
  refs.selectionPanel.querySelectorAll("[data-vector-multi-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const [dx, dy] = button.dataset.vectorMultiMove.split(",").map(Number);
      const step = nudgeStep();
      moveSelectedVectorPathsByWorldMm(dx * step, dy * step, "Konturları taşı");
    });
  });
  document.getElementById("panelApplyVectorMultiMove")?.addEventListener("click", () => {
    const dx = Number(document.getElementById("vectorMultiMoveX")?.value) || 0;
    const dy = Number(document.getElementById("vectorMultiMoveY")?.value) || 0;
    moveSelectedVectorPathsByWorldMm(dx, dy, "Konturları taşı");
  });
  document.getElementById("panelClearVectorSelection")?.addEventListener("click", () => select(null, null));
  document.getElementById("panelDeleteVectorSelection")?.addEventListener("click", deleteSelectedVectorPaths);
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
  const tabCount = vectorPathTabCount(vectorPath);
  const tabWidth = vectorPathTabWidth(vectorPath);
  const microTabControl =
    operation === "cut" && vectorPath.closed
      ? `<div class="operation-card vector-tab-card">
      <div>
        <strong>Mikro köprü</strong>
        <span>Kapalı kesim konturunda kısa lazer-kapalı boşluklar bırakır; küçük parçalar kendiliğinden düşmesin diye kullanılır.</span>
      </div>
      <div class="form-grid">
        <label>Köprü adedi <input id="vectorPathTabCount" type="number" min="0" step="1" value="${tabCount || 2}" /></label>
        <label>Genişlik mm <input id="vectorPathTabWidth" type="number" min="0.1" step="0.05" value="${(tabWidth || 0.45).toFixed(2)}" /></label>
      </div>
      <div class="button-grid">
        <button id="panelApplyVectorPathTabs">Köprüleri Uygula</button>
        <button id="panelClearVectorPathTabs">Köprüleri Temizle</button>
      </div>
    </div>`
      : "";
  refs.selectionPanel.innerHTML = `
    <div class="property-title"><strong>Vektor konturu</strong><span>${escapeHtml(pattern.name || "Desen")}</span></div>
    ${wholeTextFillActionHtml(pattern)}
    <div class="svg-clean-info">
      <strong>Secili kontur</strong>
      <span>Nokta: ${(vectorPath.points || []).length}</span>
      <span>Alan: ${Number(vectorPath.area || 0).toFixed(1)} px</span>
      <span>Uzunluk: ${Number(vectorPath.length || 0).toFixed(1)} px · ${vectorPath.closed ? "Kapalı" : "Açık"}</span>
      <span>BBox: ${bboxText}</span>
      <span>Uyarı: ${escapeHtml(warnings)}</span>
      <span>Köprü: ${tabCount > 0 && tabWidth > 0 ? `${tabCount} adet · ${tabWidth.toFixed(2)} mm` : "Yok"}</span>
      <span>Aktif: ${activeCount} / ${totalCount}</span>
      <span>Koruma: ${escapeHtml(vectorPathProtectionLabel(pattern, vectorPath))}</span>
    </div>
    <div class="operation-card">
      <div>
        <strong>Yalnız bu konturun işlemi</strong>
        <span>${operationText}</span>
      </div>
      <div class="operation-toggle">
        <button data-vector-path-operation="cut" class="${operation === "cut" ? "active danger-mode" : ""}">Kesim</button>
        <button data-vector-path-operation="engrave_line" class="${operation === "engrave_line" ? "active" : ""}">Çizgi kazıma</button>
        <button data-vector-path-operation="engrave_fill" class="${operation === "engrave_fill" ? "active" : ""}" ${canFill ? "" : "disabled"}>Dolgu Motif</button>
        <button data-vector-path-operation="ignore" class="${operation === "ignore" ? "active" : ""}">Yok say</button>
      </div>
      ${vectorFillSettingsHtml([{ pattern, vectorPath }])}
    </div>
    ${vectorPowerOverrideHtml([{ pattern, vectorPath }])}
    ${microTabControl}
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
    <div class="operation-card vector-repair-card">
      <div>
        <strong>Yerel kontur düzeltme</strong>
        <span>Kısa çıkıntıyı tek tıklamayla düzleştirin veya bozuk bölümü fareyle yeniden çizin. Yeniden çizmede yeşil nokta, kontura tam yapışan başlangıç/bitiş yerini gösterir.</span>
      </div>
      <div class="form-grid">
        <label>Düzleştirme yarıçapı mm <input id="vectorPathRepairRadius" type="number" min="0.1" step="0.1" value="${Number(state.vectorRepairTool.radius || 1).toFixed(1)}" /></label>
      </div>
      <div class="button-grid">
        <button id="panelRepairVectorPath">Çıkıntıyı Düzleştir</button>
        <button id="panelRedrawVectorPath">Konturu Yeniden Çiz</button>
      </div>
    </div>
    <div class="operation-card vector-widen-card">
      <div>
        <strong>Yerel enine kalınlaştırma</strong>
        <span>İnce bacak veya sapın ortasına tıklayın. Çember içindeki kilitsiz çizgiler desenin X ekseninde iki yana açılır; çember sınırı ve dış bağlantılar sabit kalır.</span>
      </div>
      <div class="form-grid">
        <label>Etki yarıçapı mm <input id="vectorPathWidenRadius" type="number" min="0.2" step="0.1" value="${Number(state.vectorRepairTool.widenRadius || 7).toFixed(1)}" /></label>
        <label>Her yana ekle mm <input id="vectorPathWidenAmount" type="number" min="0.05" step="0.05" value="${Number(state.vectorRepairTool.widenAmount || 1.5).toFixed(2)}" /></label>
      </div>
      <button id="panelWidenVectorRegion">Tuvalde İnce Bölgeyi İşaretle</button>
    </div>
    <div class="button-grid">
      <button id="panelCreateAlignedCutCopy" class="primary aligned-cut-copy" title="Seçili konturu aynı konumda bağımsız kesim nesnesi yap">Hizalı Kesim Kopyası</button>
      <button id="panelCopyVectorPath">Konturu Kopyala</button>
      <button id="panelDeleteVectorPath" class="danger">Konturu Sil</button>
      <button id="panelSelectVectorPattern">Tum Deseni Sec</button>
    </div>
  `;
  bindWholeTextFillAction(pattern);
  bindVectorPowerOverride([{ pattern, vectorPath }]);
  refs.selectionPanel.querySelectorAll("[data-vector-path-operation]").forEach((button) => {
    button.addEventListener("click", () => applySelectedVectorOperation(button.dataset.vectorPathOperation));
  });
  document.getElementById("panelApplyVectorPathTabs")?.addEventListener("click", () => {
    const nextCount = Math.max(0, Math.round(Number(document.getElementById("vectorPathTabCount")?.value) || 0));
    const nextWidth = Math.max(0, Number(document.getElementById("vectorPathTabWidth")?.value) || 0);
    pushUndo("Mikro kopru ayari");
    if (nextCount <= 0 || nextWidth <= 0) {
      clearMicroTabsFromVectorPath(vectorPath);
    } else {
      vectorPath.tabCount = nextCount;
      vectorPath.tabWidth = nextWidth;
    }
    draw();
    updateSelectionPanel();
    updateJobAnalysisNow();
    setStatus(nextCount > 0 && nextWidth > 0 ? `Seçili kontura ${nextCount} adet ${nextWidth.toFixed(2)} mm mikro köprü uygulandı.` : "Seçili konturun mikro köprüleri temizlendi.", "ok");
  });
  document.getElementById("panelClearVectorPathTabs")?.addEventListener("click", () => {
    if (!vectorPathTabCount(vectorPath) && !vectorPathTabWidth(vectorPath)) return;
    pushUndo("Mikro kopru temizle");
    clearMicroTabsFromVectorPath(vectorPath);
    draw();
    updateSelectionPanel();
    updateJobAnalysisNow();
    setStatus("Seçili konturun mikro köprüleri temizlendi.", "ok");
  });
  document.getElementById("panelRepairVectorPath")?.addEventListener("click", () => {
    const radius = Math.max(0.1, Number(document.getElementById("vectorPathRepairRadius")?.value) || 1);
    cancelVectorRegionSelection();
    state.materialArea.drawing = false;
    state.materialArea.previewPoint = null;
    state.vectorRepairTool.active = true;
    state.vectorRepairTool.mode = "straighten";
    state.vectorRepairTool.drawing = false;
    state.vectorRepairTool.patternId = pattern.id;
    state.vectorRepairTool.pathId = vectorPath.id;
    state.vectorRepairTool.radius = radius;
    state.vectorRepairTool.startAnchor = null;
    state.vectorRepairTool.draftWorldPoints = [];
    state.vectorRepairTool.pointerId = null;
    canvas.style.cursor = "none";
    draw();
    setStatus(`Yerel düzeltme aktif: hatalı çıkıntının üzerine tıklayın (${radius.toFixed(1)} mm).`);
  });
  document.getElementById("panelRedrawVectorPath")?.addEventListener("click", () => {
    cancelVectorRegionSelection();
    state.materialArea.drawing = false;
    state.materialArea.previewPoint = null;
    state.vectorRepairTool.active = true;
    state.vectorRepairTool.mode = "redraw";
    state.vectorRepairTool.drawing = false;
    state.vectorRepairTool.patternId = pattern.id;
    state.vectorRepairTool.pathId = vectorPath.id;
    state.vectorRepairTool.startIndex = null;
    state.vectorRepairTool.startAnchor = null;
    state.vectorRepairTool.draftWorldPoints = [];
    state.vectorRepairTool.pointerId = null;
    canvas.style.cursor = "none";
    draw();
    setStatus("Konturu yeniden çiz: mevcut çizginin üzerinden başlayın, fareyi basılı tutarak yeni eğriyi çizin ve yine konturun üzerinde bırakın.");
  });
  document.getElementById("panelWidenVectorRegion")?.addEventListener("click", () => {
    const radius = Math.max(0.2, Number(document.getElementById("vectorPathWidenRadius")?.value) || 7);
    const amount = Math.min(radius * 0.45, Math.max(0.05, Number(document.getElementById("vectorPathWidenAmount")?.value) || 1.5));
    cancelVectorRegionSelection();
    state.materialArea.drawing = false;
    state.materialArea.previewPoint = null;
    state.vectorRepairTool.active = true;
    state.vectorRepairTool.mode = "widen";
    state.vectorRepairTool.drawing = false;
    state.vectorRepairTool.patternId = pattern.id;
    state.vectorRepairTool.pathId = vectorPath.id;
    state.vectorRepairTool.widenRadius = radius;
    state.vectorRepairTool.widenAmount = amount;
    state.vectorRepairTool.startAnchor = null;
    state.vectorRepairTool.draftWorldPoints = [];
    state.vectorRepairTool.pointerId = null;
    canvas.style.cursor = "none";
    draw();
    setStatus(`Yerel kalınlaştırma aktif: ince bölgenin ortasına tıklayın (yarıçap ${radius.toFixed(1)} mm, her yana +${amount.toFixed(2)} mm).`, "info");
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
      moveSelectedVectorPathsByWorldMm(dx * step, dy * step, "Konturu taşı");
    });
  });
  document.getElementById("panelApplyVectorPathMove")?.addEventListener("click", () => {
    const dx = Number(document.getElementById("vectorPathMoveX")?.value) || 0;
    const dy = Number(document.getElementById("vectorPathMoveY")?.value) || 0;
    if (!dx && !dy) return;
    moveSelectedVectorPathsByWorldMm(dx, dy, "Konturu taşı");
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
  document.getElementById("panelCreateAlignedCutCopy")?.addEventListener("click", createAlignedCutCopyFromSelectedVectorPath);
  document.getElementById("panelCopyVectorPath").addEventListener("click", copySelectedVectorPath);
  document.getElementById("panelDeleteVectorPath").addEventListener("click", deleteSelectedVectorPaths);
  document.getElementById("panelSelectVectorPattern").addEventListener("click", () => {
    select("pattern", pattern.id);
  });
}

function renderVectorObjectPanel(pattern, vectorObject) {
  if (!pattern || !vectorObject) {
    select(null, null);
    return;
  }
  const components = {
    translateX: Number(vectorObject.transformComponents?.translateX) || 0,
    translateY: Number(vectorObject.transformComponents?.translateY) || 0,
    scaleX: Number(vectorObject.transformComponents?.scaleX) || 1,
    scaleY: Number(vectorObject.transformComponents?.scaleY) || 1,
    rotation: Number(vectorObject.transformComponents?.rotation) || 0,
  };
  const operation = normalizeOperation(vectorObject.operation, patternOperation(pattern));
  const emittedCount = (vectorObject.edgeRefs || []).filter((edgeRef) => edgeRef.emit !== false).length;
  const hiddenCount = (vectorObject.edgeRefs || []).length - emittedCount;
  const attachmentPolicy = ["detached", "pinned", "shared-joint"].includes(vectorObject.attachmentPolicy)
    ? vectorObject.attachmentPolicy
    : String(vectorObject.attachments?.[0]?.policy || "detached");
  const attachmentCount = (vectorObject.attachments || []).length;
  const translationLocked = vectorObject.locked || attachmentPolicy !== "detached";
  const sharedTransformLocked = vectorObject.locked || (attachmentPolicy === "shared-joint" && attachmentCount > 1);
  const maskCount = (pattern.occlusionMasks || []).filter((mask) => String(mask.ownerObjectId || "") === String(vectorObject.id)).length;
  const powerEntries = selectedVectorOperationEntries();
  refs.selectionPanel.innerHTML = `
    <div class="property-title">
      <strong>${escapeHtml(vectorObject.name || "Ayrılmış nesne")}</strong>
      <span>Bağımsız vektör nesnesi · ${emittedCount} aktif kontur${hiddenCount ? ` · ${hiddenCount} gizli alt parça` : ""}</span>
    </div>
    <div class="operation-card vector-object-card">
      <div>
        <strong>Graph sahipliği</strong>
        <span>Bu konturlar tek bir nesneye aittir. Buradaki dönüşüm ana dalı veya diğer nesneleri değiştirmez.</span>
      </div>
      <label>Nesne adı <input id="vectorObjectName" type="text" value="${escapeHtml(vectorObject.name || "Ayrılmış nesne")}" /></label>
      <label>Bağlantı politikası
        <select id="vectorObjectAttachmentPolicyEdit" ${attachmentCount ? "" : "disabled"}>
          <option value="detached" ${attachmentPolicy === "detached" ? "selected" : ""}>Serbest</option>
          <option value="pinned" ${attachmentPolicy === "pinned" ? "selected" : ""}>Sabit nokta</option>
          <option value="shared-joint" ${attachmentPolicy === "shared-joint" ? "selected" : ""}>Ortak mafsal</option>
        </select>
      </label>
      <span class="hint">${attachmentCount} graph gate · ${maskCount} aktif alt-çizgi maskesi${attachmentPolicy === "shared-joint" && attachmentCount > 1 ? " · Çoklu mafsal dönüşümü kilitler" : ""}</span>
      <label class="checkline"><input id="vectorObjectLocked" type="checkbox" ${vectorObject.locked ? "checked" : ""} /><span>Konumu ve ölçüyü kilitle</span></label>
    </div>
    <div class="operation-card">
      <div><strong>İşlem</strong><span>İşlem bu nesnenin sahip olduğu konturlara uygulanır.</span></div>
      <div class="operation-toggle">
        <button data-vector-object-operation="cut" class="${operation === "cut" ? "active danger-mode" : ""}">Kesim</button>
        <button data-vector-object-operation="engrave_line" class="${operation === "engrave_line" ? "active" : ""}">Kazıma çizgi</button>
        <button data-vector-object-operation="engrave_fill" class="${operation === "engrave_fill" ? "active" : ""}">Kazıma dolgu</button>
        <button data-vector-object-operation="ignore" class="${operation === "ignore" ? "active" : ""}">Yok say</button>
      </div>
    </div>
    ${vectorPowerOverrideHtml(powerEntries)}
    <div class="operation-card vector-object-transform-card">
      <div>
        <strong>Bağımsız dönüşüm</strong>
        <span>${attachmentPolicy === "detached" ? "Değerler nesnenin kendi merkezi ve yerel mm eksenlerindedir." : attachmentPolicy === "pinned" ? "Konum gate üzerinde sabittir; ölçek ve açı gate etrafında uygulanır." : "Ortak mafsal korunur; birden çok gate varsa dönüşüm aşırı kısıtlıdır."}</span>
      </div>
      <div class="form-grid">
        <label>X hareket mm <input id="vectorObjectTranslateX" type="number" step="0.1" value="${components.translateX.toFixed(2)}" ${translationLocked ? "disabled" : ""} /></label>
        <label>Y hareket mm <input id="vectorObjectTranslateY" type="number" step="0.1" value="${components.translateY.toFixed(2)}" ${translationLocked ? "disabled" : ""} /></label>
        <label>X ölçek % <input id="vectorObjectScaleX" type="number" min="1" step="1" value="${(components.scaleX * 100).toFixed(1)}" ${sharedTransformLocked ? "disabled" : ""} /></label>
        <label>Y ölçek % <input id="vectorObjectScaleY" type="number" min="1" step="1" value="${(components.scaleY * 100).toFixed(1)}" ${sharedTransformLocked ? "disabled" : ""} /></label>
        <label>Açı <input id="vectorObjectRotation" type="number" step="0.1" value="${components.rotation.toFixed(1)}" ${sharedTransformLocked ? "disabled" : ""} /></label>
      </div>
      <div class="nudge-pad">
        <span></span><button data-vector-object-move="0,1" ${translationLocked ? "disabled" : ""}>↑</button><span></span>
        <button data-vector-object-move="-1,0" ${translationLocked ? "disabled" : ""}>←</button><button data-vector-object-move="0,-1" ${translationLocked ? "disabled" : ""}>↓</button><button data-vector-object-move="1,0" ${translationLocked ? "disabled" : ""}>→</button>
      </div>
      <div class="button-grid">
        <button id="panelApplyVectorObjectTransform" ${sharedTransformLocked ? "disabled" : ""}>Dönüşümü Uygula</button>
        <button id="panelResetVectorObjectTransform" ${vectorObject.locked ? "disabled" : ""}>Sıfırla</button>
      </div>
    </div>
    <div class="button-grid">
      <button id="panelSelectVectorObjectPattern">Tüm Deseni Seç</button>
      <button id="panelRemoveVectorObject" class="danger">Nesneyi Yok Say</button>
    </div>
  `;

  bindVectorPowerOverride(powerEntries);
  const applyTransform = (updates, label = "Vektör nesnesi dönüşümü") => {
    if (vectorObject.locked) {
      setStatus("Nesnenin kilidini kaldırmadan dönüşüm uygulanamaz.", "warn");
      return;
    }
    try {
      pushUndo(label);
      updatePatternVectorObjectTransform(pattern, vectorObject.id, updates);
      draw();
      updateSelectionPanel();
      updateJobAnalysisNow();
    } catch (error) {
      setStatus(error.message, "danger");
    }
  };
  document.getElementById("vectorObjectName")?.addEventListener("change", (event) => {
    const name = String(event.target.value || "").trim() || "Ayrılmış nesne";
    if (name === vectorObject.name) return;
    pushUndo("Vektör nesnesini adlandır");
    vectorObject.name = name;
    updateSelectionPanel();
  });
  document.getElementById("vectorObjectLocked")?.addEventListener("change", (event) => {
    pushUndo("Vektör nesnesi kilidi");
    vectorObject.locked = Boolean(event.target.checked);
    updateSelectionPanel();
    draw();
  });
  document.getElementById("vectorObjectAttachmentPolicyEdit")?.addEventListener("change", (event) => {
    try {
      pushUndo("Vektör bağlantı politikası");
      setPatternVectorObjectAttachmentPolicy(pattern, vectorObject.id, event.target.value);
      draw();
      updateSelectionPanel();
      updateJobAnalysisNow();
      setStatus("Bağlantı politikası değiştirildi; nesne dönüşümü güvenli konuma sıfırlandı.", "ok");
    } catch (error) {
      setStatus(error.message, "danger");
      updateSelectionPanel();
    }
  });
  refs.selectionPanel.querySelectorAll("[data-vector-object-operation]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        pushUndo("Vektör nesnesi işlemi");
        setPatternVectorObjectOperation(pattern, vectorObject.id, button.dataset.vectorObjectOperation);
        draw();
        updateSelectionPanel();
        updateJobAnalysisNow();
      } catch (error) {
        setStatus(error.message, "danger");
      }
    });
  });
  document.getElementById("panelApplyVectorObjectTransform")?.addEventListener("click", () => {
    applyTransform({
      translateX: Number(document.getElementById("vectorObjectTranslateX")?.value) || 0,
      translateY: Number(document.getElementById("vectorObjectTranslateY")?.value) || 0,
      scaleX: Math.max(0.01, (Number(document.getElementById("vectorObjectScaleX")?.value) || 100) / 100),
      scaleY: Math.max(0.01, (Number(document.getElementById("vectorObjectScaleY")?.value) || 100) / 100),
      rotation: Number(document.getElementById("vectorObjectRotation")?.value) || 0,
    });
  });
  document.getElementById("panelResetVectorObjectTransform")?.addEventListener("click", () => {
    applyTransform({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 }, "Vektör nesnesi dönüşümünü sıfırla");
  });
  refs.selectionPanel.querySelectorAll("[data-vector-object-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const [dx, dy] = button.dataset.vectorObjectMove.split(",").map(Number);
      const step = nudgeStep();
      applyTransform({
        translateX: components.translateX + dx * step,
        translateY: components.translateY + dy * step,
      }, "Vektör nesnesini taşı");
    });
  });
  document.getElementById("panelSelectVectorObjectPattern")?.addEventListener("click", () => select("pattern", pattern.id));
  document.getElementById("panelRemoveVectorObject")?.addEventListener("click", () => {
    try {
      pushUndo("Vektör nesnesini yok say");
      syncPatternVectorModelFromPaths(pattern);
      const next = clonePlain(patternVectorModel(pattern));
      const target = vectorObjectById(next, vectorObject.id);
      if (!target) throw new Error("Vektör nesnesi bulunamadı.");
      target.removed = true;
      next.objectTransformRevision = Math.max(0, Number(next.objectTransformRevision) || 0) + 1;
      applyPatternVectorModel(pattern, next);
      compilePatternVectorModel(pattern);
      select("pattern", pattern.id);
      updateJobAnalysisNow();
      setStatus("Ayrılmış nesne G-code dışına alındı.", "ok");
    } catch (error) {
      setStatus(error.message, "danger");
    }
  });
}

function bindPatternPanel(pattern) {
  bindWholeTextFillAction(pattern);
  refs.selectionPanel.querySelectorAll("[data-pattern]").forEach((input) => {
    bindUndoBeforeEdit(input, "Desen ayari");
    input.addEventListener("input", () => {
      const key = input.dataset.pattern;
      const value = Number(input.value) || 0;
      const processEdit = ["power", "feed", "powerMin", "cutPower", "cutFeed", "engravePower", "engraveFeed"].includes(key);
      if (processEdit) enablePatternProcessOverride(pattern);
      const geometryEdit = ["x", "y", "width", "height", "rotation"].includes(key);
      if (geometryEdit) {
        beginCanvasInteraction("pattern-panel-geometry", {
          pattern,
          preserveLocked: key === "width" || key === "height",
        });
      }
      if (key === "width" || key === "height") {
        updatePatternGeometry(pattern, { [key]: value }, { preserveLocked: false });
      } else {
        pattern[key] = value;
      }
      if (["power", "powerMin", "cutPower", "engravePower"].includes(key)) {
        pattern[key] = clamp(Math.round(pattern[key]), 0, 1000);
      }
      if (["feed", "cutFeed", "engraveFeed"].includes(key)) pattern[key] = Math.max(1, pattern[key]);
      if (key === "power") {
        if (patternOperation(pattern) === "cut") pattern.cutPower = pattern.power;
        else pattern.engravePower = pattern.power;
      }
      if (key === "feed") {
        if (patternOperation(pattern) === "cut") pattern.cutFeed = pattern.feed;
        else pattern.engraveFeed = pattern.feed;
      }
      if (key === "engravePower") pattern.power = pattern.engravePower;
      if (key === "engraveFeed") pattern.feed = pattern.engraveFeed;
      if (key === "gamma") pattern[key] = Math.max(0.2, Math.min(4, pattern[key]));
      if (key === "lineStep") {
        pattern[key] = Math.max(0.05, pattern[key]);
        if (outlineTextPattern(pattern)) {
          pattern.textSettings = { ...(pattern.textSettings || {}), fillLineStep: pattern[key] };
        }
      }
      if (key === "threshold") pattern[key] = clamp(Math.round(pattern[key]), 0, 255);
      if (key === "clipMargin") pattern[key] = Math.max(0, pattern[key]);
      requestCanvasDraw();
      if (geometryEdit) scheduleCanvasInteractionEnd(220);
    });
    input.addEventListener("change", () => {
      const geometryEdit = ["x", "y", "width", "height", "rotation"].includes(input.dataset.pattern);
      if (!geometryEdit) return;
      if (canvasInteraction?.kind === "pattern-panel-geometry" && canvasInteraction.patternId === pattern.id) {
        finishCanvasInteraction();
      } else {
        flushCanvasDraw();
        updateJobAnalysisNow();
      }
      if (!syncPatternPanelGeometry(pattern)) updateSelectionPanel();
    });
  });
  refs.selectionPanel.querySelectorAll("[data-pattern-text]").forEach((input) => {
    input.addEventListener("change", () => {
      pushUndo("Desen ayari");
      pattern[input.dataset.patternText] = input.value;
      draw();
      updateSelectionPanel();
      updateJobAnalysisNow();
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
  document.getElementById("manualContourOperation")?.addEventListener("change", (event) => {
    if (state.vectorRepairTool.active && state.vectorRepairTool.mode === "create" && state.vectorRepairTool.patternId === pattern.id) {
      state.vectorRepairTool.operation = event.target.value === "cut" ? "cut" : "engrave_line";
    }
  });
  document.getElementById("panelCreateVectorPath")?.addEventListener("click", () => {
    const operation = document.getElementById("manualContourOperation")?.value || "engrave_line";
    if (beginNewVectorPathDrawing(pattern, operation)) {
      draw();
      updateSelectionPanel();
    }
  });
  document.getElementById("panelFinishCreateVectorPath")?.addEventListener("click", () => {
    cancelVectorRepairTool("Yeni kontur çizimi tamamlandı.");
    draw();
    updateSelectionPanel();
  });
  document.getElementById("panelSeparateVectorObject")?.addEventListener("click", () => {
    const policy = document.getElementById("vectorObjectUnderlayPolicy")?.value || "emit-underlay";
    const attachmentPolicy = document.getElementById("vectorObjectAttachmentPolicy")?.value || "detached";
    beginVectorObjectSeparation(pattern, policy, attachmentPolicy);
    updateSelectionPanel();
  });
  refs.selectionPanel.querySelectorAll("[data-vector-object-proposal]").forEach((button) => {
    button.addEventListener("click", () => {
      const policy = document.getElementById("vectorObjectUnderlayPolicy")?.value || "emit-underlay";
      const attachmentPolicy = document.getElementById("vectorObjectAttachmentPolicy")?.value || "detached";
      void previewSemanticVectorProposal(pattern, button.dataset.vectorObjectProposal, policy, attachmentPolicy);
    });
  });
  refs.selectionPanel.querySelectorAll("[data-vector-gate-toggle]").forEach((button) => {
    button.addEventListener("click", () => void toggleVectorObjectGate(pattern, button.dataset.vectorGateToggle));
  });
  const refreshReviewPolicy = () => {
    const review = state.vectorObjectTool.review;
    if (!review || state.vectorObjectTool.patternId !== pattern.id) return;
    void requestSemanticVectorPreview(pattern, {
      foregroundEdgeIds: review.seedForegroundEdgeIds || [],
      backgroundEdgeIds: review.seedBackgroundEdgeIds || [],
    }, {
      proposalId: review.proposalId,
      name: review.name,
      crossingEdges: review.crossingEdges,
    });
  };
  document.getElementById("vectorObjectUnderlayPolicy")?.addEventListener("change", (event) => {
    state.vectorObjectTool.policy = event.target.value;
    refreshReviewPolicy();
  });
  document.getElementById("vectorObjectAttachmentPolicy")?.addEventListener("change", (event) => {
    state.vectorObjectTool.attachmentPolicy = event.target.value;
    refreshReviewPolicy();
  });
  document.getElementById("panelCommitVectorObject")?.addEventListener("click", () => {
    commitVectorObjectSeparation();
  });
  document.getElementById("panelCancelVectorObject")?.addEventListener("click", () => {
    cancelVectorObjectSeparation("Nesne ayırma iptal edildi.");
    draw();
    updateSelectionPanel();
  });
  document.getElementById("panelSelectCadCutRegion")?.addEventListener("click", () => {
    beginVectorRegionSelection(pattern);
    draw();
  });
  document.getElementById("panelRemoveCadOuterFrame")?.addEventListener("click", async () => {
    const frameId = pattern.regionClassification?.dominantExteriorPathId;
    const framePath = (pattern.vectorPaths || []).find((item) => String(item.id || "") === String(frameId || ""));
    if (!framePath || framePath.removed) {
      setStatus("Kaldırılacak baskın dış çerçeve bulunamadı.", "warn");
      return;
    }
    pushUndo("Dış çerçeveyi kaldır");
    framePath.removed = true;
    try {
      const classification = await reclassifyCadLineArtPattern(pattern);
      setStatus(cadContourRemovalStatus(classification), "ok");
    } catch (error) {
      framePath.removed = false;
      setStatus(error.message || "Dış çerçeve kaldırılamadı.", "danger");
      draw();
      updateSelectionPanel();
    }
  });
  document.getElementById("panelReclassifyCadRegions")?.addEventListener("click", async () => {
    pushUndo("Dış iç sınıflandır");
    try {
      const classification = await reclassifyCadLineArtPattern(pattern, { resetManual: true });
      const cutCount = classification?.cutPathIds?.length || 0;
      setStatus(`Dış ve iç konturlar yenilendi; ${cutCount} kontur kesim olarak ayarlandı.`, "ok");
    } catch (error) {
      setStatus(error.message || "Dış ve iç konturlar sınıflandırılamadı.", "danger");
    }
  });
  document.getElementById("panelClearCadCutRegions")?.addEventListener("click", async () => {
    if (!pattern.cutRegionSeeds?.length) return;
    pushUndo("Kesim alanlarını temizle");
    pattern.cutRegionSeeds = [];
    try {
      await reclassifyCadLineArtPattern(pattern);
      setStatus("İşaretli alanlar temizlendi; yalnız dış sınırlar kesimde kaldı.", "ok");
    } catch (error) {
      setStatus(error.message || "Alan işaretleri temizlenemedi.", "danger");
    }
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
  document.getElementById("panelRestoreVectorPaths")?.addEventListener("click", async () => {
    pushUndo("Konturlari geri yukle");
    resetPatternVectorModel(pattern);
    if (pattern.originalVectorPaths?.length) {
      pattern.vectorPaths = cloneVectorPaths(pattern.originalVectorPaths);
    } else {
      for (const vectorPath of pattern.vectorPaths || []) vectorPath.removed = false;
    }
    if (isCadLineArtPattern(pattern)) {
      try {
        await reclassifyCadLineArtPattern(pattern);
      } catch (error) {
        setStatus(error.message || "Konturlar geri yüklendi ancak yeniden sınıflandırılamadı.", "warn");
        draw();
        updateSelectionPanel();
      }
    } else {
      draw();
      updateSelectionPanel();
    }
  });
  document.getElementById("panelDeletePattern").addEventListener("click", () => {
    deleteWholePatterns([pattern]);
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

function boundsDistance(first, second) {
  if (!first || !second) return Infinity;
  const dx = first.maxX < second.minX ? second.minX - first.maxX : second.maxX < first.minX ? first.minX - second.maxX : 0;
  const dy = first.maxY < second.minY ? second.minY - first.maxY : second.maxY < first.minY ? first.minY - second.maxY : 0;
  return Math.hypot(dx, dy);
}

function polylineMinimumDistance(firstPoints, secondPoints, firstClosed = false, secondClosed = false, stopAt = 0) {
  let best = Infinity;
  for (const point of firstPoints || []) {
    best = Math.min(best, distanceToPolyline(point, secondPoints, secondClosed));
    if (stopAt > 0 && best <= stopAt) return best;
  }
  for (const point of secondPoints || []) {
    best = Math.min(best, distanceToPolyline(point, firstPoints, firstClosed));
    if (stopAt > 0 && best <= stopAt) return best;
  }
  return best;
}

function cutSuitabilityIssuesForPattern(pattern, kerf = Math.min(1, Math.max(0, mm("kerf", 0)))) {
  if (!vectorPatternHasPaths(pattern) || patternOperation(pattern) === "ignore") return [];
  const openCutPaths = [];
  const smallClosedPaths = [];
  const closedCutPaths = [];
  const smallAreaLimit = 35;
  const smallDimensionLimit = 3.5;
  const openGapLimit = Math.max(0.5, kerf * 1.5);
  const bridgeLimit = Math.max(0.8, kerf * 2.2);

  for (const vectorPath of pattern.vectorPaths || []) {
    if (!vectorPathIsActive(vectorPath, pattern) || vectorPathOperation(vectorPath, pattern) !== "cut") continue;
    const worldPoints = vectorWorldPath(pattern, vectorPath);
    if (worldPoints.length < 2) continue;
    const closed = Boolean(vectorPath.closed);
    const bounds = boundsFromPoints(worldPoints);
    const size = bounds ? boundsSize(bounds) : { width: 0, height: 0 };
    if (!closed) {
      const first = worldPoints[0];
      const last = worldPoints[worldPoints.length - 1];
      const gap = Math.hypot(first.x - last.x, first.y - last.y);
      if (gap > openGapLimit) openCutPaths.push({ vectorPath, gap });
      continue;
    }
    const area = worldPolygonArea(worldPoints);
    const minDimension = Math.min(Math.abs(size.width), Math.abs(size.height));
    const entry = { vectorPath, points: worldPoints, bounds, area, minDimension };
    closedCutPaths.push(entry);
    if (area > 0 && (area <= smallAreaLimit || minDimension <= smallDimensionLimit) && !(vectorPathTabCount(vectorPath) > 0 && vectorPathTabWidth(vectorPath) > 0)) {
      smallClosedPaths.push(entry);
    }
  }

  const issues = [];
  if (openCutPaths.length) {
    const largestGap = Math.max(...openCutPaths.map((item) => item.gap));
    issues.push({
      level: "warning",
      title: "Kesimde açık vektör konturu var",
      body: `${pattern.name || "Desen"} içinde ${openCutPaths.length} açık kesim konturu var. En büyük uç açıklığı ${largestGap.toFixed(2)} mm; parça tam kopmayabilir veya beklenmeyen çizgi kesilebilir.`,
      action: "Deseni seç",
      target: "cut-suitability",
      patternId: pattern.id,
    });
  }

  if (smallClosedPaths.length) {
    const smallest = smallClosedPaths.reduce((best, item) => (item.area < best.area ? item : best), smallClosedPaths[0]);
    issues.push({
      level: "warning",
      title: "Küçük düşecek parça riski",
      body: `${pattern.name || "Desen"} içinde ${smallClosedPaths.length} küçük kapalı kesim konturu var. En küçük alan ${smallest.area.toFixed(1)} mm² / dar ölçü ${smallest.minDimension.toFixed(2)} mm; mikro tab gerekebilir.`,
      action: "Köprü ekle",
      target: "cut-suitability",
      fix: "micro-tabs",
      patternId: pattern.id,
      pathIds: smallClosedPaths.map((item) => item.vectorPath.id).filter(Boolean),
    });
  }

  const bridgeContourLimit = 180;
  const bridgeDistanceBudget = 1500000;
  const bridgePointCount = closedCutPaths.reduce((total, item) => total + item.points.length, 0);
  const bridgePairs = [];
  let bridgeDistanceCost = 0;
  let bridgeSkipReason = closedCutPaths.length > bridgeContourLimit ? "contours" : "";
  if (!bridgeSkipReason) {
    pairScan:
    for (let i = 0; i < closedCutPaths.length; i += 1) {
      for (let j = i + 1; j < closedCutPaths.length; j += 1) {
        const first = closedCutPaths[i];
        const second = closedCutPaths[j];
        if (boundsDistance(first.bounds, second.bounds) > bridgeLimit) continue;
        bridgeDistanceCost += first.points.length * second.points.length * 2;
        if (bridgeDistanceCost > bridgeDistanceBudget) {
          bridgeSkipReason = "points";
          bridgePairs.length = 0;
          break pairScan;
        }
        bridgePairs.push([first, second]);
      }
    }
  }
  let narrowBridgeCount = 0;
  let narrowestBridge = Infinity;
  for (const [first, second] of bridgePairs) {
    const distance = polylineMinimumDistance(first.points, second.points, true, true, bridgeLimit);
    if (distance <= bridgeLimit) {
      narrowBridgeCount += 1;
      narrowestBridge = Math.min(narrowestBridge, distance);
    }
  }
  if (narrowBridgeCount) {
    issues.push({
      level: "warning",
      title: "İnce köprü / yanma riski",
      body: `${pattern.name || "Desen"} içinde ${narrowBridgeCount} kontur çifti ${bridgeLimit.toFixed(2)} mm'den yakın. En dar mesafe ${narrowestBridge.toFixed(2)} mm; hız/güç veya mikro tab kontrolü önerilir.`,
      action: "Deseni seç",
      target: "cut-suitability",
      patternId: pattern.id,
    });
  } else if (bridgeSkipReason) {
    const reason = bridgeSkipReason === "contours"
      ? `${closedCutPaths.length} kapalı kesim konturu`
      : `${closedCutPaths.length} konturda ${bridgePointCount.toLocaleString("tr-TR")} nokta`;
    issues.push({
      level: "info",
      title: "Köprü denetimi atlandı",
      body: `${pattern.name || "Desen"} içinde ${reason} var. Yakınlık denetimi arayüzü kilitlememek için atlandı; gerekirse deseni parçalara ayırıp kontrol edin.`,
      action: "Deseni seç",
      target: "cut-suitability",
      patternId: pattern.id,
    });
  }
  return issues;
}

function applyMicroTabsToVectorPaths(pattern, pathIds = null, options = {}) {
  if (!vectorPatternHasPaths(pattern)) return 0;
  const ids = pathIds?.length ? new Set(pathIds) : null;
  const tabCount = Math.max(1, Math.round(Number(options.tabCount ?? 2) || 2));
  const tabWidth = Math.max(0.1, Number(options.tabWidth ?? 0.45) || 0.45);
  let changed = 0;
  for (const vectorPath of pattern.vectorPaths || []) {
    if (ids && !ids.has(vectorPath.id)) continue;
    if (!vectorPathIsActive(vectorPath, pattern) || vectorPathOperation(vectorPath, pattern) !== "cut" || !vectorPath.closed) continue;
    vectorPath.tabCount = tabCount;
    vectorPath.tabWidth = tabWidth;
    changed += 1;
  }
  return changed;
}

function clearMicroTabsFromVectorPath(vectorPath) {
  if (!vectorPath) return;
  delete vectorPath.tabCount;
  delete vectorPath.tabWidth;
  delete vectorPath.microTabCount;
  delete vectorPath.microTabWidth;
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
    const cutSuitabilityIssues = active ? cutSuitabilityIssuesForPattern(pattern, kerf) : [];
    const vectorModelIssues = vectorModelValidation(pattern);
    return { pattern, operation, bounds, active, inside, pathCount, pathCounts, cutSuitabilityIssues, vectorModelIssues };
  });

  const activePlacements = placements.filter((item) => item.active);
  const activePatterns = patterns.filter((item) => item.active && item.pathCount > 0);
  const productionPlacements = activePlacements.filter((item) => item.inside && item.physicalFits);
  const productionPlacementIds = new Set(productionPlacements.map((item) => item.placement.id));
  const productionPatterns = activePatterns.filter(
    (item) => item.inside && (!item.pattern.parentId || productionPlacementIds.has(item.pattern.parentId))
  );
  for (const item of patterns) {
    item.production = productionPatterns.includes(item);
    item.boundaryIssue = item.production ? patternBoundaryIssue(item.pattern, productionPlacements) : null;
  }
  const patternBoundaryIssues = productionPatterns.map((item) => item.boundaryIssue).filter(Boolean);
  const cutSuitabilityIssues = productionPatterns.flatMap((item) => item.cutSuitabilityIssues || []);
  const outsidePlacements = activePlacements.filter((item) => !item.inside || !item.physicalFits);
  const outsidePatterns = activePatterns.filter((item) => !productionPatterns.includes(item));
  const oversizedParts = state.parts.filter((part) =>
    activePlacements.some((item) => item.part?.id === part.id && !item.physicalFits)
  );
  const placedInside = productionPlacements.length;
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

  for (const item of productionPlacements) {
    const pathCount = item.part?.paths?.length || 0;
    if (item.operation === "cut") cutPathCount += pathCount;
    else if (item.operation === "engrave_fill") engraveFillCount += pathCount;
    else engraveLineCount += pathCount;
  }
  for (const item of productionPatterns) {
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
  const outsideCount = outsidePlacements.length + outsidePatterns.length;
  if (outsideCount) {
    warnings.push({
      level: "warning",
      title: `${outsideCount} nesne üretim alanı dışında`,
      body: "Bu nesnelerin tamamı G-code dışında bırakılacak; yalnız tablaya tamamen sığan nesneler üretilecek.",
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
  for (const issue of cutSuitabilityIssues) {
    warnings.push(issue);
  }
  for (const item of patterns) {
    for (const error of item.vectorModelIssues?.errors || []) {
      warnings.push({
        level: "critical",
        title: "Vektör nesne sahipliği geçersiz",
        body: `${item.pattern.name || "Vektör desen"}: ${error}`,
        action: "Deseni seç",
        target: "pattern",
        patternId: item.pattern.id,
      });
    }
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
    productionPlacements,
    productionPatterns,
    requestedPlacements,
    placedInside,
    outsidePlacements,
    outsidePatterns,
    excludedOutsideCount: outsideCount,
    patternBoundaryIssues,
    cutSuitabilityIssues,
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
  if (status === "dışarıda") return `${analysis.outsidePlacements.length + analysis.outsidePatterns.length} nesne üretim dışında bırakılacak; içeridekilerle G-code oluşturulabilir.`;
  if (status === "sığmıyor") return `${analysis.oversizedParts[0]?.name || "Parça"} aktif tabla alanından büyük ve G-code'a dahil edilmeyecek.`;
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
    ["Yerleşen", `${analysis.placedInside} / ${analysis.requestedPlacements || analysis.placements.length}`, outside ? "warn" : "ok"],
    ["Dışta kalan", outside, outside ? "warn" : "ok"],
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
  const level = analysis.layoutStatus === "güncel" ? "ok" : "warn";
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
    .map(({ pattern, operation, inside, production, boundaryIssue, cutSuitabilityIssues }) => {
      const cutIssue = cutSuitabilityIssues?.[0] || null;
      const level = operation === "ignore" ? "" : !production ? "warn" : boundaryIssue ? severityClass(boundaryIssue.level) : cutIssue ? "warn" : "ok";
      const stateText =
        operation === "ignore"
          ? "Yok say"
          : !production
            ? "Üretim dışı"
            : boundaryIssue?.level === "warning"
              ? "Kırpılacak"
              : boundaryIssue
                ? "Sınır hatası"
                : cutIssue
                  ? "Kesim kontrolü"
                  : "Hazır";
      const clip = pattern.parentId ? "Parçaya bağlı" : "Bağımsız";
      return `<button type="button" class="item ${level}" data-pattern-id="${escapeHtml(pattern.id)}">
        <div>
          <strong>${escapeHtml(pattern.name || "Desen")}</strong>
          <small>${patternOperationDisplayLabel(pattern)} · ${pattern.width.toFixed(1)} × ${pattern.height.toFixed(1)} mm</small>
          <small>${clip}${boundaryIssue ? ` · ${escapeHtml(boundaryIssue.title)}` : cutIssue ? ` · ${escapeHtml(cutIssue.title)}` : production ? "" : inside ? " · Bağlı parça üretim dışı" : " · Tabla dışında"}</small>
        </div>
        <span>${stateText}</span>
      </button>`;
    })
    .join("");
  refs.patternsList.querySelectorAll("[data-pattern-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) togglePatternSelection(button.dataset.patternId);
      else select("pattern", button.dataset.patternId);
    });
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
        : `<div class="warning-item info"><div class="warning-title">Kontrol tamam<span>${analysis.warningCount} dikkat</span></div><span>${
            analysis.excludedOutsideCount
              ? `Tabla dışındaki ${analysis.excludedOutsideCount} nesne dahil edilmeyecek; içerideki yollar üretilecek.`
              : "Kırmızı yollar kesim, mavi yollar çizgi kazıma, taramalı alanlar dolgu kazıma olarak üretilecek."
          }</span></div>`
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
    analysis.layoutStatus === "güncel" ? "ok" : "warn"
  );
  setChip(refs.warningChip, `Uyarı: ${totalWarnings}`, analysis.criticalCount ? "danger" : analysis.warningCount ? "warn" : "ok");
  if (refs.bottomStatus) {
    refs.bottomStatus.textContent = `DXF: ${state.parts.length} dosya / ${analysis.placements.length} parça | Yerleşen: ${analysis.placedInside}/${analysis.requestedPlacements || analysis.placements.length} | Desen: ${state.patterns.length} | Dışta: ${analysis.outsidePlacements.length + analysis.outsidePatterns.length} | Uyarı: ${totalWarnings}`;
  }
  const outputActionBusy = gcodeGenerationActive || Boolean(nativeDialogActivePath);
  for (const button of [refs.generateBtn, refs.generateBtn2].filter(Boolean)) {
    button.disabled = outputActionBusy || !analysis.canGenerate;
    button.classList.toggle("is-blocked", !outputActionBusy && !analysis.canGenerate);
    button.textContent = outputActionBusy
      ? gcodeGenerationActive ? "Hazırlanıyor..." : "Dosya penceresi açık"
      : analysis.canGenerate ? "G-code Oluştur" : "G-code Oluşturulamaz";
    button.title = outputActionBusy
      ? "Devam eden dosya işlemini tamamlayın"
      : analysis.canGenerate ? "G-code oluştur" : `G-code oluşturulamaz: ${analysis.warnings.find((item) => item.level === "critical")?.title || "kritik sorun var"}`;
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
  renderWorkflowProgress(analysis);
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
  if (warning.target === "pattern-boundary" || warning.target === "cut-suitability") {
    if (warning.fix === "micro-tabs" && warning.patternId) {
      const pattern = patternById(warning.patternId);
      if (pattern) {
        pushUndo("Mikro kopru ekle");
        const changed = applyMicroTabsToVectorPaths(pattern, warning.pathIds || null, { tabCount: 2, tabWidth: 0.45 });
        select("pattern", warning.patternId);
        updateJobAnalysisNow();
        setStatus(changed ? `${changed} küçük kesim konturuna 2 adet 0.45 mm mikro köprü eklendi.` : "Köprü eklenecek uygun kapalı kesim konturu bulunamadı.", changed ? "ok" : "warn");
        return;
      }
    }
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
  if (warning.target === "pattern-boundary" || warning.target === "cut-suitability") {
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
  canvas.style.cursor = "crosshair";
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
  canvas.style.cursor = "";
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
  canvas.style.cursor = "";
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
  setStatus(`${items.length} parça park alanına alındı. Bu parçalar G-code'a dahil edilmeyecek.`, "warn");
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

function packingItemOptions(item, allowRotate) {
  return LaserPacking.itemOptions(item, allowRotate);
}

function comparePackingScore(a, b) {
  return LaserPacking.compareScores(a, b);
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
  const occupiedBounds = LaserPacking.rectsBounds(occupiedRects);
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
        const score = LaserPacking.scorePlacementBounds(rect, occupiedBounds, option, false);
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
  return LaserPacking.sortItems(items, "area");
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
  const usableRect = { minX: margin, minY: margin, maxX: b.width - margin, maxY: b.height - margin };
  const result = LaserPacking.packRectangles({ items, usableRect, occupiedRects, gap, allowRotate });
  const packed = result.packed;
  const overflowItems = result.overflowItems;
  const startY = Math.max(b.height + gap, margin, ...occupiedRects.map((rect) => rect.maxY + gap), ...packed.map((item) => item.rect.maxY + gap));
  const overflow = placePackingOverflowItems(overflowItems, startY, b, margin, gap, allowRotate);
  return { packed: [...packed, ...overflow], overflowCount: overflow.length };
}

function buildReusableLayoutItems() {
  const queues = new Map();
  const placementsWithPatterns = new Set(state.patterns.map((pattern) => pattern.parentId).filter(Boolean));
  for (const placement of state.placements) {
    if (!queues.has(placement.partId)) queues.set(placement.partId, []);
    queues.get(placement.partId).push(placement);
  }
  const items = [];
  for (const part of state.parts) {
    const quantity = partQuantity(part);
    for (let index = 0; index < quantity; index += 1) {
      const placement = queues.get(part.id)?.shift() || null;
      const fixedRotation = Boolean(placement && placementsWithPatterns.has(placement.id));
      items.push({ part, placement, fixedRotation, rotation: fixedRotation ? placement.rotation : 0 });
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
    const sourcePart = packedItem.item.part;
    ProjectState.ensureEntityIdentity(placement, "placement", {
      source: sourcePart.sourceId || sourcePart.path || sourcePart.id,
      forceInstance: !existing,
    });
    placement.partSourceId = sourcePart.sourceId || placement.partSourceId;
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
    if (pattern.layoutCanRotate) {
      pattern.rotation = ((Number(packedItem.rotation) || 0) % 360 + 360) % 360;
    }
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
    for (const part of data.parts) {
      ProjectState.ensureEntityIdentity(part, "part", { source: part.path || part.name, forceInstance: true });
    }
    const quantity = await requestDxfQuantity(data.parts);
    if (quantity === null) {
      setStatus("DXF ekleme iptal edildi.");
      return;
    }
    if (refs.quantity) refs.quantity.value = String(quantity);
    saveUiSettings();
    for (const part of data.parts) part.quantity = quantity;
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
    imageAdjustmentBases.set(id, data.image.dataUrl);
    image.addEventListener("load", draw, { once: true });

    const target = selectedPlacement() || state.placements[0] || null;
    const pattern = createPatternForPlacement(id, data.image, target);
    ProjectState.ensureEntityIdentity(pattern, "pattern", {
      source: data.image.originalPath || data.image.sourcePath || data.image.name,
      forceInstance: true,
    });
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

async function preparePhotoEngrave(options = {}) {
  const replacePattern = options.replacePattern || null;
  const sourcePath = options.path || replacePattern?.sourcePath || replacePattern?.originalPath || null;
  try {
    setStatus(replacePattern ? "Foto gravür yeniden hazırlanıyor..." : "Foto gravür için raster görsel seçiliyor...");
    const data = await api("/api/open-raster-image", sourcePath ? { path: sourcePath } : {});
    if (!data.image) {
      setStatus("Fotoğraf seçilmedi.");
      return;
    }
    if (data.image.kind !== "raster") {
      setStatus("Foto gravür için JPG/PNG gibi raster görsel seçin.", "warn");
      return;
    }

    const professionalMode = vectorProfessionalMode();
    pushUndo(replacePattern ? "Foto gravür yeniden hazırla" : "Foto gravür ekle");
    const id = replacePattern?.id || uid("pat");
    const image = new Image();
    image.src = data.image.dataUrl;
    state.images.set(id, image);
    imageAdjustmentBases.set(id, data.image.dataUrl);
    image.addEventListener("load", draw, { once: true });

    const target = selectedPlacement() || state.placements[0] || null;
    const prepared = createPatternForPlacement(id, data.image, target);
    const photoDefaults = {
      operation: "engrave_fill",
      rasterMode: "grayscale",
      photoEngrave: true,
      vectorPreset: professionalMode.id,
      vectorProductMode: professionalMode.productMode,
      power: clamp(Math.round(mm("engravePower", 250)), 0, 1000),
      powerMin: 0,
      feed: Math.max(1, mm("engraveFeed", 1800)),
      lineStep: 0.2,
      gamma: 1,
      bidirectional: true,
      threshold: 245,
      vectorPaths: [],
      originalVectorPaths: [],
      vectorStats: null,
      vectorSettings: { productMode: professionalMode.productMode, mode: "raster-grayscale" },
      debugPreviews: [],
      vectorEngraveMode: "contour",
    };

    if (replacePattern) {
      const previousPlacement = {
        id: replacePattern.id,
        parentId: replacePattern.parentId,
        x: replacePattern.x,
        y: replacePattern.y,
        width: replacePattern.width,
        height: replacePattern.height,
        rotation: replacePattern.rotation,
        clipMargin: replacePattern.clipMargin,
        clipCloseBoundary: replacePattern.clipCloseBoundary,
        mirrorX: Boolean(replacePattern.mirrorX),
        mirrorY: Boolean(replacePattern.mirrorY),
      };
      resetPatternVectorModel(replacePattern);
      Object.assign(replacePattern, prepared, previousPlacement, photoDefaults, {
        sourcePath: data.image.path,
        originalPath: data.image.path,
        name: data.image.name || replacePattern.name,
      });
      select("pattern", replacePattern.id);
    } else {
      Object.assign(prepared, photoDefaults);
      ProjectState.ensureEntityIdentity(prepared, "pattern", {
        source: data.image.path || data.image.name,
        forceInstance: true,
      });
      state.patterns.push(prepared);
      select("pattern", prepared.id);
    }

    draw();
    updateSelectionPanel();
    updateJobAnalysisNow();
    const m4Note = state.laserCmd === "M4" ? "" : " M4 dinamik güç modu bu iş için daha güvenlidir.";
    setStatus(`Foto gravür raster olarak hazırlandı: gri ton güç modülasyonu, ${photoDefaults.lineStep.toFixed(2)} mm satır aralığı.${m4Note}`, state.laserCmd === "M4" ? "ok" : "warn");
  } catch (error) {
    setStatus(error.message, "danger");
  }
}

async function vectorizePhoto(options = {}) {
  if (!options.forceVector && vectorProfessionalMode().rasterPhoto) {
    await preparePhotoEngrave(options);
    return;
  }
  const replacePattern = options.replacePattern || null;
  const sourcePath = options.path || replacePattern?.sourcePath || replacePattern?.originalPath || null;
  try {
    setStatus(replacePattern ? "Vektör yeniden işleniyor..." : "Fotoğraf vektörleştiriliyor...");
    const request = { ...(options.settings || getVectorSettings()), path: sourcePath };
    if (options.dataUrl) request.dataUrl = options.dataUrl;
    const data = await api("/api/vectorize-image", request);
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
    const professionalMode = options.professionalMode || vectorProfessionalMode();
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
      resetPatternVectorModel(replacePattern);
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
      setProfessionalPatternDefaults(pattern, professionalMode);
    } else {
      pattern = createVectorPatternForPlacement(id, vector, target);
      setProfessionalPatternDefaults(pattern, professionalMode);
      ProjectState.ensureEntityIdentity(pattern, "pattern", {
        source: vector.sourcePath || vector.name,
        forceInstance: true,
      });
      state.patterns.push(pattern);
    }
    pattern.vectorPreset = professionalMode.id;
    pattern.vectorProductMode = professionalMode.productMode;
    select("pattern", pattern.id);
    renderVectorQualityBox(pattern);
    const stats = vector.stats || {};
    const timeText = stats.timings?.total ? `, süre: ${Number(stats.timings.total).toFixed(2)} sn` : "";
    const detailText = stats.detailPreservation ? ", temiz çizgi ayrıntıları korundu" : "";
    setStatus(
      `Vektör hazır (${professionalMode.label}). Aktif: ${stats.pathsKept ?? pattern.vectorPaths.length}/${stats.pathsTotal ?? pattern.vectorPaths.length}, bulunan: ${stats.contoursFound ?? "-"}, otomatik gizlenen: ${Number(stats.removedBorder || 0) + Number(stats.removedShortPost || 0)}, birleşen: ${stats.stitchedGap ?? 0}${detailText}${timeText}.`
    );
  } catch (error) {
    setStatus(error.message);
  }
}

function vectorSelectionRegionMatches(pattern, entries) {
  const region = state.vectorSelectionRegion;
  if (!region || String(region.patternId) !== String(pattern?.id)) return null;
  const selectedIds = entries.map((entry) => String(entry.pathId)).sort();
  const regionIds = (region.pathIds || []).map(String).sort();
  if (selectedIds.length !== regionIds.length || selectedIds.some((id, index) => id !== regionIds[index])) return null;
  return clonePlain(region);
}

function fallbackVectorSelectionRegion(pattern, entries) {
  const bounds = emptyBounds();
  for (const entry of entries) {
    for (const point of vectorWorldPath(pattern, entry.vectorPath)) includePoint(bounds, point);
  }
  if (!boundsReady(bounds)) return null;
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const pixelWorldSize = Math.max(Number(pattern.width) / sourceWidth, Number(pattern.height) / sourceHeight);
  const padding = Math.max(0.35, pixelWorldSize * 8);
  return {
    patternId: String(pattern.id),
    worldRect: {
      minX: bounds.minX - padding,
      minY: bounds.minY - padding,
      maxX: bounds.maxX + padding,
      maxY: bounds.maxY + padding,
    },
    pathIds: entries.map((entry) => String(entry.pathId)).sort(),
    derived: true,
  };
}

function vectorSourceCropForWorldRect(pattern, worldRect) {
  const corners = [
    { x: worldRect.minX, y: worldRect.minY },
    { x: worldRect.maxX, y: worldRect.minY },
    { x: worldRect.maxX, y: worldRect.maxY },
    { x: worldRect.minX, y: worldRect.maxY },
  ].map((point) => patternSourcePointFromWorld(pattern, point));
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const sourceRect = {
    minX: clamp(Math.min(...corners.map((point) => point[0])), 0, sourceWidth),
    minY: clamp(Math.min(...corners.map((point) => point[1])), 0, sourceHeight),
    maxX: clamp(Math.max(...corners.map((point) => point[0])), 0, sourceWidth),
    maxY: clamp(Math.max(...corners.map((point) => point[1])), 0, sourceHeight),
  };
  if (sourceRect.maxX - sourceRect.minX <= 1e-6 || sourceRect.maxY - sourceRect.minY <= 1e-6) return null;
  return {
    sourceRect,
    normalized: {
      minX: sourceRect.minX / sourceWidth,
      minY: sourceRect.minY / sourceHeight,
      maxX: sourceRect.maxX / sourceWidth,
      maxY: sourceRect.maxY / sourceHeight,
    },
  };
}

function vectorPathCenter(vectorPath) {
  const bounds = vectorPathBounds(vectorPath);
  return bounds ? [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2] : [0, 0];
}

function nearestSelectedVectorTemplate(vectorPath, entries) {
  const center = vectorPathCenter(vectorPath);
  let best = null;
  for (const entry of entries) {
    const candidateCenter = vectorPathCenter(entry.vectorPath);
    const distance = Math.hypot(center[0] - candidateCenter[0], center[1] - candidateCenter[1]);
    if (!best || distance < best.distance) best = { distance, vectorPath: entry.vectorPath };
  }
  return best?.vectorPath || null;
}

function clipVectorPathByWorldRect(pattern, vectorPath, worldRect, keepInside, idPrefix) {
  const split = window.LaserVectorEdit?.splitPolylineByRect;
  if (!split) throw new Error("Yerel vektör kırpma modülü yüklenemedi.");
  const worldPoints = vectorWorldPath(pattern, vectorPath).map((point) => [point.x, point.y]);
  const fragments = split(worldPoints, Boolean(vectorPath.closed), worldRect)
    .filter((fragment) => Boolean(fragment.inside) === Boolean(keepInside));
  return fragments.map((fragment, index) => {
    const result = {
      ...clonePlain(vectorPath),
      id: uid(`${idPrefix}_${index + 1}`),
      points: fragment.points.map((point) => patternSourcePointFromWorld(pattern, { x: point[0], y: point[1] })),
      closed: Boolean(fragment.closed),
      removed: false,
    };
    delete result.edgeId;
    delete result.objectId;
    delete result.provenance;
    refreshVectorPathMetrics(result);
    return result;
  });
}

function mapCroppedVectorPaths(pattern, vector, selectedEntries) {
  const normalized = vector.crop?.normalized;
  if (!normalized) throw new Error("Sunucu yerel kırpım koordinatlarını döndürmedi.");
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const cropRect = {
    minX: clamp(Number(normalized.minX) * sourceWidth, 0, sourceWidth),
    minY: clamp(Number(normalized.minY) * sourceHeight, 0, sourceHeight),
    maxX: clamp(Number(normalized.maxX) * sourceWidth, 0, sourceWidth),
    maxY: clamp(Number(normalized.maxY) * sourceHeight, 0, sourceHeight),
  };
  const cropSourceWidth = Math.max(0.001, Number(vector.sourceWidth) || 1);
  const cropSourceHeight = Math.max(0.001, Number(vector.sourceHeight) || 1);
  const scaleX = (cropRect.maxX - cropRect.minX) / cropSourceWidth;
  const scaleY = (cropRect.maxY - cropRect.minY) / cropSourceHeight;
  return cloneVectorPaths(vector.vectorPaths || []).map((vectorPath, index) => {
    vectorPath.id = uid(`local_vec_${index + 1}`);
    vectorPath.points = (vectorPath.points || []).map((point) => [
      cropRect.minX + Number(point[0]) * scaleX,
      cropRect.minY + Number(point[1]) * scaleY,
    ]);
    const template = nearestSelectedVectorTemplate(vectorPath, selectedEntries);
    vectorPath.operation = normalizeOperation(template?.operation, patternOperation(pattern));
    if (Number.isFinite(Number(template?.power))) vectorPath.power = Number(template.power);
    if (Number.isFinite(Number(template?.feed))) vectorPath.feed = Number(template.feed);
    vectorPath.removed = false;
    vectorPath.locked = false;
    delete vectorPath.edgeId;
    delete vectorPath.objectId;
    delete vectorPath.provenance;
    refreshVectorPathMetrics(vectorPath);
    return vectorPath;
  });
}

function snapLocalReplacementEndpoints(pattern, replacements, preservedOutside, worldRect) {
  const sourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const sourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const tolerance = Math.max(0.2, Math.max(Number(pattern.width) / sourceWidth, Number(pattern.height) / sourceHeight) * 3);
  const boundaryDistance = (point) => Math.min(
    Math.abs(point.x - worldRect.minX),
    Math.abs(point.x - worldRect.maxX),
    Math.abs(point.y - worldRect.minY),
    Math.abs(point.y - worldRect.maxY),
  );
  const endpoints = (paths, replacement) => paths.flatMap((vectorPath, pathIndex) => {
    if (vectorPath.closed || (vectorPath.points || []).length < 2) return [];
    const lastIndex = vectorPath.points.length - 1;
    return [0, lastIndex].map((pointIndex) => {
      const sourcePoint = vectorPath.points[pointIndex];
      const worldPoint = vectorSourcePointToWorld(pattern, sourcePoint);
      return { replacement, pathIndex, pointIndex, sourcePoint, worldPoint };
    }).filter((entry) => boundaryDistance(entry.worldPoint) <= tolerance * 1.5);
  });
  const oldEndpoints = endpoints(preservedOutside, false);
  const newEndpoints = endpoints(replacements, true);
  const pairs = [];
  for (let newIndex = 0; newIndex < newEndpoints.length; newIndex += 1) {
    for (let oldIndex = 0; oldIndex < oldEndpoints.length; oldIndex += 1) {
      const first = newEndpoints[newIndex].worldPoint;
      const second = oldEndpoints[oldIndex].worldPoint;
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (distance <= tolerance) pairs.push({ newIndex, oldIndex, distance });
    }
  }
  pairs.sort((first, second) => first.distance - second.distance);
  const usedNew = new Set();
  const usedOld = new Set();
  let snapped = 0;
  for (const pair of pairs) {
    if (usedNew.has(pair.newIndex) || usedOld.has(pair.oldIndex)) continue;
    const target = newEndpoints[pair.newIndex];
    const source = oldEndpoints[pair.oldIndex];
    replacements[target.pathIndex].points[target.pointIndex] = [...source.sourcePoint];
    usedNew.add(pair.newIndex);
    usedOld.add(pair.oldIndex);
    snapped += 1;
  }
  for (const vectorPath of replacements) refreshVectorPathMetrics(vectorPath);
  return snapped;
}

async function revectorizeSelectedRegion(pattern, entries, region) {
  const worldRect = region?.worldRect;
  const crop = worldRect ? vectorSourceCropForWorldRect(pattern, worldRect) : null;
  if (!crop) throw new Error("Seçili yeniden işleme alanı geçersiz. Konturları fareyle yeniden tarayın.");
  const professionalMode = vectorProfessionalMode();
  if (professionalMode.rasterPhoto) {
    throw new Error("Yerel kontur yeniden işleme için bir vektör modu seçin; foto gravür modu raster üretir.");
  }
  const sourcePath = pattern.sourcePath || pattern.originalPath || "";
  const request = {
    ...getVectorSettings(),
    path: sourcePath,
    cropNormalized: crop.normalized,
    cropPaddingPixels: 12,
    name: pattern.name,
  };
  if (!sourcePath || String(sourcePath).startsWith("generated:")) {
    const previewSource = state.images.get(pattern.id)?.src || "";
    if (!String(previewSource).startsWith("data:image/")) {
      throw new Error("Bu vektörün kaynak fotoğrafı bulunamadı; yerel yeniden işleme yapılamıyor.");
    }
    delete request.path;
    request.dataUrl = previewSource;
  }

  setStatus(`Seçili alan yeniden işleniyor (${entries.length} kontur)...`, "info");
  const data = await api("/api/vectorize-image", request);
  const vector = data.vector;
  if (!vector?.vectorPaths?.length) {
    throw new Error("Seçili alanda bu ayarlarla yeni kontur bulunamadı. Eşik veya minimum alanı değiştirin.");
  }

  const selectedIds = new Set(entries.map((entry) => String(entry.pathId)));
  const untouched = cloneVectorPaths((pattern.vectorPaths || []).filter((path) => !selectedIds.has(String(path.id))));
  const preservedOutside = entries.flatMap((entry, index) => (
    clipVectorPathByWorldRect(pattern, entry.vectorPath, worldRect, false, `local_keep_${index + 1}`)
  ));
  const mapped = mapCroppedVectorPaths(pattern, vector, entries);
  const replacements = mapped.flatMap((vectorPath, index) => (
    clipVectorPathByWorldRect(pattern, vectorPath, worldRect, true, `local_new_${index + 1}`)
  ));
  if (!replacements.length) {
    throw new Error("Yeni konturlar seçili alanın içine düşmedi. Alanı biraz genişletip tekrar deneyin.");
  }
  const snappedEndpointCount = snapLocalReplacementEndpoints(pattern, replacements, preservedOutside, worldRect);

  pushUndo("Seçili alanı yeniden işle");
  pattern.vectorPaths = [...untouched, ...preservedOutside, ...replacements];
  pattern.vectorSettings = { ...(vector.settings || getVectorSettings()), localReprocess: true };
  pattern.vectorStats = {
    ...(pattern.vectorStats || {}),
    localReprocess: {
      replacedPathCount: entries.length,
      preservedFragmentCount: preservedOutside.length,
      generatedPathCount: replacements.length,
      snappedEndpointCount,
      crop: clonePlain(vector.crop || {}),
    },
  };
  pattern.vectorPreset = professionalMode.id;
  pattern.vectorProductMode = professionalMode.productMode;
  pattern.regionClassification = null;
  pattern.cutRegionSeeds = [];
  resetPatternVectorModel(pattern);
  ensurePatternVectorModel(pattern);
  pattern.originalVectorPaths = cloneVectorPaths(pattern.vectorPaths || []);
  autoCutInnerPathCache.delete(pattern);
  vectorModelValidationCache.delete(pattern);
  invalidateSelectedVectorMoveTargets();

  const replacementItems = replacements
    .map((vectorPath) => ({ patternId: pattern.id, pathId: vectorPath.id }))
    .filter((item) => (pattern.vectorPaths || []).some((path) => String(path.id) === String(item.pathId)));
  setVectorPathSelection(replacementItems, replacementItems[replacementItems.length - 1]);
  renderVectorQualityBox(pattern);
  updateJobAnalysisNow();
  setStatus(
    `Seçili alan yenilendi: ${entries.length} eski kontur yerine ${replacements.length} yeni kontur üretildi; alan dışındaki çizgiler korundu${snappedEndpointCount ? `, ${snappedEndpointCount} sınır ucu birleştirildi` : ""}.`,
    "ok"
  );
}

function setVectorReprocessBusy(busy) {
  vectorReprocessActive = Boolean(busy);
  for (const id of ["revectorizeBtn", "panelRevectorize"]) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = vectorReprocessActive;
    button.toggleAttribute("aria-busy", vectorReprocessActive);
  }
}

async function revectorizeSelected() {
  const pattern = selectedVectorPattern();
  if (!pattern || pattern.kind !== "vector") {
    setStatus("Yeniden işlemek için fotoğraftan üretilmiş bir vektör seçin.");
    return;
  }
  if (vectorReprocessActive) {
    setStatus("Seçili alan zaten yeniden işleniyor; tamamlanmasını bekleyin.", "warn");
    return;
  }
  setVectorReprocessBusy(true);
  try {
    const entries = selectedVectorPathEntries();
    if (!entries.length) {
      await vectorizePhoto({ replacePattern: pattern });
      return;
    }
    const patternIds = new Set(entries.map((entry) => String(entry.patternId)));
    if (patternIds.size !== 1 || !patternIds.has(String(pattern.id))) {
      setStatus("Yerel yeniden işleme için yalnız tek desene ait konturları seçin.", "danger");
      return;
    }
    const region = vectorSelectionRegionMatches(pattern, entries) || fallbackVectorSelectionRegion(pattern, entries);
    await revectorizeSelectedRegion(pattern, entries, region);
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    setVectorReprocessBusy(false);
  }
}

function selectedPlacement() {
  if (state.selected?.type === "placement") return placementById(state.selected.id);
  if (state.selected?.type === "pattern") {
    const pattern = patternById(state.selected.id);
    return placementById(pattern?.parentId);
  }
  if (state.selected?.type === "vectorPath" || state.selected?.type === "vectorObject") {
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
    rasterMode: imageData.rasterMode || "threshold",
    powerMin: Number(imageData.powerMin || 0),
    gamma: Number(imageData.gamma || 1),
    bidirectional: imageData.bidirectional !== false,
    photoEngrave: Boolean(imageData.photoEngrave),
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
    imageAdjustments: defaultImageAdjustments(),
    imageFilterPreset: "original",
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
  const result = {
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
    cadLineArt: Boolean(vector.cadLineArt),
    regionClassificationMode: vector.regionClassificationMode || null,
    cutRegionSeeds: clonePlain(vector.cutRegionSeeds || []),
    regionClassification: vector.regionClassification ? clonePlain(vector.regionClassification) : null,
  };
  if (Number(vector.vectorModelVersion) === 2 && vector.vectorGraph) {
    const sourceWidth = Math.max(0.001, Number(result.sourceWidth) || 1);
    const sourceHeight = Math.max(0.001, Number(result.sourceHeight) || 1);
    const sourceToDesign = [
      Number(result.width) / sourceWidth, 0, 0,
      -Number(result.height) / sourceHeight, 0, Number(result.height),
    ];
    const model = {
      vectorModelVersion: 2,
      source: clonePlain(vector.source || { width: sourceWidth, height: sourceHeight }),
      sourceToDesign: {
        ...(clonePlain(vector.sourceToDesign || {})),
        matrix: sourceToDesign,
        unit: "mm",
        designWidth: Number(result.width),
        designHeight: Number(result.height),
      },
      vectorGraph: clonePlain(vector.vectorGraph),
      vectorObjects: clonePlain(vector.vectorObjects || []),
      connections: clonePlain(vector.connections || []),
      occlusionMasks: clonePlain(vector.occlusionMasks || []),
      objectProposals: clonePlain(vector.objectProposals || []),
      repairProposals: clonePlain(vector.repairProposals || []),
      objectTransformRevision: Number(vector.objectTransformRevision) || 0,
      vectorPathsDerivedFromRevision: 0,
    };
    for (const vectorObject of model.vectorObjects) {
      const originSource = vectorObject.localFrame?.originSource;
      if (Array.isArray(originSource)) {
        vectorObject.localFrame = {
          ...(vectorObject.localFrame || {}),
          originDesign: window.LaserVectorEdit.affinePoint(sourceToDesign, originSource),
        };
      }
    }
    applyPatternVectorModel(result, model);
    compilePatternVectorModel(result);
    result.originalVectorPaths = cloneVectorPaths(result.vectorPaths);
  }
  return result;
}

function createGeneratedVectorPattern(geometry, options = {}) {
  if (!geometry || !(geometry.vectorPaths || []).length) return null;
  const name = options.name || "Nesne";
  const id = uid("pat");
  const vector = {
    sourcePath: options.sourcePath || `generated:${geometry.kind || "shape"}`,
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
  if (geometry.kind === "text" && pattern.textSettings?.mode === "outline") {
    pattern.vectorStats = { ...(pattern.vectorStats || {}), filledTraceInvert: false };
    if (pattern.operation === "engrave_fill") pattern.lineStep = textFillLineStep(pattern);
  }
  pattern.layoutCanRotate = Boolean(options.layoutCanRotate);
  if (options.metadata) pattern.generatorMetadata = clonePlain(options.metadata);
  ProjectState.ensureEntityIdentity(pattern, "pattern", {
    source: options.sourceKey || `generated:${geometry.kind || "shape"}:${id}`,
    forceSource: true,
    forceInstance: true,
  });
  return pattern;
}

function addGeneratedVector(geometry, options) {
  options = options || {};
  const pattern = createGeneratedVectorPattern(geometry, options);
  if (!pattern) {
    setStatus("Üretilecek geometri boş.");
    return null;
  }
  const name = options.name || "Nesne";
  pushUndo(`${name} ekle`);
  state.patterns.push(pattern);
  select("pattern", pattern.id);
  updateUiFromAnalysis(computeJobAnalysis());
  setStatus(`${name} eklendi (${pattern.width.toFixed(1)} × ${pattern.height.toFixed(1)} mm).`);
  return pattern;
}

function layoutNewGeneratedPatterns(patterns) {
  const newIds = new Set(patterns.map((pattern) => pattern.id));
  const occupiedRects = [
    ...state.placements.map(placementBounds),
    ...state.patterns
      .filter((pattern) => !newIds.has(pattern.id) && !pattern.parentId && patternOperation(pattern) !== "ignore")
      .map(patternBounds)
      .filter(Boolean),
  ];
  const items = patterns.map((pattern) => {
    const bounds = patternBounds(pattern);
    const size = boundsSize(bounds);
    return {
      pattern,
      bounds,
      fixedRotation: !pattern.layoutCanRotate,
      rotation: Number(pattern.rotation) || 0,
      part: { id: pattern.id, width: size.width, height: size.height },
    };
  });
  const result = packLayoutItems(items, occupiedRects);
  applyPackedStandalonePatterns(result.packed);
  return result;
}

function addGeneratedVectorBatch(entries, options = {}) {
  const patterns = (entries || [])
    .map((entry, index) => createGeneratedVectorPattern(entry.geometry, {
      ...entry,
      sourceKey: entry.sourceKey || `${options.sourceKey || "generated:batch"}:${entry.role || index}`,
    }))
    .filter(Boolean);
  if (!patterns.length) {
    setStatus("Üretilecek geometri boş.", "warn");
    return [];
  }
  pushUndo(options.undoLabel || `${options.name || "Nesneler"} ekle`);
  state.patterns.push(...patterns);
  const layout = layoutNewGeneratedPatterns(patterns);
  acceptCurrentLayoutSettings();
  state.layout.manual = false;
  select("pattern", patterns[0].id);
  updateUiFromAnalysis(computeJobAnalysis());
  draw();
  const fitted = patterns.length - Number(layout.overflowCount || 0);
  setStatus(
    layout.overflowCount
      ? `${fitted}/${patterns.length} ${options.name || "nesne"} tablaya yerleşti; ${layout.overflowCount} parça dışarıda.`
      : `${patterns.length} ${options.name || "nesne"} verimli yerleştirildi.`,
    layout.overflowCount ? "warn" : "ok"
  );
  return patterns;
}

function boxMakerOptions() {
  return {
    width: refs.boxWidth?.value,
    depth: refs.boxDepth?.value,
    height: refs.boxHeight?.value,
    thickness: refs.boxThickness?.value,
    fingerWidth: refs.boxFingerWidth?.value,
    fit: refs.boxFit?.value,
    closed: state.boxMaker.closed,
  };
}

function updateBoxMakerTypeButtons() {
  document.querySelectorAll("[data-box-type]").forEach((button) => {
    button.classList.toggle("active", (button.dataset.boxType === "closed") === state.boxMaker.closed);
  });
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function renderBoxMakerPreview() {
  const result = BoxMaker.buildBox(boxMakerOptions());
  state.boxMaker.result = result;
  updateBoxMakerTypeButtons();
  if (refs.boxMakerValidation) {
    const messages = result.errors.length ? result.errors : result.warnings;
    refs.boxMakerValidation.textContent = messages.join(" ") || "Ölçüler geçerli. Karşılıklı kenarlar aynı parmak bölünmesiyle üretilecek.";
    refs.boxMakerValidation.classList.toggle("danger", result.errors.length > 0);
    refs.boxMakerValidation.classList.toggle("warn", !result.errors.length && result.warnings.length > 0);
  }
  const addButton = document.getElementById("addBoxToJobBtn");
  if (addButton) addButton.disabled = result.errors.length > 0;
  if (refs.boxMakerStats) {
    refs.boxMakerStats.textContent = result.panels.length
      ? `${result.panels.length} parça · yaklaşık ${result.stats.totalCutLength.toFixed(0)} mm kesim`
      : "Geçersiz ölçü";
  }
  if (!refs.boxMakerPreview) return;
  refs.boxMakerPreview.replaceChildren();
  if (!result.panels.length) return;
  const layout = BoxMaker.layoutPanels(result.panels, {
    targetWidth: Math.max(320, result.options.width * 2.2),
    gap: Math.max(8, result.options.thickness * 3),
  });
  const padding = Math.max(12, result.options.thickness * 4);
  refs.boxMakerPreview.setAttribute("viewBox", `${-padding} ${-padding} ${layout.width + padding * 2} ${layout.height + padding * 2}`);
  for (const item of layout.items) {
    const group = createSvgElement("g", { transform: `translate(${item.x} ${item.y})` });
    const path = createSvgElement("path", {
      d: BoxMaker.svgPath(item.panel.vectorPaths[0].points),
      class: "box-preview-path",
      "fill-rule": "evenodd",
    });
    const label = createSvgElement("text", {
      x: item.panel.sourceWidth / 2,
      y: Math.min(item.panel.sourceHeight - 4, 13),
      "text-anchor": "middle",
      class: "box-preview-label",
    });
    label.textContent = item.panel.name;
    group.append(path, label);
    refs.boxMakerPreview.append(group);
  }
}

function openBoxMaker() {
  closeProjectHub();
  refs.boxMakerModal?.classList.remove("hidden");
  renderBoxMakerPreview();
}

function closeBoxMaker() {
  refs.boxMakerModal?.classList.add("hidden");
  scheduleCanvasResize();
}

function addBoxToJob() {
  const result = state.boxMaker.result || BoxMaker.buildBox(boxMakerOptions());
  if (result.errors.length || !result.panels.length) {
    setStatus(result.errors[0] || "Kutu parçaları üretilemedi.", "danger");
    return;
  }
  const boxId = ProjectState.createId("box");
  const dimensions = `${result.options.width}×${result.options.depth}×${result.options.height}`;
  const patterns = addGeneratedVectorBatch(result.panels.map((panel) => ({
    geometry: panel,
    name: `${panel.name} · ${dimensions}`,
    role: panel.role,
    operation: "cut",
    layoutCanRotate: true,
    sourcePath: `generated:box:${boxId}:${panel.role}`,
    sourceKey: `generated:box:${boxId}:${panel.role}`,
    metadata: {
      generator: "box-maker",
      boxId,
      role: panel.role,
      dimensions: clonePlain(result.options),
      edges: clonePlain(panel.edges),
    },
  })), {
    name: "kutu parçası",
    undoLabel: "Kutu parçalarını ekle",
    sourceKey: `generated:box:${boxId}`,
  });
  if (!patterns.length) return;
  closeBoxMaker();
  activateRibbonTab("tabla");
  fitView();
}

function calibrationOptions() {
  return {
    columns: refs.calibrationColumns?.value,
    rows: refs.calibrationRows?.value,
    tile: refs.calibrationTile?.value,
    gap: refs.calibrationGap?.value,
    minPower: refs.calibrationMinPower?.value,
    maxPower: refs.calibrationMaxPower?.value,
    minFeed: refs.calibrationMinFeed?.value,
    maxFeed: refs.calibrationMaxFeed?.value,
  };
}

function renderCalibrationSummary() {
  const result = CalibrationGrid.build(calibrationOptions());
  if (!refs.calibrationSummary) return result;
  const operation = refs.calibrationOperation?.value === "engrave_line" ? "çizgi kazıma" : "kesim";
  refs.calibrationSummary.classList.toggle("danger", result.errors.length > 0);
  refs.calibrationSummary.textContent = result.errors.length
    ? result.errors.join(" ")
    : `${result.columns} × ${result.rows} = ${result.cells.length} ${operation} karesi · ${result.width.toFixed(1)} × ${result.height.toFixed(1)} mm · S${result.powers.join("/")} · F${result.feeds.join("/")}`;
  const button = document.getElementById("addCalibrationBtn");
  if (button) button.disabled = result.errors.length > 0;
  return result;
}

function openCalibration() {
  closeProjectHub();
  refs.calibrationModal?.classList.remove("hidden");
  renderCalibrationSummary();
}

function closeCalibration() {
  refs.calibrationModal?.classList.add("hidden");
  scheduleCanvasResize();
}

function setCalibrationPatternProcess(pattern, operation, power, feed) {
  pattern.operation = operation;
  pattern.processOverride = true;
  pattern.power = power;
  pattern.feed = feed;
  if (operation === "cut") {
    pattern.cutPower = power;
    pattern.cutFeed = feed;
  } else {
    pattern.engravePower = power;
    pattern.engraveFeed = feed;
  }
}

function addCalibrationPlate(event) {
  event?.preventDefault();
  try {
    return addCalibrationPlateUnsafe();
  } catch (error) {
    console.error("Kalibrasyon plakasi olusturulamadi.", error);
    setStatus(error?.message || "Kalibrasyon plakasi olusturulamadi.", "danger");
    return null;
  }
}

function addCalibrationPlateUnsafe() {
  const result = renderCalibrationSummary();
  if (result.errors.length) {
    setStatus(result.errors[0], "danger");
    return;
  }
  const operation = refs.calibrationOperation?.value === "engrave_line" ? "engrave_line" : "cut";
  const occupied = [
    ...state.placements.map(placementBounds),
    ...state.patterns.filter((pattern) => !pattern.parentId && patternOperation(pattern) !== "ignore").map(patternBounds).filter(Boolean),
  ];
  const groupId = ProjectState.createId("calibration");
  const packing = packLayoutItems([{
    part: { id: groupId, width: result.width, height: result.height },
    fixedRotation: true,
    rotation: 0,
  }], occupied);
  const packed = packing.packed[0];
  if (!packed || packing.overflowCount) {
    setStatus(`Kalibrasyon plakası için tablaya ${result.width.toFixed(1)} × ${result.height.toFixed(1)} mm boş alan gerekir.`, "danger");
    return;
  }
  const geometryLib = window.LaserGeometry;
  const patterns = [];
  const originX = packed.x;
  const originY = packed.y;
  const commonMetadata = {
    generator: "power-speed-calibration",
    calibrationId: groupId,
    operation,
    columns: result.columns,
    rows: result.rows,
  };
  for (const cell of result.cells) {
    const geometry = geometryLib.buildShape("rect", { width: cell.width, height: cell.height, radius: 0.8, operation });
    const pattern = createGeneratedVectorPattern(geometry, {
      name: `Kalibrasyon S${cell.power} F${cell.feed}`,
      operation,
      sourceKey: `generated:calibration:${groupId}:cell:${cell.row}:${cell.column}`,
      metadata: { ...commonMetadata, row: cell.row, column: cell.column, power: cell.power, feed: cell.feed },
    });
    pattern.x = originX + cell.x;
    pattern.y = originY + cell.y;
    setCalibrationPatternProcess(pattern, operation, cell.power, cell.feed);
    patterns.push(pattern);
  }
  const labelPower = Math.min(180, Math.max(30, result.powers[0]));
  const labelFeed = Math.max(1500, result.feeds.at(-1));
  result.powers.forEach((power, column) => {
    const geometry = geometryLib.buildText(`S${power}`, { height: 3, tracking: 0.15 });
    const pattern = createGeneratedVectorPattern(geometry, {
      name: `Güç etiketi S${power}`,
      operation: "engrave_line",
      sourceKey: `generated:calibration:${groupId}:power:${column}`,
      metadata: { ...commonMetadata, label: "power", value: power },
    });
    pattern.x = originX + result.labelWidth + column * (result.tile + result.gap) + (result.tile - pattern.width) / 2;
    pattern.y = originY + result.gridHeight + 2;
    setCalibrationPatternProcess(pattern, "engrave_line", labelPower, labelFeed);
    patterns.push(pattern);
  });
  result.feeds.forEach((feed, row) => {
    const geometry = geometryLib.buildText(`F${feed}`, { height: 3, tracking: 0.15 });
    const pattern = createGeneratedVectorPattern(geometry, {
      name: `Hız etiketi F${feed}`,
      operation: "engrave_line",
      sourceKey: `generated:calibration:${groupId}:feed:${row}`,
      metadata: { ...commonMetadata, label: "feed", value: feed },
    });
    pattern.x = originX + result.labelWidth - pattern.width - 2;
    pattern.y = originY + row * (result.tile + result.gap) + (result.tile - pattern.height) / 2;
    setCalibrationPatternProcess(pattern, "engrave_line", labelPower, labelFeed);
    patterns.push(pattern);
  });
  pushUndo("Kalibrasyon plakası ekle");
  state.patterns.push(...patterns);
  acceptCurrentLayoutSettings();
  state.layout.manual = false;
  select("pattern", patterns[0].id);
  updateUiFromAnalysis(computeJobAnalysis());
  draw();
  closeCalibration();
  activateRibbonTab("tabla");
  setStatus(`${result.cells.length} karelik güç/hız kalibrasyon plakası eklendi. Etiketler düşük güçte kazınacak.`, "ok");
}

function libraryPatternThumbnail(pattern) {
  const source = state.images.get(pattern.id)?.src || "";
  return String(source).startsWith("data:") ? source : "";
}

function selectedLibraryCandidates() {
  const patterns = selectedPatternObjects();
  if (patterns.length) return patterns.map((pattern) => ({ kind: "pattern", pattern }));
  const placement = selectedPlacement();
  const part = placement ? partById(placement.partId) : null;
  return part ? [{ kind: "part", part }] : [];
}

async function saveSelectionToLibrary() {
  const candidates = selectedLibraryCandidates();
  if (!candidates.length) {
    setStatus("Kütüphaneye kaydetmek için bir DXF parçası veya desen seçin.", "warn");
    return;
  }
  try {
    for (const candidate of candidates) {
      if (candidate.kind === "pattern") {
        const pattern = candidate.pattern;
        await state.library.store.put({
          name: pattern.name || "Desen",
          kind: "pattern",
          width: pattern.width,
          height: pattern.height,
          operation: patternOperation(pattern),
          sourceId: pattern.sourceId,
          tags: [pattern.generatedKind, pattern.vectorPreset, pattern.kind].filter(Boolean),
          thumbnail: libraryPatternThumbnail(pattern),
          payload: { pattern: clonePatternPayload(pattern) },
        });
      } else {
        const part = candidate.part;
        await state.library.store.put({
          name: part.name || "DXF parçası",
          kind: "part",
          width: part.width,
          height: part.height,
          operation: "cut",
          sourceId: part.sourceId,
          tags: ["dxf", "kesim"],
          payload: { part: clonePartPayload(part) },
        });
      }
    }
    await loadLibraryAssets();
    setStatus(`${candidates.length} öğe tasarım kütüphanesine kaydedildi.`, "ok");
  } catch (error) {
    setStatus(error.message || "Kütüphane kaydı tamamlanamadı.", "danger");
  }
}

function appendLibraryVectorPreview(container, asset) {
  const pattern = asset.payload?.pattern;
  const paths = (pattern?.vectorPaths || []).filter((path) => !path.removed && (path.points || []).length >= 2).slice(0, 400);
  if (!paths.length) return false;
  const width = Math.max(0.5, Number(pattern.sourceWidth) || Number(asset.width) || 1);
  const height = Math.max(0.5, Number(pattern.sourceHeight) || Number(asset.height) || 1);
  const svg = createSvgElement("svg", { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true" });
  const group = createSvgElement("g");
  for (const vectorPath of paths) {
    const points = vectorPath.points || [];
    const d = points.map((point, index) => `${index ? "L" : "M"}${Number(point[0]).toFixed(3)} ${Number(point[1]).toFixed(3)}`).join(" ") + (vectorPath.closed ? " Z" : "");
    group.append(createSvgElement("path", { d }));
  }
  svg.append(group);
  container.append(svg);
  return true;
}

function libraryAssetMeta(asset) {
  const type = asset.kind === "part" ? "DXF parçası" : "Desen";
  const dimensions = asset.width && asset.height ? `${asset.width.toFixed(1)} × ${asset.height.toFixed(1)} mm` : "Ölçü yok";
  return `${type} · ${dimensions}`;
}

function renderLibraryAssets() {
  if (!refs.libraryList) return;
  const assets = AssetLibrary.searchAssets(state.library.assets, refs.librarySearch?.value || "");
  refs.libraryList.replaceChildren();
  refs.libraryEmpty?.classList.toggle("hidden", assets.length > 0);
  for (const asset of assets) {
    const card = document.createElement("article");
    card.className = "library-asset";
    card.dataset.assetId = asset.id;
    const preview = document.createElement("div");
    preview.className = "library-preview";
    if (asset.thumbnail?.startsWith("data:")) {
      const image = document.createElement("img");
      image.src = asset.thumbnail;
      image.alt = "";
      preview.append(image);
    } else if (!appendLibraryVectorPreview(preview, asset)) {
      const placeholder = document.createElement("span");
      placeholder.className = "part-placeholder";
      placeholder.textContent = asset.kind === "part" ? `${asset.width.toFixed(1)} × ${asset.height.toFixed(1)} mm` : "Vektör";
      preview.append(placeholder);
    }
    const info = document.createElement("div");
    info.className = "library-asset-info";
    const name = document.createElement("strong");
    name.textContent = asset.name;
    const meta = document.createElement("span");
    meta.textContent = libraryAssetMeta(asset);
    info.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "library-asset-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "primary";
    add.textContent = "İşe Ekle";
    add.addEventListener("click", () => insertLibraryAsset(asset.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "library-delete";
    remove.textContent = "Sil";
    remove.title = "Kütüphane öğesini sil";
    remove.addEventListener("click", () => deleteLibraryAsset(asset.id));
    actions.append(add, remove);
    card.append(preview, info, actions);
    refs.libraryList.append(card);
  }
}

async function loadLibraryAssets() {
  if (state.library.loading) return;
  state.library.loading = true;
  try {
    state.library.assets = await state.library.store.list();
    renderLibraryAssets();
  } finally {
    state.library.loading = false;
  }
}

async function openLibrary() {
  closeProjectHub();
  refs.libraryModal?.classList.remove("hidden");
  if (refs.librarySearch) refs.librarySearch.value = "";
  try {
    await loadLibraryAssets();
  } catch (error) {
    setStatus(error.message || "Kütüphane açılamadı.", "danger");
  }
}

function closeLibrary() {
  refs.libraryModal?.classList.add("hidden");
  scheduleCanvasResize();
}

async function insertLibraryAsset(assetId) {
  const asset = state.library.assets.find((item) => item.id === assetId) || await state.library.store.get(assetId);
  if (!asset) {
    setStatus("Kütüphane öğesi bulunamadı.", "danger");
    return;
  }
  const hasPartPayload = asset.kind === "part" && Boolean(asset.payload?.part);
  const hasPatternPayload = Boolean(asset.payload?.pattern);
  if (!hasPartPayload && !hasPatternPayload) {
    setStatus("Kütüphane öğesinin geometrisi eksik.", "danger");
    return;
  }
  pushUndo("Kütüphaneden ekle");
  if (hasPartPayload) {
    const part = clonePartPayload(asset.payload.part);
    part.id = uid("part");
    part.name = asset.name;
    part.path = `library:${asset.id}`;
    part.quantity = 1;
    ProjectState.ensureEntityIdentity(part, "part", { source: `library:${asset.id}`, forceSource: true, forceInstance: true });
    state.parts.push(part);
    const placements = appendPartsToLayout([part]);
    if (placements[0]) select("placement", placements[0].id);
    else draw();
  } else if (hasPatternPayload) {
    const pattern = clonePatternPayload(asset.payload.pattern);
    pattern.id = uid("pat");
    pattern.name = asset.name;
    pattern.parentId = null;
    pattern.sourcePath = `library:${asset.id}`;
    pattern.x = Math.max(0, (bed().width - Number(pattern.width || asset.width || 1)) / 2);
    pattern.y = Math.max(0, (bed().height - Number(pattern.height || asset.height || 1)) / 2);
    ProjectState.ensureEntityIdentity(pattern, "pattern", { source: `library:${asset.id}`, forceSource: true, forceInstance: true });
    state.patterns.push(pattern);
    if (asset.thumbnail?.startsWith("data:")) {
      const image = new Image();
      image.src = asset.thumbnail;
      state.images.set(pattern.id, image);
      imageAdjustmentBases.set(pattern.id, asset.thumbnail);
      image.addEventListener("load", draw, { once: true });
    }
    layoutNewGeneratedPatterns([pattern]);
    select("pattern", pattern.id);
  }
  acceptCurrentLayoutSettings();
  closeLibrary();
  updateUiFromAnalysis(computeJobAnalysis());
  draw();
  setStatus(`${asset.name} kütüphaneden işe eklendi.`, "ok");
}

async function deleteLibraryAsset(assetId) {
  const asset = state.library.assets.find((item) => item.id === assetId);
  if (!asset || !window.confirm(`${asset.name} kütüphaneden silinsin mi?`)) return;
  try {
    await state.library.store.remove(assetId);
    await loadLibraryAssets();
    setStatus("Kütüphane öğesi silindi.");
  } catch (error) {
    setStatus(error.message || "Kütüphane öğesi silinemedi.", "danger");
  }
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
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(".ribbon-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tab === name);
  });
  if (!state.productionPreview.open && document.getElementById("machineTab")?.classList.contains("hidden")) {
    setWorkflowActive(["tabla", "kesim", "cikti"].includes(name) ? "prepare" : "design");
  }
  scheduleCanvasResize();
}

function openVectorPanel() {
  // Ust bardaki/Ekle sekmesindeki "Foto→Vektör" -> Vektor seritine gecer.
  activateRibbonTab("vektor");
  document.getElementById("vectorizePhotoBtn")?.focus();
}

function textCanvasFont(fontPx, font, settings = {}) {
  const style = settings.style || refs.textStyle?.value || "normal";
  const weight = settings.weight || refs.textWeight?.value || "400";
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

async function renderTextFontMask(text, font, heightMm, trackingMm, settings = {}) {
  const lines = String(text).split(/\r?\n/);
  let pxPerMm = 12;
  let fontPx = heightMm * pxPerMm;
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d");
  measure.textBaseline = "alphabetic";
  measure.font = textCanvasFont(fontPx, font, settings);
  await document.fonts?.load?.(measure.font);
  const maxLineWidthPx = Math.max(1, ...lines.map((line) => measureTrackedText(measure, line, trackingMm * pxPerMm)));
  const widthMmEstimate = maxLineWidthPx / pxPerMm;
  const totalHeightMmEstimate = Math.max(heightMm, lines.length * heightMm * 1.28);
  const maxDimension = 2200;
  if (Math.max(widthMmEstimate, totalHeightMmEstimate) * pxPerMm > maxDimension) {
    pxPerMm = Math.max(3, maxDimension / Math.max(widthMmEstimate, totalHeightMmEstimate));
    fontPx = heightMm * pxPerMm;
    measure.font = textCanvasFont(fontPx, font, settings);
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
  rawCtx.font = textCanvasFont(fontPx, font, settings);
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
  const raster = await renderTextFontMask(text, font, options.height, options.tracking, options);
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
  const fillLineStep = clamp(Number(options.fillLineStep) || TEXT_FILL_LINE_STEP_MM, 0.05, 1);
  const scaledVectorPaths = cloneVectorPaths(vector.vectorPaths).map((path) => {
    path.points = (path.points || []).map(([x, y]) => [x / raster.pxPerMm, y / raster.pxPerMm]);
    path.operation = operation;
    refreshVectorPathMetrics(path);
    return path;
  });
  const normalized = window.LaserTextGeometry?.normalizeVectorBounds(scaledVectorPaths, {
    sourceWidth: Math.max(0.5, (vector.sourceWidth || raster.widthMm * raster.pxPerMm) / raster.pxPerMm),
    sourceHeight: Math.max(0.5, (vector.sourceHeight || raster.heightMm * raster.pxPerMm) / raster.pxPerMm),
  }) || {
    paths: scaledVectorPaths,
    sourceWidth: Math.max(0.5, (vector.sourceWidth || raster.widthMm * raster.pxPerMm) / raster.pxPerMm),
    sourceHeight: Math.max(0.5, (vector.sourceHeight || raster.heightMm * raster.pxPerMm) / raster.pxPerMm),
  };
  const vectorPaths = normalized.paths.map((path) => {
    refreshVectorPathMetrics(path);
    return path;
  });
  return {
    vectorPaths,
    sourceWidth: normalized.sourceWidth,
    sourceHeight: normalized.sourceHeight,
    kind: "text",
    textSettings: {
      mode: "outline",
      text,
      font: font.name || font.label,
      fontValue: options.fontValue || textFontValue(font),
      family: font.family,
      height: options.height,
      tracking: options.tracking,
      weight: options.weight || refs.textWeight?.value || "400",
      style: options.style || refs.textStyle?.value || "normal",
      operation,
      fillLineStep,
    },
    vectorStats: { ...(vector.stats || {}), filledTraceInvert: false },
  };
}

function normalizeEditableTextPatternBounds(pattern) {
  if (!editableTextPattern(pattern) || !vectorPatternHasPaths(pattern) || !window.LaserTextGeometry) return false;
  const anchorPathIndex = (pattern.vectorPaths || []).findIndex((path) => !path.removed && (path.points || []).length);
  if (anchorPathIndex < 0) return false;
  const anchorPointIndex = 0;
  const anchorBefore = vectorSourcePointToWorld(pattern, pattern.vectorPaths[anchorPathIndex].points[anchorPointIndex]);
  const oldSourceWidth = Math.max(0.001, Number(pattern.sourceWidth) || Number(pattern.width) || 1);
  const oldSourceHeight = Math.max(0.001, Number(pattern.sourceHeight) || Number(pattern.height) || 1);
  const widthScale = Math.max(0.001, Number(pattern.width) || 1) / oldSourceWidth;
  const heightScale = Math.max(0.001, Number(pattern.height) || 1) / oldSourceHeight;
  const normalized = window.LaserTextGeometry.normalizeVectorBounds(pattern.vectorPaths, {
    sourceWidth: oldSourceWidth,
    sourceHeight: oldSourceHeight,
  });
  if (!normalized.changed) return false;

  pattern.vectorPaths = normalized.paths;
  for (const vectorPath of pattern.vectorPaths) refreshVectorPathMetrics(vectorPath);
  pattern.sourceWidth = normalized.sourceWidth;
  pattern.sourceHeight = normalized.sourceHeight;
  pattern.originalWidth = normalized.sourceWidth;
  pattern.originalHeight = normalized.sourceHeight;
  pattern.width = normalized.sourceWidth * widthScale;
  pattern.height = normalized.sourceHeight * heightScale;
  const anchorAfter = vectorSourcePointToWorld(pattern, pattern.vectorPaths[anchorPathIndex].points[anchorPointIndex]);
  pattern.x += anchorBefore.x - anchorAfter.x;
  pattern.y += anchorBefore.y - anchorAfter.y;
  pattern.originalVectorPaths = cloneVectorPaths(pattern.vectorPaths);
  pattern.vectorStats = { ...(pattern.vectorStats || {}), textBoundsNormalized: true };
  resetPatternVectorModel(pattern);
  invalidateSelectedVectorMoveTargets();
  return true;
}

async function buildEditableTextGeometry(text, font, options = {}) {
  const requestedOperation = options.operation || "engrave_line";
  const effectiveFont = textFontForOperation(font, requestedOperation);
  const height = Math.max(2, Number(options.height) || 20);
  const tracking = Number(options.tracking) || 0;
  const weight = String(options.weight || "400");
  const style = options.style || "normal";
  const fontValue = textFontValue(effectiveFont);
  if (effectiveFont.kind === "single") {
    const geometry = window.LaserGeometry?.buildText(text, { height, tracking });
    if (geometry?.vectorPaths) geometry.vectorPaths.forEach((path) => { path.operation = "engrave_line"; });
    if (geometry) {
      geometry.textSettings = {
        mode: "single-line",
        text,
        font: effectiveFont.name || effectiveFont.label,
        fontValue,
        family: effectiveFont.family || "",
        height,
        tracking,
        weight,
        style,
        operation: "engrave_line",
      };
    }
    return { geometry, operation: "engrave_line", font: effectiveFont };
  }
  await installCustomFonts();
  const geometry = await buildOutlineTextGeometry(text, {
    font: effectiveFont,
    fontValue,
    height,
    tracking,
    weight,
    style,
    operation: requestedOperation,
    fillLineStep: options.fillLineStep,
    name: options.name || `Metin ${effectiveFont.name || effectiveFont.label}`,
  });
  return { geometry, operation: requestedOperation, font: effectiveFont };
}

function replaceEditableTextGeometry(current, geometry, operation) {
  const centerX = current.x + current.width / 2;
  const centerY = current.y + current.height / 2;
  current.sourceWidth = geometry.sourceWidth;
  current.sourceHeight = geometry.sourceHeight;
  current.originalWidth = geometry.sourceWidth;
  current.originalHeight = geometry.sourceHeight;
  current.width = geometry.sourceWidth;
  current.height = geometry.sourceHeight;
  current.x = centerX - current.width / 2;
  current.y = centerY - current.height / 2;
  resetPatternVectorModel(current);
  current.vectorPaths = cloneVectorPaths(geometry.vectorPaths);
  current.originalVectorPaths = cloneVectorPaths(geometry.vectorPaths);
  current.operation = operation;
  current.vectorEngraveMode = operation === "engrave_fill" ? "fill" : "contour";
  current.generated = true;
  current.generatedKind = "text";
  current.textSettings = geometry.textSettings;
  current.vectorStats = { ...(geometry.vectorStats || {}), filledTraceInvert: false };
  if (operation === "engrave_fill") current.lineStep = textFillLineStep(current);
  state.images.delete(current.id);
  activeTextFontPreview = null;
  return current;
}

async function applyFontToSelectedText(pattern, value, options = {}) {
  const patternId = pattern?.id;
  const text = editableTextValue(pattern);
  if (!patternId || !text) {
    clearTextFontPreview();
    return;
  }
  const token = ++textFontApplyToken;
  const requestedFont = textFontDefinitionByValue(value);
  const settings = pattern.textSettings || {};
  const requestedOperation = options.operation || settings.operation || patternOperation(pattern);
  const effectiveFont = textFontForOperation(requestedFont, requestedOperation);
  setStatus(`${effectiveFont.name || effectiveFont.label} hazırlanıyor...`);
  try {
    const { geometry, operation, font } = await buildEditableTextGeometry(text, effectiveFont, {
      fontValue: textFontValue(effectiveFont),
      height: Number(settings.height) || Number(refs.textHeight?.value) || 20,
      tracking: Number.isFinite(Number(settings.tracking)) ? Number(settings.tracking) : Number(refs.textTracking?.value) || 0,
      weight: settings.weight || refs.textWeight?.value || "400",
      style: settings.style || refs.textStyle?.value || "normal",
      operation: requestedOperation,
      fillLineStep: Number(options.fillLineStep ?? settings.fillLineStep) || textFillLineStep(pattern),
      name: pattern.name,
    });
    if (token !== textFontApplyToken || editableTextPattern()?.id !== patternId) return null;
    if (!geometry?.vectorPaths?.length) throw new Error("Bu font seçili metin için vektör üretemedi.");
    const current = patternById(patternId);
    if (!current) return null;
    pushUndo(options.undoLabel || "Metin fontunu degistir");
    replaceEditableTextGeometry(current, geometry, operation);
    if (!options.deferUi) {
      syncTextControlsFromPattern(current);
      updateSelectionPanel();
      updateJobAnalysisNow();
      draw();
    }
    if (!options.suppressSuccess) setStatus(`Seçili metin ${font.name || font.label} fontuyla güncellendi.`, "ok");
    return current;
  } catch (error) {
    if (token !== textFontApplyToken) return null;
    activeTextFontPreview = null;
    draw();
    setStatus(error.message || "Metin fontu değiştirilemedi.", "danger");
    return null;
  }
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
  const effectiveFont = textFontForOperation(selectedFont, requestedOperation);
  if (effectiveFont !== selectedFont) {
    setTextFontControlValue(textFontValue(effectiveFont));
    saveUiSettings();
    setStatus(`${effectiveFont.name || effectiveFont.label} dolgu konturu hazırlanıyor...`);
  } else if (effectiveFont.kind !== "single") {
    setStatus("Font konturu vektöre çevriliyor...");
  }
  const { geometry, operation, font } = await buildEditableTextGeometry(text, effectiveFont, {
    fontValue: textFontValue(effectiveFont),
    height,
    tracking,
    weight: refs.textWeight?.value || "400",
    style: refs.textStyle?.value || "normal",
    operation: requestedOperation,
    fillLineStep: TEXT_FILL_LINE_STEP_MM,
    name: `Metin ${effectiveFont.name || effectiveFont.label}`,
  });
  if (!geometry) {
    setStatus("Bu metinden çizgi üretilemedi.");
    return;
  }
  const name = `Metin: ${text.length > 18 ? text.slice(0, 18) + "…" : text}`;
  const pattern = addGeneratedVector(geometry, { name, operation, textSettings: geometry.textSettings });
  if (pattern) setStatus(`${name} eklendi: ${font.name || font.label}, ${operation === "engrave_fill" ? "içi dolgulu yakma" : operationLabel(operation)}.`, "ok");
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

function patternVectorModel(pattern) {
  if (!pattern || Number(pattern.vectorModelVersion) !== 2 || !pattern.vectorGraph) return null;
  return {
    vectorModelVersion: 2,
    source: pattern.source || {
      width: Number(pattern.sourceWidth) || Number(pattern.width) || 1,
      height: Number(pattern.sourceHeight) || Number(pattern.height) || 1,
    },
    sourceToDesign: pattern.sourceToDesign,
    vectorGraph: pattern.vectorGraph,
    vectorObjects: pattern.vectorObjects || [],
    connections: pattern.connections || [],
    occlusionMasks: pattern.occlusionMasks || [],
    objectProposals: pattern.objectProposals || [],
    repairProposals: pattern.repairProposals || [],
    objectTransformRevision: Number(pattern.objectTransformRevision) || 0,
    vectorPathsDerivedFromRevision: Number(pattern.vectorPathsDerivedFromRevision) || 0,
  };
}

function applyPatternVectorModel(pattern, model) {
  if (!pattern || !model) return;
  pattern.vectorModelVersion = 2;
  pattern.source = clonePlain(model.source || {});
  pattern.sourceToDesign = clonePlain(model.sourceToDesign || {});
  pattern.vectorGraph = clonePlain(model.vectorGraph || { revision: 1, nodes: [], edges: [] });
  pattern.vectorObjects = clonePlain(model.vectorObjects || []);
  pattern.connections = clonePlain(model.connections || []);
  pattern.occlusionMasks = clonePlain(model.occlusionMasks || []);
  pattern.objectProposals = clonePlain(model.objectProposals || []);
  pattern.repairProposals = clonePlain(model.repairProposals || []);
  pattern.objectTransformRevision = Number(model.objectTransformRevision) || 0;
  pattern.vectorPathsDerivedFromRevision = Number(model.vectorPathsDerivedFromRevision) || 0;
}

function resetPatternVectorModel(pattern) {
  if (!pattern) return;
  for (const key of [
    "vectorModelVersion",
    "source",
    "sourceToDesign",
    "vectorGraph",
    "vectorObjects",
    "connections",
    "occlusionMasks",
    "objectProposals",
    "repairProposals",
    "objectTransformRevision",
    "vectorPathsDerivedFromRevision",
    "vectorPathsDerivedFromTransformRevision",
  ]) delete pattern[key];
}

function ensurePatternVectorModel(pattern) {
  if (!vectorPatternHasPaths(pattern)) throw new Error("Nesne ayırmak için vektör konturu gerekir.");
  const current = patternVectorModel(pattern);
  if (current) return current;
  const vectorEdit = window.LaserVectorEdit;
  if (!vectorEdit?.migrateVectorPathsToModel) throw new Error("Vektör graph modülü yüklenemedi.");
  const model = vectorEdit.migrateVectorPathsToModel(pattern.vectorPaths || [], {
    sourceWidth: Number(pattern.sourceWidth) || Number(pattern.width) || 1,
    sourceHeight: Number(pattern.sourceHeight) || Number(pattern.height) || 1,
    designWidth: Number(pattern.width) || 1,
    designHeight: Number(pattern.height) || 1,
    fallbackOperation: patternOperation(pattern),
    traceScale: Number(pattern.vectorStats?.cadTraceScale) || 1,
  });
  applyPatternVectorModel(pattern, model);
  compilePatternVectorModel(pattern);
  return patternVectorModel(pattern);
}

function compilePatternVectorModel(pattern) {
  const model = patternVectorModel(pattern);
  if (!model) return null;
  const result = window.LaserVectorEdit.compileVectorObjects(model, { fallbackOperation: patternOperation(pattern) });
  if (result.errors?.length) throw new Error(`Vektör nesne modeli geçersiz: ${result.errors[0]}`);
  pattern.vectorPaths = cloneVectorPaths(result.vectorPaths || []);
  for (const vectorPath of pattern.vectorPaths) refreshVectorPathMetrics(vectorPath);
  invalidateSelectedVectorMoveTargets();
  pattern.vectorPathsDerivedFromRevision = Number(result.graphRevision) || Number(pattern.vectorGraph?.revision) || 0;
  pattern.vectorPathsDerivedFromTransformRevision = Number(result.objectTransformRevision) || 0;
  pattern.vectorCompileWarnings = [...(result.warnings || [])];
  return result;
}

function syncPatternVectorModelFromPaths(pattern) {
  const model = patternVectorModel(pattern);
  if (!model) return null;
  const reconciled = window.LaserVectorEdit.reconcileVectorModel(model, pattern.vectorPaths || []);
  if (!reconciled) {
    throw new Error("Vektör konturları nesne modeliyle eşleşmiyor. Konturları geri alıp nesneyi yeniden ayırın.");
  }
  if (reconciled.changed) applyPatternVectorModel(pattern, reconciled.model);
  return compilePatternVectorModel(pattern);
}

function prepareVectorModelsForOutput() {
  for (const pattern of state.patterns) {
    if (Number(pattern.vectorModelVersion) === 2) syncPatternVectorModelFromPaths(pattern);
  }
}

function vectorObjectById(pattern, objectId) {
  return (pattern?.vectorObjects || []).find((item) => String(item.id) === String(objectId)) || null;
}

function vectorObjectIsUserSemantic(vectorObject) {
  if (window.LaserVectorEdit?.isUserSemanticVectorObject) {
    return window.LaserVectorEdit.isUserSemanticVectorObject(vectorObject);
  }
  const createdBy = String(vectorObject?.createdBy || "");
  return Boolean(vectorObject && !vectorObject.removed && (
    vectorObject.userSemantic === true
    || String(vectorObject.proposalId || "")
    || createdBy === "structural-analysis-confirmed"
    || createdBy === "user-rectangle-separation"
  ));
}

function selectedVectorObject() {
  if (state.selected?.type !== "vectorObject") return null;
  const pattern = patternById(state.selected.id);
  const vectorObject = vectorObjectById(pattern, state.selected.objectId);
  return pattern && vectorObject ? { pattern, vectorObject } : null;
}

function updatePatternVectorObjectTransform(pattern, objectId, updates) {
  ensurePatternVectorModel(pattern);
  syncPatternVectorModelFromPaths(pattern);
  const next = window.LaserVectorEdit.updateVectorObjectTransform(patternVectorModel(pattern), objectId, updates);
  applyPatternVectorModel(pattern, next);
  compilePatternVectorModel(pattern);
}

function setPatternVectorObjectOperation(pattern, objectId, operation) {
  ensurePatternVectorModel(pattern);
  syncPatternVectorModelFromPaths(pattern);
  const next = clonePlain(patternVectorModel(pattern));
  const vectorObject = vectorObjectById(next, objectId);
  if (!vectorObject) throw new Error("Vektör nesnesi bulunamadı.");
  const nextOperation = normalizeOperation(operation, vectorObject.operation || patternOperation(pattern));
  vectorObject.operation = nextOperation;
  const edgeIds = new Set((vectorObject.edgeRefs || []).map((edgeRef) => String(edgeRef.edgeId)));
  for (const edge of next.vectorGraph?.edges || []) {
    if (edgeIds.has(String(edge.id))) edge.operation = nextOperation;
  }
  next.vectorGraph.revision = Math.max(0, Number(next.vectorGraph.revision) || 0) + 1;
  next.vectorPathsDerivedFromRevision = 0;
  applyPatternVectorModel(pattern, next);
  compilePatternVectorModel(pattern);
}

function setPatternVectorObjectAttachmentPolicy(pattern, objectId, policy) {
  ensurePatternVectorModel(pattern);
  syncPatternVectorModelFromPaths(pattern);
  const next = window.LaserVectorEdit.setVectorObjectAttachmentPolicy(patternVectorModel(pattern), objectId, policy);
  applyPatternVectorModel(pattern, next);
  compilePatternVectorModel(pattern);
}

function clonePatternPayload(pattern) {
  const payload = {
    ...pattern,
    processOverride: patternUsesCustomProcess(pattern),
    vectorPaths: cloneVectorPaths(pattern.vectorPaths || []),
    originalVectorPaths: cloneVectorPaths(pattern.originalVectorPaths || []),
    debugPreviews: (pattern.debugPreviews || []).map((preview) => ({ ...preview })),
    vectorSettings: pattern.vectorSettings ? { ...pattern.vectorSettings } : pattern.vectorSettings,
    vectorStats: pattern.vectorStats ? { ...pattern.vectorStats } : pattern.vectorStats,
    cleanStats: pattern.cleanStats ? { ...pattern.cleanStats } : pattern.cleanStats,
    imageAdjustments: pattern.imageAdjustments ? { ...pattern.imageAdjustments } : pattern.imageAdjustments,
    imageOriginalFrame: pattern.imageOriginalFrame ? { ...pattern.imageOriginalFrame } : pattern.imageOriginalFrame,
    cutRegionSeeds: clonePlain(pattern.cutRegionSeeds || []),
    regionClassification: pattern.regionClassification ? clonePlain(pattern.regionClassification) : pattern.regionClassification,
  };
  if (Number(pattern.vectorModelVersion) === 2) {
    payload.source = clonePlain(pattern.source || {});
    payload.sourceToDesign = clonePlain(pattern.sourceToDesign || {});
    payload.vectorGraph = clonePlain(pattern.vectorGraph || {});
    payload.vectorObjects = clonePlain(pattern.vectorObjects || []);
    payload.connections = clonePlain(pattern.connections || []);
    payload.occlusionMasks = clonePlain(pattern.occlusionMasks || []);
    payload.objectProposals = clonePlain(pattern.objectProposals || []);
    payload.repairProposals = clonePlain(pattern.repairProposals || []);
  }
  delete payload.derivedToolpaths;
  delete payload.vectorSpatialIndex;
  delete payload.vectorPath2DCache;
  return payload;
}

function clonePatternCopy(pattern, suffix = "kopya", sourceImage = null) {
  const id = uid("pat");
  const copy = {
    ...clonePatternPayload(pattern),
    id,
    name: `${pattern.name || "Desen"} ${suffix}`,
  };
  ProjectState.ensureEntityIdentity(copy, "pattern", {
    source: pattern.sourceId || pattern.sourcePath || pattern.id,
    forceInstance: true,
  });
  const image = sourceImage || state.images.get(pattern.id);
  if (image) state.images.set(id, image);
  const adjustmentBase = imageAdjustmentBases.get(pattern.id);
  if (adjustmentBase) imageAdjustmentBases.set(id, adjustmentBase);
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
    extractedContour: true,
    sourcePatternId: pattern.id,
    sourceVectorPathId: vectorPath.id,
  };
  ProjectState.ensureEntityIdentity(copy, "pattern", {
    source: pattern.sourceId || pattern.sourcePath || pattern.id,
    forceInstance: true,
  });
  return copy;
}

function createAlignedCutCopyFromSelectedVectorPath() {
  const selected = selectedVectorPath();
  const pattern = selected?.pattern;
  const vectorPath = selected?.vectorPath;
  const copy = standalonePatternFromVectorPath(pattern, vectorPath);
  if (!copy) {
    setStatus("Hizalı kesim kopyası oluşturulacak kontur bulunamadı.", "warn");
    return false;
  }
  const settings = getSettings();
  copy.operation = "cut";
  copy.name = `${pattern.name || "Desen"} hizalı kesim konturu`;
  copy.power = Number(pattern.cutPower ?? settings.power ?? 1000);
  copy.feed = Number(pattern.cutFeed ?? settings.feed ?? 500);
  for (const path of copy.vectorPaths || []) {
    path.operation = "cut";
    path.operationManual = true;
    path.regionOperation = "manual";
    path.removed = false;
  }
  copy.originalVectorPaths = cloneVectorPaths(copy.vectorPaths || []);

  pushUndo("Hizalı kesim konturu oluştur");
  state.patterns.push(copy);
  select("pattern", copy.id);
  updateJobAnalysisNow();
  setStatus("Kesim konturu özgün konumunda oluşturuldu ve kaynak desenle tam hizalı bırakıldı.", "ok");
  return true;
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
  state.clipboard = [{ type: "pattern", pattern: copy, image: null, pasteInPlace: true }];
  state.clipboardPasteCount = 0;
  setStatus("Kontur kopyalandı. Ctrl+V ile özgün konumuna, desenle tam hizalı yapıştırılır.", "ok");
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

function copySelectedPlacements() {
  const placements = selectedPlacementObjects();
  if (!placements.length) {
    setStatus("Kopyalanacak DXF parcasi yok.");
    return false;
  }
  state.clipboard = placements.map((placement) => {
    const part = partById(placement.partId);
    const childPatterns = state.patterns.filter((pattern) => pattern.parentId === placement.id);
    return {
      type: "placement",
      placement: { ...placement },
      part: clonePartPayload(part),
      patterns: childPatterns.map((pattern) => ({
        pattern: clonePatternPayload(pattern),
        image: state.images.get(pattern.id) || null,
      })),
    };
  });
  state.clipboardPasteCount = 0;
  setStatus(`${placements.length} DXF parcasi kopyalandi.`);
  return true;
}

function copySelection() {
  if (state.selected?.type === "vectorPath") {
    copySelectedVectorPath();
    return;
  }
  if (state.selected?.type === "placement" || selectedPlacementObjects().length) {
    copySelectedPlacements();
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
  const copies = items.map((item) => {
    const copy = clonePatternCopy(item.pattern, "kopya", item.image);
    const offset = window.LaserVectorEdit?.patternPasteOffset
      ? window.LaserVectorEdit.patternPasteOffset(item, state.clipboardPasteCount, 5)
      : state.clipboardPasteCount * 5;
    copy.x += offset;
    copy.y += offset;
    return copy;
  });
  state.patterns.push(...copies);
  selectPatternItems(copies.map((copy) => copy.id), copies[0]?.id);
  const pastedInPlace = state.clipboardPasteCount === 1 && items.some((item) => item.pasteInPlace === true);
  setStatus(
    pastedInPlace
      ? `${copies.length} kontur özgün konumunda, desenle hizalı yapıştırıldı.`
      : `${copies.length} desen yapıştırıldı.`,
    "ok"
  );
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
    const sourcePart = partById(placement.partId) || item.part;
    ProjectState.ensureEntityIdentity(placement, "placement", {
      source: sourcePart?.sourceId || sourcePart?.path || placement.partId,
      forceInstance: true,
    });
    placement.partSourceId = sourcePart?.sourceId || placement.partSourceId;
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
  if (created[0]) selectPlacementItems(created.map((placement) => placement.id), created[0].id);
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

function cutSelection() {
  if (!state.selected) {
    setStatus("Kesilecek secim yok.", "warn");
    return;
  }
  copySelection();
  deleteSelected();
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
  if (state.selected.type === "vectorObject") {
    const selected = selectedVectorObject();
    if (!selected) return;
    const components = selected.vectorObject.transformComponents || {};
    try {
      pushUndo("Vektör nesnesini döndür");
      updatePatternVectorObjectTransform(selected.pattern, selected.vectorObject.id, {
        rotation: (Number(components.rotation) || 0) + delta,
      });
      draw();
      updateSelectionPanel();
      updateJobAnalysisNow();
    } catch (error) {
      setStatus(error.message, "danger");
    }
    return;
  }
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

function syncMovedVectorPatterns(patternIds) {
  for (const patternId of new Set(patternIds || [])) {
    const pattern = patternById(patternId);
    if (pattern && Number(pattern.vectorModelVersion) === 2) syncPatternVectorModelFromPaths(pattern);
  }
  rebuildVectorPathSelectionKeys();
}

function vectorPathMoveSnapshots(entries) {
  return (entries || []).map((entry) => ({
    patternId: entry.pattern.id,
    pathId: entry.vectorPath.id,
    edgeId: String(entry.vectorPath.edgeId || entry.vectorPath.provenance?.edgeId || ""),
    objectId: String(entry.vectorPath.objectId || entry.vectorPath.provenance?.objectId || ""),
    points: (entry.vectorPath.points || []).map((point) => [Number(point[0]), Number(point[1])]),
    vectorPath: clonePlain(entry.vectorPath),
  }));
}

function vectorPathMoveModelSnapshots(startPaths) {
  const snapshots = {};
  for (const startPath of startPaths || []) {
    const key = String(startPath.patternId);
    if (snapshots[key]) continue;
    const pattern = patternById(startPath.patternId);
    const model = patternVectorModel(pattern);
    if (model) snapshots[key] = clonePlain(model);
  }
  return snapshots;
}

function commitVectorPathSelectionTranslation(startPaths, startModels, dxMm, dyMm) {
  const groups = new Map();
  for (const startPath of startPaths || []) {
    const key = String(startPath.patternId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(startPath);
  }
  const finalSelection = [];
  for (const [patternKey, group] of groups) {
    const pattern = patternById(group[0].patternId);
    if (!pattern) continue;
    const { sourceDx, sourceDy } = patternSourceDeltaFromWorld(pattern, dxMm, dyMm);
    const startModel = startModels?.[patternKey];
    if (startModel) {
      const translate = window.LaserVectorEdit?.translateVectorModelSelection;
      if (!translate) throw new Error("Vektör taşıma modülü yüklenemedi.");
      const result = translate(startModel, group.map((item) => item.vectorPath), { sourceDx, sourceDy });
      if (!result.movedEdgeIds?.length) throw new Error("Seçili semantik konturlar taşınamadı.");
      applyPatternVectorModel(pattern, result.model);
      compilePatternVectorModel(pattern);
    } else {
      for (const item of group) {
        const vectorPath = (pattern.vectorPaths || []).find((path) => String(path.id) === String(item.pathId));
        if (vectorPath) applyVectorPathWorldDelta(pattern, vectorPath, item.points, dxMm, dyMm);
      }
    }
    for (const item of group) {
      const linked = item.edgeId && item.objectId
        ? (pattern.vectorPaths || []).filter((path) => (
          String(path.edgeId || path.provenance?.edgeId || "") === item.edgeId
          && String(path.objectId || path.provenance?.objectId || "") === item.objectId
        ))
        : [];
      const matches = linked.length
        ? linked
        : (pattern.vectorPaths || []).filter((path) => String(path.id) === String(item.pathId));
      for (const vectorPath of matches) finalSelection.push({ patternId: pattern.id, pathId: vectorPath.id });
    }
  }
  invalidateSelectedVectorMoveTargets();
  return normalizeVectorPathSelectionItems(finalSelection);
}

function moveSelectedVectorPathsByWorldMm(dx, dy, label = "Konturları taşı") {
  const entries = selectedVectorPathEntries();
  const movable = entries.filter((entry) => !entry.vectorPath.locked);
  if (!movable.length || (!dx && !dy)) {
    if (entries.length && !movable.length) setStatus("Seçili konturlar kilitli; konumları değiştirilmedi.", "warn");
    return false;
  }
  const startPaths = vectorPathMoveSnapshots(movable);
  const startModels = vectorPathMoveModelSnapshots(startPaths);
  pushUndo(label);
  try {
    const finalSelection = commitVectorPathSelectionTranslation(startPaths, startModels, dx, dy);
    setVectorPathSelection(finalSelection, finalSelection[finalSelection.length - 1], { redraw: false, updateUi: false });
  } catch (error) {
    const snapshot = undoStack.pop();
    if (snapshot) restoreUndoSnapshot(snapshot);
    setStatus(error.message || "Konturlar taşınamadı.", "danger");
    return false;
  }
  draw();
  updateSelectionPanel();
  updateJobAnalysisNow();
  const lockedCount = entries.length - movable.length;
  setStatus(
    `${movable.length} kontur ${Number(dx).toFixed(2)}, ${Number(dy).toFixed(2)} mm taşındı${lockedCount ? ` · ${lockedCount} kilitli kontur korundu` : ""}.`,
    "ok"
  );
  return true;
}

function selectedArrangeEntries() {
  const patterns = selectedPatternObjects();
  if (patterns.length > 1) {
    return patterns.map((object) => ({ type: "pattern", object, bounds: patternBounds(object) }));
  }
  const placements = selectedPlacementObjects();
  if (placements.length > 1) {
    return placements.map((object) => ({ type: "placement", object, bounds: placementBounds(object) }));
  }
  return [];
}

function translateArrangeEntry(entry, dx, dy) {
  if (!dx && !dy) return;
  entry.object.x += dx;
  entry.object.y += dy;
  if (entry.type !== "placement") return;
  for (const pattern of state.patterns) {
    if (pattern.parentId !== entry.object.id) continue;
    pattern.x += dx;
    pattern.y += dy;
  }
}

function arrangeSelectedObjects(mode) {
  const entries = selectedArrangeEntries();
  if (entries.length < 2) {
    setStatus("Hizalama icin ayni turden en az iki nesne secin.", "warn");
    return false;
  }
  const transforms = SelectionLayout.calculate(
    entries.map((entry, index) => ({ id: entry.object.id || index, bounds: entry.bounds })),
    mode
  );
  if (transforms.length !== entries.length) return false;
  pushUndo("Coklu secimi hizala");
  for (const transform of transforms) {
    const entry = entries[transform.index];
    if (entry) translateArrangeEntry(entry, transform.dx, transform.dy);
  }
  if (entries[0].type === "placement") markManualLayout();
  updateJobAnalysisNow();
  updateSelectionPanel();
  draw();
  setStatus(`${entries.length} nesne hizalandi.`, "ok");
  return true;
}

function moveSelected(dx, dy) {
  if (!dx && !dy) return;
  if (state.selected?.type === "vectorObject") {
    const selected = selectedVectorObject();
    if (!selected) return;
    const components = selected.vectorObject.transformComponents || {};
    try {
      pushUndo("Vektör nesnesini taşı");
      updatePatternVectorObjectTransform(selected.pattern, selected.vectorObject.id, {
        translateX: (Number(components.translateX) || 0) + dx,
        translateY: (Number(components.translateY) || 0) + dy,
      });
      draw();
      updateSelectionPanel();
      updateJobAnalysisNow();
    } catch (error) {
      setStatus(error.message, "danger");
    }
    return;
  }
  if (state.selected?.type === "vectorPath") {
    moveSelectedVectorPathsByWorldMm(dx, dy, "Konturları taşı");
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
  const selectedPlacements = selectedPlacementObjects();
  if (selectedPlacements.length) {
    const placementIds = new Set(selectedPlacements.map((placement) => placement.id));
    for (const placement of selectedPlacements) {
      placement.x += dx;
      placement.y += dy;
    }
    for (const pattern of state.patterns) {
      if (!placementIds.has(pattern.parentId)) continue;
      pattern.x += dx;
      pattern.y += dy;
    }
    markManualLayout();
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
  beginCanvasInteraction("pattern-scale", {
    pattern,
    undoLabel: "Olcekle",
    preserveLocked: vectorPatternNeedsResizePreserve(pattern),
    updatePanel: true,
  });
  const cx = pattern.x + pattern.width / 2;
  const cy = pattern.y + pattern.height / 2;
  const width = Math.max(1, pattern.width * factor);
  const height = Math.max(1, pattern.height * factor);
  updatePatternGeometry(pattern, {
    width,
    height,
    x: cx - width / 2,
    y: cy - height / 2,
  }, { preserveLocked: false });
  requestCanvasDraw();
  scheduleCanvasInteractionEnd(360);
}

function rotateSelectedContinuous(delta) {
  const pattern = selectedPattern();
  if (!pattern) return;
  beginCanvasInteraction("pattern-rotate", {
    pattern,
    undoLabel: "Dondur",
    updatePanel: true,
  });
  pattern.rotation = (pattern.rotation + delta + 360) % 360;
  requestCanvasDraw();
  scheduleCanvasInteractionEnd(360);
}

function deleteWholePatterns(patterns, undoLabel = "Tüm deseni sil") {
  const unique = [...new Map((patterns || []).filter(Boolean).map((pattern) => [pattern.id, pattern])).values()];
  if (!unique.length) return false;
  const activeContours = unique.reduce(
    (total, pattern) => total + (pattern.vectorPaths || []).filter((path) => !path.removed).length,
    0
  );
  const subject = unique.length === 1
    ? `“${unique[0].name || "Desen"}” deseninin tamamı`
    : `${unique.length} desenin tamamı`;
  const contourText = activeContours ? ` ve içindeki ${activeContours} aktif kontur` : "";
  if (!window.confirm(`${subject}${contourText} silinecek. Tek bir konturu silmek için önce çizginin üzerine tıklayın.\n\nDevam edilsin mi?`)) {
    setStatus("Tüm desen silme iptal edildi.", "info");
    return false;
  }
  pushUndo(undoLabel);
  const ids = new Set(unique.map((pattern) => pattern.id));
  state.patterns = state.patterns.filter((item) => !ids.has(item.id));
  for (const id of ids) state.images.delete(id);
  select(null, null);
  setStatus(unique.length === 1 ? "Desenin tamamı silindi. Ctrl+Z ile geri alabilirsiniz." : `${unique.length} desen silindi. Ctrl+Z ile geri alabilirsiniz.`, "ok");
  return true;
}

function deleteSelectedVectorPaths() {
  const entries = selectedVectorPathEntries();
  const deletable = entries.filter((entry) => !entry.vectorPath.locked);
  if (!deletable.length) {
    setStatus(entries.length ? "Seçili konturlar kilitli; silinmedi." : "Silinecek kontur seçilmedi.", "warn");
    return false;
  }
  pushUndo(deletable.length > 1 ? "Seçili konturları sil" : "Kontur sil");
  const affectedPatternIds = [...new Set(deletable.map((entry) => entry.pattern.id))];
  try {
    for (const entry of deletable) entry.vectorPath.removed = true;
    syncMovedVectorPatterns(affectedPatternIds);
  } catch (error) {
    const snapshot = undoStack.pop();
    if (snapshot) restoreUndoSnapshot(snapshot);
    setStatus(error.message || "Konturlar silinemedi.", "danger");
    return false;
  }
  const remainingLocked = entries.length - deletable.length;
  const activePattern = patternById(affectedPatternIds[0]);
  if (activePattern) select("pattern", activePattern.id);
  else select(null, null);
  updateJobAnalysisNow();
  setStatus(
    `${deletable.length} kontur silindi${remainingLocked ? ` · ${remainingLocked} kilitli kontur korundu` : ""}. Ctrl+Z ile geri alınabilir.`,
    "ok"
  );
  for (const patternId of affectedPatternIds) {
    const pattern = patternById(patternId);
    if (!pattern || !isCadLineArtPattern(pattern) || pattern.regionClassificationMode !== "exterior-cut") continue;
    void reclassifyCadLineArtPattern(pattern).catch((error) => {
      setStatus(error.message || "Dış ve iç konturlar yeniden sınıflandırılamadı.", "danger");
    });
  }
  return true;
}

function deleteSelected() {
  if (!state.selected) return;
  const selectedPlacements = selectedPlacementObjects();
  if (selectedPlacements.length > 1) {
    pushUndo("Coklu DXF parcasi sil");
    for (const placement of selectedPlacements) deletePlacementById(placement.id);
    pruneUnusedParts();
    select(null, null);
    setStatus(`${selectedPlacements.length} DXF parcasi silindi. Ctrl+Z ile geri alinabilir.`, "ok");
    return;
  }
  const selectedPatterns = selectedPatternObjects();
  if (selectedPatterns.length > 1) {
    deleteWholePatterns(selectedPatterns, "Çoklu desen sil");
    return;
  }
  if (state.selected.type === "pattern") {
    deleteWholePatterns([patternById(state.selected.id)]);
    return;
  } else if (state.selected.type === "vectorPath") {
    deleteSelectedVectorPaths();
    return;
  } else if (state.selected.type === "vectorObject") {
    const selected = selectedVectorObject();
    if (selected) {
      if (!vectorObjectIsUserSemantic(selected.vectorObject)) {
        select("pattern", selected.pattern.id);
        setStatus("Temel topoloji kabı topluca silinemez; silmek istediğiniz konturun çizgisine tıklayın.", "warn");
        return;
      }
      try {
        pushUndo("Semantik nesneyi sil");
        syncPatternVectorModelFromPaths(selected.pattern);
        const next = clonePlain(patternVectorModel(selected.pattern));
        const target = vectorObjectById(next, selected.vectorObject.id);
        if (target) target.removed = true;
        next.objectTransformRevision = Math.max(0, Number(next.objectTransformRevision) || 0) + 1;
        applyPatternVectorModel(selected.pattern, next);
        compilePatternVectorModel(selected.pattern);
        select("pattern", selected.pattern.id);
        updateJobAnalysisNow();
        return;
      } catch (error) {
        setStatus(error.message, "danger");
        return;
      }
    }
  } else if (state.selected.type === "placement") {
    pushUndo("Parça sil");
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

function hitTestBounds(worldPoint) {
  for (let index = state.patterns.length - 1; index >= 0; index -= 1) {
    const pattern = state.patterns[index];
    if (pointInPolygon(worldPoint, patternCorners(pattern))) return { type: "pattern", id: pattern.id };
  }
  for (let index = state.placements.length - 1; index >= 0; index -= 1) {
    const placement = state.placements[index];
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

function objectPatternHitCandidate(pattern, index, worldPoint, vectorHitDistance) {
  if (!pointInPolygon(worldPoint, patternCorners(pattern))) return null;
  const area = Math.max(0.000001, Math.abs(Number(pattern.width) * Number(pattern.height)));
  if (editableTextPattern(pattern)) {
    return { type: "pattern", id: pattern.id, priority: 0, area, z: index, hitKind: "text" };
  }
  if (!vectorPatternHasPaths(pattern)) {
    return { type: "pattern", id: pattern.id, priority: 2, area, z: index, hitKind: "bitmap" };
  }
  for (let j = (pattern.vectorPaths || []).length - 1; j >= 0; j -= 1) {
    const vectorPath = pattern.vectorPaths[j];
    if (vectorPath.removed) continue;
    const points = vectorWorldPath(pattern, vectorPath);
    const pathHit = distanceToPolyline(worldPoint, points, Boolean(vectorPath.closed)) <= vectorHitDistance;
    const fillHit = (
      vectorPathOperation(vectorPath, pattern) === "engrave_fill"
      && Boolean(vectorPath.closed)
      && points.length >= 3
      && pointInPolygon(worldPoint, points)
    );
    if (pathHit || fillHit) {
      return { type: "pattern", id: pattern.id, priority: 1, area, z: index, hitKind: fillHit ? "fill" : "stroke" };
    }
  }
  if (selectedIs("pattern", pattern.id)) {
    return { type: "pattern", id: pattern.id, priority: 3, area, z: index, hitKind: "selected-bounds" };
  }
  return null;
}

function hitTest(worldPoint, mode = state.canvasSelectionMode, options = {}) {
  const objectMode = mode !== "contour";
  const vectorHitDistance = Math.max(2 / Math.max(0.001, state.view.scale), 0.3);
  if (objectMode) {
    const candidates = [];
    for (let i = 0; i < state.patterns.length; i += 1) {
      const candidate = objectPatternHitCandidate(state.patterns[i], i, worldPoint, vectorHitDistance);
      if (candidate) candidates.push(candidate);
    }
    const selectedId = state.selected?.type === "pattern" ? state.selected.id : "";
    const chosen = window.LaserCanvasSelection?.chooseObjectCandidate(candidates, {
      selectedId,
      cycle: Boolean(options.cycle),
    }) || candidates.sort((first, second) => (
      first.priority - second.priority
      || first.area - second.area
      || second.z - first.z
    ))[0];
    if (chosen) return { type: "pattern", id: chosen.id };
  }
  if (!objectMode) {
    for (let i = state.patterns.length - 1; i >= 0; i -= 1) {
      const pattern = state.patterns[i];
      if (!pointInPolygon(worldPoint, patternCorners(pattern))) continue;
      if (vectorPatternHasPaths(pattern)) {
        const vectorPaths = pattern.vectorPaths || [];
        for (let j = vectorPaths.length - 1; j >= 0; j -= 1) {
          const vectorPath = vectorPaths[j];
          if (vectorPath.removed) continue;
          const points = vectorWorldPath(pattern, vectorPath);
          const pathHit = distanceToPolyline(worldPoint, points, Boolean(vectorPath.closed)) <= vectorHitDistance;
          if (pathHit) {
            return { type: "vectorPath", id: pattern.id, pathId: vectorPath.id, objectId: vectorPath.objectId || vectorPath.provenance?.objectId || "" };
          }
        }
        continue;
      }
    }
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

function beginObjectMarquee(screen, world, event) {
  const selectionMode = (event.ctrlKey || event.metaKey) ? "toggle" : event.shiftKey ? "add" : "replace";
  const baseItems = selectionMode === "replace" ? [] : uniqueSelectionItems(state.selectedItems || []);
  state.drag = {
    mode: "objectMarquee",
    startScreen: { ...screen },
    currentScreen: { ...screen },
    startWorld: { ...world },
    currentWorld: { ...world },
    selectionMode,
    baseItems,
    previewItems: [...baseItems],
    hitCount: 0,
  };
  canvas.style.cursor = "none";
  showSelectionCursor(screen, "select");
  canvas.setPointerCapture(event.pointerId);
  requestCanvasDraw();
}

function beginVectorMarquee(screen, world, event) {
  const selectionMode = (event.ctrlKey || event.metaKey) ? "toggle" : event.shiftKey ? "add" : "replace";
  const baseItems = selectionMode === "replace"
    ? []
    : normalizeVectorPathSelectionItems(state.selectedVectorPaths || []);
  state.drag = {
    mode: "vectorMarquee",
    startScreen: { ...screen },
    currentScreen: { ...screen },
    startWorld: { ...world },
    currentWorld: { ...world },
    selectionMode,
    baseItems,
    previewItems: [...baseItems],
    candidates: createVectorMarqueeCandidates(),
    hitCount: 0,
  };
  setVectorPathPreview(state.drag.previewItems);
  canvas.style.cursor = "none";
  showSelectionCursor(screen, "select");
  canvas.setPointerCapture(event.pointerId);
  requestCanvasDraw();
}

function beginVectorPathSelectionMove(hit, screen, world, event) {
  const entries = selectedVectorPathEntries();
  const movable = entries.filter((entry) => !entry.vectorPath.locked);
  if (!movable.length) {
    setStatus("Seçili konturlar kilitli; sürüklenemez.", "warn");
    return false;
  }
  const startPaths = vectorPathMoveSnapshots(movable);
  state.drag = {
    mode: "moveVectorPaths",
    startScreen: { ...screen },
    startWorld: { ...world },
    moved: false,
    undoPushed: false,
    activeItem: { patternId: hit.id, pathId: hit.pathId },
    startPaths,
    startModels: vectorPathMoveModelSnapshots(startPaths),
    lockedCount: entries.length - movable.length,
  };
  canvas.style.cursor = "none";
  showSelectionCursor(screen, "move");
  canvas.setPointerCapture(event.pointerId);
  return true;
}

function hitVectorObjectReviewGate(pattern, screenPoint) {
  const review = state.vectorObjectTool.review;
  const candidateIds = new Set((review?.candidateGateNodeIds || []).map(String));
  if (!pattern || !candidateIds.size) return null;
  let best = null;
  for (const node of pattern.vectorGraph?.nodes || []) {
    const nodeId = String(node.id || "");
    if (!candidateIds.has(nodeId)) continue;
    const screen = worldToScreen(vectorSourcePointToWorld(pattern, node.position));
    const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
    if (distance <= 12 && (!best || distance < best.distance)) best = { nodeId, distance };
  }
  return best;
}

function onPointerDown(event) {
  const screen = canvasPoint(event);
  const world = screenToWorld(screen);
  if (state.imageTool.active && event.button === 0 && !state.spaceDown) {
    const pattern = imageToolPattern();
    if (!pattern || !pointInPolygon(world, patternCorners(pattern))) {
      setStatus("Gorsel aracini secili gorselin icinde kullanin.", "warn");
      event.preventDefault();
      return;
    }
    const source = clampPatternSourcePoint(pattern, patternSourcePointFromWorld(pattern, world));
    state.imageTool.drawing = true;
    state.imageTool.startSource = [...source];
    state.imageTool.currentSource = [...source];
    state.imageTool.draftSourcePoints = [[...source]];
    state.imageTool.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    requestCanvasDraw();
    event.preventDefault();
    return;
  }
  if (state.drawingTool.active && event.button === 0 && !state.spaceDown) {
    if (state.drawingTool.mode === "vector") {
      const first = state.drawingTool.points[0];
      if (first && state.drawingTool.points.length >= 3 && Math.hypot(first.x - world.x, first.y - world.y) * state.view.scale <= 12) {
        state.drawingTool.closePath = true;
        if (refs.drawingClosePath) refs.drawingClosePath.checked = true;
        finishDrawingTool();
      } else {
        const last = state.drawingTool.points[state.drawingTool.points.length - 1];
        if (!last || Math.hypot(last.x - world.x, last.y - world.y) * state.view.scale >= 2) {
          state.drawingTool.points.push({ x: world.x, y: world.y });
        }
        syncDrawingUi();
        requestCanvasDraw();
      }
    } else {
      state.drawingTool.drawing = true;
      state.drawingTool.points = [{ x: world.x, y: world.y }];
      state.drawingTool.pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      requestCanvasDraw();
    }
    event.preventDefault();
    return;
  }
  if (state.vectorObjectTool.active && event.button === 0 && !state.spaceDown) {
    if (state.vectorObjectTool.pending) {
      event.preventDefault();
      return;
    }
    if (state.vectorObjectTool.review) {
      const pattern = patternById(state.vectorObjectTool.patternId);
      const gate = hitVectorObjectReviewGate(pattern, screen);
      if (gate) {
        void toggleVectorObjectGate(pattern, gate.nodeId);
      } else {
        setStatus("Gate halkasına tıklayarak Kes/Koru değiştirin; ardından Onayla veya İptal kullanın.", "info");
      }
      event.preventDefault();
      return;
    }
    const pattern = patternById(state.vectorObjectTool.patternId);
    if (!pattern || !pointInPolygon(world, patternCorners(pattern))) {
      setStatus("Nesne seçimine seçili vektör deseninin içinde başlayın.", "warn");
      event.preventDefault();
      return;
    }
    const source = clampPatternSourcePoint(pattern, patternSourcePointFromWorld(pattern, world));
    state.vectorObjectTool.drawing = true;
    state.vectorObjectTool.startSource = source;
    state.vectorObjectTool.currentSource = [...source];
    state.vectorObjectTool.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    requestCanvasDraw();
    event.preventDefault();
    return;
  }
  if (state.vectorRepairTool.active && event.button === 0 && !state.spaceDown) {
    if (state.vectorRepairTool.mode === "create") {
      if (beginNewVectorPathDraw(world, event.pointerId)) canvas.setPointerCapture(event.pointerId);
    } else if (state.vectorRepairTool.mode === "redraw") {
      if (beginVectorPathRedraw(world, event.pointerId)) canvas.setPointerCapture(event.pointerId);
    } else {
      repairVectorPathAtWorld(world);
    }
    event.preventDefault();
    return;
  }
  if (state.vectorRegionTool.active && event.button === 0 && !state.spaceDown) {
    void markVectorCutRegionAtWorld(world);
    event.preventDefault();
    return;
  }
  if (state.materialArea.drawing && event.button === 0 && !state.spaceDown) {
    addMaterialAreaPoint(world);
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  if (event.button === 1 || state.spaceDown) {
    beginCanvasInteraction("pointer-pan");
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
    beginCanvasInteraction("pointer-pattern-transform", { pattern });
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

  const selectedMoveHit = canvasSelectionIsContour() && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey
    ? selectedVectorMoveHit(world)
    : null;
  if (selectedMoveHit) {
    beginVectorPathSelectionMove(selectedMoveHit, screen, world, event);
    event.preventDefault();
    return;
  }

  const hit = hitTest(world, state.canvasSelectionMode, { cycle: event.altKey });
  if (!hit) {
    if (canvasSelectionIsContour()) beginVectorMarquee(screen, world, event);
    else beginObjectMarquee(screen, world, event);
    event.preventDefault();
    return;
  }
  if (hit.type === "vectorPath") {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const items = normalizeVectorPathSelectionItems(state.selectedVectorPaths || []);
        if (!vectorPathSelectionHas(hit.id, hit.pathId)) items.push({ patternId: hit.id, pathId: hit.pathId });
        setVectorPathSelection(items, { patternId: hit.id, pathId: hit.pathId });
      } else {
        toggleVectorPathSelection({ patternId: hit.id, pathId: hit.pathId });
      }
      event.preventDefault();
      return;
    }
    const alreadySelected = vectorPathSelectionHas(hit.id, hit.pathId);
    if (!alreadySelected) {
      const hitPattern = patternById(hit.id);
      const hitObject = vectorObjectById(hitPattern, hit.objectId);
      if (hitObject && vectorObjectIsUserSemantic(hitObject) && !event.altKey) {
        select("vectorObject", hit.id, { objectId: hitObject.id });
        return;
      }
      setVectorPathSelection([{ patternId: hit.id, pathId: hit.pathId }], { patternId: hit.id, pathId: hit.pathId });
    } else {
      setVectorPathSelection(state.selectedVectorPaths, { patternId: hit.id, pathId: hit.pathId });
    }
    beginVectorPathSelectionMove(hit, screen, world, event);
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey || event.shiftKey) && ["pattern", "placement"].includes(hit.type)) {
    if (hit.type === "pattern") togglePatternSelection(hit.id);
    else togglePlacementSelection(hit.id);
    return;
  }
  const movingPatternGroup = hit.type === "pattern" && selectedIs("pattern", hit.id) && selectedPatternObjects().length > 1;
  const movingPlacementGroup = hit.type === "placement" && selectedIs("placement", hit.id) && selectedPlacementObjects().length > 1;
  if (movingPatternGroup) {
    state.selected = { type: "pattern", id: hit.id };
    updateSelectionPanel();
  } else if (movingPlacementGroup) {
    state.selected = { type: "placement", id: hit.id };
    updateSelectionPanel();
  } else {
    select(hit.type, hit.id);
  }
  const selectedObject = hit.type === "pattern" ? patternById(hit.id) : placementById(hit.id);
  pushUndo(hit.type === "pattern" ? "Desen tasi" : "Parca tasi");
  if (hit.type === "pattern") {
    beginCanvasInteraction("pointer-pattern-move", { pattern: movingPatternGroup ? null : selectedObject });
  }
  state.drag = {
    mode: movingPatternGroup ? "moveSelection" : movingPlacementGroup ? "movePlacementSelection" : hit.type === "pattern" ? "movePattern" : "movePlacement",
    id: hit.id,
    startWorld: world,
    startObject: { ...selectedObject },
    startSelectedPatterns: movingPatternGroup
      ? selectedPatternObjects().map((item) => ({ id: item.id, x: item.x, y: item.y }))
      : [],
    startSelectedPlacements: movingPlacementGroup
      ? selectedPlacementObjects().map((item) => ({ id: item.id, x: item.x, y: item.y }))
      : [],
    startPatterns:
      hit.type === "placement"
        ? state.patterns
            .filter((item) => movingPlacementGroup
              ? selectedPlacementObjects().some((placement) => placement.id === item.parentId)
              : item.parentId === hit.id)
            .map((item) => ({ id: item.id, x: item.x, y: item.y }))
        : [],
  };
  canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  const screen = canvasPoint(event);
  const world = screenToWorld(screen);
  state.cursor = world;
  if (state.imageTool.active) {
    hideSelectionCursor();
    const pattern = imageToolPattern();
    if (pattern) {
      state.imageTool.currentSource = clampPatternSourcePoint(pattern, patternSourcePointFromWorld(pattern, world));
      if (state.imageTool.mode === "mask" && state.imageTool.drawing) {
        const points = state.imageTool.draftSourcePoints;
        const last = points[points.length - 1];
        const current = state.imageTool.currentSource;
        if (!last || Math.hypot(last[0] - current[0], last[1] - current[1]) >= Math.max(0.5, Math.min(pattern.sourceWidth, pattern.sourceHeight) * 0.002)) {
          points.push([...current]);
        }
      }
    }
    canvas.style.cursor = state.imageTool.mode === "crop" ? "crosshair" : "none";
    requestCanvasDraw();
    return;
  }
  if (state.drawingTool.active) {
    hideSelectionCursor();
    if (state.drawingTool.mode === "freehand" && state.drawingTool.drawing) {
      const points = state.drawingTool.points;
      const last = points[points.length - 1];
      if (!last || Math.hypot(last.x - world.x, last.y - world.y) >= Math.max(0.03, 1.5 / state.view.scale)) {
        points.push({ x: world.x, y: world.y });
      }
    }
    canvas.style.cursor = "crosshair";
    requestCanvasDraw();
    return;
  }
  if (state.vectorObjectTool.active) {
    hideSelectionCursor();
    const pattern = patternById(state.vectorObjectTool.patternId);
    if (state.vectorObjectTool.review) {
      canvas.style.cursor = hitVectorObjectReviewGate(pattern, screen) ? "pointer" : "default";
    } else {
      if (pattern) state.vectorObjectTool.currentSource = clampPatternSourcePoint(pattern, patternSourcePointFromWorld(pattern, world));
      canvas.style.cursor = "crosshair";
    }
    requestCanvasDraw();
    return;
  }
  if (state.vectorRepairTool.active) {
    hideSelectionCursor();
    if (["create", "redraw"].includes(state.vectorRepairTool.mode) && state.vectorRepairTool.drawing) {
      appendVectorPathRedraw(world);
    }
    canvas.style.cursor = "none";
    requestCanvasDraw();
    return;
  }
  if (state.vectorRegionTool.active) {
    hideSelectionCursor();
    canvas.style.cursor = "crosshair";
    requestCanvasDraw();
    return;
  }
  if (state.materialArea.drawing) {
    hideSelectionCursor();
    state.materialArea.previewPoint = axisConstrainedMaterialAreaPoint(world);
    canvas.style.cursor = "none";
    requestCanvasDraw();
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
    const objectHit = canvasSelectionIsContour() ? hitTestBounds(world) : hitTest(world, "object");
    const wholeObjectMove = objectHit?.type === "placement"
      || (objectHit?.type === "pattern" && state.selected?.type === "pattern" && state.selected.id === objectHit.id);
    const vectorMoveHit = canvasSelectionIsContour() ? selectedVectorMoveHit(world) : null;
    if (handleCursor || wholeObjectMove) {
      hideSelectionCursor();
      canvas.style.cursor = handleCursor || "move";
    } else {
      canvas.style.cursor = "none";
      showSelectionCursor(screen, vectorMoveHit ? "move" : "select");
    }
    computeView();
    return;
  }
  if (state.drag.mode === "objectMarquee") {
    state.drag.currentScreen = { ...screen };
    state.drag.currentWorld = { ...world };
    updateObjectMarqueePreview(state.drag);
    canvas.style.cursor = "none";
    showSelectionCursor(screen, "select");
    requestCanvasDraw();
    return;
  }
  if (state.drag.mode === "vectorMarquee") {
    state.drag.currentScreen = { ...screen };
    state.drag.currentWorld = { ...world };
    updateVectorMarqueePreview(state.drag);
    canvas.style.cursor = "none";
    showSelectionCursor(screen, "select");
    requestCanvasDraw();
    return;
  }
  if (state.drag.mode === "moveVectorPaths") {
    const movedPixels = Math.hypot(screen.x - state.drag.startScreen.x, screen.y - state.drag.startScreen.y);
    if (!state.drag.moved && movedPixels < 3) return;
    if (!state.drag.undoPushed) {
      pushUndo("Konturları sürükle");
      state.drag.undoPushed = true;
      state.drag.moved = true;
    }
    const dx = world.x - state.drag.startWorld.x;
    const dy = world.y - state.drag.startWorld.y;
    for (const startPath of state.drag.startPaths || []) {
      const pattern = patternById(startPath.patternId);
      const vectorPath = (pattern?.vectorPaths || []).find((path) => String(path.id) === String(startPath.pathId));
      if (!pattern || !vectorPath) continue;
      applyVectorPathWorldDelta(pattern, vectorPath, startPath.points, dx, dy);
    }
    invalidateSelectedVectorMoveTargets();
    canvas.style.cursor = "none";
    showSelectionCursor(screen, "move");
    requestCanvasDraw();
    return;
  }
  if (state.drag.mode === "pan") {
    hideSelectionCursor();
    canvas.style.cursor = "grabbing";
    state.view.panX = state.drag.startPanX + (screen.x - state.drag.startScreen.x);
    state.view.panY = state.drag.startPanY + (screen.y - state.drag.startScreen.y);
    requestCanvasDraw();
    return;
  }
  hideSelectionCursor();
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
  if (state.drag.mode === "movePlacementSelection") {
    for (const startPlacement of state.drag.startSelectedPlacements || []) {
      const placement = placementById(startPlacement.id);
      if (!placement) continue;
      placement.x = startPlacement.x + dx;
      placement.y = startPlacement.y + dy;
    }
    for (const startPattern of state.drag.startPatterns || []) {
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
    }, { preserveLocked: false });
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
    }, { preserveLocked: false });
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
    }, { preserveLocked: false });
  }
  if (state.drag.mode === "rotate") {
    const pattern = patternById(state.drag.id);
    const angle = Math.atan2(world.y - state.drag.center.y, world.x - state.drag.center.x);
    pattern.rotation = (state.drag.startPattern.rotation + ((angle - state.drag.startAngle) * 180) / Math.PI + 360) % 360;
  }
  requestCanvasDraw();
}

function onPointerUp(event) {
  if (state.imageTool.active && state.imageTool.drawing) {
    const pattern = imageToolPattern();
    const tool = state.imageTool;
    tool.drawing = false;
    tool.pointerId = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (event.type === "pointercancel" || !pattern) {
      cancelImageTool("Gorsel islemi iptal edildi.");
    } else if (tool.mode === "crop") {
      const start = tool.startSource && [...tool.startSource];
      const end = tool.currentSource && [...tool.currentSource];
      cancelImageTool();
      if (start && end) applyImageCrop(pattern, start, end)
        .then(() => setStatus("Gorsel kirpildi.", "ok"))
        .catch((error) => setStatus(error.message, "danger"));
    } else if (tool.mode === "mask") {
      const points = tool.draftSourcePoints.map((point) => [...point]);
      tool.draftSourcePoints = [];
      applyImageMask(pattern, points).catch((error) => setStatus(error.message, "danger"));
      requestCanvasDraw();
    }
    event.preventDefault();
    return;
  }
  if (state.drawingTool.active && state.drawingTool.mode === "freehand" && state.drawingTool.drawing) {
    state.drawingTool.drawing = false;
    state.drawingTool.pointerId = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (event.type === "pointercancel") cancelDrawingTool("Serbest cizim iptal edildi.");
    else finishDrawingTool();
    event.preventDefault();
    return;
  }
  if (state.vectorObjectTool.active && state.vectorObjectTool.drawing) {
    const pattern = patternById(state.vectorObjectTool.patternId);
    if (pattern) {
      const world = screenToWorld(canvasPoint(event));
      state.vectorObjectTool.currentSource = clampPatternSourcePoint(pattern, patternSourcePointFromWorld(pattern, world));
    }
    state.vectorObjectTool.drawing = false;
    state.vectorObjectTool.pointerId = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (event.type === "pointercancel") {
      cancelVectorObjectSeparation("Nesne ayırma iptal edildi.");
      draw();
    } else {
      finishVectorObjectSeparation();
    }
    event.preventDefault();
    return;
  }
  if (state.vectorRepairTool.active && ["create", "redraw"].includes(state.vectorRepairTool.mode) && state.vectorRepairTool.drawing) {
    const world = screenToWorld(canvasPoint(event));
    if (event.type === "pointercancel") {
      cancelVectorRepairTool(state.vectorRepairTool.mode === "create" ? "Yeni kontur çizimi iptal edildi." : "Konturu yeniden çizme iptal edildi.");
      draw();
    } else if (state.vectorRepairTool.mode === "create") {
      finishNewVectorPathDraw(world);
    } else {
      finishVectorPathRedraw(world);
    }
    canvas.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
    return;
  }
  if (state.drag?.mode === "objectMarquee") {
    const completedDrag = state.drag;
    if (event.type !== "pointercancel") {
      completedDrag.currentScreen = canvasPoint(event);
      completedDrag.currentWorld = screenToWorld(completedDrag.currentScreen);
      updateObjectMarqueePreview(completedDrag);
    }
    const movedPixels = Math.hypot(
      Number(completedDrag.currentScreen?.x) - Number(completedDrag.startScreen?.x),
      Number(completedDrag.currentScreen?.y) - Number(completedDrag.startScreen?.y),
    );
    const finalItems = event.type === "pointercancel"
      ? completedDrag.baseItems
      : movedPixels >= 3
        ? completedDrag.previewItems
        : completedDrag.selectionMode === "replace" ? [] : completedDrag.baseItems;
    state.drag = null;
    canvas.releasePointerCapture?.(event.pointerId);
    const normalized = uniqueSelectionItems(finalItems);
    const patterns = normalized.filter((item) => item.type === "pattern");
    const placements = normalized.filter((item) => item.type === "placement");
    if (patterns.length) {
      selectPatternItems(patterns.map((item) => item.id), patterns[patterns.length - 1].id);
    } else if (placements.length) {
      selectPlacementItems(placements.map((item) => item.id), placements[placements.length - 1].id);
    } else {
      select(null, null);
    }
    setStatus(
      normalized.length ? `${normalized.length} nesne seçildi.` : "Nesne seçimi temizlendi.",
      normalized.length ? "ok" : "info"
    );
    event.preventDefault();
    return;
  }
  if (state.drag?.mode === "vectorMarquee") {
    const completedDrag = state.drag;
    if (event.type !== "pointercancel") {
      completedDrag.currentScreen = canvasPoint(event);
      completedDrag.currentWorld = screenToWorld(completedDrag.currentScreen);
      updateVectorMarqueePreview(completedDrag);
    }
    const movedPixels = Math.hypot(
      Number(completedDrag.currentScreen?.x) - Number(completedDrag.startScreen?.x),
      Number(completedDrag.currentScreen?.y) - Number(completedDrag.startScreen?.y),
    );
    const finalItems = event.type === "pointercancel"
      ? completedDrag.baseItems
      : movedPixels >= 3
        ? completedDrag.previewItems
        : completedDrag.selectionMode === "replace" ? [] : completedDrag.baseItems;
    const selectionRegion = event.type === "pointercancel" || movedPixels < 3
      ? null
      : vectorMarqueeSelectionRegion(completedDrag, finalItems);
    state.drag = null;
    setVectorPathPreview([]);
    canvas.releasePointerCapture?.(event.pointerId);
    setVectorPathSelection(finalItems, finalItems?.[finalItems.length - 1], { region: selectionRegion });
    setStatus(
      finalItems?.length
        ? `${finalItems.length} kontur seçildi. Seçili çizgilerden birini sürükleyerek birlikte taşıyın.`
        : "Kontur seçimi temizlendi.",
      finalItems?.length ? "ok" : "info"
    );
    event.preventDefault();
    return;
  }
  if (state.drag?.mode === "moveVectorPaths") {
    const completedDrag = state.drag;
    if (completedDrag.moved && event.type !== "pointercancel") {
      const endWorld = screenToWorld(canvasPoint(event));
      const dx = endWorld.x - completedDrag.startWorld.x;
      const dy = endWorld.y - completedDrag.startWorld.y;
      for (const startPath of completedDrag.startPaths || []) {
        const pattern = patternById(startPath.patternId);
        const vectorPath = (pattern?.vectorPaths || []).find((path) => String(path.id) === String(startPath.pathId));
        if (pattern && vectorPath) applyVectorPathWorldDelta(pattern, vectorPath, startPath.points, dx, dy);
      }
    }
    state.drag = null;
    setVectorPathPreview([]);
    canvas.releasePointerCapture?.(event.pointerId);
    if (event.type === "pointercancel" && completedDrag.undoPushed) {
      const snapshot = undoStack.pop();
      if (snapshot) restoreUndoSnapshot(snapshot);
      setStatus("Kontur taşıma iptal edildi.", "warn");
      event.preventDefault();
      return;
    }
    if (completedDrag.moved) {
      try {
        const endWorld = screenToWorld(canvasPoint(event));
        const finalSelection = commitVectorPathSelectionTranslation(
          completedDrag.startPaths,
          completedDrag.startModels,
          endWorld.x - completedDrag.startWorld.x,
          endWorld.y - completedDrag.startWorld.y,
        );
        setVectorPathSelection(finalSelection, finalSelection[finalSelection.length - 1], { redraw: false, updateUi: false });
      } catch (error) {
        const snapshot = undoStack.pop();
        if (snapshot) restoreUndoSnapshot(snapshot);
        setStatus(error.message || "Konturlar taşınamadı.", "danger");
        event.preventDefault();
        return;
      }
      flushCanvasDraw();
      updateSelectionPanel();
      updateJobAnalysisNow();
      setStatus(
        `${completedDrag.startPaths.length} kontur birlikte taşındı${completedDrag.lockedCount ? ` · ${completedDrag.lockedCount} kilitli kontur korundu` : ""}.`,
        "ok"
      );
    } else {
      draw();
    }
    event.preventDefault();
    return;
  }
  const completedDrag = state.drag;
  const hadDrag = Boolean(completedDrag);
  if (["movePlacement", "movePlacementSelection"].includes(completedDrag?.mode)) {
    markManualLayout();
  }
  if (["resize", "resizeX", "resizeY"].includes(completedDrag?.mode)) {
    const pattern = patternById(completedDrag.id);
    if (pattern && vectorPatternNeedsResizePreserve(pattern)) {
      preserveLockedVectorPaths(completedDrag.startPattern, pattern);
    }
  }
  state.drag = null;
  if (canvasInteraction?.kind?.startsWith("pointer-")) {
    finishCanvasInteraction({ redraw: false, updateUi: false });
  }
  canvas.releasePointerCapture?.(event.pointerId);
  if (hadDrag) {
    flushCanvasDraw();
    if (["movePattern", "moveSelection", "resize", "resizeX", "resizeY", "rotate"].includes(completedDrag.mode)) {
      if (!syncPatternPanelGeometry(selectedPattern())) updateSelectionPanel();
    } else if (["movePlacement", "movePlacementSelection"].includes(completedDrag.mode)) {
      updateSelectionPanel();
    }
    if (completedDrag.mode !== "pan") updateJobAnalysisNow();
  }
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
    rotateSelectedContinuous(direction * 5);
    return;
  }
  zoomView(direction > 0 ? 1.12 : 1 / 1.12, screen);
}

function gcodeDefaultName() {
  const current = String(refs.outputPath?.value || "").split(/[\\/]/).pop() || "laser_job.nc";
  const stem = current.replace(/\.(nc|gcode)$/i, "").trim() || "laser_job";
  return `${stem}.nc`;
}

async function chooseOutput(options = {}) {
  try {
    const data = await api("/api/save-gcode-dialog", {
      defaultName: options.defaultName || gcodeDefaultName(),
    });
    if (data.path) {
      pushUndo("Cikti yolu");
      refs.outputPath.value = data.path;
      clearMachinePreview();
      updateSummary();
      return data.path;
    }
    return "";
  } catch (error) {
    setStatus(error.message, "warn");
    return "";
  }
}

function projectDefaultName() {
  const output = refs.outputPath?.value || "";
  const raw = state.project.name || output.split(/[\\/]/).pop()?.replace(/\.(nc|gcode)$/i, "") || "laser_job";
  const name = String(raw)
    .replace(/\.laserjob\.json$/i, "")
    .replace(/\.json$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim() || "laser_job";
  return `${name}.laserjob.json`;
}

function projectPayload(options = {}) {
  prepareVectorModelsForOutput();
  ensureStateEntityIdentities();
  const imageSources = captureImageSources();
  return {
    schema: ProjectState.PROJECT_SCHEMA,
    version: ProjectState.PROJECT_VERSION,
    features: {
      embeddedPartGeometry: true,
      vectorGraph: true,
      vectorObjects: true,
      toolpathProvenance: true,
      entityIdentity: true,
      autosaveRecovery: true,
    },
    name: state.project.name || "Adsız iş",
    savedAt: options.autosave ? state.project.lastSavedAt : new Date().toISOString(),
    project: clonePlain(state.project),
    parts: clonePlain(state.parts),
    placements: clonePlain(state.placements),
    patterns: state.patterns.map((pattern) => clonePatternPayload(pattern)),
    customFonts: clonePlain(state.customFonts),
    selected: state.selected ? clonePlain(state.selected) : null,
    selectedItems: clonePlain(state.selectedItems || []),
    selectedVectorPaths: clonePlain(state.selectedVectorPaths || []),
    vectorSelectionRegion: state.vectorSelectionRegion ? clonePlain(state.vectorSelectionRegion) : null,
    layout: clonePlain(state.layout),
    materialArea: clonePlain(state.materialArea),
    laserCmd: state.laserCmd,
    inputs: undoInputSnapshot(),
    outputPath: refs.outputPath?.value || "",
    imageSources,
    imageAdjustmentBases: captureImageAdjustmentBases(imageSources),
  };
}

function restoreProject(project, options = {}) {
  if (!project || !["laser-editor-project-v1", "laser-editor-project-v2", ProjectState.PROJECT_SCHEMA].includes(project.schema)) {
    throw new Error("Bu dosya Lazer İş Editörü proje dosyası değil.");
  }
  state.parts = clonePlain(project.parts || []);
  state.placements = clonePlain(project.placements || []);
  state.patterns = (project.patterns || []).map((pattern) => clonePatternPayload({
    ...pattern,
    processOverride: pattern.processOverride === undefined ? true : Boolean(pattern.processOverride),
  }));
  state.lastGeneratedRevision = null;
  state.lastGeneratedPath = "";
  ensureStateEntityIdentities();
  let normalizedTextPatternCount = 0;
  for (const pattern of state.patterns) {
    if (normalizeEditableTextPatternBounds(pattern)) normalizedTextPatternCount += 1;
  }
  for (const pattern of state.patterns) {
    if (!vectorPatternHasPaths(pattern)) continue;
    if (Number(pattern.vectorModelVersion) === 2) compilePatternVectorModel(pattern);
    else ensurePatternVectorModel(pattern);
  }
  state.customFonts = clonePlain(project.customFonts || []).map((font) => ({ ...font, installed: false }));
  state.selected = project.selected ? clonePlain(project.selected) : null;
  state.selectedItems = clonePlain(project.selectedItems || []);
  state.selectedVectorPaths = clonePlain(project.selectedVectorPaths || []);
  state.vectorSelectionRegion = project.vectorSelectionRegion ? clonePlain(project.vectorSelectionRegion) : null;
  rebuildVectorPathSelectionKeys();
  state.layout = clonePlain(project.layout || state.layout);
  state.materialArea = normalizeMaterialArea(project.materialArea || {});
  state.laserCmd = project.laserCmd || state.laserCmd;
  const restoredSession = options.session || project.project || {};
  const restoredPath = options.path || restoredSession.path || "";
  const revision = Math.max(0, Number(restoredSession.revision) || 0);
  state.project = ProjectState.createSession({
    ...restoredSession,
    id: restoredSession.id || ProjectState.createId("project"),
    name: restoredSession.name || project.name || ProjectState.projectNameFromPath(restoredPath),
    path: restoredPath,
    revision,
    savedRevision: options.recovery ? Number(restoredSession.savedRevision) || 0 : revision,
    dirty: Boolean(options.recovery),
    lastSavedAt: restoredSession.lastSavedAt || project.savedAt || null,
  });
  if (normalizedTextPatternCount && !options.recovery) {
    state.project = ProjectState.markDirty(state.project, "Metin seçim kutusu düzeltildi");
  }
  undoStack.length = 0;
  redoStack.length = 0;
  cancelImageTool();
  cancelDrawingTool();
  applyUndoInputSnapshot(project.inputs || {});
  if (refs.outputPath) refs.outputPath.value = project.outputPath || project.inputs?.outputPath || "";
  restoreImageSources(project.imageSources || {}, project.imageAdjustmentBases || {});
  installCustomFonts().then(() => renderTextFontOptions(project.inputs?.textFont || refs.textFont?.value)).catch(() => renderTextFontOptions(refs.textFont?.value));
  syncLaserButtons();
  clearMachinePreview();
  saveUiSettings();
  updateUiFromAnalysis(computeJobAnalysis());
  updateSelectionPanel();
  syncImageEditUi();
  draw();
  renderMachinePanel();
  updateProjectChrome();
  closeProjectHub();
}

async function saveProject(options = {}) {
  try {
    setStatus("İş projesi kaydediliyor...");
    const saveAs = Boolean(options.saveAs);
    const data = await api("/api/save-project", {
      project: projectPayload(),
      defaultName: projectDefaultName(),
      outputPath: saveAs ? "" : state.project.path,
    });
    if (!data.saved) {
      setStatus("Proje kaydedilmedi.");
      return;
    }
    state.project = ProjectState.markSaved(state.project, {
      path: data.saved.outputPath,
      name: ProjectState.projectNameFromPath(data.saved.outputPath, state.project.name),
    });
    addCurrentProjectToRecent(data.saved.outputPath);
    await clearProjectRecovery();
    updateProjectChrome();
    closeProjectInfo();
    setStatus(`Proje kaydedildi: ${data.saved.outputPath}`, "ok");
  } catch (error) {
    setStatus(error.message, "danger");
  }
}

async function openProject(options = {}) {
  if (state.project.dirty && state.preferences.confirmBeforeClear) {
    const proceed = window.confirm("Geçerli projede kaydedilmemiş değişiklikler var. Başka proje açılsın mı?");
    if (!proceed) return;
  }
  try {
    const path = options.path || "";
    const data = await api("/api/open-project", path ? { path } : {});
    if (!data.project) {
      setStatus("Proje seçilmedi.");
      return;
    }
    restoreProject(data.project, { path: data.path || path });
    addCurrentProjectToRecent(data.path || path);
    await clearProjectRecovery();
    setStatus(`Proje açıldı: ${data.path || data.project.name || ""}`);
  } catch (error) {
    if (options.path) {
      state.recentProjects = state.recentProjects.filter((item) => ProjectState.normalizeSource(item.path) !== ProjectState.normalizeSource(options.path));
      saveProjectPreferences();
      renderRecentProjects();
    }
    setStatus(error.message, "danger");
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
    state.lastGeneratedRevision = state.project.revision;
    state.lastGeneratedPath = result.outputPath;
    clearMachinePreview();
    saveUiSettings();
    await loadMachinePreview(false);
    recordProductionHistory("generated", { message: "Kazıma blokları kesim G-code'una çevrildi." });
    updateSummary(
      `\nKesime çevrilen blok: ${result.convertedBlocks}\nGüç komutu: ${result.powerChanges}\nHız komutu: ${result.feedChanges}\nÇıktı: ${result.outputPath}`
    );
    renderMachinePanel();
    setStatus(`G-code kesime çevrildi: ${result.outputPath}`, "ok");
  } catch (error) {
    setStatus(error.message, "danger");
  }
}

function setGcodeGenerationBusy(busy) {
  for (const button of [refs.generateBtn, refs.generateBtn2, document.getElementById("previewGenerateBtn")].filter(Boolean)) {
    button.disabled = Boolean(busy);
    button.toggleAttribute("aria-busy", Boolean(busy));
    button.textContent = busy ? "Hazırlanıyor..." : "G-code Oluştur";
  }
}

async function generateGcode() {
  if (gcodeGenerationActive) {
    setStatus("G-code hedef seçimi veya üretimi zaten devam ediyor.", "warn");
    return;
  }
  gcodeGenerationActive = true;
  setGcodeGenerationBusy(true);
  try {
    prepareVectorModelsForOutput();
    const analysis = computeJobAnalysis();
    updateUiFromAnalysis(analysis);
    setGcodeGenerationBusy(true);
    if (!analysis.canGenerate) {
      const first = analysis.warnings.find((item) => item.level === "critical");
      setStatus(`G-code oluşturulamaz: ${first?.title || "kritik sorun var"}.`, "danger");
      refs.preflightPanel?.scrollIntoView({ block: "nearest" });
      return;
    }
    const outputPath = await chooseOutput({ defaultName: gcodeDefaultName() });
    if (!outputPath) {
      setStatus("G-code oluşturma iptal edildi.", "info");
      return;
    }
    setStatus("G-code oluşturuluyor...");
    const productionPlacementIds = new Set(analysis.productionPlacements.map((item) => item.placement.id));
    const productionPatternIds = new Set(analysis.productionPatterns.map((item) => item.pattern.id));
    const settings = getSettings();
    const payload = {
      parts: state.parts.map((part) => clonePartPayload(part)),
      placements: state.placements.map((placement) => ({
        ...placement,
        operation: productionPlacementIds.has(placement.id) ? placementOperation(placement) : "ignore",
      })),
      patterns: state.patterns.map((pattern) => {
        const payloadPattern = clonePatternPayload(pattern);
        payloadPattern.operation = productionPatternIds.has(pattern.id) ? patternOperation(pattern) : "ignore";
        if (!patternUsesCustomProcess(pattern)) {
          payloadPattern.cutPower = settings.power;
          payloadPattern.cutFeed = settings.feed;
          payloadPattern.engravePower = settings.engravePower;
          payloadPattern.engraveFeed = settings.engraveFeed;
          const cutPattern = patternOperation(pattern) === "cut";
          payloadPattern.power = cutPattern ? settings.power : settings.engravePower;
          payloadPattern.feed = cutPattern ? settings.feed : settings.engraveFeed;
        }
        const editedRaster = pattern.kind === "raster" ? state.images.get(pattern.id) : null;
        if (editedRaster?.src?.startsWith("data:image/")) payloadPattern.dataUrl = editedRaster.src;
        return payloadPattern;
      }),
      settings,
      outputPath,
      overwriteConfirmed: true,
    };
    const data = await api("/api/generate", payload);
    const result = data.result;
    state.lastGeneratedRevision = state.project.revision;
    state.lastGeneratedPath = outputPath;
    result.excludedObjectCount = analysis.excludedOutsideCount + Number(result.excludedObjectCount || 0);
    setStatus(
      result.excludedObjectCount
        ? `G-code hazır. Üretim alanı dışındaki ${result.excludedObjectCount} nesne dahil edilmedi.`
        : "G-code hazır.",
      result.excludedObjectCount ? "warn" : "ok"
    );
    updateSummary(
      `\nKesim alanı: ${result.cutWidth.toFixed(2)} x ${result.cutHeight.toFixed(2)} mm\nSatır: ${result.lineCount}${
        result.excludedObjectCount ? `\nÜretim dışı: ${result.excludedObjectCount} nesne` : ""
      }`
    );
    await loadMachinePreview(false);
    recordProductionHistory("generated", { message: "G-code uygulamada oluşturuldu." });
    openProduceFlow(result);
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    gcodeGenerationActive = false;
    setGcodeGenerationBusy(false);
    updateUiFromAnalysis(computeJobAnalysis());
  }
}

function clearParts() {
  if (!(state.parts.length || state.placements.length || state.patterns.length)) {
    setStatus("Temizlenecek nesne yok.");
    return;
  }
  if (state.preferences.confirmBeforeClear && !window.confirm("Tüm DXF parçaları, yerleşimler ve desenler silinsin mi?")) return;
  if (state.parts.length || state.placements.length || state.patterns.length) pushUndo("Temizle");
  state.parts = [];
  state.placements = [];
  state.patterns = [];
  state.images.clear();
  imageAdjustmentBases.clear();
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
  if (event.defaultPrevented || dxfQuantityDialogOpen()) return;
  if (event.key === "Escape") {
    if (state.productionPreview.open) {
      setWorkspaceMode("design");
      event.preventDefault();
      return;
    }
    if (!refs.libraryModal?.classList.contains("hidden")) {
      closeLibrary();
      event.preventDefault();
      return;
    }
    if (!refs.notificationsModal?.classList.contains("hidden")) {
      closeNotifications();
      event.preventDefault();
      return;
    }
    if (!refs.productionHistoryModal?.classList.contains("hidden")) {
      closeProductionHistory();
      event.preventDefault();
      return;
    }
    if (!refs.boxMakerModal?.classList.contains("hidden")) {
      closeBoxMaker();
      event.preventDefault();
      return;
    }
    if (!refs.calibrationModal?.classList.contains("hidden")) {
      closeCalibration();
      event.preventDefault();
      return;
    }
    if (!refs.preferencesModal?.classList.contains("hidden")) {
      closePreferences();
      event.preventDefault();
      return;
    }
    if (!refs.helpModal?.classList.contains("hidden")) {
      closeHelp();
      event.preventDefault();
      return;
    }
    if (!refs.projectInfoModal?.classList.contains("hidden")) {
      closeProjectInfo();
      event.preventDefault();
      return;
    }
    if (!refs.projectHub?.classList.contains("hidden")) {
      closeProjectHub();
      event.preventDefault();
      return;
    }
  }
  if (state.imageTool.active && !isTypingTarget(event.target) && event.key === "Escape") {
    cancelImageTool("Gorsel araci iptal edildi.");
    event.preventDefault();
    return;
  }
  if (state.drawingTool.active && !isTypingTarget(event.target)) {
    if (event.key === "Escape") {
      cancelDrawingTool("Cizim iptal edildi.");
      event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      finishDrawingTool();
      event.preventDefault();
      return;
    }
    if (event.key === "Backspace" && state.drawingTool.mode === "vector") {
      state.drawingTool.points.pop();
      syncDrawingUi();
      draw();
      event.preventDefault();
      return;
    }
  }
  if (state.vectorObjectTool.active && event.key === "Escape") {
    cancelVectorObjectSeparation("Nesne ayırma iptal edildi.");
    draw();
    event.preventDefault();
    return;
  }
  if (state.vectorRepairTool.active && !isTypingTarget(event.target) && event.key === "Escape") {
    cancelVectorRepairTool("Yerel kontur düzeltme iptal edildi.");
    draw();
    event.preventDefault();
    return;
  }
  if (state.vectorRegionTool.active && !isTypingTarget(event.target) && event.key === "Escape") {
    cancelVectorRegionSelection("Alan seçimi iptal edildi.");
    draw();
    event.preventDefault();
    return;
  }
  if (state.materialArea.drawing && !isTypingTarget(event.target)) {
    if (event.key === "Enter") {
      finishMaterialAreaDrawing();
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      state.materialArea.drawing = false;
      state.materialArea.previewPoint = null;
      canvas.style.cursor = "";
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
  const shortcutKey = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (shortcutKey === "s") {
      saveProject({ saveAs: event.shiftKey });
      event.preventDefault();
      return;
    }
    if (shortcutKey === "o") {
      openProject();
      event.preventDefault();
      return;
    }
    if (shortcutKey === "n") {
      newProject();
      event.preventDefault();
      return;
    }
  }
  if (isTypingTarget(event.target)) return;
  if (event.key === "Escape" && state.selectedVectorPaths?.length) {
    select(null, null);
    setStatus("Kontur seçimi temizlendi.", "info");
    event.preventDefault();
    return;
  }
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
  if ((event.ctrlKey || event.metaKey) && key === "x") {
    cutSelection();
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
  document.addEventListener("keydown", (event) => {
    if (!state.tour.active) return;
    if (event.key === "Escape") finishProductTour({ skipped: true });
    else if (event.key === "ArrowRight" || event.key === "Enter") nextProductTourStep();
    else if (event.key === "ArrowLeft") previousProductTourStep();
    else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  undoInputIds.forEach((id) => bindUndoBeforeEdit(refs[id], "Ayar degisikligi"));
  document.querySelectorAll("[data-workspace-mode]").forEach((button) => {
    button.addEventListener("click", () => setWorkspaceMode(button.dataset.workspaceMode));
  });
  refs.workflowContinueBtn?.addEventListener("click", advanceWorkflow);
  document.getElementById("addDxfBtn").addEventListener("click", addDxfs);
  document.getElementById("addImageBtn").addEventListener("click", addImage);
  // Ust bardaki "Foto→Vektör" artik ayar panelini acar (dogrudan tekrar
  // vektorlestirmek yerine); asil eylem panel icindeki butondadir.
  document.getElementById("vectorizeBtn").addEventListener("click", openVectorPanel);
  document.getElementById("vectorizePhotoBtn").addEventListener("click", vectorizePhoto);
  document.getElementById("revectorizeBtn").addEventListener("click", revectorizeSelected);
  document.getElementById("fillSelectedVectorBtn")?.addEventListener("click", () => applySelectedVectorOperation("engrave_fill"));
  document.getElementById("vectorAutoPresetBtn")?.addEventListener("click", applyAutoVectorPreset);
  refs.applyVectorModeBtn?.addEventListener("click", () => applyVectorProfessionalMode(true));
  refs.vecProfessionalMode?.addEventListener("change", () => {
    applyVectorProfessionalMode(false);
  });
  document.getElementById("saveVectorSvgBtn").addEventListener("click", saveSelectedVectorSvg);
  document.getElementById("autoLayoutBtn").addEventListener("click", autoLayout);
  refs.drawAreaToolBtn?.addEventListener("click", beginMaterialAreaDrawing);
  refs.finishAreaBtn?.addEventListener("click", finishMaterialAreaDrawing);
  refs.clearAreaBtn?.addEventListener("click", clearMaterialArea);
  document.getElementById("alignJobBtn").addEventListener("click", () => alignJobToBed(true));
  document.getElementById("applyJobOffsetBtn").addEventListener("click", applyJobOffset);
  document.getElementById("homeNavBtn")?.addEventListener("click", openProjectHub);
  document.getElementById("closeProjectHubBtn")?.addEventListener("click", closeProjectHub);
  document.getElementById("newProjectBtn")?.addEventListener("click", newProject);
  document.getElementById("hubOpenProjectBtn")?.addEventListener("click", () => openProject());
  document.getElementById("hubSaveProjectBtn")?.addEventListener("click", () => saveProject({ saveAs: true }));
  document.getElementById("openBoxMakerBtn")?.addEventListener("click", openBoxMaker);
  document.getElementById("hubBoxMakerBtn")?.addEventListener("click", openBoxMaker);
  document.querySelectorAll("[data-box-maker-close]").forEach((element) => element.addEventListener("click", closeBoxMaker));
  document.querySelectorAll("[data-box-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.boxMaker.closed = button.dataset.boxType === "closed";
      renderBoxMakerPreview();
    });
  });
  refs.boxMakerForm?.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", renderBoxMakerPreview);
    input.addEventListener("change", renderBoxMakerPreview);
  });
  document.getElementById("addBoxToJobBtn")?.addEventListener("click", addBoxToJob);
  document.getElementById("openCalibrationBtn")?.addEventListener("click", openCalibration);
  document.querySelectorAll("[data-calibration-close]").forEach((element) => element.addEventListener("click", closeCalibration));
  document.getElementById("addCalibrationBtn")?.addEventListener("click", addCalibrationPlate);
  refs.calibrationForm?.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", renderCalibrationSummary);
    input.addEventListener("change", renderCalibrationSummary);
  });
  document.getElementById("openLibraryBtn")?.addEventListener("click", openLibrary);
  document.getElementById("hubLibraryBtn")?.addEventListener("click", openLibrary);
  document.querySelectorAll("[data-library-close]").forEach((element) => element.addEventListener("click", closeLibrary));
  document.getElementById("saveSelectionToLibraryBtn")?.addEventListener("click", saveSelectionToLibrary);
  refs.librarySearch?.addEventListener("input", renderLibraryAssets);
  document.getElementById("openProjectBtn")?.addEventListener("click", openProject);
  document.getElementById("saveProjectBtn")?.addEventListener("click", saveProject);
  document.getElementById("projectInfoBtn")?.addEventListener("click", openProjectInfo);
  document.getElementById("projectSaveAsBtn")?.addEventListener("click", () => saveProject({ saveAs: true }));
  document.querySelectorAll("[data-project-info-close]").forEach((element) => element.addEventListener("click", closeProjectInfo));
  document.getElementById("notificationsBtn")?.addEventListener("click", openNotifications);
  document.querySelectorAll("[data-notifications-close]").forEach((element) => element.addEventListener("click", closeNotifications));
  document.querySelectorAll("[data-notification-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activity.notificationFilter = button.dataset.notificationFilter || "all";
      renderNotificationCenter();
    });
  });
  document.getElementById("markNotificationsReadBtn")?.addEventListener("click", () => {
    state.activity.notifications = ProductionState.markAllRead(state.activity.notifications);
    saveNotifications();
  });
  document.getElementById("clearNotificationsBtn")?.addEventListener("click", () => {
    state.activity.notifications = [];
    saveNotifications();
  });
  document.getElementById("productionHistoryBtn")?.addEventListener("click", openProductionHistory);
  document.getElementById("hubProductionHistoryBtn")?.addEventListener("click", () => {
    closeProjectHub();
    openProductionHistory();
  });
  document.querySelectorAll("[data-production-history-close]").forEach((element) => element.addEventListener("click", closeProductionHistory));
  document.getElementById("clearProductionHistoryBtn")?.addEventListener("click", () => {
    if (state.activity.history.length && !window.confirm("Üretim geçmişi temizlensin mi?")) return;
    state.activity.history = [];
    state.activity.activeHistoryId = "";
    saveProductionHistory();
  });
  document.getElementById("preferencesBtn")?.addEventListener("click", openPreferences);
  document.querySelectorAll("[data-preferences-close]").forEach((element) => element.addEventListener("click", closePreferences));
  refs.preferencesForm?.addEventListener("submit", savePreferences);
  document.getElementById("helpBtn")?.addEventListener("click", openHelp);
  document.getElementById("hubHelpBtn")?.addEventListener("click", openHelp);
  document.getElementById("productTourBtn")?.addEventListener("click", startProductTour);
  document.getElementById("hubProductTourBtn")?.addEventListener("click", startProductTour);
  document.getElementById("tourSkipBtn")?.addEventListener("click", () => finishProductTour({ skipped: true }));
  document.getElementById("tourCloseBtn")?.addEventListener("click", () => finishProductTour({ skipped: true }));
  refs.tourPreviousBtn?.addEventListener("click", previousProductTourStep);
  refs.tourNextBtn?.addEventListener("click", nextProductTourStep);
  document.querySelectorAll("[data-help-close]").forEach((element) => element.addEventListener("click", closeHelp));
  document.getElementById("downloadDiagnosticsBtn")?.addEventListener("click", downloadDiagnostics);
  document.getElementById("helpHistoryBtn")?.addEventListener("click", () => {
    closeHelp();
    openProductionHistory();
  });
  document.getElementById("restoreRecoveryBtn")?.addEventListener("click", restoreRecoveryProject);
  document.getElementById("discardRecoveryBtn")?.addEventListener("click", discardRecoveryProject);
  document.getElementById("clearRecentProjectsBtn")?.addEventListener("click", () => {
    state.recentProjects = [];
    saveProjectPreferences();
    renderRecentProjects();
    setStatus("Son proje listesi temizlendi.");
  });
  document.getElementById("chooseOutputBtn").addEventListener("click", chooseOutput);
  document.getElementById("convertOutputToCutBtn")?.addEventListener("click", convertOutputToCut);
  document.getElementById("generateBtn").addEventListener("click", generateGcode);
  document.getElementById("generateBtn2")?.addEventListener("click", generateGcode);
  initRibbon();
  [refs.imageSharpness, refs.imageBrightness, refs.imageContrast, refs.imageNegative].forEach((input) => {
    bindUndoBeforeEdit(input, "Görsel ayarı");
    input?.addEventListener("input", scheduleImageAdjustmentRender);
    input?.addEventListener("change", scheduleImageAdjustmentRender);
  });
  document.querySelectorAll("[data-image-filter]").forEach((button) => {
    button.addEventListener("click", () => applyImageFilterPreset(button.dataset.imageFilter).catch((error) => setStatus(error.message, "danger")));
  });
  refs.resetImageAdjustmentsBtn?.addEventListener("click", () => resetImageAdjustments().catch((error) => setStatus(error.message, "danger")));
  refs.resetImageOriginalBtn?.addEventListener("click", () => restoreSelectedImageOriginal().catch((error) => setStatus(error.message, "danger")));
  refs.removeImageBackgroundBtn?.addEventListener("click", () => removeSelectedImageBackground().catch((error) => setStatus(error.message, "danger")));
  refs.cropImageBtn?.addEventListener("click", () => beginImageTool("crop"));
  refs.maskImageBtn?.addEventListener("click", () => beginImageTool("mask"));
  refs.finishImageToolBtn?.addEventListener("click", () => cancelImageTool("Görsel aracı tamamlandı."));
  refs.traceImageBtn?.addEventListener("click", () => {
    const pattern = selectedRasterPattern();
    const image = rasterImageForPattern(pattern);
    if (!pattern || !image?.src) {
      setStatus("İzlemek için raster bir görsel seçin.", "warn");
      return;
    }
    vectorizePhoto({
      dataUrl: image.src,
      path: pattern.sourcePath,
      forceVector: true,
      settings: { ...getVectorSettings(), productMode: "line_engrave", mode: "centerline" },
      professionalMode: { id: "image-trace", label: "Görsel izleme", productMode: "line_engrave", operation: "engrave_line" },
    });
  });
  document.querySelectorAll("[data-drawing-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.drawingTool.mode = button.dataset.drawingMode || "vector";
      syncDrawingUi();
    });
  });
  refs.drawingOperation?.addEventListener("change", () => {
    state.drawingTool.operation = refs.drawingOperation.value;
    draw();
  });
  refs.drawingSmoothing?.addEventListener("input", () => {
    state.drawingTool.smoothing = clamp(Number(refs.drawingSmoothing.value || 45), 0, 100);
  });
  refs.drawingClosePath?.addEventListener("change", () => {
    state.drawingTool.closePath = refs.drawingClosePath.checked;
    draw();
  });
  refs.startDrawingBtn?.addEventListener("click", beginDrawingTool);
  refs.finishDrawingBtn?.addEventListener("click", finishDrawingTool);
  refs.cancelDrawingBtn?.addEventListener("click", () => cancelDrawingTool("Cizim iptal edildi."));
  document.getElementById("machineNavBtn")?.addEventListener("click", () => setMachineTabOpen(true));
  document.getElementById("closeMachineTabBtn")?.addEventListener("click", () => setMachineTabOpen(false));
  document.getElementById("closeProductionPreviewBtn")?.addEventListener("click", () => setWorkspaceMode("design"));
  document.getElementById("refreshProductionPreviewBtn")?.addEventListener("click", () => loadMachinePreview(true));
  document.getElementById("fitProductionPreviewBtn")?.addEventListener("click", drawProductionPreview);
  document.getElementById("previewGenerateBtn")?.addEventListener("click", generateGcode);
  document.getElementById("previewFrameBtn")?.addEventListener("click", frameMachineJob);
  document.getElementById("previewSendBtn")?.addEventListener("click", sendGcodeToMachine);
  document.getElementById("previewDeviceBtn")?.addEventListener("click", () => setWorkspaceMode("device"));
  document.querySelectorAll("[data-preview-layer]").forEach((input) => {
    input.addEventListener("change", () => {
      state.productionPreview.layers[input.dataset.previewLayer] = input.checked;
      drawProductionPreview();
    });
  });
  refs.productionPreviewProgress?.addEventListener("input", () => {
    stopProductionPlayback();
    state.productionPreview.progress = Number(refs.productionPreviewProgress.value) || 0;
    drawProductionPreview();
  });
  refs.productionPreviewPlay?.addEventListener("click", toggleProductionPlayback);
  window.addEventListener("resize", drawProductionPreview);
  document.getElementById("refreshMachinePortsBtn")?.addEventListener("click", refreshMachinePorts);
  document.getElementById("autoConnectMachineBtn")?.addEventListener("click", autoConnectMachine);
  document.getElementById("connectMachineBtn")?.addEventListener("click", connectMachine);
  document.getElementById("disconnectMachineBtn")?.addEventListener("click", disconnectMachine);
  document.getElementById("machineStatusBtn")?.addEventListener("click", () => refreshMachineStatus(true));
  document.getElementById("sendMachineCommandBtn")?.addEventListener("click", sendMachineCommand);
  document.getElementById("sendGcodeToMachineBtn")?.addEventListener("click", sendGcodeToMachine);
  document.getElementById("machinePreviewBtn")?.addEventListener("click", () => loadMachinePreview(true));
  document.querySelectorAll("[data-flow-close]").forEach((el) => el.addEventListener("click", closeProduceFlow));
  refs.dxfQuantityForm?.addEventListener("submit", submitDxfQuantityDialog);
  refs.dxfQuantityCancelBtn?.addEventListener("click", () => closeDxfQuantityDialog(null));
  refs.dxfQuantityInput?.addEventListener("input", () => refs.dxfQuantityInput.setCustomValidity(""));
  document.querySelectorAll("[data-dxf-quantity-close]").forEach((el) => {
    el.addEventListener("click", () => closeDxfQuantityDialog(null));
  });
  document.getElementById("addTextBtn")?.addEventListener("click", addTextPattern);
  document.getElementById("fillSelectedTextBtn")?.addEventListener("click", () => {
    const pattern = editableTextPattern();
    if (pattern) {
      void applyWholeTextFill(pattern);
      return;
    }
    if (refs.textOperation) refs.textOperation.value = "engrave_fill";
    updateTextFontHint();
    setStatus("Yeni kalın yazı için kontur font seçin, metni yazın ve Metni Ekle düğmesine basın.", "info");
  });
  refs.textFont?.addEventListener("change", () => {
    updateTextFontSelectionUi();
    updateTextFontHint();
    saveUiSettings();
  });
  refs.textFontButton?.addEventListener("click", () => {
    if (textFontMenuIsOpen()) closeTextFontMenu({ restoreFocus: true });
    else openTextFontMenu();
  });
  refs.textFontSearch?.addEventListener("input", () => filterTextFontOptions(refs.textFontSearch.value));
  refs.textFontFilters?.querySelectorAll("[data-font-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.textFontFilter = button.dataset.fontFilter || "all";
      filterTextFontOptions(refs.textFontSearch?.value || "");
      refs.textFontOptions?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  refs.textFontSearch?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusTextFontOption(null, event.key === "ArrowDown" ? 1 : -1);
    }
  });
  refs.textFontMenu?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeTextFontMenu({ restoreFocus: true });
  });
  document.addEventListener("pointerdown", (event) => {
    if (!textFontMenuIsOpen()) return;
    if (refs.textFontMenu?.contains(event.target) || refs.textFontPicker?.contains(event.target)) return;
    closeTextFontMenu();
  });
  document.addEventListener("scroll", positionTextFontMenu, true);
  window.addEventListener("resize", positionTextFontMenu);
  refs.textWeight?.addEventListener("change", updateTextFontHint);
  refs.textStyle?.addEventListener("change", updateTextFontHint);
  refs.textOperation?.addEventListener("change", () => {
    if (refs.textOperation.value !== "engrave_line" && selectedTextFontDefinition().kind === "single") {
      setTextFontControlValue(DEFAULT_TEXT_FONT_VALUE);
    }
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
    if (event.key !== "Escape") return;
    if (state.vectorObjectTool.active) {
      cancelVectorObjectSeparation("Nesne ayırma iptal edildi.");
      draw();
      updateSelectionPanel();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (textFontMenuIsOpen()) {
      closeTextFontMenu({ restoreFocus: true });
      event.preventDefault();
      return;
    }
    if (dxfQuantityDialogOpen()) {
      closeDxfQuantityDialog(null);
      event.preventDefault();
      return;
    }
    if (produceFlowOpen()) closeProduceFlow();
  }, true);
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
  refs.canvasSelectionMode?.querySelectorAll("[data-selection-mode]").forEach((button) => {
    button.addEventListener("click", () => setCanvasSelectionMode(button.dataset.selectionMode));
  });
  document.getElementById("rotateLeftBtn").addEventListener("click", () => rotateSelected(-15));
  document.getElementById("rotateRightBtn").addEventListener("click", () => rotateSelected(15));
  document.getElementById("rotate90Btn").addEventListener("click", () => rotateSelected(90));
  refs.selectionArrange?.addEventListener("change", () => {
    const mode = refs.selectionArrange.value;
    refs.selectionArrange.value = "";
    if (mode) arrangeSelectedObjects(mode);
  });
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
      if (id === "outputPath" && state.machine.previewPath !== refs.outputPath.value.trim()) {
        state.activity.activeHistoryId = "";
        clearMachinePreview();
      }
      draw();
      saveUiSettings();
      renderMachinePanel();
      renderWorkflowProgress();
    });
  });

  persistedInputIds.forEach((id) => {
    const input = refs[id];
    if (!input) return;
    input.addEventListener("change", saveUiSettings);
  });

  ["cutPower", "cutFeed", "engravePower", "engraveFeed"].forEach((id) => {
    refs[id]?.addEventListener("input", () => {
      if (["pattern", "vectorPath", "vectorObject"].includes(state.selected?.type)) updateSelectionPanel();
    });
  });
  ["cutPower", "engravePower"].forEach((id) => {
    refs[id]?.addEventListener("change", () => {
      refs[id].value = clamp(Math.round(mm(id, 0)), 0, 1000);
      if (["pattern", "vectorPath", "vectorObject"].includes(state.selected?.type)) updateSelectionPanel();
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
  canvas.addEventListener("pointerleave", () => {
    if (!state.drag) hideSelectionCursor();
  });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("resize", updateProductTourPosition);
  document.addEventListener("scroll", updateProductTourPosition, true);
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

loadProjectPreferences();
applyPreferencesToUi(false);
loadActivityState();
installClientErrorBoundary();
renderTextFontOptions();
const savedUiSettings = loadUiSettings();
const preferredStartupFont = savedUiSettings.textFont || refs.textFont?.value || DEFAULT_TEXT_FONT_VALUE;
renderTextFontOptions(preferredStartupFont);
void loadSystemFonts(preferredStartupFont);
state.layout.appliedSettings = layoutSettingsSnapshot();
syncLaserButtons();
startClientLifecycleTracking();
bindControls();
syncImageEditUi();
syncDrawingUi();
resizeCanvas();
if (window.ResizeObserver) {
  canvasResizeObserver = new ResizeObserver(scheduleCanvasResize);
  canvasResizeObserver.observe(canvas);
}
updateSelectionPanel();
updateSummary();
updateProjectChrome();
renderWorkflowProgress();
renderRecentProjects();
renderMachinePanel();
refreshMachinePorts({ silent: true });
refreshMachineStatus(false, { silent: true });
startMachinePolling();
syncMachineTabFromHash();
loadRecoveryCandidate().then(async () => {
  if (!state.recovery.snapshot && state.preferences.reopenLastProject && !projectHasContent() && state.recentProjects[0]?.path) {
    await openProject({ path: state.recentProjects[0].path });
  }
}).finally(scheduleAutomaticProductTour);
window.addEventListener("beforeunload", (event) => {
  if (!state.project.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
