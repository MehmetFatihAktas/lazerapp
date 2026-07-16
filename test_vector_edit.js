"use strict";

const assert = require("node:assert/strict");
const {
  assignPathOperation,
  appendOpenPathToVectorModel,
  anchorPointToVectorModel,
  compileVectorObjects,
  edgeIdsInRect,
  expandNestedClosedPaths,
  fitOpenPolyline,
  isUserSemanticVectorObject,
  migrateVectorPathsToModel,
  nearestPointOnPolyline,
  patternPasteOffset,
  polylineIntersectsRect,
  preparePolylineAnchors,
  reconcileVectorModel,
  repairPolylineArc,
  replacePolylineSection,
  separateVectorModelByRect,
  separateVectorModelByEdgeIds,
  setVectorObjectAttachmentPolicy,
  smoothOpenPolyline,
  splitPolylineByRect,
  translateVectorModelSelection,
  updateVectorObjectTransform,
  widenPolylineRegion,
  widenVectorModelRegion,
} = require("./laser_editor/vector_edit.js");

function testSelectedClosedPathsBecomeFillWhileOpenPathsStayLines() {
  const paths = [
    { id: "outer", points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, operation: "engrave_line" },
    { id: "hole", points: [[3, 3], [7, 3], [7, 7], [3, 7]], closed: true, operation: "engrave_line" },
    { id: "baseline", points: [[0, 12], [10, 12]], closed: false, operation: "engrave_line" },
  ];
  const result = assignPathOperation(paths, "engrave_fill");
  assert.deepEqual(result, { total: 3, changed: 2, skippedOpen: 1, operation: "engrave_fill" });
  assert.equal(paths[0].operation, "engrave_fill");
  assert.equal(paths[1].operation, "engrave_fill");
  assert.equal(paths[2].operation, "engrave_line");
  assert.equal(paths[0].operationManual, true);
  assert.equal(paths[0].regionOperation, "manual");
}

function testSelectedOuterPathIncludesNestedTextCounters() {
  const outer = { id: "letter-o", points: [[0, 0], [30, 0], [30, 30], [0, 30]], closed: true };
  const counter = { id: "letter-o-counter", points: [[8, 8], [22, 8], [22, 22], [8, 22]], closed: true };
  const nestedIsland = { id: "nested-island", points: [[12, 12], [18, 12], [18, 18], [12, 18]], closed: true };
  const unrelated = { id: "other-letter", points: [[40, 0], [55, 0], [55, 20], [40, 20]], closed: true };
  const overlapping = { id: "overlap", points: [[25, 10], [35, 10], [35, 20], [25, 20]], closed: true };
  const openStroke = { id: "baseline", points: [[5, 5], [25, 5]], closed: false };
  const paths = [outer, counter, nestedIsland, unrelated, overlapping, openStroke];

  assert.deepEqual(expandNestedClosedPaths(paths, [outer]), [outer, counter, nestedIsland]);
  assert.deepEqual(expandNestedClosedPaths(paths, [counter]), [counter, nestedIsland]);
  assert.deepEqual(expandNestedClosedPaths(paths, [openStroke]), [openStroke]);
}

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

function testLocalWidenMovesBothSidesAndKeepsBoundaryAnchored() {
  const points = [[-4, 0], [-1, 0], [0, 0], [1, 0], [4, 0], [0, 4]];
  const result = widenPolylineRegion(points, [0, 0], {
    radiusX: 4,
    radiusY: 4,
    amountX: 0.75,
  });
  assert.ok(result.points[1][0] < -1, "left side must move outward");
  assert.ok(result.points[3][0] > 1, "right side must move outward");
  assert.deepEqual(result.points[2], [0, 0], "the local center must stay stable");
  assert.deepEqual(result.points[0], [-4, 0], "points on the influence boundary must stay fixed");
  assert.deepEqual(result.points[4], [4, 0], "opposite boundary must stay fixed");
  assert.deepEqual(result.points[5], [0, 4], "orthogonal boundary must stay fixed");
  assert.equal(result.changedPoints, 2);
}

