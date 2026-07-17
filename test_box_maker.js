"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
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

function almostEqual(actual, expected, tolerance = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function byRole(box) {
  return Object.fromEntries(box.panels.map((panel) => [panel.role, panel]));
}

function hasSelfIntersection(points) {
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (a, b, point) => Math.abs(cross(a, b, point)) <= 0.00001
    && point[0] >= Math.min(a[0], b[0]) - 0.00001
    && point[0] <= Math.max(a[0], b[0]) + 0.00001
    && point[1] >= Math.min(a[1], b[1]) - 0.00001
    && point[1] <= Math.max(a[1], b[1]) + 0.00001;
  const intersects = (a, b, c, d) => {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
      && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
    return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
  };
  const segmentCount = points.length - 1;
  for (let first = 0; first < segmentCount; first += 1) {
    for (let second = first + 1; second < segmentCount; second += 1) {
      if (second === first + 1 || (first === 0 && second === segmentCount - 1)) continue;
      if (intersects(points[first], points[first + 1], points[second], points[second + 1])) return true;
    }
  }
  return false;
}

test("open box generates five production panels", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, fingerWidth: 12 });
  assert.equal(box.errors.length, 0);
  assert.equal(box.panels.length, 5);
  assert.deepEqual(box.panels.map((panel) => panel.role), ["bottom", "front", "back", "left", "right"]);
});

test("closed box generates a fixed sixth top panel", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, closed: true });
  const panels = byRole(box);
  assert.equal(box.panels.length, 6);
  assert.ok(panels.top);
  assert.equal(panels.top.name, "Üst panel");
  assert.equal(panels.top.edges.top.mode, BoxMaker.EDGE_MODES.FEMALE);
  assert.equal(panels.front.edges.top.mode, BoxMaker.EDGE_MODES.MALE);
});

test("outer dimensions remain the finished box dimensions", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, closed: true, kerf: 0 });
  const panels = byRole(box);
  assert.deepEqual(box.options.outer, { width: 204, depth: 70, height: 49 });
  assert.deepEqual(box.options.inner, { width: 198, depth: 64, height: 43 });
  assert.deepEqual([panels.bottom.baseWidth, panels.bottom.baseHeight], [204, 70]);
  assert.deepEqual([panels.front.baseWidth, panels.front.baseHeight], [204, 49]);
  assert.deepEqual([panels.left.baseWidth, panels.left.baseHeight], [70, 49]);
});

test("inner dimensions convert to the correct outer dimensions", () => {
  const closed = BoxMaker.buildBox({
    width: 198,
    depth: 64,
    height: 43,
    thickness: 3,
    closed: true,
    dimensionMode: BoxMaker.DIMENSION_MODES.INNER,
  });
  assert.deepEqual(closed.options.outer, { width: 204, depth: 70, height: 49 });
  assert.deepEqual(closed.options.inner, { width: 198, depth: 64, height: 43 });

  const open = BoxMaker.buildBox({
    width: 198,
    depth: 64,
    height: 46,
    thickness: 3,
    dimensionMode: BoxMaker.DIMENSION_MODES.INNER,
  });
  assert.deepEqual(open.options.outer, { width: 204, depth: 70, height: 49 });
});

test("mating edges use complementary profiles with identical segmentation", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, fingerWidth: 11, clearance: 0.12, closed: true });
  const panels = byRole(box);
  for (const pair of box.matingPairs) {
    const first = panels[pair.first[0]].edges[pair.first[1]];
    const second = panels[pair.second[0]].edges[pair.second[1]];
    assert.notEqual(first.mode, second.mode, `${pair.first.join(".")} / ${pair.second.join(".")}`);
    assert.equal(first.count, second.count);
    almostEqual(first.activeLength, second.activeLength);
    almostEqual(first.activeLength, pair.length);
  }
});

test("panel joints are cut inward instead of protruding beyond the panel", () => {
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, fingerWidth: 12, closed: true, kerf: 0 });
  for (const panel of box.panels) {
    const path = panel.vectorPaths[0];
    assert.equal(path.closed, true);
    assert.deepEqual(path.points[0], path.points[path.points.length - 1]);
    for (let index = 0; index < path.points.length; index += 1) {
      const [x, y] = path.points[index];
      assert.ok(x >= -0.0001 && x <= panel.baseWidth + 0.0001, `${panel.name}: x=${x}`);
      assert.ok(y >= -0.0001 && y <= panel.baseHeight + 0.0001, `${panel.name}: y=${y}`);
      if (index > 0) assert.notDeepEqual(path.points[index], path.points[index - 1]);
    }
  }
});

