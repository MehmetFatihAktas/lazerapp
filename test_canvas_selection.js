const assert = require("assert");
const selection = require("./laser_editor/canvas_selection.js");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

test("generated text wins over a larger overlapping vector", () => {
  const chosen = selection.chooseObjectCandidate([
    { id: "large-vector", priority: 1, area: 14400, z: 3 },
    { id: "text", priority: 0, area: 900, z: 1 },
  ]);
  assert.strictEqual(chosen.id, "text");
});

test("the smaller precise object wins when hit quality is equal", () => {
  const chosen = selection.chooseObjectCandidate([
    { id: "large", priority: 1, area: 10000, z: 4 },
    { id: "small", priority: 1, area: 400, z: 1 },
  ]);
  assert.strictEqual(chosen.id, "small");
});

test("topmost object wins equal priority and size", () => {
  const chosen = selection.chooseObjectCandidate([
    { id: "lower", priority: 1, area: 400, z: 1 },
    { id: "upper", priority: 1, area: 400, z: 7 },
  ]);
  assert.strictEqual(chosen.id, "upper");
});

test("cycle advances from the selected overlapping object", () => {
  const candidates = [
    { id: "text", priority: 0, area: 300, z: 1 },
    { id: "motif", priority: 1, area: 9000, z: 2 },
  ];
  const chosen = selection.chooseObjectCandidate(candidates, { selectedId: "text", cycle: true });
  assert.strictEqual(chosen.id, "motif");
});

console.log("All canvas selection tests passed.");
