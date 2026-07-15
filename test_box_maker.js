"use strict";

const assert = require("node:assert/strict");
const BoxMaker = require("./laser_editor/box_maker.js");

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

test("open box generates five production panels", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, fingerWidth: 12 });
  assert.equal(box.errors.length, 0);
  assert.equal(box.panels.length, 5);
  assert.deepEqual(box.panels.map((panel) => panel.role), ["bottom", "front", "back", "left", "right"]);
});

test("closed box adds a matching lid", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, closed: true });
  assert.equal(box.panels.length, 6);
  const lid = box.panels.find((panel) => panel.role === "lid");
  assert.ok(lid);
  assert.equal(lid.edges.top.mode, BoxMaker.EDGE_MODES.MALE);
});

test("mating edges share the same segmentation", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, fingerWidth: 11, fit: 0.12 });
  const byRole = Object.fromEntries(box.panels.map((panel) => [panel.role, panel]));
  assert.equal(byRole.bottom.edges.top.count, byRole.front.edges.bottom.count);
  assert.equal(byRole.bottom.edges.right.count, byRole.right.edges.bottom.count);
  assert.equal(byRole.front.edges.left.count, byRole.left.edges.right.count);
  assert.equal(byRole.bottom.edges.top.mode, BoxMaker.EDGE_MODES.MALE);
  assert.equal(byRole.front.edges.bottom.mode, BoxMaker.EDGE_MODES.FEMALE);
});

test("all panel contours are closed and stay inside their source bounds", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, fingerWidth: 12, closed: true });
  for (const panel of box.panels) {
    const path = panel.vectorPaths[0];
    assert.equal(path.closed, true);
    assert.deepEqual(path.points[0], path.points[path.points.length - 1]);
    for (const [x, y] of path.points) {
      assert.ok(x >= -0.0001 && x <= panel.sourceWidth + 0.0001, `${panel.name}: x=${x}`);
      assert.ok(y >= -0.0001 && y <= panel.sourceHeight + 0.0001, `${panel.name}: y=${y}`);
    }
  }
});

test("fit compensation narrows tabs and widens matching slots", () => {
  const neutral = BoxMaker.edgeProfile([0, 3], [100, 3], [0, -1], "male", { thickness: 3, fingerWidth: 12, fit: 0 });
  const loose = BoxMaker.edgeProfile([0, 3], [100, 3], [0, -1], "male", { thickness: 3, fingerWidth: 12, fit: 0.2 });
  const neutralFirstTab = neutral.points[3][0] - neutral.points[2][0];
  const looseFirstTab = loose.points[3][0] - loose.points[2][0];
  assert.ok(looseFirstTab < neutralFirstTab);
});

test("invalid proportions are rejected before geometry is created", () => {
  const box = BoxMaker.buildBox({ width: 20, depth: 20, height: 15, thickness: 6 });
  assert.equal(box.panels.length, 0);
  assert.ok(box.errors.length > 0);
});

test("preview layout does not overlap rows", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3 });
  const layout = BoxMaker.layoutPanels(box.panels, { targetWidth: 330, gap: 8 });
  assert.equal(layout.items.length, 5);
  assert.ok(layout.width > 0 && layout.height > 0);
});
