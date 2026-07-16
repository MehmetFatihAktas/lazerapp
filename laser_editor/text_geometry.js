(function initLaserTextGeometry(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LaserTextGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLaserTextGeometry() {
  "use strict";

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function activePointBounds(vectorPaths) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const vectorPath of vectorPaths || []) {
      if (vectorPath?.removed) continue;
      for (const point of vectorPath?.points || []) {
        const x = finite(point?.[0], NaN);
        const y = finite(point?.[1], NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
    return { minX, minY, maxX, maxY };
  }

  function normalizeVectorBounds(vectorPaths, options = {}) {
    const bounds = activePointBounds(vectorPaths);
    if (!bounds) {
      return {
        paths: (vectorPaths || []).map((path) => ({ ...path, points: (path?.points || []).map((point) => [...point]) })),
        sourceWidth: Math.max(0.5, finite(options.sourceWidth, 0.5)),
        sourceHeight: Math.max(0.5, finite(options.sourceHeight, 0.5)),
        changed: false,
        deltaX: 0,
        deltaY: 0,
        bounds: null,
      };
    }

    const contentWidth = Math.max(0.001, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(0.001, bounds.maxY - bounds.minY);
    const sourceWidth = Math.max(0.5, finite(options.sourceWidth, contentWidth), contentWidth);
    const sourceHeight = Math.max(0.5, finite(options.sourceHeight, contentHeight), contentHeight);
    const targetMinX = Math.max(0, (sourceWidth - contentWidth) / 2);
    const targetMinY = Math.max(0, (sourceHeight - contentHeight) / 2);
    const deltaX = targetMinX - bounds.minX;
    const deltaY = targetMinY - bounds.minY;
    const epsilon = Math.max(1e-7, Math.max(sourceWidth, sourceHeight) * 1e-9);
    const changed = Math.abs(deltaX) > epsilon || Math.abs(deltaY) > epsilon;
    const paths = (vectorPaths || []).map((vectorPath) => ({
      ...vectorPath,
      points: (vectorPath?.points || []).map((point) => [
        finite(point?.[0]) + deltaX,
        finite(point?.[1]) + deltaY,
      ]),
    }));

    return {
      paths,
      sourceWidth,
      sourceHeight,
      changed,
      deltaX,
      deltaY,
      bounds,
      normalizedBounds: {
        minX: bounds.minX + deltaX,
        minY: bounds.minY + deltaY,
        maxX: bounds.maxX + deltaX,
        maxY: bounds.maxY + deltaY,
      },
    };
  }

  return Object.freeze({
    activePointBounds,
    normalizeVectorBounds,
  });
});
