"use strict";

const assert = require("node:assert/strict");
const ProjectState = require("./laser_editor/project_state.js");

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

test("source ids are stable for the same file path", () => {
  const first = ProjectState.sourceIdFor("part", "D:\\Drawings\\box.DXF");
  const second = ProjectState.sourceIdFor("part", "d:/drawings/box.dxf");
  assert.equal(first, second);
});

test("copies retain source identity but receive an independent instance", () => {
  const original = ProjectState.ensureEntityIdentity({ id: "pat_1", sourcePath: "logo.svg" }, "pattern");
  const copy = ProjectState.ensureEntityIdentity({ ...original, id: "pat_2" }, "pattern", { forceInstance: true });
  assert.equal(copy.sourceId, original.sourceId);
  assert.notEqual(copy.instanceId, original.instanceId);
});

test("project normalization links placements to their part source", () => {
  const state = {
    parts: [{ id: "part_1", path: "C:/part.dxf" }],
    placements: [{ id: "pl_1", partId: "part_1" }],
    patterns: [],
  };
  ProjectState.normalizeProjectEntities(state);
  assert.equal(state.placements[0].partSourceId, state.parts[0].sourceId);
  assert.ok(state.placements[0].instanceId);
});

test("session dirty and saved revisions are explicit", () => {
  let session = ProjectState.createSession({ name: "Test" });
  session = ProjectState.markDirty(session, "DXF ekle", new Date("2026-07-15T10:00:00Z"));
  assert.equal(session.dirty, true);
  assert.equal(session.revision, 1);
  session = ProjectState.markSaved(session, { path: "C:/jobs/test.laserjob.json" }, new Date("2026-07-15T10:01:00Z"));
  assert.equal(session.dirty, false);
  assert.equal(session.savedRevision, 1);
});

test("recent project list de-duplicates paths and stays ordered", () => {
  const recent = ProjectState.upsertRecentProject([
    { name: "Old", path: "C:/jobs/a.laserjob.json", openedAt: "2026-01-01T00:00:00Z" },
    { name: "Other", path: "C:/jobs/b.laserjob.json", openedAt: "2026-02-01T00:00:00Z" },
  ], {
    name: "New A",
    path: "c:\\jobs\\a.laserjob.json",
  }, 12, new Date("2026-07-15T10:00:00Z"));
  assert.equal(recent.length, 2);
  assert.equal(recent[0].name, "New A");
});

test("derived counters use actual entities", () => {
  const counts = ProjectState.deriveCounts({
    parts: [{ id: "a", sourceId: "s1" }, { id: "b", sourceId: "s1" }],
    placements: [{ id: "p1" }, { id: "p2" }],
    patterns: [{ id: "v1" }],
  });
  assert.deepEqual(counts, { sourceFiles: 1, parts: 2, placements: 2, patterns: 1, totalObjects: 3 });
});

test("preferences are clamped to safe limits", () => {
  const preferences = ProjectState.normalizePreferences({ autosaveDelayMs: 10, maxRecentProjects: 100, theme: "purple", userMode: "invalid", prepareStrategy: "invalid", showTravelInPreview: 1, productTourVersion: 1200 });
  assert.equal(preferences.autosaveDelayMs, 1000);
  assert.equal(preferences.maxRecentProjects, 30);
  assert.equal(preferences.theme, "system");
  assert.equal(preferences.userMode, "advanced");
  assert.equal(preferences.prepareStrategy, "keep");
  assert.equal(preferences.showGrid, true);
  assert.equal(preferences.showTravelInPreview, true);
  assert.equal(preferences.productTourVersion, 999);
  assert.equal(ProjectState.normalizePreferences({ productTourVersion: 4 }).productTourVersion, 4);
});