function testLocalWidenPreservesSharedGraphJunctions() {
  const model = migrateVectorPathsToModel([
    { id: "left", points: [[-3, 0], [0, 0]], closed: false, operation: "engrave_line" },
    { id: "right", points: [[0, 0], [3, 0]], closed: false, operation: "engrave_line" },
  ], { sourceWidth: 10, sourceHeight: 10 });
  const sharedNode = model.vectorGraph.nodes.find((node) => node.position[0] === 0 && node.position[1] === 0);
  assert.ok(sharedNode, "fixture must contain a shared graph node");
  const result = widenVectorModelRegion(model, [1, 0], {
    radiusX: 4,
    radiusY: 4,
    amountX: 0.75,
  });
  const left = result.model.vectorGraph.edges.find((edge) => edge.id === "edge:left");
  const right = result.model.vectorGraph.edges.find((edge) => edge.id === "edge:right");
  const movedNode = result.model.vectorGraph.nodes.find((node) => node.id === sharedNode.id);
  assert.deepEqual(left.points[left.points.length - 1], right.points[0], "both incident edges must keep one identical junction");
  assert.deepEqual(movedNode.position, right.points[0], "graph node and edge endpoints must move together");
  assert.equal(result.model.vectorGraph.revision, model.vectorGraph.revision + 1);
}

function testLocalWidenKeepsJunctionFixedBesideExcludedEdge() {
  const model = migrateVectorPathsToModel([
    { id: "editable", points: [[-3, 0], [-1, 0], [0, 0]], closed: false, operation: "engrave_line" },
    { id: "locked", points: [[0, 0], [3, 0]], closed: false, operation: "engrave_line", locked: true },
  ], { sourceWidth: 10, sourceHeight: 10 });
  const sharedNode = model.vectorGraph.nodes.find((node) => node.position[0] === 0 && node.position[1] === 0);
  const result = widenVectorModelRegion(model, [1, 0], {
    radiusX: 4,
    radiusY: 4,
    amountX: 0.75,
    edgeIds: ["edge:editable"],
  });
  const editable = result.model.vectorGraph.edges.find((edge) => edge.id === "edge:editable");
  const locked = result.model.vectorGraph.edges.find((edge) => edge.id === "edge:locked");
  assert.ok(editable.points[1][0] < -1, "editable interior geometry must widen");
  assert.deepEqual(editable.points[editable.points.length - 1], [0, 0], "junction beside a locked edge must stay fixed");
  assert.deepEqual(locked.points, [[0, 0], [3, 0]], "excluded edge must not deform");
  assert.deepEqual(result.model.vectorGraph.nodes.find((node) => node.id === sharedNode.id).position, [0, 0]);
}

function branchFlowerPaths() {
  return [
    { id: "branch", points: [[0, 5], [10, 5]], closed: false, operation: "engrave_line" },
    { id: "flower", points: [[4.4, 4.2], [5.6, 4.2], [5.6, 5.8], [4.4, 5.8]], closed: true, operation: "engrave_line" },
  ];
}

function testLegacyMigrationPreservesOneObjectPerPath() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), {
    sourceWidth: 10,
    sourceHeight: 10,
    designWidth: 100,
    designHeight: 100,
  });
  assert.equal(model.vectorModelVersion, 2);
  assert.equal(model.vectorGraph.edges.length, 2);
  assert.equal(model.vectorObjects.length, 2);
  assert.deepEqual(model.vectorObjects.map((object) => object.edgeRefs.length), [1, 1]);
  assert.deepEqual(compileVectorObjects(model).vectorPaths.map((path) => path.id), ["branch", "flower"]);
}

