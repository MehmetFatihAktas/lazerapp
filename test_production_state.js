"use strict";

const assert = require("assert");
const ProductionState = require("./laser_editor/production_state.js");

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test("notification levels normalize", () => {
  assert.equal(ProductionState.normalizedLevel("critical"), "danger");
  assert.equal(ProductionState.normalizedLevel("warning"), "warn");
  assert.equal(ProductionState.normalizedLevel("success"), "ok");
});

test("notifications deduplicate and become unread", () => {
  let clock = 1000;
  let items = ProductionState.addNotification([], { text: "Limit alarm", level: "danger", source: "Makine" }, { clock: () => clock });
  items = ProductionState.markAllRead(items);
  clock = 2000;
  items = ProductionState.addNotification(items, { text: "Limit alarm", level: "danger", source: "Makine" }, { clock: () => clock });
  assert.equal(items.length, 1);
  assert.equal(items[0].read, false);
  assert.equal(ProductionState.unreadCount(items), 1);
});

test("history upserts the same file hash", () => {
  let items = ProductionState.upsertHistory([], { path: "C:\\job.nc", fileHash: "abc", status: "generated" }, { clock: () => 1000 });
  const id = items[0].id;
  items = ProductionState.upsertHistory(items, { path: "C:\\job.nc", fileHash: "abc", status: "sent", sentLines: 4 }, { clock: () => 2000 });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, id);
  assert.equal(items[0].status, "sent");
  assert.equal(items[0].sentLines, 4);
});

test("history patch keeps identity", () => {
  const items = ProductionState.upsertHistory([], { path: "C:\\job.nc", status: "generated" }, { clock: () => 1000 });
  const patched = ProductionState.patchHistory(items, items[0].id, { status: "completed" }, () => 3000);
  assert.equal(patched[0].id, items[0].id);
  assert.equal(patched[0].status, "completed");
  assert.equal(patched[0].createdAt, items[0].createdAt);
});

test("local store round trips both collections", () => {
  const store = ProductionState.createLocalStore(memoryStorage());
  const notices = ProductionState.addNotification([], { text: "Ready" }, { clock: () => 1000 });
  const history = ProductionState.upsertHistory([], { path: "D:\\part.nc" }, { clock: () => 1000 });
  assert.equal(store.saveNotifications(notices), true);
  assert.equal(store.saveHistory(history), true);
  assert.equal(store.loadNotifications()[0].text, "Ready");
  assert.equal(store.loadHistory()[0].path, "D:\\part.nc");
});

let failures = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}\n${error.stack}`); }
}
if (failures) process.exitCode = 1;
else console.log(`\n${tests.length} production-state tests passed.`);
