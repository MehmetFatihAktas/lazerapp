(function initLaserAssetLibrary(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LaserAssetLibrary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLaserAssetLibrary() {
  "use strict";

  const ASSET_SCHEMA = "laser-editor-asset-v1";

  function createId() {
    const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (cryptoApi?.randomUUID) return `asset_${cryptoApi.randomUUID()}`;
    return `asset_${Date.now().toString(36)}_${Math.floor(Math.random() * 0x100000000).toString(36)}`;
  }

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeTags(tags) {
    return [...new Set((Array.isArray(tags) ? tags : String(tags || "").split(","))
      .map((tag) => String(tag || "").trim().toLocaleLowerCase("tr-TR"))
      .filter(Boolean))].slice(0, 20);
  }

  function normalizeAsset(value = {}) {
    const now = new Date().toISOString();
    const kind = value.kind === "part" ? "part" : "pattern";
    return {
      schema: ASSET_SCHEMA,
      id: String(value.id || createId()),
      name: String(value.name || (kind === "part" ? "DXF parçası" : "Desen")).trim().slice(0, 160),
      kind,
      width: Math.max(0, finite(value.width)),
      height: Math.max(0, finite(value.height)),
      operation: String(value.operation || (kind === "part" ? "cut" : "engrave_line")),
      tags: normalizeTags(value.tags),
      sourceId: String(value.sourceId || ""),
      thumbnail: typeof value.thumbnail === "string" ? value.thumbnail : "",
      payload: value.payload && typeof value.payload === "object" ? value.payload : {},
      createdAt: value.createdAt || now,
      updatedAt: value.updatedAt || now,
    };
  }

  function searchAssets(entries, query = "") {
    const needle = String(query || "").trim().toLocaleLowerCase("tr-TR");
    return (Array.isArray(entries) ? entries : [])
      .map(normalizeAsset)
      .filter((asset) => !needle || [asset.name, asset.kind, asset.operation, ...asset.tags].join(" ").toLocaleLowerCase("tr-TR").includes(needle))
      .sort((first, second) => String(second.updatedAt).localeCompare(String(first.updatedAt)));
  }

  function createStore(options = {}) {
    const databaseName = options.databaseName || "laser-editor-library-v1";
    const storeName = options.storeName || "assets";
    const memory = new Map();

    function openDatabase() {
      if (typeof indexedDB === "undefined") return Promise.resolve(null);
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Kütüphane veritabanı açılamadı."));
      });
    }

    async function run(mode, operation) {
      const database = await openDatabase();
      if (!database) return operation(null, memory);
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store, null);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error || new Error("Kütüphane işlemi tamamlanamadı."));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => database.close();
      });
    }

    return {
      async list() {
        const result = await run("readonly", (store, fallback) => store ? store.getAll() : [...fallback.values()]);
        return searchAssets(result || []);
      },
      async get(id) {
        const result = await run("readonly", (store, fallback) => store ? store.get(String(id)) : fallback.get(String(id)) || null);
        return result ? normalizeAsset(result) : null;
      },
      async put(value) {
        const asset = normalizeAsset({ ...value, updatedAt: new Date().toISOString() });
        await run("readwrite", (store, fallback) => {
          if (store) return store.put(asset);
          fallback.set(asset.id, asset);
          return asset;
        });
        return asset;
      },
      async remove(id) {
        await run("readwrite", (store, fallback) => {
          if (store) return store.delete(String(id));
          fallback.delete(String(id));
          return null;
        });
      },
      async clear() {
        await run("readwrite", (store, fallback) => {
          if (store) return store.clear();
          fallback.clear();
          return null;
        });
      },
    };
  }

  return Object.freeze({ ASSET_SCHEMA, normalizeTags, normalizeAsset, searchAssets, createStore });
});
