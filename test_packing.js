"use strict";

const assert = require("node:assert/strict");
const packing = require("./laser_editor/packing.js");

function rectWidth(rect) {
  return rect.maxX - rect.minX;
}

function rectHeight(rect) {
  return rect.maxY - rect.minY;
}

function makeItems(count, width, height) {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `item-${index + 1}`,
    part: { width, height },
  }));
}

function assertSeparatedByGap(packed, gap) {
  for (let first = 0; first < packed.length; first += 1) {
    for (let second = first + 1; second < packed.length; second += 1) {
      const a = packed[first].rect;
      const b = packed[second].rect;
      const separated = (
        a.maxX + gap <= b.minX + 0.001 ||
        b.maxX + gap <= a.minX + 0.001 ||
        a.maxY + gap <= b.minY + 0.001 ||
        b.maxY + gap <= a.minY + 0.001
      );
      assert.equal(separated, true, `items ${first} and ${second} must keep ${gap} mm gap`);
    }
  }
}

function testThreeCoversUseCompactSingleOrientationFrame() {
  const result = packing.packRectangles({
    items: makeItems(3, 100, 200),
    usableRect: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    gap: 3,
    allowRotate: true,
  });

  assert.equal(result.overflowItems.length, 0);
  assert.deepEqual(result.packed.map((entry) => entry.rotation), [0, 0, 0]);
  assert.equal(rectWidth(result.envelope), 100);
  assert.equal(rectHeight(result.envelope), 606);
  assertSeparatedByGap(result.packed, 3);
}

function testAppendedCoversAlignToExistingEnvelope() {
  const occupiedRects = [{ minX: 250, minY: 100, maxX: 350, maxY: 300 }];
  const result = packing.packRectangles({
    items: makeItems(2, 100, 200),
    usableRect: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    occupiedRects,
    gap: 3,
    allowRotate: true,
  });

  assert.equal(result.overflowItems.length, 0);
  assert.deepEqual(result.packed.map((entry) => [entry.x, entry.y, entry.rotation]), [
    [250, 303, 0],
    [250, 506, 0],
  ]);
  assert.equal(rectWidth(result.envelope), 100);
  assert.equal(rectHeight(result.envelope), 606);
}

function testRotationIsUsedWhenItAvoidsOverflow() {
  const result = packing.packRectangles({
    items: makeItems(1, 100, 60),
    usableRect: { minX: 0, minY: 0, maxX: 80, maxY: 120 },
    gap: 3,
    allowRotate: true,
  });

  assert.equal(result.overflowItems.length, 0);
  assert.equal(result.packed[0].rotation, 90);
  assert.equal(rectWidth(result.packed[0].rect), 60);
  assert.equal(rectHeight(result.packed[0].rect), 100);
}

function testFixedRotationIsPreserved() {
  const item = {
    part: { width: 100, height: 60 },
    fixedRotation: true,
    rotation: 270,
  };
  const result = packing.packRectangles({
    items: [item],
    usableRect: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
    gap: 3,
    allowRotate: true,
  });

  assert.equal(result.overflowItems.length, 0);
  assert.equal(result.packed[0].rotation, 270);
  assert.equal(rectWidth(result.packed[0].rect), 60);
  assert.equal(rectHeight(result.packed[0].rect), 100);
}

const tests = [
  testThreeCoversUseCompactSingleOrientationFrame,
  testAppendedCoversAlignToExistingEnvelope,
  testRotationIsUsedWhenItAvoidsOverflow,
  testFixedRotationIsPreserved,
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}
console.log("All compact packing tests passed.");
