(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LaserVectorEdit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function pointDistance(a, b) {
    return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]));
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

  return {
    fitOpenPolyline,
    nearestPointOnPolyline,
    preparePolylineAnchors,
    repairPolylineArc,
    replacePolylineSection,
    simplifyOpenPolyline,
    smoothOpenPolyline,
  };
});
