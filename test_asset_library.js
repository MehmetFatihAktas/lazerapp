"use strict";

const assert = require("node:assert/strict");
const AssetLibrary = require("./laser_editor/asset_library.js");

async function test(name, fn) {
  try {
    await fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

(async () => {
  await test("asset metadata is normalized", () => {
    const asset = AssetLibrary.normalizeAsset({ name: " Motif ", kind: "pattern", width: "25.5", tags: "Tesbih, motif, TESBIH" });
    assert.equal(asset.schema, AssetLibrary.ASSET_SCHEMA);
    assert.equal(asset.name, "Motif");
    assert.equal(asset.width, 25.5);
    assert.deepEqual(asset.tags, ["tesbih", "motif", "tesbıh"]);
  });

  await test("search filters name, operation and tags", () => {
    const entries = [
      { id: "a", name: "Tesbih motifi", tags: ["kapak"], updatedAt: "2026-01-01T00:00:00Z" },
      { id: "b", name: "Kutu tabanı", kind: "part", operation: "cut", updatedAt: "2026-02-01T00:00:00Z" },
    ];
    assert.deepEqual(AssetLibrary.searchAssets(entries, "kapak").map((item) => item.id), ["a"]);
    assert.deepEqual(AssetLibrary.searchAssets(entries, "cut").map((item) => item.id), ["b"]);
  });

  await test("results are sorted by latest update", () => {
    const result = AssetLibrary.searchAssets([
      { id: "old", updatedAt: "2025-01-01T00:00:00Z" },
      { id: "new", updatedAt: "2026-01-01T00:00:00Z" },
    ]);
    assert.deepEqual(result.map((item) => item.id), ["new", "old"]);
  });

  await test("memory store supports put, list, get and remove", async () => {
    const store = AssetLibrary.createStore({ databaseName: "test-memory" });
    const saved = await store.put({ id: "asset_test", name: "Test", payload: { value: 1 } });
    assert.equal((await store.list()).length, 1);
    assert.equal((await store.get(saved.id)).payload.value, 1);
    await store.remove(saved.id);
    assert.equal((await store.list()).length, 0);
  });
})();
