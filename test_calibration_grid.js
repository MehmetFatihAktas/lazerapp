"use strict";

const assert = require("node:assert/strict");
const CalibrationGrid = require("./laser_editor/calibration_grid.js");

const result = CalibrationGrid.build({ columns: 5, rows: 4, tile: 10, gap: 2, minPower: 20, maxPower: 100, minFeed: 300, maxFeed: 1500 });
assert.deepEqual(result.powers, [20, 40, 60, 80, 100]);
assert.deepEqual(result.feeds, [300, 700, 1100, 1500]);
assert.equal(result.cells.length, 20);
assert.equal(result.cells[0].x, result.labelWidth);
assert.equal(result.cells.at(-1).x + result.tile, result.width);
assert.equal(result.cells.at(-1).y + result.tile + result.labelHeight, result.height);
assert.equal(result.errors.length, 0);

const invalid = CalibrationGrid.build({ minPower: 90, maxPower: 10, minFeed: 1000, maxFeed: 500 });
assert.equal(invalid.errors.length, 2);

const textGrid = CalibrationGrid.build({ columns: 3, rows: 2, tileWidth: 48, tileHeight: 12, gap: 3 });
assert.equal(textGrid.cells[0].width, 48);
assert.equal(textGrid.cells[0].height, 12);
assert.equal(textGrid.width, textGrid.labelWidth + 3 * 48 + 2 * 3);
assert.equal(textGrid.height, textGrid.labelHeight + 2 * 12 + 3);

const legacyTextGrid = CalibrationGrid.build({
  columns: 4,
  rows: 4,
  tileWidth: 24,
  tileHeight: 11,
  gap: 3,
  minPower: 40,
  maxPower: 70,
  minFeed: 500,
  maxFeed: 1500,
});
const fastTextGrid = CalibrationGrid.build({
  columns: 3,
  rows: 2,
  tileWidth: 24,
  tileHeight: 11,
  gap: 2,
  minPower: 40,
  maxPower: 70,
  minFeed: 1200,
  maxFeed: 2400,
});
const legacySeconds = CalibrationGrid.estimateTextFillSeconds({
  lineStep: 0.08,
  contentWidth: 18,
  contentHeight: 6,
  returnFeed: 900,
  acceleration: 320,
}, legacyTextGrid);
const fastSeconds = CalibrationGrid.estimateTextFillSeconds({
  lineStep: 0.12,
  contentWidth: 18,
  contentHeight: 6,
  returnFeed: 1200,
  acceleration: 320,
}, fastTextGrid);
assert.ok(fastSeconds < legacySeconds / 2, `fast text test should take less than half the old time (${fastSeconds}s vs ${legacySeconds}s)`);
assert.ok(fastSeconds < 12 * 60, `fast text test estimate should stay below 12 minutes, got ${fastSeconds}s`);

console.log("PASS calibration grid values and bounds");
