(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LaserSelectionLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizedBounds(value = {}) {
    const minX = Number(value.minX);
    const minY = Number(value.minY);
    const maxX = Number(value.maxX);
    const maxY = Number(value.maxY);
    if (![minX, minY, maxX, maxY].every(Number.isFinite) || maxX < minX || maxY < minY) return null;
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function prepare(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
      id: String(item?.id ?? index),
      index,
      bounds: normalizedBounds(item?.bounds),
    })).filter((item) => item.bounds);
  }

  function overallBounds(items) {
    const prepared = prepare(items);
    if (!prepared.length) return null;
    const minX = Math.min(...prepared.map((item) => item.bounds.minX));
    const minY = Math.min(...prepared.map((item) => item.bounds.minY));
    const maxX = Math.max(...prepared.map((item) => item.bounds.maxX));
    const maxY = Math.max(...prepared.map((item) => item.bounds.maxY));
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function calculate(items, mode) {
    const prepared = prepare(items);
    if (prepared.length < 2) return [];
    const overall = overallBounds(prepared.map((item) => ({ id: item.id, bounds: item.bounds })));
    const deltas = new Map();
    if (mode === "distribute-h" || mode === "distribute-v") {
      const horizontal = mode === "distribute-h";
      const sorted = [...prepared].sort((first, second) => {
        const delta = horizontal
          ? first.bounds.minX - second.bounds.minX
          : first.bounds.minY - second.bounds.minY;
        return delta || first.index - second.index;
      });
      const span = horizontal ? overall.width : overall.height;
      const sizes = sorted.map((item) => horizontal ? item.bounds.width : item.bounds.height);
      const gap = (span - sizes.reduce((sum, size) => sum + size, 0)) / (sorted.length - 1);
      let cursor = horizontal ? overall.minX : overall.minY;
      sorted.forEach((item, index) => {
        const delta = cursor - (horizontal ? item.bounds.minX : item.bounds.minY);
        deltas.set(item.index, { dx: horizontal ? delta : 0, dy: horizontal ? 0 : delta });
        cursor += sizes[index] + gap;
      });
    } else {
      const centerX = (overall.minX + overall.maxX) / 2;
      const centerY = (overall.minY + overall.maxY) / 2;
      for (const item of prepared) {
        const bounds = item.bounds;
        let dx = 0;
        let dy = 0;
        if (mode === "left") dx = overall.minX - bounds.minX;
        else if (mode === "right") dx = overall.maxX - bounds.maxX;
        else if (mode === "hcenter") dx = centerX - (bounds.minX + bounds.maxX) / 2;
        else if (mode === "bottom") dy = overall.minY - bounds.minY;
        else if (mode === "top") dy = overall.maxY - bounds.maxY;
        else if (mode === "vcenter") dy = centerY - (bounds.minY + bounds.maxY) / 2;
        else return [];
        deltas.set(item.index, { dx, dy });
      }
    }
    return prepared.map((item) => ({ id: item.id, index: item.index, ...(deltas.get(item.index) || { dx: 0, dy: 0 }) }));
  }

  return { calculate, normalizedBounds, overallBounds };
});