function testManualOpenPathReusesExactGraphEndpoints() {
  const model = migrateVectorPathsToModel([
    { id: "body", points: [[0, 0], [2, 0]], closed: false, operation: "engrave_line" },
    { id: "foot", points: [[2, 3], [4, 3]], closed: false, operation: "engrave_line" },
  ], { sourceWidth: 5, sourceHeight: 5, designWidth: 50, designHeight: 50 });
  const bodyEdge = model.vectorGraph.edges.find((edge) => edge.id === "edge:body");
  const footEdge = model.vectorGraph.edges.find((edge) => edge.id === "edge:foot");
  const originalNodeCount = model.vectorGraph.nodes.length;
  const appended = appendOpenPathToVectorModel(model, {
    id: "replacement-leg",
    points: [[2, 0], [2.4, 1.4], [2, 3]],
    closed: false,
    operation: "engrave_line",
  }, {
    startNodeId: bodyEdge.endNodeId,
    endNodeId: footEdge.startNodeId,
  });

  assert.equal(model.vectorGraph.edges.length, 2, "the source model must remain immutable");
  assert.equal(appended.model.vectorGraph.nodes.length, originalNodeCount, "snapped endpoints must reuse existing nodes");
  const edge = appended.model.vectorGraph.edges.find((item) => item.id === appended.edgeId);
  assert.equal(edge.startNodeId, bodyEdge.endNodeId);
  assert.equal(edge.endNodeId, footEdge.startNodeId);
  assert.deepEqual(edge.points[0], [2, 0]);
  assert.deepEqual(edge.points[edge.points.length - 1], [2, 3]);
  assert.equal(appended.model.vectorGraph.nodes.find((node) => node.id === bodyEdge.endNodeId).degree, 2);
  assert.equal(appended.model.vectorGraph.nodes.find((node) => node.id === footEdge.startNodeId).degree, 2);
  const compiled = compileVectorObjects(appended.model);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.vectorPaths.find((path) => path.edgeId === appended.edgeId).operation, "engrave_line");
}

