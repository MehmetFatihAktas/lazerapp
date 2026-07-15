"use strict";

const assert = require("node:assert/strict");
const CalibrationGrid = require("./laser_editor/calibration_grid.js");

const result = CalibrationGrid.build({ columns: 5, rows: 4, tile: 10, gap: 2, minPower: 200, maxPower: 1000, minFeed: 300, maxFeed: 1500 });
assert.deepEqual(result.powers, [200, 400, 600, 800, 1000]);
assert.deepEqual(result.feeds, [300, 700, 1100, 1500]);
assert.equal(result.cells.length, 20);
assert.equal(result.cells[0].x, result.labelWidth);
assert.equal(result.cells.at(-1).x + result.tile, result.width);
assert.equal(result.cells.at(-1).y + result.tile + result.labelHeight, result.height);
assert.equal(result.errors.length, 0);

const invalid = CalibrationGrid.build({ minPower: 900, maxPower: 100, minFeed: 1000, maxFeed: 500 });
assert.equal(invalid.errors.length, 2);

console.log("PASS calibration grid values and bounds");
