(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LaserProductionState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const NOTIFICATION_KEY = "laser-editor-notifications-v1";
  const HISTORY_KEY = "laser-editor-production-history-v1";
  const MAX_NOTIFICATIONS = 120;
  const MAX_HISTORY = 80;

  function nowIso(clock) {
    return new Date(typeof clock === "function" ? clock() : Date.now()).toISOString();
  }

  function makeId(prefix, clock) {
    const stamp = typeof clock === "function" ? clock() : Date.now();
    return `${prefix}-${stamp.toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizedLevel(level) {
    if (["danger", "error", "critical"].includes(level)) return "danger";
    if (["warn", "warning"].includes(level)) return "warn";
    if (["ok", "success"].includes(level)) return "ok";
    return "info";
  }

  function normalizeNotification(entry, clock) {
    const text = String(entry?.text || entry?.title || "").trim();
    if (!text) return null;
    return {
      id: String(entry.id || makeId("notice", clock)),
      text,
      detail: String(entry.detail || "").trim(),
      level: normalizedLevel(entry.level),
      source: String(entry.source || "Uygulama").trim() || "Uygulama",
      code: String(entry.code || "").trim(),
      createdAt: entry.createdAt || nowIso(clock),
      read: Boolean(entry.read),
    };
  }

  function addNotification(items, entry, options = {}) {
    const next = normalizeNotification(entry, options.clock);
    if (!next) return safeArray(items).slice();
    const dedupeMs = Math.max(0, Number(options.dedupeMs ?? 15000));
    const nextTime = Date.parse(next.createdAt) || 0;
    const existing = safeArray(items).find((item) => {
      const itemTime = Date.parse(item.createdAt) || 0;
      return item.text === next.text && item.level === next.level && item.source === next.source && Math.abs(nextTime - itemTime) <= dedupeMs;
    });
    if (existing) {
      return safeArray(items).map((item) => item.id === existing.id ? { ...item, createdAt: next.createdAt, read: false, detail: next.detail || item.detail } : item);
    }
    return [next, ...safeArray(items)].slice(0, Math.max(1, Number(options.limit || MAX_NOTIFICATIONS)));
  }

  function markAllRead(items) {
    return safeArray(items).map((item) => ({ ...item, read: true }));
  }

  function unreadCount(items) {
    return safeArray(items).reduce((count, item) => count + (item.read ? 0 : 1), 0);
  }

  function normalizeHistoryEntry(entry, clock) {
    const path = String(entry?.path || "").trim();
    if (!path) return null;
    const status = ["generated", "sent", "running", "paused", "completed", "cancelled", "failed"].includes(entry.status)
      ? entry.status
      : "generated";
    return {
      id: String(entry.id || makeId("job", clock)),
      path,
      fileName: String(entry.fileName || path.split(/[\\/]/).pop() || path),
      fileHash: String(entry.fileHash || "").trim(),
      projectId: String(entry.projectId || "").trim(),
      projectName: String(entry.projectName || "Adsiz is").trim() || "Adsiz is",
      status,
      createdAt: entry.createdAt || nowIso(clock),
      updatedAt: entry.updatedAt || entry.createdAt || nowIso(clock),
      estimatedSeconds: Math.max(0, Number(entry.estimatedSeconds || 0)),
      bounds: entry.bounds && typeof entry.bounds === "object" ? { ...entry.bounds } : null,
      cutLength: Math.max(0, Number(entry.cutLength || 0)),
      engraveLength: Math.max(0, Number(entry.engraveLength || 0)),
      sentLines: Math.max(0, Number(entry.sentLines || 0)),
      totalLines: Math.max(0, Number(entry.totalLines || 0)),
      message: String(entry.message || "").trim(),
    };
  }

  function upsertHistory(items, entry, options = {}) {
    const next = normalizeHistoryEntry(entry, options.clock);
    if (!next) return safeArray(items).slice();
    const current = safeArray(items);
    const match = current.find((item) => item.id === next.id || (next.fileHash && item.fileHash === next.fileHash && item.path === next.path));
    const merged = match ? { ...match, ...next, id: match.id, createdAt: match.createdAt } : next;
    return [merged, ...current.filter((item) => item.id !== merged.id)].slice(0, Math.max(1, Number(options.limit || MAX_HISTORY)));
  }

  function patchHistory(items, id, patch, clock) {
    return safeArray(items).map((item) => item.id === id ? { ...item, ...patch, id: item.id, createdAt: item.createdAt, updatedAt: nowIso(clock) } : item);
  }

  function createLocalStore(storage) {
    const backend = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    function read(key) {
      if (!backend) return [];
      try { return safeArray(JSON.parse(backend.getItem(key) || "[]")); }
      catch (_error) { return []; }
    }
    function write(key, value) {
      if (!backend) return false;
      try { backend.setItem(key, JSON.stringify(value)); return true; }
      catch (_error) { return false; }
    }
    return {
      loadNotifications: () => read(NOTIFICATION_KEY).map((item) => normalizeNotification(item)).filter(Boolean),
      saveNotifications: (items) => write(NOTIFICATION_KEY, safeArray(items).slice(0, MAX_NOTIFICATIONS)),
      loadHistory: () => read(HISTORY_KEY).map((item) => normalizeHistoryEntry(item)).filter(Boolean),
      saveHistory: (items) => write(HISTORY_KEY, safeArray(items).slice(0, MAX_HISTORY)),
    };
  }

  return {
    NOTIFICATION_KEY,
    HISTORY_KEY,
    MAX_NOTIFICATIONS,
    MAX_HISTORY,
    normalizedLevel,
    normalizeNotification,
    addNotification,
    markAllRead,
    unreadCount,
    normalizeHistoryEntry,
    upsertHistory,
    patchHistory,
    createLocalStore,
  };
});
