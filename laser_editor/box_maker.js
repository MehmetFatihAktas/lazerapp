(function initLaserBoxMaker(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LaserBoxMaker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLaserBoxMaker() {
  "use strict";

  const EPSILON = 0.0001;
  const EDGE_MODES = Object.freeze({ PLAIN: "plain", MALE: "male", FEMALE: "female" });

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
    const width = clamp(finite(value.width, 200), 20, 2000);
    const depth = clamp(finite(value.depth, 80), 20, 2000);
    const height = clamp(finite(value.height, 50), 15, 1000);
    const thickness = clamp(finite(value.thickness, 3), 0.5, 30);
    const fingerWidth = clamp(finite(value.fingerWidth, Math.max(8, thickness * 3)), thickness * 1.25, 100);
    const fit = clamp(finite(value.fit, 0.1), -1, 2);
    return {
      width,
      depth,
      height,
      thickness,
      fingerWidth,
      fit,
      closed: value.closed === true || value.type === "closed" || value.type === "lidded",
    };
  }

  function fingerCount(length, targetWidth, thickness) {
    const minimumSegment = Math.max(thickness * 1.25, 1);
    const desired = Math.max(minimumSegment, targetWidth);
    let count = Math.max(3, Math.round(length / desired));
    if (count % 2 === 0) count += 1;
    while (count > 3 && length / count < minimumSegment) count -= 2;
    return Math.max(3, count);
  }

  function pointAt(start, tangent, normal, distance, depth) {
    return [
      round(start[0] + tangent[0] * distance + normal[0] * depth),
      round(start[1] + tangent[1] * distance + normal[1] * depth),
    ];
  }

  function pushPoint(points, point) {
    const previous = points[points.length - 1];
    if (previous && Math.abs(previous[0] - point[0]) <= EPSILON && Math.abs(previous[1] - point[1]) <= EPSILON) return;
    points.push(point);
  }

  function edgeProfile(start, end, normal, mode, options) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) return { points: [start], count: 0, segmentWidth: 0 };
    const tangent = [dx / length, dy / length];
    if (mode === EDGE_MODES.PLAIN) {
      return { points: [[...start], [...end]], count: 0, segmentWidth: length };
    }

    const count = fingerCount(length, options.fingerWidth, options.thickness);
    const segmentWidth = length / count;
    const clearance = clamp(options.fit, -segmentWidth * 0.45, segmentWidth * 0.8);
    const depth = mode === EDGE_MODES.MALE ? options.thickness : -options.thickness;
    const points = [[...start]];
    let active = false;
    let activeDepth = 0;

    for (let boundary = 1; boundary < count; boundary += 1) {
      const nextActive = boundary % 2 === 1;
      const entering = nextActive && !active;
      let shift = 0;
      if (mode === EDGE_MODES.MALE) shift = entering ? clearance / 2 : -clearance / 2;
      else shift = entering ? -clearance / 2 : clearance / 2;
      const distance = clamp(boundary * segmentWidth + shift, 0, length);
      pushPoint(points, pointAt(start, tangent, normal, distance, activeDepth));
      active = nextActive;
      activeDepth = active ? depth : 0;
      pushPoint(points, pointAt(start, tangent, normal, distance, activeDepth));
    }

    pushPoint(points, pointAt(start, tangent, normal, length, 0));
    return { points, count, segmentWidth };
  }

  function edgePadding(mode, thickness) {
    return mode === EDGE_MODES.MALE ? thickness : 0;
  }

  function buildPanel(name, width, height, edges, options, role) {
    const leftPad = edgePadding(edges.left, options.thickness);
    const topPad = edgePadding(edges.top, options.thickness);
    const rightPad = edgePadding(edges.right, options.thickness);
    const bottomPad = edgePadding(edges.bottom, options.thickness);
    const x0 = leftPad;
    const y0 = topPad;
    const x1 = x0 + width;
    const y1 = y0 + height;
    const definitions = [
      ["top", [x0, y0], [x1, y0], [0, -1]],
      ["right", [x1, y0], [x1, y1], [1, 0]],
      ["bottom", [x1, y1], [x0, y1], [0, 1]],
      ["left", [x0, y1], [x0, y0], [-1, 0]],
    ];
    const points = [];
    const edgeInfo = {};
    for (const [key, start, end, normal] of definitions) {
      const profile = edgeProfile(start, end, normal, edges[key], options);
      for (const point of profile.points) pushPoint(points, point);
      edgeInfo[key] = {
        mode: edges[key],
        count: profile.count,
        segmentWidth: round(profile.segmentWidth),
        length: round(Math.hypot(end[0] - start[0], end[1] - start[1])),
      };
    }
    pushPoint(points, points[0]);
    return {
      name,
      role,
      sourceWidth: round(width + leftPad + rightPad),
      sourceHeight: round(height + topPad + bottomPad),
      baseWidth: round(width),
      baseHeight: round(height),
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
    const minimum = options.thickness * 4;
    if (options.width < minimum || options.depth < minimum || options.height < minimum) {
      errors.push(`Kutu ölçüleri malzeme kalınlığının en az 4 katı (${minimum.toFixed(1)} mm) olmalı.`);
    }
    const shortestEdge = Math.min(options.width, options.depth, options.height);
    const shortestSegment = shortestEdge / fingerCount(shortestEdge, options.fingerWidth, options.thickness);
    if (shortestSegment < options.thickness * 1.75) {
      warnings.push("Parmaklar malzeme kalınlığına göre dar. Parmak genişliğini artırmak daha sağlam bir birleşim verir.");
    }
    if (Math.abs(options.fit) > options.thickness * 0.35) {
      warnings.push("Geçme telafisi malzeme kalınlığına göre yüksek; önce küçük bir geçme testi kesin.");
    }
    return { errors, warnings };
  }

  function buildBox(value = {}) {
    const options = normalizeOptions(value);
    const validation = validateOptions(options);
    if (validation.errors.length) return { options, panels: [], ...validation };
    const M = EDGE_MODES.MALE;
    const F = EDGE_MODES.FEMALE;
    const P = EDGE_MODES.PLAIN;
    const wallTop = options.closed ? F : P;
    const panels = [
      buildPanel("Taban", options.width, options.depth, { top: M, right: M, bottom: M, left: M }, options, "bottom"),
      buildPanel("Ön panel", options.width, options.height, { top: wallTop, right: M, bottom: F, left: M }, options, "front"),
      buildPanel("Arka panel", options.width, options.height, { top: wallTop, right: M, bottom: F, left: M }, options, "back"),
      buildPanel("Sol panel", options.depth, options.height, { top: wallTop, right: F, bottom: F, left: F }, options, "left"),
      buildPanel("Sağ panel", options.depth, options.height, { top: wallTop, right: F, bottom: F, left: F }, options, "right"),
    ];
    if (options.closed) {
      panels.push(buildPanel("Kapak", options.width, options.depth, { top: M, right: M, bottom: M, left: M }, options, "lid"));
    }
    return {
      options,
      panels,
      errors: [],
      warnings: validation.warnings,
      stats: {
        panelCount: panels.length,
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
      items.push({ panel, x, y });
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
    normalizeOptions,
    fingerCount,
    edgeProfile,
    buildPanel,
    buildBox,
    layoutPanels,
    svgPath,
  });
});