function testAnchorSplitsOpenEdgeAndKeepsOwnership() {
  const model = migrateVectorPathsToModel([
    { id: "branch", points: [[0, 0], [10, 0]], closed: false, operation: "engrave_line" },
  ], { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const anchored = anchorPointToVectorModel(model, [4, 0.08], {
    edgeId: "edge:branch",
    snapTolerance: 0.2,
  });

  assert.equal(model.vectorGraph.edges.length, 1, "the source model must remain immutable");
  assert.equal(anchored.snapped, true);
  assert.deepEqual(anchored.sourcePoint, [4, 0]);
  assert.equal(anchored.model.vectorGraph.edges.length, 2);
  assert.equal(anchored.model.vectorObjects[0].edgeRefs.length, 2, "the split edge must keep the same owner");
  const [first, second] = anchored.model.vectorGraph.edges;
  assert.equal(first.endNodeId, anchored.nodeId);
  assert.equal(second.startNodeId, anchored.nodeId);
  assert.deepEqual(first.points[first.points.length - 1], [4, 0]);
  assert.deepEqual(second.points[0], [4, 0]);
  assert.deepEqual(first.lineage.sourceInterval, [0, 0.4]);
  assert.deepEqual(second.lineage.sourceInterval, [0.4, 1]);
  assert.deepEqual(compileVectorObjects(anchored.model).errors, []);
}

function testAnchorCanCreateFreeEndpointWithoutChangingEdges() {
  const model = migrateVectorPathsToModel([
    { id: "branch", points: [[0, 0], [10, 0]], closed: false, operation: "engrave_line" },
  ], { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const anchored = anchorPointToVectorModel(model, [5, 4], {
    snapTolerance: 0.2,
    allowFree: true,
  });

  assert.equal(anchored.snapped, false);
  assert.deepEqual(anchored.sourcePoint, [5, 4]);
  assert.equal(anchored.model.vectorGraph.edges.length, 1);
  assert.equal(anchored.model.vectorGraph.nodes.find((node) => node.id === anchored.nodeId).degree, 0);
}

function testAnchorRotatesClosedEdgeToSharedNode() {
  const model = migrateVectorPathsToModel([
    { id: "frame", points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, operation: "engrave_line" },
  ], { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const anchored = anchorPointToVectorModel(model, [5, 0.05], {
    edgeId: "edge:frame",
    snapTolerance: 0.2,
  });
  const edge = anchored.model.vectorGraph.edges[0];

  assert.equal(anchored.snapped, true);
  assert.equal(edge.startNodeId, anchored.nodeId);
  assert.equal(edge.endNodeId, anchored.nodeId);
  assert.deepEqual(edge.points[0], [5, 0]);
  assert.equal(anchored.model.vectorGraph.nodes.find((node) => node.id === anchored.nodeId).degree, 2);
  assert.deepEqual(compileVectorObjects(anchored.model).errors, []);
}

function testOnlyConfirmedOrUserSeparatedObjectsAreSemanticSelections() {
  assert.equal(isUserSemanticVectorObject({ createdBy: "structural-analysis-base" }), false);
  assert.equal(isUserSemanticVectorObject({ createdBy: "v1-migration" }), false);
  assert.equal(isUserSemanticVectorObject({ createdBy: "manual-contour" }), false);
  assert.equal(isUserSemanticVectorObject({ createdBy: "structural-analysis-confirmed" }), true);
  assert.equal(isUserSemanticVectorObject({ createdBy: "user-rectangle-separation" }), true);
  assert.equal(isUserSemanticVectorObject({ createdBy: "future", proposalId: "proposal-7" }), true);
  assert.equal(isUserSemanticVectorObject({ createdBy: "user-rectangle-separation", removed: true }), false);
}

function testExtractedContourFirstPasteKeepsOriginalPosition() {
  const inPlaceItem = { pasteInPlace: true };
  assert.equal(patternPasteOffset(inPlaceItem, 1), 0);
  assert.equal(patternPasteOffset(inPlaceItem, 2), 5);
  assert.equal(patternPasteOffset({ pasteInPlace: false }, 1), 5);
}

function testMarqueeSelectionRequiresActualPolylineContact() {
  const rect = { minX: 4, minY: 4, maxX: 6, maxY: 6 };
  assert.equal(
    polylineIntersectsRect([[0, 0], [10, 0], [10, 10], [0, 10]], true, rect),
    false,
    "a closed frame surrounding the marquee must not be selected when its stroke does not touch the marquee"
  );
  assert.equal(polylineIntersectsRect([[0, 5], [10, 5]], false, rect), true);
  assert.equal(polylineIntersectsRect([[4.5, 4.5], [5.5, 5.5]], false, rect), true);
  assert.equal(polylineIntersectsRect([[0, 1], [10, 1]], false, rect), false);
}

function testRectangleSplitUsesExactBoundaryPoints() {
  const fragments = splitPolylineByRect([[0, 5], [10, 5]], false, { minX: 4, minY: 4, maxX: 6, maxY: 6 });
  assert.equal(fragments.length, 3);
  assert.deepEqual(fragments.map((fragment) => fragment.inside), [false, true, false]);
  assert.deepEqual(fragments.map((fragment) => fragment.points), [
    [[0, 5], [4, 5]],
    [[4, 5], [6, 5]],
    [[6, 5], [10, 5]],
  ]);
  const total = fragments.reduce((sum, fragment) => sum + Math.hypot(
    fragment.points[fragment.points.length - 1][0] - fragment.points[0][0],
    fragment.points[fragment.points.length - 1][1] - fragment.points[0][1],
  ), 0);
  assert.equal(total, 10);
}

function testCutAtBoundaryDoesNotEmitUnderlayInsideMotif() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const separated = separateVectorModelByRect(model, { minX: 4, minY: 4, maxX: 6, maxY: 6 }, { policy: "cut-at-boundary" });
  assert.equal(separated.stats.crossingEdges, 1);
  assert.equal(separated.stats.hiddenFragments, 1);
  const compiled = compileVectorObjects(separated.model);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.vectorPaths.length, 3, "two branch remainders plus the flower must emit");
  const branchFragments = compiled.vectorPaths.filter((path) => path.provenance.canonicalEdgeLineageId === "legacy:branch");
  assert.equal(branchFragments.length, 2);
  assert.ok(branchFragments.every((path) => path.points.every((point) => point[0] <= 4.000001 || point[0] >= 5.999999)));
}

function testSeparatedObjectScaleLeavesBranchUnchanged() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const separated = separateVectorModelByRect(model, { minX: 4, minY: 4, maxX: 6, maxY: 6 }, { policy: "emit-underlay" });
  const before = compileVectorObjects(separated.model);
  const branchBefore = before.vectorPaths.find((path) => path.edgeId === "edge:branch").points;
  const scaledModel = updateVectorObjectTransform(separated.model, separated.objectId, { scaleX: 1.5, scaleY: 0.5 });
  const after = compileVectorObjects(scaledModel);
  const branchAfter = after.vectorPaths.find((path) => path.edgeId === "edge:branch").points;
  const flowerBefore = before.vectorPaths.find((path) => path.objectId === separated.objectId).points;
  const flowerAfter = after.vectorPaths.find((path) => path.objectId === separated.objectId).points;
  assert.deepEqual(branchAfter, branchBefore, "branch canonical/world-compatible geometry must not change");
  assert.notDeepEqual(flowerAfter, flowerBefore, "only the separated flower must scale");
}

function testMovedObjectLeavesNoGhostPath() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const separated = separateVectorModelByRect(model, { minX: 4, minY: 4, maxX: 6, maxY: 6 }, { policy: "emit-underlay" });
  const beforePath = compileVectorObjects(separated.model).vectorPaths.find((path) => path.objectId === separated.objectId);
  const moved = updateVectorObjectTransform(separated.model, separated.objectId, { translateX: 20, translateY: -10 });
  const movedPaths = compileVectorObjects(moved).vectorPaths.filter((path) => path.objectId === separated.objectId);
  assert.equal(movedPaths.length, 1);
  assert.notDeepEqual(movedPaths[0].points, beforePath.points);
  assert.ok(movedPaths[0].points.every((point, index) => Math.abs(point[0] - beforePath.points[index][0] - 2) < 1e-9));
}

function testExclusiveOwnershipConflictIsRejected() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10 });
  model.vectorObjects.push({
    ...JSON.parse(JSON.stringify(model.vectorObjects[0])),
    id: "conflicting-owner",
  });
  const compiled = compileVectorObjects(model);
  assert.ok(compiled.errors.some((message) => message.includes("multiple exclusive owners")));
}

