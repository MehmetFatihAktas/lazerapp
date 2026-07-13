"use strict";

const assert = require("node:assert/strict");
const {
  fitOpenPolyline,
  nearestPointOnPolyline,
  preparePolylineAnchors,
  repairPolylineArc,
  replacePolylineSection,
  smoothOpenPolyline,
} = require("./laser_editor/vector_edit.js");

function testOpenPathRepairsOnlyMarkedArc() {
  const points = [[0, 0], [1, 0], [2, 0], [2.5, 1], [3, 0], [4, 0], [5, 0]];
  const repaired = repairPolylineArc(points, points, false, 3, 1.1);
  assert.deepEqual(repaired, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  assert.deepEqual(points[3], [2.5, 1], "source points must remain unchanged");
}

function testClosedPathKeepsOppositeSide() {
  const points = [[0, 0], [2, 0], [4, 0], [5, 1], [4, 2], [2, 2], [0, 2], [-1, 1]];
  const repaired = repairPolylineArc(points, points, true, 3, 1.1);
  assert.deepEqual(repaired, [[4, 0], [4, 2], [2, 2], [0, 2], [-1, 1], [0, 0], [2, 0]]);
}

function testInvalidRepairLeavesPathUntouched() {
  assert.equal(repairPolylineArc([[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [2, 0]], false, 1, 1), null);
}

function testOpenPathRedrawReplacesOnlySelectedSection() {
  const points = [[0, 0], [1, 0], [2, 1], [3, 0], [4, 0]];
  const replacement = [[1, 0], [2, -0.25], [3, 0]];
  assert.deepEqual(
    replacePolylineSection(points, points, false, 1, 3, replacement),
    [[0, 0], [1, 0], [2, -0.25], [3, 0], [4, 0]]
  );
}

function testClosedPathRedrawUsesShorterArc() {
  const points = [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2]];
  const replacement = [[4, 0], [4.5, 1], [4, 2]];
  assert.deepEqual(
    replacePolylineSection(points, points, true, 2, 3, replacement),
    [[4, 0], [4.5, 1], [4, 2], [2, 2], [0, 2], [0, 0], [2, 0]]
  );
}

function testSmoothingKeepsDrawnEndpoints() {
  const points = [[0, 0], [1, 0.4], [2, -0.4], [3, 0]];
  const smoothed = smoothOpenPolyline(points, 2, 0.01);
  assert.deepEqual(smoothed[0], points[0]);
  assert.deepEqual(smoothed[smoothed.length - 1], points[points.length - 1]);
  assert.ok(smoothed.length > points.length);
}

function testNearestPointSnapsToSegmentInsteadOfVertex() {
  const nearest = nearestPointOnPolyline([[0, 0], [10, 0], [10, 10]], [4.25, 1], false);
  assert.equal(nearest.segmentIndex, 0);
  assert.ok(Math.abs(nearest.t - 0.425) < 1e-9);
  assert.deepEqual(nearest.point, [4.25, 0]);
  assert.equal(nearest.distance, 1);
}

function testProjectedAnchorsBecomeRealPolylineVertices() {
  const points = [[0, 0], [10, 0], [10, 10]];
  const start = nearestPointOnPolyline(points, [2, 0.5], false);
  const end = nearestPointOnPolyline(points, [9.5, 6], false);
  const prepared = preparePolylineAnchors(points, points, false, start, end);
  assert.deepEqual(prepared.points, [[0, 0], [2, 0], [10, 0], [10, 6], [10, 10]]);
  assert.equal(prepared.startIndex, 1);
  assert.equal(prepared.endIndex, 3);
}

function testFreehandFitRemovesPointerJitterWithoutMovingEnds() {
  const points = [[0, 0], [0.4, 0.08], [0.8, -0.06], [1.2, 0.09], [1.6, 0.45], [2, 1], [2.4, 1.45], [2.8, 1.1], [3, 1]];
  const fitted = fitOpenPolyline(points, { tolerance: 0.12, minDistance: 0.03, passes: 1 });
  assert.deepEqual(fitted[0], points[0]);
  assert.deepEqual(fitted[fitted.length - 1], points[points.length - 1]);
  assert.ok(fitted.length < points.length * 2, "fitting must not explode the point count");
  assert.ok(fitted.some((point) => point[1] > 0.8), "the intentional curve must remain");
}

testOpenPathRepairsOnlyMarkedArc();
testClosedPathKeepsOppositeSide();
testInvalidRepairLeavesPathUntouched();
testOpenPathRedrawReplacesOnlySelectedSection();
testClosedPathRedrawUsesShorterArc();
testSmoothingKeepsDrawnEndpoints();
testNearestPointSnapsToSegmentInsteadOfVertex();
testProjectedAnchorsBecomeRealPolylineVertices();
testFreehandFitRemovesPointerJitterWithoutMovingEnds();
console.log("vector edit tests: 9 passed");
