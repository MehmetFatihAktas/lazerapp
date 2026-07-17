(function initLaserBoxMaker(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LaserBoxMaker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLaserBoxMaker() {
  "use strict";

  const EPSILON = 0.000001;
  const EDGE_MODES = Object.freeze({ PLAIN: "plain", MALE: "male", FEMALE: "female" });
  const DIMENSION_MODES = Object.freeze({ OUTER: "outer", INNER: "inner" });

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits = 5) {
    const scale = 10 ** digits;
    return Math.round(value * scale) / scale;
  }

  function normalizeOptions(value = {}) {
    const width = Math.max(0, finite(value.width, 200));
    const depth = Math.max(0, finite(value.depth, 80));
    const height = Math.max(0, finite(value.height, 50));
    const thickness = clamp(finite(value.thickness, 3), 0.5, 30);
    const fingerWidth = clamp(finite(value.fingerWidth, Math.max(8, thickness * 3)), thickness * 1.25, 100);
    const clearance = clamp(finite(value.clearance, finite(value.fit, 0.05)), -1, 2);
    const kerf = clamp(finite(value.kerf, 0.12), 0, 1);
    const closed = value.closed === true || value.type === "closed" || value.type === "sealed";
    const dimensionMode = value.dimensionMode === DIMENSION_MODES.INNER
      ? DIMENSION_MODES.INNER
      : DIMENSION_MODES.OUTER;
    const verticalLayers = closed ? 2 : 1;
    const outer = dimensionMode === DIMENSION_MODES.INNER
      ? {
          width: width + thickness * 2,
          depth: depth + thickness * 2,
          height: height + thickness * verticalLayers,
        }
      : { width, depth, height };
    const inner = dimensionMode === DIMENSION_MODES.INNER
      ? { width, depth, height }
      : {
          width: width - thickness * 2,
          depth: depth - thickness * 2,
          height: height - thickness * verticalLayers,
        };
    return {
      width,
      depth,
      height,
      thickness,
      fingerWidth,
      clearance,
      fit: clearance,
      kerf,
      closed,
      type: closed ? "closed" : "open",
      dimensionMode,
      outer: Object.fromEntries(Object.entries(outer).map(([key, number]) => [key, round(number)])),
      inner: Object.fromEntries(Object.entries(inner).map(([key, number]) => [key, round(number)])),
    };
  }

  function fingerCount(length, targetWidth, thickness) {
    const minimumSegment = Math.max(thickness * 1.25, 1);
    const maximumCount = Math.max(3, Math.floor(length / minimumSegment));
    const uncappedMaximumOddCount = maximumCount % 2 === 1 ? maximumCount : maximumCount - 1;
    const maximumOddCount = Math.min(401, uncappedMaximumOddCount);
    const desiredCount = Math.max(3, Math.round(length / Math.max(minimumSegment, targetWidth)));
    const candidates = [];
    for (let count = 3; count <= Math.max(3, maximumOddCount); count += 2) candidates.push(count);
    if (!candidates.length) return 3;
    return candidates.reduce((best, count) => {
      const error = Math.abs(count - desiredCount);
      const bestError = Math.abs(best - desiredCount);
      return error < bestError ? count : best;
    }, candidates[0]);
  }

  function pointKey(point) {
    return `${round(point[0], 6)},${round(point[1], 6)}`;
  }

  function samePoint(a, b) {
    return Boolean(a && b)
      && Math.abs(a[0] - b[0]) <= EPSILON
      && Math.abs(a[1] - b[1]) <= EPSILON;
  }

  function pushPoint(points, point) {
    if (!samePoint(points[points.length - 1], point)) points.push([round(point[0]), round(point[1])]);
  }

  function normalizeEdgeSpec(value) {
    if (typeof value === "string") return { mode: value, startOffset: 0, endOffset: 0 };
    return {
      mode: Object.values(EDGE_MODES).includes(value?.mode) ? value.mode : EDGE_MODES.PLAIN,
      startOffset: Math.max(0, finite(value?.startOffset, 0)),
      endOffset: Math.max(0, finite(value?.endOffset, 0)),
    };
  }

  function edgeNotches(length, edgeValue, options) {
    const edge = normalizeEdgeSpec(edgeValue);
    const start = clamp(edge.startOffset, 0, length);
    const end = clamp(length - edge.endOffset, start, length);
    const activeLength = Math.max(0, end - start);
    if (edge.mode === EDGE_MODES.PLAIN || activeLength <= EPSILON) {
      return { intervals: [], count: 0, segmentWidth: activeLength, activeLength, start, end };
    }

    const thickness = Math.max(0.01, finite(options?.thickness, 3));
    const fingerWidth = Math.max(0.01, finite(options?.fingerWidth, thickness * 3));
    const clearance = finite(options?.clearance, finite(options?.fit, 0));
    const count = fingerCount(activeLength, fingerWidth, thickness);
    const segmentWidth = activeLength / count;
    const recessParity = edge.mode === EDGE_MODES.MALE ? 1 : 0;
    const lateralExpansion = clamp(clearance / 4, -segmentWidth * 0.2, segmentWidth * 0.2);
    const intervals = [];
    for (let index = recessParity; index < count; index += 2) {
      const intervalStart = clamp(start + index * segmentWidth - lateralExpansion, start, end);
      const intervalEnd = clamp(start + (index + 1) * segmentWidth + lateralExpansion, start, end);
      if (intervalEnd - intervalStart > EPSILON) intervals.push([round(intervalStart), round(intervalEnd)]);
    }
    return {
      intervals,
      count,
      segmentWidth: round(segmentWidth),
      activeLength: round(activeLength),
      start: round(start),
      end: round(end),
    };
  }

  function edgeProfile(start, end, normal, mode, options) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) return { points: [[...start]], count: 0, segmentWidth: 0 };
    const tangent = [dx / length, dy / length];
    const profile = edgeNotches(length, mode, options);
    const jointDepth = options.thickness + Math.max(0, options.clearance || options.fit || 0) / 2;
    const points = [[...start]];
    for (const [intervalStart, intervalEnd] of profile.intervals) {
      const outerStart = [start[0] + tangent[0] * intervalStart, start[1] + tangent[1] * intervalStart];
      const innerStart = [outerStart[0] - normal[0] * jointDepth, outerStart[1] - normal[1] * jointDepth];
      const outerEnd = [start[0] + tangent[0] * intervalEnd, start[1] + tangent[1] * intervalEnd];
      const innerEnd = [outerEnd[0] - normal[0] * jointDepth, outerEnd[1] - normal[1] * jointDepth];
      pushPoint(points, outerStart);
      pushPoint(points, innerStart);
      pushPoint(points, innerEnd);
      pushPoint(points, outerEnd);
    }
    pushPoint(points, end);
    return { points, count: profile.count, segmentWidth: profile.segmentWidth };
  }

  function uniqueSorted(values) {
    const sorted = [...values].map((value) => round(value)).sort((a, b) => a - b);
    const result = [];
    for (const value of sorted) {
      if (!result.length || Math.abs(result[result.length - 1] - value) > EPSILON) result.push(value);
    }
    return result;
  }

  function simplifyClosed(points) {
    const open = [...(points || [])];
    if (open.length > 1 && samePoint(open[0], open[open.length - 1])) open.pop();
    let changed = true;
    while (changed && open.length > 3) {
      changed = false;
      for (let index = 0; index < open.length; index += 1) {
        const previous = open[(index - 1 + open.length) % open.length];
        const current = open[index];
        const next = open[(index + 1) % open.length];
        const cross = (current[0] - previous[0]) * (next[1] - current[1])
          - (current[1] - previous[1]) * (next[0] - current[0]);
        if (Math.abs(cross) <= EPSILON) {
          open.splice(index, 1);
          changed = true;
          break;
        }
      }
    }
    if (open.length) open.push([...open[0]]);
    return open;
  }

  function signedArea(points) {
    let area = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      area += points[index][0] * points[index + 1][1] - points[index + 1][0] * points[index][1];
    }
    return area / 2;
  }

  function contourFromNotches(width, height, notches) {
    const xs = uniqueSorted([0, width, ...notches.flatMap((rect) => [rect.x0, rect.x1])]);
    const ys = uniqueSorted([0, height, ...notches.flatMap((rect) => [rect.y0, rect.y1])]);
    const rows = ys.length - 1;
    const columns = xs.length - 1;
    const filled = Array.from({ length: rows }, () => Array(columns).fill(false));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const centerX = (xs[column] + xs[column + 1]) / 2;
        const centerY = (ys[row] + ys[row + 1]) / 2;
        filled[row][column] = !notches.some((rect) => (
          centerX > rect.x0 - EPSILON && centerX < rect.x1 + EPSILON
          && centerY > rect.y0 - EPSILON && centerY < rect.y1 + EPSILON
        ));
      }
    }

    const edges = [];
    const addEdge = (start, end) => edges.push({ start, end, key: `${pointKey(start)}>${pointKey(end)}` });
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (!filled[row][column]) continue;
        const x0 = xs[column];
        const x1 = xs[column + 1];
        const y0 = ys[row];
        const y1 = ys[row + 1];
        if (row === 0 || !filled[row - 1][column]) addEdge([x0, y0], [x1, y0]);
        if (column === columns - 1 || !filled[row][column + 1]) addEdge([x1, y0], [x1, y1]);
        if (row === rows - 1 || !filled[row + 1][column]) addEdge([x1, y1], [x0, y1]);
        if (column === 0 || !filled[row][column - 1]) addEdge([x0, y1], [x0, y0]);
      }
    }

    const byStart = new Map();
    edges.forEach((edge, index) => {
      const key = pointKey(edge.start);
      if (!byStart.has(key)) byStart.set(key, []);
      byStart.get(key).push(index);
    });
    const unused = new Set(edges.map((_, index) => index));
    const loops = [];
    while (unused.size) {
      const firstIndex = unused.values().next().value;
      const first = edges[firstIndex];
      const loop = [[...first.start]];
      let currentIndex = firstIndex;
      let guard = edges.length + 2;
      while (guard-- > 0) {
        const edge = edges[currentIndex];
        unused.delete(currentIndex);
        pushPoint(loop, edge.end);
        if (samePoint(edge.end, loop[0])) break;
        const candidates = (byStart.get(pointKey(edge.end)) || []).filter((index) => unused.has(index));
        if (!candidates.length) break;
        currentIndex = candidates[0];
      }
      if (loop.length >= 4 && samePoint(loop[0], loop[loop.length - 1])) loops.push(simplifyClosed(loop));
    }
    if (!loops.length) return [];
    return loops.reduce((largest, loop) => (
      Math.abs(signedArea(loop)) > Math.abs(signedArea(largest)) ? loop : largest
    ), loops[0]);
  }

  function pathBounds(points) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  function buildPanel(name, width, height, edges, options, role) {
    const normalizedEdges = Object.fromEntries(
      ["top", "right", "bottom", "left"].map((key) => [key, normalizeEdgeSpec(edges[key])])
    );
    const jointDepth = options.thickness + Math.max(0, options.clearance) / 2;
    const definitions = {
      top: { length: width, toRect: ([start, end]) => ({ x0: start, x1: end, y0: 0, y1: jointDepth }) },
      right: { length: height, toRect: ([start, end]) => ({ x0: width - jointDepth, x1: width, y0: start, y1: end }) },
      bottom: { length: width, toRect: ([start, end]) => ({ x0: start, x1: end, y0: height - jointDepth, y1: height }) },
      left: { length: height, toRect: ([start, end]) => ({ x0: 0, x1: jointDepth, y0: start, y1: end }) },
    };
    const notches = [];
    const edgeInfo = {};
    for (const key of ["top", "right", "bottom", "left"]) {
      const definition = definitions[key];
      const profile = edgeNotches(definition.length, normalizedEdges[key], options);
      notches.push(...profile.intervals.map(definition.toRect));
      edgeInfo[key] = {
        mode: normalizedEdges[key].mode,
        count: profile.count,
        segmentWidth: profile.segmentWidth,
        length: round(definition.length),
        activeLength: profile.activeLength,
        startOffset: profile.start,
        endOffset: round(definition.length - profile.end),
        recessIntervals: profile.intervals,
      };
    }

    const nominalPoints = contourFromNotches(width, height, notches);
    const bounds = pathBounds(nominalPoints);
    const points = nominalPoints.map((point) => [round(point[0] - bounds.minX), round(point[1] - bounds.minY)]);
    const sourceWidth = round(bounds.maxX - bounds.minX);
    const sourceHeight = round(bounds.maxY - bounds.minY);
    return {
      name,
      role,
      sourceWidth,
      sourceHeight,
      baseWidth: round(width),
      baseHeight: round(height),
      finishedWidth: round(width),
      finishedHeight: round(height),
      kerfCompensated: false,
      productionKerf: options.kerf,
      kind: "box-panel",
      edges: edgeInfo,
      vectorPaths: [{
        id: `${role}-outer`,
        points,
        closed: true,
        removed: false,
        operation: "cut",
      }],
    };
  }

  function validateOptions(options) {
    const errors = [];
    const warnings = [];
    const { outer, inner, thickness } = options;
    const minimum = thickness * 4;
    if (outer.width < minimum || outer.depth < minimum || outer.height < minimum) {
      errors.push(`Bitmiş dış ölçüler malzeme kalınlığının en az 4 katı (${minimum.toFixed(1)} mm) olmalı.`);
    }
    if (inner.width <= 0 || inner.depth <= 0 || inner.height <= 0) {
      errors.push("Girilen ölçüler bu malzeme kalınlığıyla pozitif bir iç hacim bırakmıyor.");
    }
    if (outer.depth - thickness * 2 < thickness * 3) {
      errors.push("Derinlik, yan panelin alt ve üst geçmelerine yetecek kadar büyük değil.");
    }
    const shortestJoint = Math.min(outer.width, outer.depth - thickness * 2, outer.height);
    const shortestSegment = shortestJoint / fingerCount(shortestJoint, options.fingerWidth, thickness);
    if (shortestSegment < thickness * 1.75) {
      warnings.push("Parmaklar malzeme kalınlığına göre dar; daha sağlam bir birleşim için parmak hedefini artırın.");
    }
    if (Math.abs(options.clearance) > thickness * 0.2) {
      warnings.push("Geçme boşluğu yüksek. Tam kutudan önce küçük bir geçme testi kesin.");
    }
    if (options.kerf > thickness * 0.25) {
      warnings.push("Kerf değeri malzeme kalınlığına göre yüksek görünüyor; birimi ve ölçümü kontrol edin.");
    }
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }

  function edge(mode, startOffset = 0, endOffset = startOffset) {
    return { mode, startOffset, endOffset };
  }

  function buildBox(value = {}) {
    const options = normalizeOptions(value);
    const validation = validateOptions(options);
    if (validation.errors.length) return { options, panels: [], ...validation };
    const M = EDGE_MODES.MALE;
    const F = EDGE_MODES.FEMALE;
    const P = EDGE_MODES.PLAIN;
    const { width, depth, height } = options.outer;
    const t = options.thickness;
    const wallTop = options.closed ? M : P;
    const sideHorizontal = (mode) => edge(mode, t, t);
    const panels = [
      buildPanel("Taban", width, depth, {
        top: F,
        right: sideHorizontal(F),
        bottom: F,
        left: sideHorizontal(F),
      }, options, "bottom"),
      buildPanel("Ön panel", width, height, { top: wallTop, right: M, bottom: M, left: M }, options, "front"),
      buildPanel("Arka panel", width, height, { top: wallTop, right: M, bottom: M, left: M }, options, "back"),
      buildPanel("Sol panel", depth, height, {
        top: options.closed ? sideHorizontal(M) : P,
        right: F,
        bottom: sideHorizontal(M),
        left: F,
      }, options, "left"),
      buildPanel("Sağ panel", depth, height, {
        top: options.closed ? sideHorizontal(M) : P,
        right: F,
        bottom: sideHorizontal(M),
        left: F,
      }, options, "right"),
    ];
    if (options.closed) {
      panels.push(buildPanel("Üst panel", width, depth, {
        top: F,
        right: sideHorizontal(F),
        bottom: F,
        left: sideHorizontal(F),
      }, options, "top"));
    }
    return {
      options,
      panels,
      errors: [],
      warnings: validation.warnings,
      matingPairs: [
        { first: ["bottom", "top"], second: ["front", "bottom"], length: width },
        { first: ["bottom", "bottom"], second: ["back", "bottom"], length: width },
        { first: ["bottom", "left"], second: ["left", "bottom"], length: depth - t * 2 },
        { first: ["bottom", "right"], second: ["right", "bottom"], length: depth - t * 2 },
        { first: ["front", "left"], second: ["left", "right"], length: height },
        { first: ["front", "right"], second: ["right", "left"], length: height },
        { first: ["back", "left"], second: ["left", "left"], length: height },
        { first: ["back", "right"], second: ["right", "right"], length: height },
        ...(options.closed ? [
          { first: ["top", "top"], second: ["front", "top"], length: width },
          { first: ["top", "bottom"], second: ["back", "top"], length: width },
          { first: ["top", "left"], second: ["left", "top"], length: depth - t * 2 },
          { first: ["top", "right"], second: ["right", "top"], length: depth - t * 2 },
        ] : []),
      ],
      stats: {
        panelCount: panels.length,
        sheetArea: round(panels.reduce((sum, panel) => sum + panel.sourceWidth * panel.sourceHeight, 0), 2),
        totalCutLength: round(panels.reduce((sum, panel) => {
          const points = panel.vectorPaths[0].points;
          let length = 0;
          for (let index = 1; index < points.length; index += 1) {
            length += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
          }
          return sum + length;
        }, 0), 2),
      },
    };
  }

  function layoutPanels(panels, options = {}) {
    const gap = Math.max(1, finite(options.gap, 8));
    const widest = Math.max(1, ...(panels || []).map((panel) => panel.sourceWidth));
    const targetWidth = Math.max(widest, finite(options.targetWidth, widest * 2.25));
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    let maxX = 0;
    const items = [];
    for (const panel of panels || []) {
      if (x > 0 && x + panel.sourceWidth > targetWidth + EPSILON) {
        x = 0;
        y += rowHeight + gap;
        rowHeight = 0;
      }
      items.push({ panel, x, y, rotated: false });
      maxX = Math.max(maxX, x + panel.sourceWidth);
      rowHeight = Math.max(rowHeight, panel.sourceHeight);
      x += panel.sourceWidth + gap;
    }
    return { items, width: maxX, height: items.length ? y + rowHeight : 0 };
  }

  function svgPath(points) {
    return (points || []).map((point, index) => `${index ? "L" : "M"}${round(point[0], 3)} ${round(point[1], 3)}`).join(" ");
  }

  return Object.freeze({
    EDGE_MODES,
    DIMENSION_MODES,
    normalizeOptions,
    fingerCount,
    edgeNotches,
    edgeProfile,
    buildPanel,
    buildBox,
    layoutPanels,
    svgPath,
  });
});