function testIgnoredObjectEmitsNothing() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10 });
  model.vectorObjects.find((object) => object.id === "object:flower").operation = "ignore";
  const compiled = compileVectorObjects(model);
  assert.deepEqual(compiled.vectorPaths.map((path) => path.edgeId), ["edge:branch"]);
}

function testDerivedEditReconcilesBackToCanonicalEdge() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const separated = separateVectorModelByRect(model, { minX: 4, minY: 4, maxX: 6, maxY: 6 }, { policy: "emit-underlay" });
  const moved = updateVectorObjectTransform(separated.model, separated.objectId, { translateX: 20 });
  const derived = compileVectorObjects(moved).vectorPaths;
  const flower = derived.find((path) => path.objectId === separated.objectId);
  flower.points[0][1] += 0.25;
  const reconciled = reconcileVectorModel(moved, derived);
  assert.equal(reconciled.changed, true);
  const recompiled = compileVectorObjects(reconciled.model).vectorPaths.find((path) => path.objectId === separated.objectId);
  assert.ok(Math.abs(recompiled.points[0][1] - flower.points[0][1]) < 1e-9);
}

function testGraphEdgeSeedsUseCanonicalRectangleHits() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const hits = edgeIdsInRect(model, { minX: 4, minY: 4, maxX: 6, maxY: 6 });
  assert.deepEqual(new Set(hits.edgeIds), new Set(["edge:branch", "edge:flower"]));
  assert.deepEqual(hits.completeEdgeIds, ["edge:flower"]);
  assert.deepEqual(hits.crossingEdgeIds, ["edge:branch"]);
}

