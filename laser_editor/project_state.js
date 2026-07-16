(function initLaserProjectState(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LaserProjectState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLaserProjectState() {
  "use strict";

  const PROJECT_SCHEMA = "laser-editor-project-v4";
  const PROJECT_VERSION = 4;
  const LEGACY_MACHINE_PROFILE = Object.freeze({
    id: "legacy-grbl-s1000",
    name: "Legacy GRBL S1000",
    maxS: 1000,
    travelX: 400,
    travelY: 400,
    requiresLaserMode: true,
    airAssist: Object.freeze({ supported: false, onCommand: "M8", offCommand: "M9" }),
    focus: Object.freeze({
      normalMaxPercent: 3,
      normalMaxMs: 100,
      expertMaxPercent: 5,
      expertMaxMs: 250,
    }),
    verified: false,
    verifiedAt: null,
    source: "legacy-migration",
  });
  const STORAGE_KEYS = Object.freeze({
    preferences: "laser-editor-preferences-v1",
    recentProjects: "laser-editor-recent-projects-v1",
    recoveryMeta: "laser-editor-recovery-meta-v1",
  });
  const DEFAULT_PREFERENCES = Object.freeze({
    autosaveEnabled: true,
    autosaveDelayMs: 3000,
    maxRecentProjects: 12,
    confirmBeforeClear: true,
    reopenLastProject: false,
    theme: "system",
    userMode: "advanced",
    showGrid: true,
    showTravelInPreview: false,
    prepareStrategy: "keep",
    productTourVersion: 0,
  });

  function finiteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeMachineProfile(value = {}, fallback = LEGACY_MACHINE_PROFILE) {
    const source = value && typeof value === "object" ? value : {};
    const airAssist = source.airAssist && typeof source.airAssist === "object" ? source.airAssist : fallback.airAssist;
    const focus = source.focus && typeof source.focus === "object" ? source.focus : fallback.focus;
    return {
      id: String(source.id || fallback.id),
      name: String(source.name || fallback.name),
      maxS: Math.max(1, finiteNumber(source.maxS, fallback.maxS)),
      travelX: Math.max(1, finiteNumber(source.travelX, fallback.travelX)),
      travelY: Math.max(1, finiteNumber(source.travelY, fallback.travelY)),
      requiresLaserMode: source.requiresLaserMode !== false,
      airAssist: {
        supported: Boolean(airAssist.supported),
        onCommand: ["M7", "M8"].includes(String(airAssist.onCommand || "").toUpperCase())
          ? String(airAssist.onCommand).toUpperCase()
          : "M8",
        offCommand: "M9",
      },
      focus: {
        normalMaxPercent: clamp(finiteNumber(focus.normalMaxPercent, 3), 0.1, 3),
        normalMaxMs: clamp(Math.round(finiteNumber(focus.normalMaxMs, 100)), 10, 100),
        expertMaxPercent: clamp(finiteNumber(focus.expertMaxPercent, 5), 0.1, 5),
        expertMaxMs: clamp(Math.round(finiteNumber(focus.expertMaxMs, 250)), 10, 250),
      },
      verified: Boolean(source.verified),
      verifiedAt: source.verifiedAt || null,
      source: String(source.source || fallback.source || "manual"),
    };
  }

  function legacyPowerPercent(value) {
    const numeric = finiteNumber(value, 0);
    const converted = clamp(numeric / 10, 0, 100);
    return typeof value === "string" ? String(converted) : converted;
  }

  function migrateLegacyPatternPowers(pattern) {
    const next = { ...(pattern || {}) };
    for (const key of ["power", "powerMin", "cutPower", "engravePower"]) {
      if (next[key] !== undefined && next[key] !== null && next[key] !== "") next[key] = legacyPowerPercent(next[key]);
    }
    next.vectorPaths = (Array.isArray(next.vectorPaths) ? next.vectorPaths : []).map((path) => {
      const migrated = { ...path };
      if (migrated.powerOverride !== undefined && migrated.powerOverride !== null && migrated.powerOverride !== "") {
        migrated.powerOverride = legacyPowerPercent(migrated.powerOverride);
      }
      return migrated;
    });
    next.originalVectorPaths = (Array.isArray(next.originalVectorPaths) ? next.originalVectorPaths : []).map((path) => {
      const migrated = { ...path };
      if (migrated.powerOverride !== undefined && migrated.powerOverride !== null && migrated.powerOverride !== "") {
        migrated.powerOverride = legacyPowerPercent(migrated.powerOverride);
      }
      return migrated;
    });
    return next;
  }

  function migrateProject(project = {}) {
    const source = project && typeof project === "object" ? project : {};
    const isCurrent = source.schema === PROJECT_SCHEMA && Number(source.version) === PROJECT_VERSION;
    const next = {
      ...source,
      inputs: { ...(source.inputs || {}) },
      parts: (Array.isArray(source.parts) ? source.parts : []).map((part) => ({ ...part })),
      patterns: (Array.isArray(source.patterns) ? source.patterns : []).map((pattern) => ({ ...pattern })),
    };
    if (!isCurrent) {
      for (const key of ["cutPower", "engravePower", "calibrationMinPower", "calibrationMaxPower", "machinePulsePower"]) {
        if (next.inputs[key] !== undefined && next.inputs[key] !== null && next.inputs[key] !== "") {
          next.inputs[key] = legacyPowerPercent(next.inputs[key]);
        }
      }
      next.parts = next.parts.map((part) => ({
        ...part,
        sourceUnits: part.sourceUnits || {
          sourceUnit: "legacy-mm-assumed",
          scaleToMm: 1,
          unitless: true,
          override: "mm",
          legacyAssumed: true,
        },
        geometrySnapshotVersion: Number(part.geometrySnapshotVersion) || 1,
      }));
      next.patterns = next.patterns.map(migrateLegacyPatternPowers);
      next.machineProfile = normalizeMachineProfile({
        ...LEGACY_MACHINE_PROFILE,
        verified: false,
        source: "legacy-migration",
      });
      next.migration = {
        ...(source.migration || {}),
        powerModel: "legacy-s-divided-by-10",
        legacySchema: source.schema || "unknown",
        migratedAt: new Date().toISOString(),
      };
    } else {
      next.machineProfile = normalizeMachineProfile(source.machineProfile);
    }
    next.schema = PROJECT_SCHEMA;
    next.version = PROJECT_VERSION;
    return next;
  }

  function createId(prefix = "id") {
    const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (cryptoApi?.randomUUID) return `${prefix}_${cryptoApi.randomUUID()}`;
    const random = Math.floor(Math.random() * 0x100000000).toString(36);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizeSource(value) {
    return String(value || "")
      .trim()
      .replaceAll("\\", "/")
      .replace(/\/+/g, "/")
      .toLocaleLowerCase("en-US");
  }

  function sourceIdFor(kind, source, fallback = "") {
    const normalized = normalizeSource(source || fallback || createId(kind));
    return `src_${String(kind || "item")}_${hashText(normalized)}`;
  }

  function sourceHint(entity) {
    return entity?.path || entity?.sourcePath || entity?.originalPath || entity?.name || entity?.id || "";
  }

  function ensureEntityIdentity(entity, kind, options = {}) {
    if (!entity || typeof entity !== "object") return entity;
    const forceSource = Boolean(options.forceSource);
    const forceInstance = Boolean(options.forceInstance);
    const source = options.source || sourceHint(entity);
    if (forceSource || !entity.sourceId) entity.sourceId = sourceIdFor(kind, source, entity.id);
    if (forceInstance || !entity.instanceId) entity.instanceId = forceInstance ? createId(`${kind}i`) : String(entity.id || createId(`${kind}i`));
    return entity;
  }

  function normalizeProjectEntities(collections, options = {}) {
    const parts = Array.isArray(collections?.parts) ? collections.parts : [];
    const placements = Array.isArray(collections?.placements) ? collections.placements : [];
    const patterns = Array.isArray(collections?.patterns) ? collections.patterns : [];
    const partMap = new Map();

    for (const part of parts) {
      ensureEntityIdentity(part, "part", options);
      partMap.set(String(part.id), part);
    }
    for (const placement of placements) {
      const part = partMap.get(String(placement.partId));
      ensureEntityIdentity(placement, "placement", {
        ...options,
        source: part?.sourceId || placement.partId || placement.id,
      });
      if (!placement.partSourceId && part?.sourceId) placement.partSourceId = part.sourceId;
    }
    for (const pattern of patterns) ensureEntityIdentity(pattern, "pattern", options);

    return { parts, placements, patterns };
  }

  function projectNameFromPath(path, fallback = "Adsiz is") {
    const fileName = String(path || "").split(/[\\/]/).pop() || "";
    return fileName.replace(/\.laserjob\.json$/i, "").replace(/\.json$/i, "").trim() || fallback;
  }

  function createSession(meta = {}) {
    const revision = Math.max(0, Math.round(finiteNumber(meta.revision, 0)));
    const savedRevision = Math.max(0, Math.round(finiteNumber(meta.savedRevision, revision)));
    const path = String(meta.path || "");
    return {
      id: String(meta.id || createId("project")),
      name: String(meta.name || projectNameFromPath(path)),
      path,
      revision,
      savedRevision,
      dirty: Boolean(meta.dirty ?? revision !== savedRevision),
      createdAt: meta.createdAt || new Date().toISOString(),
      lastChangeAt: meta.lastChangeAt || null,
      lastSavedAt: meta.lastSavedAt || null,
      lastAutosavedAt: meta.lastAutosavedAt || null,
      lastAction: String(meta.lastAction || ""),
    };
  }

  function markDirty(session, action = "Degisiklik", now = new Date()) {
    const current = createSession(session);
    const revision = current.revision + 1;
    return {
      ...current,
      revision,
      dirty: revision !== current.savedRevision,
      lastChangeAt: now.toISOString(),
      lastAction: String(action || "Degisiklik"),
    };
  }

  function markSaved(session, meta = {}, now = new Date()) {
    const current = createSession(session);
    const path = String(meta.path ?? current.path ?? "");
    return {
      ...current,
      name: String(meta.name || current.name || projectNameFromPath(path)),
      path,
      savedRevision: current.revision,
      dirty: false,
      lastSavedAt: now.toISOString(),
      lastAction: "Kaydedildi",
    };
  }

  function markAutosaved(session, now = new Date()) {
    return { ...createSession(session), lastAutosavedAt: now.toISOString() };
  }

  function normalizePreferences(value = {}) {
    return {
      autosaveEnabled: value.autosaveEnabled !== false,
      autosaveDelayMs: clamp(Math.round(finiteNumber(value.autosaveDelayMs, DEFAULT_PREFERENCES.autosaveDelayMs)), 1000, 60000),
      maxRecentProjects: clamp(Math.round(finiteNumber(value.maxRecentProjects, DEFAULT_PREFERENCES.maxRecentProjects)), 3, 30),
      confirmBeforeClear: value.confirmBeforeClear !== false,
      reopenLastProject: Boolean(value.reopenLastProject),
      theme: ["system", "light", "dark"].includes(value.theme) ? value.theme : DEFAULT_PREFERENCES.theme,
      userMode: value.userMode === "simple" ? "simple" : "advanced",
      showGrid: value.showGrid !== false,
      showTravelInPreview: Boolean(value.showTravelInPreview),
      prepareStrategy: value.prepareStrategy === "auto" ? "auto" : "keep",
      productTourVersion: clamp(Math.round(finiteNumber(value.productTourVersion, 0)), 0, 999),
    };
  }

  function normalizeRecentProjects(entries, limit = DEFAULT_PREFERENCES.maxRecentProjects) {
    const seen = new Set();
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && typeof entry === "object" && entry.path)
      .sort((a, b) => String(b.openedAt || b.savedAt || "").localeCompare(String(a.openedAt || a.savedAt || "")))
      .filter((entry) => {
        const key = normalizeSource(entry.path);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, clamp(Math.round(finiteNumber(limit, 12)), 3, 30))
      .map((entry) => ({
        id: String(entry.id || sourceIdFor("project", entry.path)),
        name: String(entry.name || projectNameFromPath(entry.path)),
        path: String(entry.path),
        savedAt: entry.savedAt || null,
        openedAt: entry.openedAt || entry.savedAt || new Date(0).toISOString(),
        counts: entry.counts && typeof entry.counts === "object" ? { ...entry.counts } : null,
      }));
  }

  function upsertRecentProject(entries, project, limit = DEFAULT_PREFERENCES.maxRecentProjects, now = new Date()) {
    if (!project?.path) return normalizeRecentProjects(entries, limit);
    return normalizeRecentProjects([
      {
        id: project.id,
        name: project.name || projectNameFromPath(project.path),
        path: project.path,
        savedAt: project.savedAt || project.lastSavedAt || null,
        openedAt: now.toISOString(),
        counts: project.counts || null,
      },
      ...(Array.isArray(entries) ? entries : []),
    ], limit);
  }

  function deriveCounts(collections = {}) {
    const parts = Array.isArray(collections.parts) ? collections.parts : [];
    const placements = Array.isArray(collections.placements) ? collections.placements : [];
    const patterns = Array.isArray(collections.patterns) ? collections.patterns : [];
    const sources = new Set(parts.map((item) => item.sourceId || item.path || item.id).filter(Boolean));
    return {
      sourceFiles: sources.size,
      parts: parts.length,
      placements: placements.length,
      patterns: patterns.length,
      totalObjects: placements.length + patterns.length,
    };
  }

  function createRecoveryStore(options = {}) {
    const databaseName = options.databaseName || "laser-editor-projects-v1";
    const storeName = options.storeName || "recovery";

    function openDatabase() {
      if (typeof indexedDB === "undefined") return Promise.resolve(null);
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Kurtarma veritabani acilamadi."));
      });
    }

    async function run(mode, operation) {
      const database = await openDatabase();
      if (!database) return null;
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error || new Error("Kurtarma verisi islenemedi."));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => database.close();
      });
    }

    return {
      async save(key, value) {
        await run("readwrite", (store) => store.put(value, key));
        return value;
      },
      async load(key) {
        return run("readonly", (store) => store.get(key));
      },
      async remove(key) {
        await run("readwrite", (store) => store.delete(key));
      },
    };
  }

  return Object.freeze({
    PROJECT_SCHEMA,
    PROJECT_VERSION,
    LEGACY_MACHINE_PROFILE,
    STORAGE_KEYS,
    DEFAULT_PREFERENCES,
    createId,
    hashText,
    normalizeSource,
    sourceIdFor,
    ensureEntityIdentity,
    normalizeProjectEntities,
    projectNameFromPath,
    createSession,
    markDirty,
    markSaved,
    markAutosaved,
    normalizePreferences,
    normalizeMachineProfile,
    migrateProject,
    normalizeRecentProjects,
    upsertRecentProject,
    deriveCounts,
    createRecoveryStore,
  });
});