test("kerf is kept for production without changing design dimensions twice", () => {
  const kerf = 0.2;
  const box = BoxMaker.buildBox({ width: 204, depth: 70, height: 49, thickness: 3, kerf });
  const bottom = byRole(box).bottom;
  almostEqual(bottom.sourceWidth, bottom.baseWidth);
  almostEqual(bottom.sourceHeight, bottom.baseHeight);
  almostEqual(bottom.productionKerf, kerf);
  assert.equal(bottom.kerfCompensated, false);
});

test("positive clearance narrows tabs and widens matching slots", () => {
  const base = { thickness: 3, fingerWidth: 12, clearance: 0 };
  const loose = { ...base, clearance: 0.2 };
  const neutralMale = BoxMaker.edgeNotches(99, BoxMaker.EDGE_MODES.MALE, base);
  const looseMale = BoxMaker.edgeNotches(99, BoxMaker.EDGE_MODES.MALE, loose);
  const neutralFemale = BoxMaker.edgeNotches(99, BoxMaker.EDGE_MODES.FEMALE, base);
  const looseFemale = BoxMaker.edgeNotches(99, BoxMaker.EDGE_MODES.FEMALE, loose);
  assert.ok(looseMale.intervals[0][0] < neutralMale.intervals[0][0]);
  assert.ok(looseFemale.intervals[0][1] > neutralFemale.intervals[0][1]);
});

test("variable box sizes preserve panel contracts", () => {
  const cases = [
    { width: 80, depth: 60, height: 40, thickness: 3, fingerWidth: 8 },
    { width: 204, depth: 70, height: 49, thickness: 3, fingerWidth: 12 },
    { width: 320, depth: 180, height: 120, thickness: 6, fingerWidth: 20 },
  ];
  for (const options of cases) {
    const box = BoxMaker.buildBox({ ...options, closed: true });
    assert.equal(box.errors.length, 0, JSON.stringify(box.errors));
    const panels = byRole(box);
    assert.deepEqual([panels.bottom.baseWidth, panels.bottom.baseHeight], [options.width, options.depth]);
    assert.deepEqual([panels.front.baseWidth, panels.front.baseHeight], [options.width, options.height]);
    assert.deepEqual([panels.left.baseWidth, panels.left.baseHeight], [options.depth, options.height]);
  }
});

test("many variable dimensions keep finite closed contours", () => {
  let seed = 73421;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let sample = 0; sample < 80; sample += 1) {
    const thickness = 1.5 + random() * 6;
    const options = {
      width: thickness * 8 + 40 + random() * 350,
      depth: thickness * 8 + 30 + random() * 180,
      height: thickness * 6 + 25 + random() * 150,
      thickness,
      fingerWidth: thickness * (2 + random() * 3),
      kerf: random() * 0.3,
      clearance: -0.08 + random() * 0.24,
      closed: random() > 0.5,
    };
    const box = BoxMaker.buildBox(options);
    assert.equal(box.errors.length, 0, `sample ${sample}: ${box.errors.join(" ")}`);
    for (const panel of box.panels) {
      const points = panel.vectorPaths[0].points;
      assert.deepEqual(points[0], points[points.length - 1]);
      assert.ok(points.length >= 5);
      assert.equal(hasSelfIntersection(points), false, `${panel.name} self-intersects`);
      for (const point of points) {
        assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]));
        assert.ok(point[0] >= -0.0001 && point[0] <= panel.sourceWidth + 0.0001);
        assert.ok(point[1] >= -0.0001 && point[1] <= panel.sourceHeight + 0.0001);
      }
    }
  }
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
  for (let first = 0; first < layout.items.length; first += 1) {
    for (let second = first + 1; second < layout.items.length; second += 1) {
      const a = layout.items[first];
      const b = layout.items[second];
      const overlap = a.x < b.x + b.panel.sourceWidth
        && a.x + a.panel.sourceWidth > b.x
        && a.y < b.y + b.panel.sourceHeight
        && a.y + a.panel.sourceHeight > b.y;
      assert.equal(overlap, false);
    }
  }
});

test("box maker UI exposes the new measurement and fit controls", () => {
  const html = fs.readFileSync("./laser_editor/index.html", "utf8");
  const app = fs.readFileSync("./laser_editor/app.js", "utf8");
  for (const id of ["boxKerf", "boxMakerAssemblyPreview", "boxMakerDimensionSummary"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(app, new RegExp(`getElementById\\(["']${id}["']\\)`));
  }
  assert.match(html, /data-box-dimension="outer"/);
  assert.match(html, /data-box-dimension="inner"/);
});