function testSemanticEdgeSeparationTransfersExclusiveOwnership() {
  const model = migrateVectorPathsToModel(branchFlowerPaths(), { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const separated = separateVectorModelByEdgeIds(model, ["edge:flower"], {
    graphRevision: model.vectorGraph.revision,
    gateNodeIds: [model.vectorGraph.edges[1].startNodeId],
    name: "Kompakt motif 1",
    confidence: 0.91,
    proposalId: "proposal-1",
  });
  const compiled = compileVectorObjects(separated.model);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.vectorPaths.filter((path) => path.edgeId === "edge:flower").length, 1, "semantic object must emit its edge once");
  assert.equal(separated.model.vectorObjects.find((object) => object.id === separated.objectId).proposalId, "proposal-1");
  assert.equal(separated.stats.gateCount, 1);
}

function testRepeatedSemanticSeparationKeepsIdsAndConnectionsValid() {
  const model = migrateVectorPathsToModel([
    { id: "a", points: [[0, 0], [2, 0]], closed: false, operation: "engrave_line" },
    { id: "b", points: [[3, 0], [5, 0]], closed: false, operation: "engrave_line" },
    { id: "c", points: [[6, 0], [8, 0]], closed: false, operation: "engrave_line" },
  ], { sourceWidth: 10, sourceHeight: 10 });
  const first = separateVectorModelByEdgeIds(model, ["edge:a"], {
    graphRevision: model.vectorGraph.revision,
    gateNodeIds: [model.vectorGraph.edges[0].startNodeId],
  });
  const second = separateVectorModelByEdgeIds(first.model, ["edge:b"], {
    graphRevision: model.vectorGraph.revision,
    gateNodeIds: [model.vectorGraph.edges[1].startNodeId],
  });
  const objectIds = second.model.vectorObjects.map((object) => object.id);
  assert.equal(new Set(objectIds).size, objectIds.length, "semantic object ids must remain unique within one graph revision");

  const movedAgain = separateVectorModelByEdgeIds(second.model, ["edge:a"], {
    graphRevision: model.vectorGraph.revision,
    gateNodeIds: [model.vectorGraph.edges[0].endNodeId],
  });
  const attachmentIds = new Set(
    movedAgain.model.vectorObjects.flatMap((object) => (object.attachments || []).map((attachment) => attachment.id))
  );
  assert.ok(
    movedAgain.model.connections.every((connection) => (connection.attachmentIds || []).every((attachmentId) => attachmentIds.has(attachmentId))),
    "connections from replaced semantic owners must not remain orphaned"
  );
  assert.deepEqual(compileVectorObjects(movedAgain.model).errors, []);
}

function combinedOwnerModel(paths) {
  const model = migrateVectorPathsToModel(paths, { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  model.vectorObjects[0].edgeRefs.push(...model.vectorObjects.slice(1).flatMap((object) => object.edgeRefs));
  model.vectorObjects = model.vectorObjects.slice(0, 1);
  return model;
}

function testMaskUnderlayRemovesOnlyCoveredBranchSection() {
  const model = combinedOwnerModel([
    { id: "branch", points: [[0, 5], [10, 5]], closed: false, operation: "engrave_line" },
    { id: "flower", points: [[4, 4], [6, 4], [6, 6], [4, 6]], closed: true, operation: "engrave_line" },
  ]);
  const separated = separateVectorModelByEdgeIds(model, ["edge:flower"], {
    graphRevision: model.vectorGraph.revision,
    manufacturingPolicy: "mask-underlay",
  });
  assert.equal(separated.model.occlusionMasks.length, 1);
  const compiled = compileVectorObjects(separated.model);
  assert.deepEqual(compiled.errors, []);
  const branchFragments = compiled.vectorPaths.filter((path) => path.edgeId === "edge:branch");
  assert.equal(branchFragments.length, 2, "branch must be split around the semantic object silhouette");
  assert.deepEqual(branchFragments.map((path) => path.points), [
    [[0, 5], [4, 5]],
    [[6, 5], [10, 5]],
  ]);
  assert.ok(branchFragments.every((path) => path.provenance.occlusionMaskApplied));
  const reconciled = reconcileVectorModel(separated.model, compiled.vectorPaths);
  assert.deepEqual(
    reconciled.model.vectorGraph.edges.find((edge) => edge.id === "edge:branch").points,
    [[0, 5], [10, 5]],
    "canonical underlay geometry must stay intact"
  );
}

function testPinnedAndSharedJointPoliciesEnforceAnchors() {
  const model = combinedOwnerModel([
    { id: "branch", points: [[0, 0], [5, 0]], closed: false, operation: "engrave_line" },
    { id: "motif", points: [[5, 0], [5, 2], [6, 2]], closed: false, operation: "engrave_line" },
  ]);
  const motifEdge = model.vectorGraph.edges.find((edge) => edge.id === "edge:motif");
  const separated = separateVectorModelByEdgeIds(model, ["edge:motif"], {
    graphRevision: model.vectorGraph.revision,
    gateNodeIds: [motifEdge.startNodeId],
    attachmentPolicy: "pinned",
  });
  const pinned = updateVectorObjectTransform(separated.model, separated.objectId, { scaleX: 1.5, scaleY: 0.6, rotation: 20 });
  assert.deepEqual(compileVectorObjects(pinned).errors, [], "pinned transform must preserve its gate");
  assert.throws(() => updateVectorObjectTransform(separated.model, separated.objectId, { translateX: 1 }), /cannot translate/);

  const shared = setVectorObjectAttachmentPolicy(separated.model, separated.objectId, "shared-joint");
  assert.equal(shared.vectorObjects.find((object) => object.id === separated.objectId).attachmentPolicy, "shared-joint");
  const twoGate = JSON.parse(JSON.stringify(shared));
  const object = twoGate.vectorObjects.find((item) => item.id === separated.objectId);
  object.attachments.push({ id: "attachment:second", graphNodeId: motifEdge.endNodeId, policy: "shared-joint" });
  assert.throws(() => updateVectorObjectTransform(twoGate, separated.objectId, { scaleX: 1.2 }), /overconstrain/);
}

function testCanonicalSelectionTranslationSurvivesObjectTransform() {
  const model = migrateVectorPathsToModel([
    { id: "path", points: [[1, 2], [3, 2], [4, 4]], closed: false, operation: "engrave_line" },
  ], { sourceWidth: 10, sourceHeight: 10, designWidth: 100, designHeight: 100 });
  const transformed = updateVectorObjectTransform(model, "object:path", {
    scaleX: 1.7,
    scaleY: 0.6,
    rotation: 27,
    translateX: 8,
    translateY: -3,
  });
  const before = compileVectorObjects(transformed).vectorPaths[0];
  const translated = translateVectorModelSelection(transformed, [before], { sourceDx: 1.25, sourceDy: -0.75 });
  const after = compileVectorObjects(translated.model).vectorPaths[0];
  assert.deepEqual(translated.movedEdgeIds, ["edge:path"]);
  after.points.forEach((point, index) => {
    assert.ok(Math.abs(point[0] - before.points[index][0] - 1.25) < 1e-8);
    assert.ok(Math.abs(point[1] - before.points[index][1] + 0.75) < 1e-8);
  });
}

function testMaskedFragmentsTranslateThroughCanonicalEdge() {
  const model = combinedOwnerModel([
    { id: "branch", points: [[0, 5], [10, 5]], closed: false, operation: "engrave_line" },
    { id: "flower", points: [[4, 4], [6, 4], [6, 6], [4, 6]], closed: true, operation: "engrave_line" },
  ]);
  const separated = separateVectorModelByEdgeIds(model, ["edge:flower"], {
    graphRevision: model.vectorGraph.revision,
    manufacturingPolicy: "mask-underlay",
  });
  const fragments = compileVectorObjects(separated.model).vectorPaths.filter((path) => path.edgeId === "edge:branch");
  assert.equal(fragments.length, 2);
  const translated = translateVectorModelSelection(separated.model, fragments, { sourceDx: 1, sourceDy: 0 });
  const canonicalBranch = translated.model.vectorGraph.edges.find((edge) => edge.id === "edge:branch");
  assert.deepEqual(canonicalBranch.points, [[1, 5], [11, 5]]);
  assert.ok(compileVectorObjects(translated.model).vectorPaths.some((path) => path.edgeId === "edge:branch"));
}

function testMovingOneSharedEdgeCreatesAValidDetachedNode() {
  const model = migrateVectorPathsToModel([
    { id: "a", points: [[0, 0], [5, 0]], closed: false, operation: "engrave_line" },
    { id: "b", points: [[5, 0], [5, 5]], closed: false, operation: "engrave_line" },
  ], { sourceWidth: 10, sourceHeight: 10 });
  const before = compileVectorObjects(model);
  const pathA = before.vectorPaths.find((path) => path.edgeId === "edge:a");
  const translated = translateVectorModelSelection(model, [pathA], { sourceDx: 1, sourceDy: 0 });
  const edgeA = translated.model.vectorGraph.edges.find((edge) => edge.id === "edge:a");
  const edgeB = translated.model.vectorGraph.edges.find((edge) => edge.id === "edge:b");
  const nodeA = translated.model.vectorGraph.nodes.find((node) => node.id === edgeA.endNodeId);
  const nodeB = translated.model.vectorGraph.nodes.find((node) => node.id === edgeB.startNodeId);
  assert.notEqual(edgeA.endNodeId, edgeB.startNodeId);
  assert.deepEqual(nodeA.position, [6, 0]);
  assert.deepEqual(nodeB.position, [5, 0]);
  const after = compileVectorObjects(translated.model).vectorPaths;
  assert.deepEqual(after.find((path) => path.edgeId === "edge:a").points, [[1, 0], [6, 0]]);
  assert.deepEqual(after.find((path) => path.edgeId === "edge:b").points, [[5, 0], [5, 5]]);
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
testLocalWidenMovesBothSidesAndKeepsBoundaryAnchored();
testLocalWidenPreservesSharedGraphJunctions();
testLocalWidenKeepsJunctionFixedBesideExcludedEdge();
testLegacyMigrationPreservesOneObjectPerPath();
testManualOpenPathReusesExactGraphEndpoints();
testAnchorSplitsOpenEdgeAndKeepsOwnership();
testAnchorCanCreateFreeEndpointWithoutChangingEdges();
testAnchorRotatesClosedEdgeToSharedNode();
testOnlyConfirmedOrUserSeparatedObjectsAreSemanticSelections();
testExtractedContourFirstPasteKeepsOriginalPosition();
testMarqueeSelectionRequiresActualPolylineContact();
testRectangleSplitUsesExactBoundaryPoints();
testCutAtBoundaryDoesNotEmitUnderlayInsideMotif();
testSeparatedObjectScaleLeavesBranchUnchanged();
testMovedObjectLeavesNoGhostPath();
testExclusiveOwnershipConflictIsRejected();
testIgnoredObjectEmitsNothing();
testDerivedEditReconcilesBackToCanonicalEdge();
testGraphEdgeSeedsUseCanonicalRectangleHits();
testSemanticEdgeSeparationTransfersExclusiveOwnership();
testRepeatedSemanticSeparationKeepsIdsAndConnectionsValid();
testMaskUnderlayRemovesOnlyCoveredBranchSection();
testPinnedAndSharedJointPoliciesEnforceAnchors();
testCanonicalSelectionTranslationSurvivesObjectTransform();
testMaskedFragmentsTranslateThroughCanonicalEdge();
testMovingOneSharedEdgeCreatesAValidDetachedNode();
testSelectedClosedPathsBecomeFillWhileOpenPathsStayLines();
testSelectedOuterPathIncludesNestedTextCounters();
console.log("vector edit tests: 37 passed");
