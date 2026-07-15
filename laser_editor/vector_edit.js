(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LaserVectorEdit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function pointDistance(a, b) {
    return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]));
  }

  function patternPasteOffset(item, pasteCount, step = 5) {
    const count = Math.max(1, Math.round(Number(pasteCount) || 1));
    const safeStep = Math.max(0, Number(step) || 0);
    return item?.pasteInPlace === true ? (count - 1) * safeStep : count * safeStep;
  }

  function projectPointToSegment(point, start, end) {
    const px = Number(point[0]);
    const py = Number(point[1]);
    const ax = Number(start[0]);
    const ay = Number(start[1]);
    const dx = Number(end[0]) - ax;
    const dy = Number(end[1]) - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
    const projected = [ax + dx * t, ay + dy * t];
    return { point: projected, t, distance: pointDistance(point, projected) };
  }

  function nearestPointOnPolyline(metricPoints, point, closed) {
    if (!Array.isArray(metricPoints) || metricPoints.length < 2 || !Array.isArray(point)) return null;
    const segmentCount = closed ? metricPoints.length : metricPoints.length - 1;
    let best = null;
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const nextIndex = (segmentIndex + 1) % metricPoints.length;
      const projection = projectPointToSegment(point, metricPoints[segmentIndex], metricPoints[nextIndex]);
      if (!best || projection.distance < best.distance) {
        best = { ...projection, segmentIndex, nextIndex };
      }
    }
    return best;
  }

  function interpolatePoint(start, end, t) {
    return [
      Number(start[0]) + (Number(end[0]) - Number(start[0])) * t,
      Number(start[1]) + (Number(end[1]) - Number(start[1])) * t,
    ];
  }

  function preparePolylineAnchors(points, metricPoints, closed, startAnchor, endAnchor) {
    if (!Array.isArray(points) || !Array.isArray(metricPoints) || points.length !== metricPoints.length || points.length < 2) {
      return null;
    }
    const count = points.length;
    const entries = points.map((source, index) => ({
      position: index,
      source: [Number(source[0]), Number(source[1])],
      metric: [Number(metricPoints[index][0]), Number(metricPoints[index][1])],
      keys: [],
    }));

    for (const [key, anchor] of [["start", startAnchor], ["end", endAnchor]]) {
      if (!anchor || !Number.isInteger(anchor.segmentIndex) || !Number.isFinite(Number(anchor.t))) return null;
      const segmentIndex = Math.max(0, Math.min(closed ? count - 1 : count - 2, anchor.segmentIndex));
      const nextIndex = (segmentIndex + 1) % count;
      const t = Math.max(0, Math.min(1, Number(anchor.t)));
      let vertexIndex = null;
      if (t <= 1e-5) vertexIndex = segmentIndex;
      else if (t >= 1 - 1e-5) vertexIndex = nextIndex;
      if (vertexIndex !== null) {
        entries[vertexIndex].keys.push(key);
        continue;
      }
      entries.push({
        position: segmentIndex + t,
        source: interpolatePoint(points[segmentIndex], points[nextIndex], t),
        metric: Array.isArray(anchor.point)
          ? [Number(anchor.point[0]), Number(anchor.point[1])]
          : interpolatePoint(metricPoints[segmentIndex], metricPoints[nextIndex], t),
        keys: [key],
      });
    }

    entries.sort((first, second) => first.position - second.position);
    const startIndex = entries.findIndex((entry) => entry.keys.includes("start"));
    const endIndex = entries.findIndex((entry) => entry.keys.includes("end"));
    if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) return null;
    return {
      points: entries.map((entry) => entry.source),
      metricPoints: entries.map((entry) => entry.metric),
      startIndex,
      endIndex,
    };
  }

  function repairPolylineArc(points, metricPoints, closed, centerIndex, radius) {
    if (!Array.isArray(points) || !Array.isArray(metricPoints) || points.length !== metricPoints.length || points.length < 4) {
      return null;
    }
    const count = points.length;
    const target = Math.max(0.0001, Number(radius) || 0);
    const center = Math.max(0, Math.min(count - 1, Math.round(Number(centerIndex) || 0)));
    let start = center;
    let end = center;
    let walked = 0;

    if (closed) {
      let steps = 0;
      while (walked < target && steps < count - 3) {
        const previous = (start - 1 + count) % count;
        walked += pointDistance(metricPoints[start], metricPoints[previous]);
        start = previous;
        steps += 1;
      }
      walked = 0;
      steps = 0;
      while (walked < target && steps < count - 3) {
        const next = (end + 1) % count;
        walked += pointDistance(metricPoints[end], metricPoints[next]);
        end = next;
        steps += 1;
      }

      const result = [points[start], points[end]];
      let index = (end + 1) % count;
      while (index !== start && result.length <= count) {
        result.push(points[index]);
        index = (index + 1) % count;
      }
      return result.length >= 3 && result.length < count ? result.map((point) => [...point]) : null;
    }

    while (start > 0 && walked < target) {
      walked += pointDistance(metricPoints[start], metricPoints[start - 1]);
      start -= 1;
    }
    walked = 0;
    while (end < count - 1 && walked < target) {
      walked += pointDistance(metricPoints[end], metricPoints[end + 1]);
      end += 1;
    }
    if (end - start < 2) return null;
    const result = points.slice(0, start + 1).concat(points.slice(end));
    return result.length >= 2 && result.length < count ? result.map((point) => [...point]) : null;
  }

  function widenPointInRegion(point, center, options = {}) {
    const x = Number(point?.[0]);
    const y = Number(point?.[1]);
    const centerX = Number(center?.[0]);
    const centerY = Number(center?.[1]);
    const radiusX = Math.max(1e-6, Math.abs(Number(options.radiusX) || 0));
    const radiusY = Math.max(1e-6, Math.abs(Number(options.radiusY) || 0));
    const amountX = Number(options.amountX) || 0;
    const amountY = Number(options.amountY) || 0;
    if (![x, y, centerX, centerY].every(Number.isFinite) || (!amountX && !amountY)) return [x, y];

    const dx = x - centerX;
    const dy = y - centerY;
    const normalizedX = dx / radiusX;
    const normalizedY = dy / radiusY;
    const distance = Math.hypot(normalizedX, normalizedY);
    if (distance >= 1 - 1e-9) return [x, y];

    const remaining = 1 - distance;
    const falloff = remaining * remaining * (3 - 2 * remaining);
    const softness = Math.max(0.01, Math.min(0.25, Number(options.centerSoftness) || 0.06));
    const directionX = normalizedX / Math.sqrt(normalizedX * normalizedX + softness * softness);
    const directionY = normalizedY / Math.sqrt(normalizedY * normalizedY + softness * softness);
    return [x + amountX * directionX * falloff, y + amountY * directionY * falloff];
  }

  function widenPolylineRegion(points, center, options = {}) {
    if (!Array.isArray(points) || !points.length || !Array.isArray(center)) {
      return { points: cloneJson(points || []), changedPoints: 0 };
    }
    let changedPoints = 0;
    const widened = points.map((point) => {
      const next = widenPointInRegion(point, center, options);
      if (pointDistance(point, next) > 1e-9) changedPoints += 1;
      return next;
    });
    return { points: widened, changedPoints };
  }

  function widenVectorModelRegion(model, center, options = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const next = cloneJson(model);
    const graph = next.vectorGraph || { revision: 0, nodes: [], edges: [] };
    const allowedEdgeIds = options.edgeIds?.length ? new Set(options.edgeIds.map(String)) : null;
    const edgeById = new Map((graph.edges || []).map((edge) => [String(edge.id || ""), edge]));
    const skippedEdgeIds = new Set();
    const incidentEdges = new Map();
    for (const edge of graph.edges || []) {
      const edgeId = String(edge.id || "");
      for (const nodeId of [edge.startNodeId, edge.endNodeId].map(String).filter(Boolean)) {
        if (!incidentEdges.has(nodeId)) incidentEdges.set(nodeId, []);
        incidentEdges.get(nodeId).push(edgeId);
      }
      if (edge.removed || edge.pathData?.locked || (allowedEdgeIds && !allowedEdgeIds.has(edgeId))) skippedEdgeIds.add(edgeId);
    }
    const frozenNodeIds = new Set();
    for (const [nodeId, edgeIds] of incidentEdges) {
      if (edgeIds.some((edgeId) => skippedEdgeIds.has(edgeId))) frozenNodeIds.add(nodeId);
    }

    let changedEdges = 0;
    let changedPoints = 0;
    const changedEdgeIds = new Set();
    for (const edge of graph.edges || []) {
      const edgeId = String(edge.id || "");
      if (skippedEdgeIds.has(edgeId) || !Array.isArray(edge.points) || !edge.points.length) continue;
      const widened = widenPolylineRegion(edge.points, center, options);
      if (!widened.changedPoints) continue;
      if (!edge.closed && widened.points.length) {
        if (frozenNodeIds.has(String(edge.startNodeId || ""))) widened.points[0] = cloneJson(edge.points[0]);
        if (frozenNodeIds.has(String(edge.endNodeId || ""))) widened.points[widened.points.length - 1] = cloneJson(edge.points[edge.points.length - 1]);
      }
      const effectiveChanges = widened.points.reduce(
        (count, point, index) => count + (pointDistance(point, edge.points[index]) > 1e-9 ? 1 : 0),
        0
      );
      if (!effectiveChanges) continue;
      edge.points = widened.points;
      edge.lengthSource = polylineLength(edge.points, Boolean(edge.closed));
      changedEdges += 1;
      changedPoints += effectiveChanges;
      changedEdgeIds.add(edgeId);
    }

    if (changedEdges) {
      for (const node of graph.nodes || []) {
        const nodeId = String(node.id || "");
        const connected = incidentEdges.get(nodeId) || [];
        if (!connected.length || frozenNodeIds.has(nodeId) || !connected.every((edgeId) => changedEdgeIds.has(edgeId) || !edgeById.has(edgeId))) continue;
        node.position = widenPointInRegion(node.position, center, options);
      }
      graph.revision = Math.max(0, Math.round(Number(graph.revision) || 0)) + 1;
      next.vectorPathsDerivedFromRevision = 0;
      next.objectProposals = [];
      next.repairProposals = [];
    }
    return { model: next, changedEdges, changedPoints };
  }

  function dedupeOpenPoints(points, minDistance) {
    const result = [];
    for (const point of points || []) {
      const next = [Number(point[0]), Number(point[1])];
      if (!Number.isFinite(next[0]) || !Number.isFinite(next[1])) continue;
      if (!result.length || pointDistance(result[result.length - 1], next) >= minDistance) result.push(next);
    }
    return result;
  }

  function simplifyOpenPolyline(points, tolerance) {
    const current = dedupeOpenPoints(points, 0.0001);
    const epsilon = Math.max(0, Number(tolerance) || 0);
    if (current.length < 3 || epsilon <= 0) return current;
    const keep = new Set([0, current.length - 1]);
    const stack = [[0, current.length - 1]];
    while (stack.length) {
      const [startIndex, endIndex] = stack.pop();
      let farthestIndex = -1;
      let farthestDistance = 0;
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const distance = projectPointToSegment(current[index], current[startIndex], current[endIndex]).distance;
        if (distance > farthestDistance) {
          farthestDistance = distance;
          farthestIndex = index;
        }
      }
      if (farthestIndex > startIndex && farthestDistance > epsilon) {
        keep.add(farthestIndex);
        stack.push([startIndex, farthestIndex], [farthestIndex, endIndex]);
      }
    }
    return [...keep].sort((first, second) => first - second).map((index) => current[index]);
  }

  function smoothOpenPolyline(points, passes, minDistance) {
    let current = dedupeOpenPoints(points, Math.max(0.0001, Number(minDistance) || 0.02));
    if (current.length < 3) return current;
    for (let pass = 0; pass < Math.max(1, Math.round(Number(passes) || 1)); pass += 1) {
      const result = [current[0]];
      for (let index = 0; index < current.length - 1; index += 1) {
        const a = current[index];
        const b = current[index + 1];
        result.push([
          a[0] * 0.75 + b[0] * 0.25,
          a[1] * 0.75 + b[1] * 0.25,
        ]);
        result.push([
          a[0] * 0.25 + b[0] * 0.75,
          a[1] * 0.25 + b[1] * 0.75,
        ]);
      }
      result.push(current[current.length - 1]);
      current = dedupeOpenPoints(result, Math.max(0.0001, Number(minDistance) || 0.02));
    }
    current[0] = [...points[0]];
    current[current.length - 1] = [...points[points.length - 1]];
    return current;
  }

  function fitOpenPolyline(points, options = {}) {
    const minDistance = Math.max(0.0001, Number(options.minDistance) || 0.02);
    const tolerance = Math.max(minDistance, Number(options.tolerance) || minDistance * 1.5);
    const passes = Math.max(0, Math.min(2, Math.round(Number(options.passes) || 1)));
    let current = simplifyOpenPolyline(dedupeOpenPoints(points, minDistance), tolerance);
    if (current.length < 3) return current;
    const first = [...current[0]];
    const last = [...current[current.length - 1]];
    if (passes > 0) current = smoothOpenPolyline(current, passes, minDistance * 0.5);
    current = simplifyOpenPolyline(current, tolerance * 0.45);
    current[0] = first;
    current[current.length - 1] = last;
    return current;
  }

  function forwardArcLength(metricPoints, startIndex, endIndex) {
    let length = 0;
    let index = startIndex;
    while (index !== endIndex) {
      const next = (index + 1) % metricPoints.length;
      length += pointDistance(metricPoints[index], metricPoints[next]);
      index = next;
    }
    return length;
  }

  function replacePolylineSection(points, metricPoints, closed, startIndex, endIndex, replacement) {
    if (!Array.isArray(points) || !Array.isArray(metricPoints) || !Array.isArray(replacement)) return null;
    if (points.length !== metricPoints.length || points.length < 3 || replacement.length < 2) return null;
    let start = Math.max(0, Math.min(points.length - 1, Math.round(Number(startIndex) || 0)));
    let end = Math.max(0, Math.min(points.length - 1, Math.round(Number(endIndex) || 0)));
    if (start === end) return null;
    let drawn = replacement.map((point) => [Number(point[0]), Number(point[1])]);

    if (!closed) {
      if (start > end) {
        [start, end] = [end, start];
        drawn = drawn.reverse();
      }
      drawn[0] = [...points[start]];
      drawn[drawn.length - 1] = [...points[end]];
      return points.slice(0, start).concat(drawn, points.slice(end + 1)).map((point) => [...point]);
    }

    const forward = forwardArcLength(metricPoints, start, end);
    const total = forwardArcLength(metricPoints, 0, metricPoints.length - 1) + pointDistance(metricPoints[metricPoints.length - 1], metricPoints[0]);
    let replaceStart = start;
    let replaceEnd = end;
    if (forward > total - forward) {
      replaceStart = end;
      replaceEnd = start;
      drawn = drawn.reverse();
    }
    drawn[0] = [...points[replaceStart]];
    drawn[drawn.length - 1] = [...points[replaceEnd]];
    const result = [...drawn];
    let index = (replaceEnd + 1) % points.length;
    while (index !== replaceStart && result.length <= points.length + drawn.length) {
      result.push([...points[index]]);
      index = (index + 1) % points.length;
    }
    return result.length >= 3 ? result : null;
  }

  function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeOperation(value, fallback = "engrave_line") {
    const operation = String(value || fallback).toLowerCase().replaceAll("-", "_");
    if (operation === "engrave") return "engrave_line";
    return ["cut", "engrave_line", "engrave_fill", "ignore"].includes(operation) ? operation : fallback;
  }

  function isUserSemanticVectorObject(vectorObject) {
    if (!vectorObject || vectorObject.removed) return false;
    if (vectorObject.userSemantic === true || String(vectorObject.proposalId || "")) return true;
    const createdBy = String(vectorObject.createdBy || "");
    return createdBy === "structural-analysis-confirmed" || createdBy === "user-rectangle-separation";
  }

  function affinePoint(matrix, point) {
    const [a, b, c, d, e, f] = matrix;
    const x = Number(point[0]);
    const y = Number(point[1]);
    return [a * x + c * y + e, b * x + d * y + f];
  }

  function affineVector(matrix, vector) {
    const [a, b, c, d] = matrix;
    const x = Number(vector[0]);
    const y = Number(vector[1]);
    return [a * x + c * y, b * x + d * y];
  }

  function invertAffine(matrix) {
    if (!Array.isArray(matrix) || matrix.length !== 6 || matrix.some((value) => !Number.isFinite(Number(value)))) return null;
    const [a, b, c, d, e, f] = matrix.map(Number);
    const determinant = a * d - b * c;
    if (Math.abs(determinant) <= 1e-12) return null;
    return [
      d / determinant,
      -b / determinant,
      -c / determinant,
      a / determinant,
      (c * f - d * e) / determinant,
      (b * e - a * f) / determinant,
    ];
  }

  function identityAffine(matrix) {
    const current = Array.isArray(matrix) && matrix.length === 6 ? matrix.map(Number) : [1, 0, 0, 1, 0, 0];
    return current.every((value, index) => Math.abs(value - [1, 0, 0, 1, 0, 0][index]) <= 1e-9);
  }

  function affineFromComponents(components = {}, origin = [0, 0]) {
    const scaleX = Math.max(0.01, Number(components.scaleX) || 1);
    const scaleY = Math.max(0.01, Number(components.scaleY) || 1);
    const rotation = Number(components.rotation) || 0;
    const translateX = Number(components.translateX) || 0;
    const translateY = Number(components.translateY) || 0;
    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const a = cos * scaleX;
    const b = sin * scaleX;
    const c = -sin * scaleY;
    const d = cos * scaleY;
    const ox = Number(origin[0]) || 0;
    const oy = Number(origin[1]) || 0;
    return [
      a,
      b,
      c,
      d,
      translateX + ox - a * ox - c * oy,
      translateY + oy - b * ox - d * oy,
    ];
  }

  function polylineLength(points, closed = false) {
    let length = 0;
    for (let index = 1; index < (points || []).length; index += 1) {
      length += pointDistance(points[index - 1], points[index]);
    }
    if (closed && points?.length > 2) length += pointDistance(points[points.length - 1], points[0]);
    return length;
  }

  function pathBounds(points) {
    if (!Array.isArray(points) || !points.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
  }

  function pointOnSegment2d(point, start, end, epsilon = 1e-8) {
    const dx = Number(end[0]) - Number(start[0]);
    const dy = Number(end[1]) - Number(start[1]);
    const cross = (Number(point[0]) - Number(start[0])) * dy - (Number(point[1]) - Number(start[1])) * dx;
    if (Math.abs(cross) > epsilon * Math.max(1, Math.hypot(dx, dy))) return false;
    const dot = (Number(point[0]) - Number(start[0])) * dx + (Number(point[1]) - Number(start[1])) * dy;
    return dot >= -epsilon && dot <= dx * dx + dy * dy + epsilon;
  }

  function pointInPolygon2d(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
      const start = polygon[previous];
      const end = polygon[index];
      if (pointOnSegment2d(point, start, end)) return true;
      const crosses = (Number(start[1]) > Number(point[1])) !== (Number(end[1]) > Number(point[1]));
      if (!crosses) continue;
      const x = Number(start[0]) + ((Number(point[1]) - Number(start[1])) * (Number(end[0]) - Number(start[0]))) / (Number(end[1]) - Number(start[1]));
      if (Number(point[0]) < x) inside = !inside;
    }
    return inside;
  }

  function segmentIntersectionParameter(start, end, first, second) {
    const dx = Number(end[0]) - Number(start[0]);
    const dy = Number(end[1]) - Number(start[1]);
    const ex = Number(second[0]) - Number(first[0]);
    const ey = Number(second[1]) - Number(first[1]);
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) <= 1e-12) return null;
    const rx = Number(first[0]) - Number(start[0]);
    const ry = Number(first[1]) - Number(start[1]);
    const t = (rx * ey - ry * ex) / denominator;
    const u = (rx * dy - ry * dx) / denominator;
    return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? Math.max(0, Math.min(1, t)) : null;
  }

  function clipPolylineOutsidePolygons(points, closed, polygons) {
    const source = (points || []).map((point) => [Number(point[0]), Number(point[1])]);
    const masks = (polygons || []).filter((polygon) => Array.isArray(polygon) && polygon.length >= 3);
    if (source.length < 2 || !masks.length) return source.length >= 2 ? [{ points: source, closed: Boolean(closed), masked: false }] : [];
    const segmentCount = closed ? source.length : source.length - 1;
    const fragments = [];
    let current = null;
    let removedAny = false;
    const append = (start, end) => {
      if (pointDistance(start, end) <= 1e-9) return;
      if (current && pointDistance(current.points[current.points.length - 1], start) <= 1e-7) {
        current.points.push(end);
      } else {
        current = { points: [start, end], closed: false, masked: true };
        fragments.push(current);
      }
    };
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const start = source[segmentIndex];
      const end = source[(segmentIndex + 1) % source.length];
      const breaks = [0, 1];
      for (const polygon of masks) {
        for (let index = 0; index < polygon.length; index += 1) {
          const t = segmentIntersectionParameter(start, end, polygon[index], polygon[(index + 1) % polygon.length]);
          if (t !== null) breaks.push(t);
        }
      }
      const ordered = [...new Set(breaks.map((value) => Number(value.toFixed(10))))].sort((first, second) => first - second);
      for (let index = 1; index < ordered.length; index += 1) {
        const t0 = ordered[index - 1];
        const t1 = ordered[index];
        if (t1 - t0 <= 1e-10) continue;
        const midpoint = interpolatePoint(start, end, (t0 + t1) / 2);
        const masked = masks.some((polygon) => pointInPolygon2d(midpoint, polygon));
        if (masked) {
          removedAny = true;
          current = null;
        } else {
          append(interpolatePoint(start, end, t0), interpolatePoint(start, end, t1));
        }
      }
    }
    if (!removedAny) return [{ points: source, closed: Boolean(closed), masked: false }];
    if (closed && fragments.length > 1) {
      const first = fragments[0];
      const last = fragments[fragments.length - 1];
      if (pointDistance(last.points[last.points.length - 1], first.points[0]) <= 1e-7) {
        fragments[0] = { points: [...last.points, ...first.points.slice(1)], closed: false, masked: true };
        fragments.pop();
      }
    }
    return fragments.filter((fragment) => fragment.points.length >= 2 && polylineLength(fragment.points, false) > 1e-8);
  }

  function convexHull(points) {
    const unique = [...new Map((points || []).map((point) => {
      const clean = [Number(point[0]), Number(point[1])];
      return [`${clean[0].toFixed(8)},${clean[1].toFixed(8)}`, clean];
    })).values()].sort((first, second) => first[0] - second[0] || first[1] - second[1]);
    if (unique.length < 3) return unique;
    const cross = (origin, first, second) => (first[0] - origin[0]) * (second[1] - origin[1]) - (first[1] - origin[1]) * (second[0] - origin[0]);
    const lower = [];
    for (const point of unique) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-10) lower.pop();
      lower.push(point);
    }
    const upper = [];
    for (let index = unique.length - 1; index >= 0; index -= 1) {
      const point = unique[index];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-10) upper.pop();
      upper.push(point);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  function pathDataFromVectorPath(vectorPath) {
    const pathData = cloneJson(vectorPath || {});
    delete pathData.points;
    delete pathData.id;
    delete pathData.edgeId;
    delete pathData.objectId;
    delete pathData.provenance;
    return pathData;
  }

  function endpointNodeBuilder(nodes, tolerance, prefix = "node") {
    const safeTolerance = Math.max(1e-6, Number(tolerance) || 0.01);
    const buckets = new Map();
    const keyFor = (point) => `${Math.round(Number(point[0]) / safeTolerance)},${Math.round(Number(point[1]) / safeTolerance)}`;
    for (const node of nodes) {
      const key = keyFor(node.position);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(node);
    }
    return (point) => {
      const x = Number(point[0]);
      const y = Number(point[1]);
      const gx = Math.round(x / safeTolerance);
      const gy = Math.round(y / safeTolerance);
      for (let ix = gx - 1; ix <= gx + 1; ix += 1) {
        for (let iy = gy - 1; iy <= gy + 1; iy += 1) {
          for (const candidate of buckets.get(`${ix},${iy}`) || []) {
            if (pointDistance(candidate.position, [x, y]) <= safeTolerance) return candidate.id;
          }
        }
      }
      const node = {
        id: `${prefix}-${nodes.length + 1}`,
        position: [x, y],
        type: "endpoint",
        confidence: 1,
        lineage: {},
      };
      nodes.push(node);
      const key = keyFor(node.position);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(node);
      return node.id;
    };
  }

  function refreshGraphNodeTypes(graph) {
    const degree = new Map((graph.nodes || []).map((node) => [node.id, 0]));
    for (const edge of graph.edges || []) {
      if (!edge || edge.removed) continue;
      if (edge.closed && edge.startNodeId === edge.endNodeId) {
        degree.set(edge.startNodeId, (degree.get(edge.startNodeId) || 0) + 2);
      } else {
        degree.set(edge.startNodeId, (degree.get(edge.startNodeId) || 0) + 1);
        degree.set(edge.endNodeId, (degree.get(edge.endNodeId) || 0) + 1);
      }
    }
    for (const node of graph.nodes || []) {
      const current = degree.get(node.id) || 0;
      node.degree = current;
      node.type = current > 2 ? "junction" : current === 2 ? "pass-through" : "endpoint";
    }
  }

  function migrateVectorPathsToModel(vectorPaths, options = {}) {
    const sourceWidth = Math.max(0.001, Number(options.sourceWidth) || 1);
    const sourceHeight = Math.max(0.001, Number(options.sourceHeight) || 1);
    const designWidth = Math.max(0.001, Number(options.designWidth) || sourceWidth);
    const designHeight = Math.max(0.001, Number(options.designHeight) || sourceHeight);
    const fallbackOperation = normalizeOperation(options.fallbackOperation, "engrave_line");
    const revision = Math.max(1, Math.round(Number(options.revision) || 1));
    const nodes = [];
    const edges = [];
    const vectorObjects = [];
    const nodeFor = endpointNodeBuilder(nodes, options.nodeTolerance, `node-r${revision}`);
    const usedIds = new Set();
    const sourceToDesign = [designWidth / sourceWidth, 0, 0, -designHeight / sourceHeight, 0, designHeight];

    for (let index = 0; index < (vectorPaths || []).length; index += 1) {
      const vectorPath = vectorPaths[index] || {};
      const points = (vectorPath.points || [])
        .map((point) => [Number(point[0]), Number(point[1])])
        .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
      if (points.length < 2) continue;
      let legacyPathId = String(vectorPath.id || `path-${index + 1}`);
      while (usedIds.has(legacyPathId)) legacyPathId = `${legacyPathId}-${index + 1}`;
      usedIds.add(legacyPathId);
      const closed = Boolean(vectorPath.closed);
      const startNodeId = nodeFor(points[0]);
      const endNodeId = closed ? startNodeId : nodeFor(points[points.length - 1]);
      const edgeId = `edge:${legacyPathId}`;
      const operation = normalizeOperation(vectorPath.operation, fallbackOperation);
      const bounds = pathBounds(points);
      const sourceCenter = bounds ? [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2] : points[0];
      const originDesign = affinePoint(sourceToDesign, sourceCenter);
      edges.push({
        id: edgeId,
        startNodeId,
        endNodeId,
        points,
        closed,
        lengthSource: polylineLength(points, closed),
        operation,
        removed: Boolean(vectorPath.removed),
        pathData: pathDataFromVectorPath(vectorPath),
        lineage: {
          canonicalEdgeLineageId: `legacy:${legacyPathId}`,
          parentEdgeId: null,
          sourcePathIds: [legacyPathId],
          legacyPathId,
          sourceInterval: [0, 1],
        },
        warnings: cloneJson(vectorPath.warnings || []),
      });
      vectorObjects.push({
        id: `object:${legacyPathId}`,
        name: `Kontur ${index + 1}`,
        edgeRefs: [{ edgeId, ownership: "exclusive", role: "stroke", emit: true }],
        attachments: [],
        localFrame: { originDesign },
        transform: [1, 0, 0, 1, 0, 0],
        transformComponents: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        transformRevision: 0,
        resizePolicy: "scale",
        locked: Boolean(vectorPath.locked),
        removed: Boolean(vectorPath.removed),
        deformable: vectorPath.deformable !== false,
        operation,
        confidence: 1,
        createdBy: "v1-migration",
      });
    }
    const vectorGraph = { revision, nodes, edges };
    refreshGraphNodeTypes(vectorGraph);
    return {
      vectorModelVersion: 2,
      source: {
        width: sourceWidth,
        height: sourceHeight,
        imageHash: options.imageHash || "",
        traceScale: Number(options.traceScale) || 1,
        analysisVersion: "graph-v1",
      },
      sourceToDesign: { matrix: sourceToDesign, unit: "mm", designWidth, designHeight },
      vectorGraph,
      vectorObjects,
      connections: [],
      occlusionMasks: [],
      objectProposals: [],
      objectTransformRevision: 0,
      vectorPathsDerivedFromRevision: 0,
    };
  }

  function anchorPointToVectorModel(model, sourcePoint, options = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const target = [Number(sourcePoint?.[0]), Number(sourcePoint?.[1])];
    if (!target.every(Number.isFinite)) throw new Error("anchor point is invalid");
    const next = cloneJson(model);
    const graph = next.vectorGraph || (next.vectorGraph = { revision: 1, nodes: [], edges: [] });
    graph.nodes = graph.nodes || [];
    graph.edges = graph.edges || [];
    next.vectorObjects = next.vectorObjects || [];
    const tolerance = Math.max(1e-8, Number(options.snapTolerance) || 0.01);
    const nodeById = new Map(graph.nodes.map((node) => [String(node.id || ""), node]));
    const requestedNode = options.nodeId ? nodeById.get(String(options.nodeId)) : null;
    if (requestedNode) {
      return { model: next, nodeId: requestedNode.id, sourcePoint: cloneJson(requestedNode.position), edgeId: String(options.edgeId || ""), snapped: true };
    }
    const nearbyNode = graph.nodes.find((node) => pointDistance(node.position, target) <= tolerance);
    if (nearbyNode) {
      return { model: next, nodeId: nearbyNode.id, sourcePoint: cloneJson(nearbyNode.position), edgeId: String(options.edgeId || ""), snapped: true };
    }

    const preferredEdgeId = String(options.edgeId || "");
    let best = null;
    let preferredBest = null;
    for (const edge of graph.edges) {
      if (!edge || edge.removed || !Array.isArray(edge.points) || edge.points.length < 2) continue;
      const nearest = nearestPointOnPolyline(edge.points, target, Boolean(edge.closed));
      if (!nearest) continue;
      const preferred = preferredEdgeId && String(edge.id) === preferredEdgeId;
      const candidate = { edge, nearest, preferred };
      if (!best || nearest.distance < best.nearest.distance) best = candidate;
      if (preferred && (!preferredBest || nearest.distance < preferredBest.nearest.distance)) preferredBest = candidate;
    }
    if (preferredBest?.nearest.distance <= tolerance) best = preferredBest;

    const usedNodeIds = new Set(graph.nodes.map((node) => String(node.id || "")));
    const usedEdgeIds = new Set(graph.edges.map((edge) => String(edge.id || "")));
    const uniqueId = (base, used) => {
      let candidate = String(base);
      let suffix = 2;
      while (used.has(candidate)) candidate = `${base}-${suffix++}`;
      used.add(candidate);
      return candidate;
    };
    const createNode = (position) => {
      const revision = Math.max(1, Math.round(Number(graph.revision) || 1));
      const id = uniqueId(`node-r${revision + 1}-anchor-${graph.nodes.length + 1}`, usedNodeIds);
      const node = {
        id,
        position: [Number(position[0]), Number(position[1])],
        type: "endpoint",
        confidence: 1,
        lineage: { createdBy: "manual-anchor" },
      };
      graph.nodes.push(node);
      return node;
    };
    const commitGraphChange = () => {
      graph.revision = Math.max(0, Math.round(Number(graph.revision) || 0)) + 1;
      next.objectProposals = [];
      next.repairProposals = [];
      next.vectorPathsDerivedFromRevision = 0;
      refreshGraphNodeTypes(graph);
    };

    if (!best || best.nearest.distance > tolerance) {
      if (options.allowFree === false) throw new Error("no vector edge is close enough to anchor");
      const node = createNode(target);
      commitGraphChange();
      return { model: next, nodeId: node.id, sourcePoint: cloneJson(node.position), edgeId: "", snapped: false };
    }

    const edge = best.edge;
    const projected = [Number(best.nearest.point[0]), Number(best.nearest.point[1])];
    const segmentIndex = Math.max(0, Math.min(edge.points.length - (edge.closed ? 1 : 2), Number(best.nearest.segmentIndex) || 0));
    const t = Math.max(0, Math.min(1, Number(best.nearest.t) || 0));
    const lastIndex = edge.points.length - 1;
    if ((!edge.closed && segmentIndex === 0 && t <= 1e-6) || (edge.closed && pointDistance(projected, edge.points[0]) <= tolerance)) {
      const node = nodeById.get(String(edge.startNodeId));
      if (node) return { model: next, nodeId: node.id, sourcePoint: cloneJson(node.position), edgeId: String(edge.id), snapped: true };
    }
    if (!edge.closed && segmentIndex === lastIndex - 1 && t >= 1 - 1e-6) {
      const node = nodeById.get(String(edge.endNodeId));
      if (node) return { model: next, nodeId: node.id, sourcePoint: cloneJson(node.position), edgeId: String(edge.id), snapped: true };
    }

    const node = createNode(projected);
    let splitIndex = segmentIndex + 1;
    const edgePoints = edge.points.map((point) => [Number(point[0]), Number(point[1])]);
    if (t <= 1e-6) splitIndex = segmentIndex;
    else if (t >= 1 - 1e-6) splitIndex = (segmentIndex + 1) % edgePoints.length;
    else edgePoints.splice(splitIndex, 0, cloneJson(node.position));

    if (edge.closed) {
      const rotated = edgePoints.slice(splitIndex).concat(edgePoints.slice(0, splitIndex));
      rotated[0] = cloneJson(node.position);
      edge.points = rotated;
      edge.startNodeId = node.id;
      edge.endNodeId = node.id;
      edge.lengthSource = polylineLength(rotated, true);
      commitGraphChange();
      return { model: next, nodeId: node.id, sourcePoint: cloneJson(node.position), edgeId: String(edge.id), snapped: true };
    }

    if (splitIndex <= 0 || splitIndex >= edgePoints.length - 1) {
      const endpointNode = nodeById.get(String(splitIndex <= 0 ? edge.startNodeId : edge.endNodeId));
      graph.nodes = graph.nodes.filter((candidate) => String(candidate.id) !== String(node.id));
      if (!endpointNode) throw new Error("edge endpoint node is missing");
      return { model: next, nodeId: endpointNode.id, sourcePoint: cloneJson(endpointNode.position), edgeId: String(edge.id), snapped: true };
    }

    edgePoints[splitIndex] = cloneJson(node.position);
    const firstPoints = edgePoints.slice(0, splitIndex + 1);
    const secondPoints = edgePoints.slice(splitIndex);
    const originalEdgeId = String(edge.id);
    const secondEdgeId = uniqueId(`${originalEdgeId}:split`, usedEdgeIds);
    const sourceInterval = edge.lineage?.sourceInterval || [0, 1];
    const totalLength = Math.max(1e-12, polylineLength(edgePoints, false));
    const ratio = Math.max(0, Math.min(1, polylineLength(firstPoints, false) / totalLength));
    const intervalStart = Number(sourceInterval[0]) || 0;
    const intervalEnd = Number(sourceInterval[1]);
    const safeIntervalEnd = Number.isFinite(intervalEnd) ? intervalEnd : 1;
    const intervalSplit = intervalStart + (safeIntervalEnd - intervalStart) * ratio;
    const canonicalId = String(edge.lineage?.canonicalEdgeLineageId || originalEdgeId);
    const firstEdge = {
      ...cloneJson(edge),
      points: firstPoints,
      endNodeId: node.id,
      lengthSource: polylineLength(firstPoints, false),
      lineage: { ...(cloneJson(edge.lineage || {})), canonicalEdgeLineageId: canonicalId, parentEdgeId: originalEdgeId, sourceInterval: [intervalStart, intervalSplit] },
    };
    const secondEdge = {
      ...cloneJson(edge),
      id: secondEdgeId,
      points: secondPoints,
      startNodeId: node.id,
      lengthSource: polylineLength(secondPoints, false),
      lineage: { ...(cloneJson(edge.lineage || {})), canonicalEdgeLineageId: canonicalId, parentEdgeId: originalEdgeId, sourceInterval: [intervalSplit, safeIntervalEnd] },
    };
    const edgeIndex = graph.edges.findIndex((candidate) => String(candidate.id) === originalEdgeId);
    graph.edges.splice(edgeIndex, 1, firstEdge, secondEdge);
    for (const vectorObject of next.vectorObjects) {
      const refs = [];
      for (const edgeRef of vectorObject.edgeRefs || []) {
        refs.push(edgeRef);
        if (String(edgeRef.edgeId) === originalEdgeId) refs.push({ ...cloneJson(edgeRef), edgeId: secondEdgeId });
      }
      vectorObject.edgeRefs = refs;
    }
    commitGraphChange();
    return { model: next, nodeId: node.id, sourcePoint: cloneJson(node.position), edgeId: originalEdgeId, splitEdgeId: secondEdgeId, snapped: true };
  }

  function appendOpenPathToVectorModel(model, vectorPath, options = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    if (vectorPath?.closed) throw new Error("only open paths can be appended");
    const points = (vectorPath?.points || [])
      .map((point) => [Number(point?.[0]), Number(point?.[1])])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (points.length < 2 || polylineLength(points, false) <= 1e-8) throw new Error("an open path needs two different points");

    const next = cloneJson(model);
    const graph = next.vectorGraph || (next.vectorGraph = { revision: 1, nodes: [], edges: [] });
    graph.nodes = graph.nodes || [];
    graph.edges = graph.edges || [];
    next.vectorObjects = next.vectorObjects || [];
    const nodeTolerance = Math.max(1e-8, Number(options.nodeTolerance) || 1e-5);
    const nodeIds = new Set(graph.nodes.map((node) => String(node.id || "")));
    const edgeIds = new Set(graph.edges.map((edge) => String(edge.id || "")));
    const objectIds = new Set(next.vectorObjects.map((object) => String(object.id || "")));
    const uniqueId = (base, used) => {
      let candidate = String(base || "item");
      let suffix = 2;
      while (used.has(candidate)) candidate = `${base}-${suffix++}`;
      used.add(candidate);
      return candidate;
    };
    const resolveNode = (requestedId, point, label) => {
      if (requestedId !== undefined && requestedId !== null && String(requestedId)) {
        const node = graph.nodes.find((candidate) => String(candidate.id) === String(requestedId));
        if (!node) throw new Error(`${label} node does not exist`);
        if (pointDistance(node.position, point) > nodeTolerance) throw new Error(`${label} point does not match its graph node`);
        return node;
      }
      const matched = graph.nodes.find((candidate) => pointDistance(candidate.position, point) <= nodeTolerance);
      if (matched) return matched;
      const revision = Math.max(1, Math.round(Number(graph.revision) || 1));
      const id = uniqueId(`node-r${revision + 1}-manual-${graph.nodes.length + 1}`, nodeIds);
      const node = { id, position: [...point], type: "endpoint", confidence: 1, lineage: { createdBy: "manual-contour" } };
      graph.nodes.push(node);
      return node;
    };

    const startNode = resolveNode(options.startNodeId, points[0], "start");
    const endNode = resolveNode(options.endNodeId, points[points.length - 1], "end");
    if (String(startNode.id) === String(endNode.id)) throw new Error("an open path must connect two different graph nodes");
    points[0] = [Number(startNode.position[0]), Number(startNode.position[1])];
    points[points.length - 1] = [Number(endNode.position[0]), Number(endNode.position[1])];

    const rawPathId = String(vectorPath?.id || `manual-path-${graph.edges.length + 1}`).trim().replace(/\s+/g, "-");
    const pathId = rawPathId || `manual-path-${graph.edges.length + 1}`;
    const edgeId = uniqueId(`edge:${pathId}`, edgeIds);
    const objectId = uniqueId(`object:${pathId}`, objectIds);
    const operation = normalizeOperation(vectorPath?.operation, normalizeOperation(options.fallbackOperation, "engrave_line"));
    const bounds = pathBounds(points);
    const sourceCenter = bounds ? [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2] : [...points[0]];
    const sourceToDesign = next.sourceToDesign?.matrix || [1, 0, 0, 1, 0, 0];
    const originDesign = affinePoint(sourceToDesign, sourceCenter);

    graph.edges.push({
      id: edgeId,
      startNodeId: startNode.id,
      endNodeId: endNode.id,
      points,
      closed: false,
      lengthSource: polylineLength(points, false),
      operation,
      removed: false,
      pathData: pathDataFromVectorPath({ ...vectorPath, id: pathId, closed: false, removed: false }),
      lineage: {
        canonicalEdgeLineageId: `manual:${pathId}`,
        parentEdgeId: null,
        sourcePathIds: [pathId],
        legacyPathId: pathId,
        sourceInterval: [0, 1],
      },
      warnings: cloneJson(vectorPath?.warnings || []),
    });
    next.vectorObjects.push({
      id: objectId,
      name: String(options.name || "Elle çizilen kontur"),
      edgeRefs: [{ edgeId, ownership: "exclusive", role: "stroke", emit: true }],
      attachments: [],
      localFrame: { originSource: sourceCenter, centerSource: sourceCenter, originDesign, centerDesign: originDesign },
      transform: [1, 0, 0, 1, 0, 0],
      transformComponents: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      transformRevision: 0,
      resizePolicy: "scale",
      locked: false,
      removed: false,
      deformable: true,
      operation,
      confidence: 1,
      createdBy: "manual-contour",
    });
    graph.revision = Math.max(0, Math.round(Number(graph.revision) || 0)) + 1;
    next.objectProposals = [];
    next.repairProposals = [];
    next.vectorPathsDerivedFromRevision = 0;
    refreshGraphNodeTypes(graph);
    return { model: next, edgeId, objectId, startNodeId: startNode.id, endNodeId: endNode.id };
  }

  function compileVectorObjects(model, options = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) {
      return { vectorPaths: cloneJson(options.vectorPaths || []), errors: [], warnings: [] };
    }
    const graph = model.vectorGraph || {};
    const revision = Math.max(0, Math.round(Number(graph.revision) || 0));
    const sourceToDesign = model.sourceToDesign?.matrix || [1, 0, 0, 1, 0, 0];
    const designToSource = invertAffine(sourceToDesign);
    const fallbackOperation = normalizeOperation(options.fallbackOperation, "engrave_line");
    const edges = new Map((graph.edges || []).map((edge) => [String(edge.id), edge]));
    const nodes = new Map((graph.nodes || []).map((node) => [String(node.id), node]));
    const objects = new Map((model.vectorObjects || []).map((object) => [String(object.id || ""), object]));
    const exclusiveOwners = new Map();
    const emissionKeys = new Set();
    const vectorPaths = [];
    const errors = [];
    const warnings = [];
    if (!designToSource) errors.push("sourceToDesign transform is singular or invalid");

    const masksByTarget = new Map();
    if (designToSource) {
      for (const mask of model.occlusionMasks || []) {
        if (!mask || mask.removed || String(mask.mode || "") !== "mask-underlay") continue;
        const owner = objects.get(String(mask.ownerObjectId || ""));
        if (!owner || owner.removed || normalizeOperation(owner.operation, fallbackOperation) === "ignore") continue;
        const ownerTransform = Array.isArray(owner.transform) ? owner.transform.map(Number) : [1, 0, 0, 1, 0, 0];
        if (!invertAffine(ownerTransform)) {
          errors.push(`invalid mask owner transform for object ${owner.id || "?"}`);
          continue;
        }
        const polygon = (mask.polygonSource || []).map((point) => {
          const designPoint = affinePoint(sourceToDesign, point);
          return affinePoint(designToSource, affinePoint(ownerTransform, designPoint));
        });
        if (polygon.length < 3) {
          warnings.push(`occlusion mask ${mask.id || "?"} has no valid polygon`);
          continue;
        }
        const targets = (mask.targetObjectIds || []).map(String).filter((objectId) => objectId && objectId !== String(owner.id || ""));
        for (const targetId of targets) {
          if (!masksByTarget.has(targetId)) masksByTarget.set(targetId, []);
          masksByTarget.get(targetId).push(polygon);
        }
      }
    }

    for (const object of model.vectorObjects || []) {
      if (!object || object.removed || normalizeOperation(object.operation, fallbackOperation) === "ignore") continue;
      const transform = Array.isArray(object.transform) ? object.transform.map(Number) : [1, 0, 0, 1, 0, 0];
      if (!invertAffine(transform)) {
        errors.push(`invalid transform for object ${object.id || "?"}`);
        continue;
      }
      const attachmentPolicy = ["detached", "pinned", "shared-joint"].includes(object.attachmentPolicy)
        ? object.attachmentPolicy
        : String(object.attachments?.[0]?.policy || "detached");
      if (attachmentPolicy === "pinned" || attachmentPolicy === "shared-joint") {
        const constrainedAttachments = attachmentPolicy === "pinned" ? (object.attachments || []).slice(0, 1) : (object.attachments || []);
        let invalidConstraint = false;
        for (const attachment of constrainedAttachments) {
          const node = nodes.get(String(attachment.graphNodeId || ""));
          if (!node) {
            errors.push(`object ${object.id || "?"} attachment references missing graph node`);
            invalidConstraint = true;
            break;
          }
          const anchor = affinePoint(sourceToDesign, node.position || [0, 0]);
          if (pointDistance(anchor, affinePoint(transform, anchor)) > 1e-6) {
            errors.push(`object ${object.id || "?"} violates ${attachmentPolicy} anchor constraint`);
            invalidConstraint = true;
            break;
          }
        }
        if (invalidConstraint) continue;
      }
      for (const edgeRef of object.edgeRefs || []) {
        const edgeId = String(edgeRef.edgeId || "");
        const edge = edges.get(edgeId);
        if (!edge) {
          errors.push(`object ${object.id || "?"} references missing edge ${edgeId || "?"}`);
          continue;
        }
        if (edgeRef.ownership === "exclusive") {
          const previous = exclusiveOwners.get(edgeId);
          if (previous && previous !== object.id) {
            errors.push(`edge ${edgeId} has multiple exclusive owners: ${previous}, ${object.id}`);
            continue;
          }
          exclusiveOwners.set(edgeId, object.id);
        }
        if (edgeRef.emit === false || edge.removed) continue;
        const operation = normalizeOperation(edge.operation, normalizeOperation(object.operation, fallbackOperation));
        if (operation === "ignore") continue;
        const transformKey = transform.map((value) => Number(value).toFixed(9)).join(",");
        const lineage = edge.lineage || {};
        const sourceInterval = lineage.sourceInterval || [0, 1];
        const emissionKey = [
          lineage.canonicalEdgeLineageId || edgeId,
          sourceInterval.map((value) => Number(value).toFixed(9)).join(":"),
          transformKey,
          operation,
        ].join("|");
        if (emissionKeys.has(emissionKey)) {
          warnings.push(`duplicate emission suppressed for edge ${edgeId}`);
          continue;
        }
        emissionKeys.add(emissionKey);
        if (!designToSource) continue;
        const points = (edge.points || []).map((point) => {
          const designPoint = affinePoint(sourceToDesign, point);
          const transformedDesignPoint = affinePoint(transform, designPoint);
          return affinePoint(designToSource, transformedDesignPoint);
        });
        if (points.length < 2) continue;
        const legacyPathId = String(lineage.legacyPathId || "");
        const identityLegacy = legacyPathId && identityAffine(transform) && object.createdBy === "v1-migration";
        const fragments = clipPolylineOutsidePolygons(points, Boolean(edge.closed), masksByTarget.get(String(object.id || "")) || []);
        fragments.forEach((fragment, fragmentIndex) => {
          const fragmentEmissionKey = fragment.masked
            ? `${emissionKey}|mask:${fragmentIndex + 1}`
            : emissionKey;
          vectorPaths.push({
            ...(cloneJson(edge.pathData) || {}),
            id: identityLegacy && !fragment.masked && fragments.length === 1 && fragment.closed === Boolean(edge.closed)
              ? legacyPathId
              : `${edgeId}@${object.id}${fragments.length > 1 ? `:mask${fragmentIndex + 1}` : ""}`,
            points: fragment.points,
            closed: Boolean(fragment.closed),
            operation,
            removed: false,
            locked: Boolean(object.locked || edge.pathData?.locked),
            deformable: object.deformable !== false && edge.pathData?.deformable !== false,
            edgeId,
            objectId: object.id,
            provenance: {
              objectId: object.id,
              edgeId,
              graphRevision: revision,
              canonicalEdgeLineageId: lineage.canonicalEdgeLineageId || edgeId,
              sourceInterval: cloneJson(sourceInterval),
              emissionKey: fragmentEmissionKey,
              occlusionMaskApplied: Boolean(fragment.masked),
            },
          });
        });
      }
    }
    return { vectorPaths, errors, warnings, graphRevision: revision, objectTransformRevision: Number(model.objectTransformRevision) || 0 };
  }

  function normalizeRect(rect) {
    const x1 = Number(rect?.minX ?? rect?.x1 ?? 0);
    const y1 = Number(rect?.minY ?? rect?.y1 ?? 0);
    const x2 = Number(rect?.maxX ?? rect?.x2 ?? 0);
    const y2 = Number(rect?.maxY ?? rect?.y2 ?? 0);
    return { minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) };
  }

  function pointInRect(point, rect, epsilon = 1e-8) {
    return Number(point[0]) >= rect.minX - epsilon && Number(point[0]) <= rect.maxX + epsilon && Number(point[1]) >= rect.minY - epsilon && Number(point[1]) <= rect.maxY + epsilon;
  }

  function edgeIdsInRect(model, inputRect) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const rect = normalizeRect(inputRect);
    const edgeIds = [];
    const completeEdgeIds = [];
    const crossingEdgeIds = [];
    for (const edge of model.vectorGraph?.edges || []) {
      if (!edge || edge.removed || !Array.isArray(edge.points) || edge.points.length < 2) continue;
      const fragments = splitPolylineByRect(edge.points, Boolean(edge.closed), rect);
      const hasInside = fragments.some((fragment) => fragment.inside);
      if (!hasInside) continue;
      const hasOutside = fragments.some((fragment) => !fragment.inside);
      edgeIds.push(String(edge.id));
      if (hasOutside) crossingEdgeIds.push(String(edge.id));
      else completeEdgeIds.push(String(edge.id));
    }
    return { edgeIds, completeEdgeIds, crossingEdgeIds };
  }

  function polylineIntersectsRect(points, closed, inputRect) {
    if (!Array.isArray(points) || points.length < 2) return false;
    const rect = normalizeRect(inputRect);
    if (rect.maxX - rect.minX <= 1e-9 || rect.maxY - rect.minY <= 1e-9) return false;
    return splitPolylineByRect(points, Boolean(closed), rect).some((fragment) => fragment.inside);
  }

  function separateVectorModelByEdgeIds(model, selectedEdgeIds, options = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const next = cloneJson(model);
    const graph = next.vectorGraph || {};
    const revision = Math.max(0, Math.round(Number(graph.revision) || 0));
    if (options.graphRevision !== undefined && Number(options.graphRevision) !== revision) {
      throw new Error("vector graph revision changed; recalculate the proposal");
    }
    const selected = new Set((selectedEdgeIds || []).map(String));
    const edgeMap = new Map((graph.edges || []).map((edge) => [String(edge.id), edge]));
    const nodeMap = new Map((graph.nodes || []).map((node) => [String(node.id), node]));
    const requestedAttachmentPolicy = ["detached", "pinned", "shared-joint"].includes(options.attachmentPolicy)
      ? options.attachmentPolicy
      : "detached";
    const manufacturingPolicy = ["emit-underlay", "mask-underlay", "cut-at-boundary"].includes(options.manufacturingPolicy)
      ? options.manufacturingPolicy
      : "emit-underlay";
    for (const edgeId of selected) {
      if (!edgeMap.has(edgeId)) throw new Error(`vector object references missing edge ${edgeId}`);
    }
    if (!selected.size) throw new Error("selection contains no vector graph edge");

    const selectedRefs = [];
    const selectedRefIds = new Set();
    const selectedSourceOwnerIds = new Set();
    const addSelectedRef = (edgeRef) => {
      const edgeId = String(edgeRef?.edgeId || "");
      if (!edgeId || selectedRefIds.has(edgeId)) return;
      selectedRefIds.add(edgeId);
      selectedRefs.push({ ...(cloneJson(edgeRef) || {}), edgeId, ownership: "exclusive", emit: edgeRef?.emit !== false });
    };
    const retainedObjects = [];
    for (const object of next.vectorObjects || []) {
      const retainedRefs = [];
      for (const edgeRef of object.edgeRefs || []) {
        if (selected.has(String(edgeRef.edgeId))) {
          selectedSourceOwnerIds.add(String(object.id || ""));
          addSelectedRef(edgeRef);
        } else {
          retainedRefs.push(edgeRef);
        }
      }
      if (retainedRefs.length) retainedObjects.push({ ...object, edgeRefs: retainedRefs });
    }
    for (const edgeId of selected) {
      addSelectedRef({ edgeId, ownership: "exclusive", role: "stroke", emit: true });
    }

    const selectedEdges = [...selected].map((edgeId) => edgeMap.get(edgeId));
    const allPoints = selectedEdges.flatMap((edge) => edge.points || []);
    const bounds = pathBounds(allPoints);
    const centerSource = bounds ? [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2] : [0, 0];
    const sourceToDesign = next.sourceToDesign?.matrix || [1, 0, 0, 1, 0, 0];
    const centerDesign = affinePoint(sourceToDesign, centerSource);
    const operationCounts = new Map();
    for (const edge of selectedEdges) {
      const operation = normalizeOperation(edge.operation, options.fallbackOperation || "engrave_line");
      operationCounts.set(operation, (operationCounts.get(operation) || 0) + 1);
    }
    const operation = [...operationCounts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] || "engrave_line";
    const objectIdPrefix = `object:semantic:r${revision}:`;
    const usedObjectIds = new Set((next.vectorObjects || []).map((object) => String(object.id || "")));
    let objectSequence = 1;
    while (usedObjectIds.has(`${objectIdPrefix}${objectSequence}`)) objectSequence += 1;
    const objectId = `${objectIdPrefix}${objectSequence}`;
    const gateNodeIds = [...new Set((options.gateNodeIds || []).map(String))];
    const attachmentPolicy = gateNodeIds.length ? requestedAttachmentPolicy : "detached";
    const anchorSource = attachmentPolicy === "detached"
      ? centerSource
      : cloneJson(nodeMap.get(gateNodeIds[0])?.position || centerSource);
    const originDesign = affinePoint(sourceToDesign, anchorSource);
    const separatedObject = {
      id: objectId,
      name: String(options.name || `Kompakt motif ${(next.vectorObjects || []).filter((item) => item.createdBy === "structural-analysis-confirmed").length + 1}`),
      edgeRefs: selectedRefs,
      attachments: gateNodeIds.map((graphNodeId, index) => ({
        id: `attachment:${objectId}:${index + 1}`,
        graphNodeId,
        policy: attachmentPolicy,
        localAnchor: affinePoint(sourceToDesign, nodeMap.get(graphNodeId)?.position || anchorSource),
      })),
      attachmentPolicy,
      localFrame: { originSource: anchorSource, originDesign, centerSource, centerDesign },
      transform: [1, 0, 0, 1, 0, 0],
      transformComponents: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      transformRevision: 0,
      resizePolicy: "scale",
      locked: false,
      removed: false,
      deformable: true,
      operation,
      confidence: Math.max(0, Math.min(1, Number(options.confidence) || 0)),
      createdBy: String(options.createdBy || "structural-analysis-confirmed"),
      proposalId: String(options.proposalId || ""),
      manufacturingPolicy,
    };
    next.vectorObjects = retainedObjects.concat(separatedObject);
    const retainedAttachmentIds = new Set(
      retainedObjects.flatMap((object) => (object.attachments || []).map((attachment) => String(attachment.id || "")))
    );
    next.connections = (next.connections || []).filter((connection) => {
      const attachmentIds = (connection.attachmentIds || []).map(String).filter(Boolean);
      return !attachmentIds.length || attachmentIds.every((attachmentId) => retainedAttachmentIds.has(attachmentId));
    });
    if (gateNodeIds.length) {
      next.connections = next.connections.concat(gateNodeIds.map((graphNodeId, index) => ({
        id: `connection:${objectId}:${index + 1}`,
        attachmentIds: [separatedObject.attachments[index].id],
        graphNodeId,
        policy: attachmentPolicy,
        geometryPolicy: attachmentPolicy === "detached" ? "detached" : "shared-node",
        manufacturingPolicy,
      })));
    }
    const activeObjectIds = new Set(next.vectorObjects.map((object) => String(object.id || "")));
    next.occlusionMasks = (next.occlusionMasks || []).filter((mask) => {
      if (!activeObjectIds.has(String(mask.ownerObjectId || ""))) return false;
      mask.targetObjectIds = (mask.targetObjectIds || []).map(String).filter((targetId) => activeObjectIds.has(targetId));
      return mask.targetObjectIds.length > 0;
    });
    if (manufacturingPolicy === "mask-underlay") {
      const targetObjectIds = retainedObjects
        .map((object) => String(object.id || ""))
        .filter((objectIdValue) => selectedSourceOwnerIds.has(objectIdValue));
      const polygonSource = convexHull(allPoints);
      if (targetObjectIds.length && polygonSource.length >= 3) {
        const usedMaskIds = new Set(next.occlusionMasks.map((mask) => String(mask.id || "")));
        let maskIndex = 1;
        while (usedMaskIds.has(`mask:${objectId}:${maskIndex}`)) maskIndex += 1;
        next.occlusionMasks.push({
          id: `mask:${objectId}:${maskIndex}`,
          mode: "mask-underlay",
          ownerObjectId: objectId,
          targetObjectIds,
          polygonSource,
          graphRevision: revision,
          createdBy: "semantic-object-hull",
        });
      }
    }
    next.objectTransformRevision = Math.max(0, Math.round(Number(next.objectTransformRevision) || 0)) + 1;
    next.vectorPathsDerivedFromRevision = 0;
    return {
      model: next,
      objectId,
      stats: {
        selectedEdges: selected.size,
        completeEdges: selected.size,
        crossingEdges: Number(options.crossingEdges) || 0,
        hiddenFragments: 0,
        gateCount: gateNodeIds.length,
        confidence: separatedObject.confidence,
      },
    };
  }

  function segmentRectBreaks(start, end, rect) {
    const ax = Number(start[0]);
    const ay = Number(start[1]);
    const dx = Number(end[0]) - ax;
    const dy = Number(end[1]) - ay;
    const breaks = [0, 1];
    if (Math.abs(dx) > 1e-12) {
      for (const x of [rect.minX, rect.maxX]) {
        const t = (x - ax) / dx;
        const y = ay + dy * t;
        if (t > 1e-9 && t < 1 - 1e-9 && y >= rect.minY - 1e-8 && y <= rect.maxY + 1e-8) breaks.push(t);
      }
    }
    if (Math.abs(dy) > 1e-12) {
      for (const y of [rect.minY, rect.maxY]) {
        const t = (y - ay) / dy;
        const x = ax + dx * t;
        if (t > 1e-9 && t < 1 - 1e-9 && x >= rect.minX - 1e-8 && x <= rect.maxX + 1e-8) breaks.push(t);
      }
    }
    return [...new Set(breaks.map((value) => Number(value.toFixed(12))))].sort((first, second) => first - second);
  }

  function splitPolylineByRect(points, closed, inputRect) {
    const rect = normalizeRect(inputRect);
    const source = (points || []).map((point) => [Number(point[0]), Number(point[1])]);
    if (source.length < 2 || rect.maxX - rect.minX <= 1e-9 || rect.maxY - rect.minY <= 1e-9) return [];
    const segmentCount = closed ? source.length : source.length - 1;
    const segmentLengths = [];
    let totalLength = 0;
    for (let index = 0; index < segmentCount; index += 1) {
      const length = pointDistance(source[index], source[(index + 1) % source.length]);
      segmentLengths.push(length);
      totalLength += length;
    }
    if (totalLength <= 1e-12) return [];
    const fragments = [];
    let current = null;
    let walked = 0;
    const appendFragmentPiece = (inside, start, end, t0, t1) => {
      if (!current || current.inside !== inside || pointDistance(current.points[current.points.length - 1], start) > 1e-7) {
        current = { inside, points: [start, end], tRange: [t0, t1], closed: false };
        fragments.push(current);
      } else {
        if (pointDistance(current.points[current.points.length - 1], end) > 1e-9) current.points.push(end);
        current.tRange[1] = t1;
      }
    };
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const start = source[segmentIndex];
      const end = source[(segmentIndex + 1) % source.length];
      const segmentLength = segmentLengths[segmentIndex];
      if (segmentLength <= 1e-12) continue;
      const breaks = segmentRectBreaks(start, end, rect);
      for (let index = 1; index < breaks.length; index += 1) {
        const localStart = breaks[index - 1];
        const localEnd = breaks[index];
        const midpoint = interpolatePoint(start, end, (localStart + localEnd) / 2);
        appendFragmentPiece(
          pointInRect(midpoint, rect),
          interpolatePoint(start, end, localStart),
          interpolatePoint(start, end, localEnd),
          (walked + segmentLength * localStart) / totalLength,
          (walked + segmentLength * localEnd) / totalLength,
        );
      }
      walked += segmentLength;
    }
    if (fragments.length === 1) fragments[0].closed = Boolean(closed);
    return fragments.filter((fragment) => fragment.points.length >= 2 && polylineLength(fragment.points, false) > 1e-8);
  }

  function mapSourceInterval(parentInterval, childRange) {
    const start = Number(parentInterval?.[0]) || 0;
    const end = Number(parentInterval?.[1]) || 1;
    return [start + (end - start) * Number(childRange[0]), start + (end - start) * Number(childRange[1])];
  }

  function separateVectorModelByRect(model, inputRect, options = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const next = cloneJson(model);
    const graph = next.vectorGraph || { revision: 0, nodes: [], edges: [] };
    const rect = normalizeRect(inputRect);
    if (rect.maxX - rect.minX <= 1e-6 || rect.maxY - rect.minY <= 1e-6) throw new Error("selection rectangle is too small");
    const policy = ["emit-underlay", "mask-underlay", "cut-at-boundary", "include-crossing"].includes(options.policy)
      ? options.policy
      : "emit-underlay";
    const nextRevision = Math.max(0, Math.round(Number(graph.revision) || 0)) + 1;
    const objectByEdge = new Map();
    for (const object of next.vectorObjects || []) {
      if (object.removed) continue;
      for (const edgeRef of object.edgeRefs || []) {
        if (edgeRef.ownership !== "exclusive") continue;
        if (objectByEdge.has(edgeRef.edgeId) && objectByEdge.get(edgeRef.edgeId).object.id !== object.id) {
          throw new Error(`edge ${edgeRef.edgeId} has multiple exclusive owners`);
        }
        objectByEdge.set(edgeRef.edgeId, { object, edgeRef });
      }
    }
    const sourceToDesign = next.sourceToDesign?.matrix || [1, 0, 0, 1, 0, 0];
    const selectedRefs = [];
    const selectedSourceOwnerIds = new Set();
    const splitConnections = [];
    const replacementEdges = [];
    const removedEdgeIds = new Set();
    const nodes = graph.nodes || (graph.nodes = []);
    const nodeFor = endpointNodeBuilder(nodes, options.nodeTolerance, `node-r${nextRevision}`);
    let insideCount = 0;
    let crossingCount = 0;
    let hiddenFragmentCount = 0;

    const removeRef = (object, edgeId) => {
      object.edgeRefs = (object.edgeRefs || []).filter((edgeRef) => edgeRef.edgeId !== edgeId);
    };
    const addRef = (object, edgeId, sourceRef, emit = true, role = sourceRef?.role || "stroke") => {
      object.edgeRefs.push({ ...(cloneJson(sourceRef) || {}), edgeId, emit, role });
    };

    for (const edge of [...(graph.edges || [])]) {
      const ownerEntry = objectByEdge.get(edge.id);
      if (!ownerEntry || ownerEntry.object.removed || !identityAffine(ownerEntry.object.transform)) continue;
      const fragments = splitPolylineByRect(edge.points || [], Boolean(edge.closed), rect);
      if (!fragments.length) continue;
      const inside = fragments.filter((fragment) => fragment.inside);
      const outside = fragments.filter((fragment) => !fragment.inside);
      if (inside.length && !outside.length) {
        removeRef(ownerEntry.object, edge.id);
        selectedSourceOwnerIds.add(String(ownerEntry.object.id || ""));
        selectedRefs.push({ ...(cloneJson(ownerEntry.edgeRef) || {}), edgeId: edge.id, ownership: "exclusive", emit: true });
        insideCount += 1;
        continue;
      }
      if (!inside.length || !outside.length) continue;
      crossingCount += 1;
      if (policy === "emit-underlay" || policy === "mask-underlay") continue;
      removedEdgeIds.add(edge.id);
      removeRef(ownerEntry.object, edge.id);
      fragments.forEach((fragment, fragmentIndex) => {
        const edgeId = `${edge.id}:r${nextRevision}:${fragmentIndex + 1}`;
        const points = fragment.points.map((point) => [Number(point[0]), Number(point[1])]);
        const child = {
          ...cloneJson(edge),
          id: edgeId,
          startNodeId: nodeFor(points[0]),
          endNodeId: nodeFor(points[points.length - 1]),
          points,
          closed: Boolean(fragment.closed),
          lengthSource: polylineLength(points, Boolean(fragment.closed)),
          lineage: {
            ...(cloneJson(edge.lineage) || {}),
            parentEdgeId: edge.id,
            sourceInterval: mapSourceInterval(edge.lineage?.sourceInterval || [0, 1], fragment.tRange),
          },
        };
        replacementEdges.push(child);
        if (fragment.inside && policy === "include-crossing") {
          selectedSourceOwnerIds.add(String(ownerEntry.object.id || ""));
          selectedRefs.push({ ...(cloneJson(ownerEntry.edgeRef) || {}), edgeId, ownership: "exclusive", emit: true });
          insideCount += 1;
        } else {
          const emit = !fragment.inside;
          addRef(ownerEntry.object, edgeId, ownerEntry.edgeRef, emit, fragment.inside ? "underlay-hidden" : ownerEntry.edgeRef.role);
          if (!emit) hiddenFragmentCount += 1;
        }
        if (fragmentIndex > 0) {
          splitConnections.push({
            id: `connection-r${nextRevision}-${splitConnections.length + 1}`,
            graphNodeId: child.startNodeId,
            policy: "detached",
            geometryPolicy: "boundary-split",
            manufacturingPolicy: policy,
          });
        }
      });
    }

    if (!selectedRefs.length) throw new Error("selection contains no complete vector object");
    graph.edges = (graph.edges || []).filter((edge) => !removedEdgeIds.has(edge.id)).concat(replacementEdges);
    graph.revision = nextRevision;
    const centerSource = [(rect.minX + rect.maxX) / 2, (rect.minY + rect.maxY) / 2];
    const originDesign = affinePoint(sourceToDesign, centerSource);
    const operationCounts = new Map();
    const edgeMap = new Map(graph.edges.map((edge) => [edge.id, edge]));
    for (const ref of selectedRefs) {
      const operation = normalizeOperation(edgeMap.get(ref.edgeId)?.operation, options.fallbackOperation || "engrave_line");
      operationCounts.set(operation, (operationCounts.get(operation) || 0) + 1);
    }
    const operation = [...operationCounts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] || "engrave_line";
    const objectId = `object:separated:r${nextRevision}:${(next.vectorObjects || []).length + 1}`;
    const separatedObject = {
      id: objectId,
      name: String(options.name || `Ayrilan nesne ${(next.vectorObjects || []).filter((item) => item.createdBy === "user-rectangle-separation").length + 1}`),
      edgeRefs: selectedRefs,
      attachments: [],
      localFrame: { originDesign },
      transform: [1, 0, 0, 1, 0, 0],
      transformComponents: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      transformRevision: 0,
      resizePolicy: "scale",
      locked: false,
      removed: false,
      deformable: true,
      operation,
      confidence: 1,
      createdBy: "user-rectangle-separation",
      separationPolicy: policy,
      manufacturingPolicy: policy,
      selectionRectSource: rect,
    };
    next.vectorObjects = (next.vectorObjects || []).filter((object) => (object.edgeRefs || []).length > 0);
    next.vectorObjects.push(separatedObject);
    const activeObjectIds = new Set(next.vectorObjects.map((object) => String(object.id || "")));
    next.occlusionMasks = (next.occlusionMasks || []).filter((mask) => {
      if (!activeObjectIds.has(String(mask.ownerObjectId || ""))) return false;
      mask.targetObjectIds = (mask.targetObjectIds || []).map(String).filter((targetId) => activeObjectIds.has(targetId));
      return mask.targetObjectIds.length > 0;
    });
    if (policy === "mask-underlay") {
      const maskPoints = selectedRefs.flatMap((edgeRef) => edgeMap.get(String(edgeRef.edgeId))?.points || []);
      const polygonSource = convexHull(maskPoints);
      const targetObjectIds = next.vectorObjects
        .map((object) => String(object.id || ""))
        .filter((targetId) => targetId !== objectId && selectedSourceOwnerIds.has(targetId));
      if (polygonSource.length >= 3 && targetObjectIds.length) {
        next.occlusionMasks.push({
          id: `mask:${objectId}:1`,
          mode: "mask-underlay",
          ownerObjectId: objectId,
          targetObjectIds,
          polygonSource,
          graphRevision: nextRevision,
          createdBy: "rectangle-object-hull",
        });
      }
    }
    next.connections = (next.connections || []).concat(splitConnections);
    next.vectorPathsDerivedFromRevision = 0;
    refreshGraphNodeTypes(graph);
    return {
      model: next,
      objectId,
      stats: { selectedEdges: selectedRefs.length, completeEdges: insideCount, crossingEdges: crossingCount, hiddenFragments: hiddenFragmentCount },
    };
  }

  function updateVectorObjectTransform(model, objectId, updates = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const next = cloneJson(model);
    const object = (next.vectorObjects || []).find((item) => String(item.id) === String(objectId));
    if (!object) throw new Error(`vector object not found: ${objectId}`);
    if (object.locked && optionsHasTransformChange(updates)) throw new Error("locked vector object cannot be transformed");
    const previous = object.transformComponents || { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    const components = {
      translateX: Number(updates.translateX ?? previous.translateX) || 0,
      translateY: Number(updates.translateY ?? previous.translateY) || 0,
      scaleX: Math.max(0.01, Number(updates.scaleX ?? previous.scaleX) || 1),
      scaleY: Math.max(0.01, Number(updates.scaleY ?? previous.scaleY) || 1),
      rotation: Number(updates.rotation ?? previous.rotation) || 0,
    };
    const attachmentPolicy = ["detached", "pinned", "shared-joint"].includes(object.attachmentPolicy)
      ? object.attachmentPolicy
      : String(object.attachments?.[0]?.policy || "detached");
    if (attachmentPolicy === "pinned" || attachmentPolicy === "shared-joint") {
      if (Math.abs(components.translateX) > 1e-9 || Math.abs(components.translateY) > 1e-9) {
        throw new Error("pinned vector object cannot translate; detach it before moving");
      }
    }
    if (attachmentPolicy === "shared-joint" && (object.attachments || []).length > 1) {
      const changesSharedAnchors = Math.abs(components.scaleX - 1) > 1e-9
        || Math.abs(components.scaleY - 1) > 1e-9
        || Math.abs(components.rotation) > 1e-9;
      if (changesSharedAnchors) throw new Error("multiple shared joints overconstrain this transform; use pinned or detached");
    }
    object.transformComponents = components;
    object.transform = affineFromComponents(components, object.localFrame?.originDesign || [0, 0]);
    object.transformRevision = Math.max(0, Math.round(Number(object.transformRevision) || 0)) + 1;
    next.objectTransformRevision = Math.max(0, Math.round(Number(next.objectTransformRevision) || 0)) + 1;
    next.vectorPathsDerivedFromRevision = 0;
    return next;
  }

  function setVectorObjectAttachmentPolicy(model, objectId, policy) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const nextPolicy = ["detached", "pinned", "shared-joint"].includes(policy) ? policy : "detached";
    const next = cloneJson(model);
    const object = (next.vectorObjects || []).find((item) => String(item.id) === String(objectId));
    if (!object) throw new Error(`vector object not found: ${objectId}`);
    const attachments = object.attachments || [];
    if (nextPolicy !== "detached" && !attachments.length) throw new Error("this vector object has no graph gate to pin");
    const sourceToDesign = next.sourceToDesign?.matrix || [1, 0, 0, 1, 0, 0];
    const nodes = new Map((next.vectorGraph?.nodes || []).map((node) => [String(node.id), node]));
    const centerSource = cloneJson(object.localFrame?.centerSource || object.localFrame?.originSource || [0, 0]);
    const centerDesign = affinePoint(sourceToDesign, centerSource);
    const anchorSource = nextPolicy === "detached"
      ? centerSource
      : cloneJson(nodes.get(String(attachments[0].graphNodeId || ""))?.position || centerSource);
    const originDesign = affinePoint(sourceToDesign, anchorSource);
    object.attachmentPolicy = nextPolicy;
    object.localFrame = { ...(object.localFrame || {}), originSource: anchorSource, originDesign, centerSource, centerDesign };
    for (const attachment of attachments) attachment.policy = nextPolicy;
    const attachmentIds = new Set(attachments.map((attachment) => String(attachment.id || "")));
    for (const connection of next.connections || []) {
      if ((connection.attachmentIds || []).some((attachmentId) => attachmentIds.has(String(attachmentId)))) {
        connection.policy = nextPolicy;
        connection.geometryPolicy = nextPolicy === "detached" ? "detached" : "shared-node";
      }
    }
    object.transformComponents = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    object.transform = [1, 0, 0, 1, 0, 0];
    object.transformRevision = Math.max(0, Math.round(Number(object.transformRevision) || 0)) + 1;
    next.objectTransformRevision = Math.max(0, Math.round(Number(next.objectTransformRevision) || 0)) + 1;
    next.vectorPathsDerivedFromRevision = 0;
    return next;
  }

  function optionsHasTransformChange(updates) {
    return ["translateX", "translateY", "scaleX", "scaleY", "rotation"].some((key) => updates[key] !== undefined);
  }

  function reconcileVectorModel(model, vectorPaths) {
    if (!model || Number(model.vectorModelVersion) !== 2) return null;
    const next = cloneJson(model);
    const graph = next.vectorGraph || {};
    const edges = new Map((graph.edges || []).map((edge) => [String(edge.id), edge]));
    const objects = new Map((next.vectorObjects || []).map((object) => [String(object.id), object]));
    const sourceToDesign = next.sourceToDesign?.matrix || [1, 0, 0, 1, 0, 0];
    const designToSource = invertAffine(sourceToDesign);
    if (!designToSource) return null;
    const derivedCounts = new Map();
    for (const vectorPath of vectorPaths || []) {
      const edgeId = String(vectorPath.edgeId || vectorPath.provenance?.edgeId || "");
      const objectId = String(vectorPath.objectId || vectorPath.provenance?.objectId || "");
      const key = `${edgeId}|${objectId}`;
      derivedCounts.set(key, (derivedCounts.get(key) || 0) + 1);
    }
    let changed = false;
    for (const vectorPath of vectorPaths || []) {
      const edgeId = String(vectorPath.edgeId || vectorPath.provenance?.edgeId || "");
      const objectId = String(vectorPath.objectId || vectorPath.provenance?.objectId || "");
      const derivedKey = `${edgeId}|${objectId}`;
      if (vectorPath.provenance?.occlusionMaskApplied || (derivedCounts.get(derivedKey) || 0) > 1) continue;
      const edge = edges.get(edgeId);
      const object = objects.get(objectId);
      if (!edge || !object) return null;
      const inverseObject = invertAffine(object.transform || [1, 0, 0, 1, 0, 0]);
      if (!inverseObject) return null;
      const canonicalPoints = (vectorPath.points || []).map((point) => {
        const designPoint = affinePoint(sourceToDesign, point);
        return affinePoint(designToSource, affinePoint(inverseObject, designPoint));
      });
      const nextState = JSON.stringify({
        points: canonicalPoints,
        closed: Boolean(vectorPath.closed),
        operation: normalizeOperation(vectorPath.operation, edge.operation || object.operation),
        removed: Boolean(vectorPath.removed),
        pathData: pathDataFromVectorPath(vectorPath),
      });
      const oldState = JSON.stringify({
        points: edge.points,
        closed: Boolean(edge.closed),
        operation: normalizeOperation(edge.operation, object.operation),
        removed: Boolean(edge.removed),
        pathData: edge.pathData || {},
      });
      if (nextState === oldState) continue;
      edge.points = canonicalPoints;
      edge.closed = Boolean(vectorPath.closed);
      edge.operation = normalizeOperation(vectorPath.operation, edge.operation || object.operation);
      edge.removed = Boolean(vectorPath.removed);
      edge.pathData = pathDataFromVectorPath(vectorPath);
      edge.lengthSource = polylineLength(canonicalPoints, edge.closed);
      changed = true;
    }
    if (changed) {
      graph.revision = Math.max(0, Math.round(Number(graph.revision) || 0)) + 1;
      next.vectorPathsDerivedFromRevision = 0;
      refreshGraphNodeTypes(graph);
    }
    return { model: next, changed };
  }

  function translateVectorModelSelection(model, vectorPaths, sourceDelta = {}) {
    if (!model || Number(model.vectorModelVersion) !== 2) throw new Error("vector model v2 is required");
    const sourceDx = Number(sourceDelta.sourceDx ?? sourceDelta.dx ?? sourceDelta[0] ?? 0);
    const sourceDy = Number(sourceDelta.sourceDy ?? sourceDelta.dy ?? sourceDelta[1] ?? 0);
    if (!Number.isFinite(sourceDx) || !Number.isFinite(sourceDy)) throw new Error("vector translation is invalid");

    const next = cloneJson(model);
    const graph = next.vectorGraph || (next.vectorGraph = { revision: 1, nodes: [], edges: [] });
    const edges = new Map((graph.edges || []).map((edge) => [String(edge.id || ""), edge]));
    const objects = new Map((next.vectorObjects || []).map((object) => [String(object.id || ""), object]));
    const sourceToDesign = next.sourceToDesign?.matrix || [1, 0, 0, 1, 0, 0];
    const designToSource = invertAffine(sourceToDesign);
    if (!designToSource) throw new Error("sourceToDesign transform is singular or invalid");

    const selectedEmissions = new Map();
    for (const vectorPath of vectorPaths || []) {
      const edgeId = String(vectorPath?.edgeId || vectorPath?.provenance?.edgeId || "");
      const objectId = String(vectorPath?.objectId || vectorPath?.provenance?.objectId || "");
      if (!edgeId || !objectId) continue;
      selectedEmissions.set(`${edgeId}|${objectId}`, { edgeId, objectId, vectorPath });
    }
    if (!selectedEmissions.size || (Math.abs(sourceDx) <= 1e-12 && Math.abs(sourceDy) <= 1e-12)) {
      return { model: next, movedEdgeIds: [], detachedNodeCount: 0, lockedCount: 0 };
    }

    const emittedDesignDelta = affineVector(sourceToDesign, [sourceDx, sourceDy]);
    const edgeDeltas = new Map();
    let lockedCount = 0;
    for (const selection of selectedEmissions.values()) {
      const edge = edges.get(selection.edgeId);
      const object = objects.get(selection.objectId);
      if (!edge || !object) throw new Error(`vector selection references missing edge or object: ${selection.edgeId}`);
      if (edge.removed || object.removed || selection.vectorPath?.locked || object.locked || edge.pathData?.locked) {
        lockedCount += 1;
        continue;
      }
      const attachmentPolicy = ["detached", "pinned", "shared-joint"].includes(object.attachmentPolicy)
        ? object.attachmentPolicy
        : String(object.attachments?.[0]?.policy || "detached");
      if (attachmentPolicy === "pinned" || attachmentPolicy === "shared-joint") {
        throw new Error("pinned vector geometry cannot move; detach the semantic object first");
      }
      const inverseObject = invertAffine(object.transform || [1, 0, 0, 1, 0, 0]);
      if (!inverseObject) throw new Error(`invalid transform for object ${object.id || "?"}`);
      const canonicalDesignDelta = affineVector(inverseObject, emittedDesignDelta);
      const canonicalSourceDelta = affineVector(designToSource, canonicalDesignDelta);
      const previous = edgeDeltas.get(selection.edgeId);
      if (previous && pointDistance(previous, canonicalSourceDelta) > 1e-8) {
        throw new Error(`edge ${selection.edgeId} is emitted through incompatible transforms`);
      }
      edgeDeltas.set(selection.edgeId, canonicalSourceDelta);
    }
    if (!edgeDeltas.size) {
      return { model: next, movedEdgeIds: [], detachedNodeCount: 0, lockedCount };
    }

    const endpointRefs = new Map();
    const appendEndpoint = (nodeId, edge, field) => {
      const key = String(nodeId || "");
      if (!key) return;
      if (!endpointRefs.has(key)) endpointRefs.set(key, []);
      endpointRefs.get(key).push({ edge, field });
    };
    for (const edge of graph.edges || []) {
      if (!edge || edge.removed) continue;
      appendEndpoint(edge.startNodeId, edge, "startNodeId");
      appendEndpoint(edge.endNodeId, edge, "endNodeId");
    }

    for (const [edgeId, delta] of edgeDeltas) {
      const edge = edges.get(edgeId);
      edge.points = (edge.points || []).map((point) => [Number(point[0]) + delta[0], Number(point[1]) + delta[1]]);
      edge.lengthSource = polylineLength(edge.points, Boolean(edge.closed));
    }

    const usedNodeIds = new Set((graph.nodes || []).map((node) => String(node.id || "")));
    const nextNodeId = (base) => {
      let id = base;
      let suffix = 2;
      while (usedNodeIds.has(id)) id = `${base}-${suffix++}`;
      usedNodeIds.add(id);
      return id;
    };
    let detachedNodeCount = 0;
    for (const node of graph.nodes || []) {
      const refs = endpointRefs.get(String(node.id || "")) || [];
      const movedRefs = refs.filter((reference) => edgeDeltas.has(String(reference.edge.id || "")));
      if (!movedRefs.length) continue;
      const groups = new Map();
      for (const reference of movedRefs) {
        const delta = edgeDeltas.get(String(reference.edge.id || ""));
        const key = `${delta[0].toFixed(9)},${delta[1].toFixed(9)}`;
        if (!groups.has(key)) groups.set(key, { delta, refs: [] });
        groups.get(key).refs.push(reference);
      }
      if (movedRefs.length === refs.length && groups.size === 1) {
        const delta = groups.values().next().value.delta;
        node.position = [Number(node.position?.[0]) + delta[0], Number(node.position?.[1]) + delta[1]];
        continue;
      }
      for (const group of groups.values()) {
        const newNode = {
          ...cloneJson(node),
          id: nextNodeId(`${String(node.id || "node")}:moved-r${Math.max(1, Number(graph.revision) || 1) + 1}`),
          position: [Number(node.position?.[0]) + group.delta[0], Number(node.position?.[1]) + group.delta[1]],
        };
        graph.nodes.push(newNode);
        for (const reference of group.refs) reference.edge[reference.field] = newNode.id;
        detachedNodeCount += 1;
      }
    }

    graph.revision = Math.max(0, Math.round(Number(graph.revision) || 0)) + 1;
    next.objectProposals = [];
    next.repairProposals = [];
    next.vectorPathsDerivedFromRevision = 0;
    refreshGraphNodeTypes(graph);
    return { model: next, movedEdgeIds: [...edgeDeltas.keys()], detachedNodeCount, lockedCount };
  }

  return {
    appendOpenPathToVectorModel,
    anchorPointToVectorModel,
    affineFromComponents,
    affinePoint,
    affineVector,
    compileVectorObjects,
    edgeIdsInRect,
    fitOpenPolyline,
    invertAffine,
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
    simplifyOpenPolyline,
    splitPolylineByRect,
    smoothOpenPolyline,
    translateVectorModelSelection,
    updateVectorObjectTransform,
    widenPolylineRegion,
    widenVectorModelRegion,
  };
});
