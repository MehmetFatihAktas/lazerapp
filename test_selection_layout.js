"use strict";

const assert = require("node:assert/strict");
const SelectionLayout = require("./laser_editor/selection_layout.js");

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

const objects = [
  { id: "a", bounds: { minX: 10, minY: 5, maxX: 20, maxY: 15 } },
  { id: "b", bounds: { minX: 30, minY: 12, maxX: 50, maxY: 22 } },
  { id: "c", bounds: { minX: 80, minY: 30, maxX: 90, maxY: 50 } },
];

test("left alignment keeps the left-most item fixed", () => {
  assert.deepEqual(SelectionLayout.calculate(objects, "left"), [
    { id: "a", index: 0, dx: 0, dy: 0 },
    { id: "b", index: 1, dx: -20, dy: 0 },
    { id: "c", index: 2, dx: -70, dy: 0 },
  ]);
});

test("horizontal distribution uses equal edge gaps", () => {
  const result = SelectionLayout.calculate(objects, "distribute-h");
  assert.deepEqual(result, [
    { id: "a", index: 0, dx: 0, dy: 0 },
    { id: "b", index: 1, dx: 10, dy: 0 },
    { id: "c", index: 2, dx: 0, dy: 0 },
  ]);
});

test("invalid or single selections do not produce transforms", () => {
  assert.deepEqual(SelectionLayout.calculate(objects.slice(0, 1), "left"), []);
  assert.deepEqual(SelectionLayout.calculate(objects, "unknown"), []);
});
