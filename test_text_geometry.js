const assert = require("assert");
const geometry = require("./laser_editor/text_geometry.js");

function close(actual, expected, tolerance = 1e-5) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

test("offset text paths are moved inside their declared source box", () => {
  const result = geometry.normalizeVectorBounds([
    {
      id: "glyph",
      points: [
        [20.579653978860392, 28.46004584433942],
        [100.41298214552712, 28.46004584433942],
        [100.41298214552712, 47.07961294057279],
        [20.579653978860392, 47.07961294057279],
      ],
      closed: true,
    },
  ], {
    sourceWidth: 79.83333333333333,
    sourceHeight: 19.083333333333332,
  });

  assert.strictEqual(result.changed, true);
  close(result.normalizedBounds.minX, 0);
  close(result.normalizedBounds.maxX, result.sourceWidth);
  assert.ok(result.normalizedBounds.minY >= 0);
  assert.ok(result.normalizedBounds.maxY <= result.sourceHeight);
});

test("already normalized text geometry remains unchanged", () => {
  const result = geometry.normalizeVectorBounds([
    { points: [[0, 0], [50, 0], [50, 20], [0, 20]], closed: true },
  ], { sourceWidth: 50, sourceHeight: 20 });

  assert.strictEqual(result.changed, false);
  close(result.deltaX, 0);
  close(result.deltaY, 0);
});

test("unused vertical padding is kept symmetric", () => {
  const result = geometry.normalizeVectorBounds([
    { points: [[10, 30], [60, 30], [60, 48], [10, 48]], closed: true },
  ], { sourceWidth: 50, sourceHeight: 20 });

  close(result.normalizedBounds.minY, 1);
  close(result.normalizedBounds.maxY, 19);
});

console.log("All text geometry tests passed.");
