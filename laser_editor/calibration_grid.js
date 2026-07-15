(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LaserCalibrationGrid = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function series(min, max, count, round = false) {
    if (count <= 1) return [round ? Math.round(min) : min];
    return Array.from({ length: count }, (_, index) => {
      const value = min + (max - min) * index / (count - 1);
      return round ? Math.round(value) : value;
    });
  }

  function build(options = {}) {
    const columns = clamp(Math.round(number(options.columns, 5)), 2, 10);
    const rows = clamp(Math.round(number(options.rows, 5)), 2, 10);
    const tile = clamp(number(options.tile, 12), 5, 50);
    const gap = clamp(number(options.gap, 3), 1, 20);
    const minPower = clamp(Math.round(number(options.minPower, 200)), 0, 1000);
    const maxPower = clamp(Math.round(number(options.maxPower, 1000)), 0, 1000);
    const minFeed = Math.max(1, Math.round(number(options.minFeed, 300)));
    const maxFeed = Math.max(1, Math.round(number(options.maxFeed, 1500)));
    const labelWidth = clamp(number(options.labelWidth, 18), 10, 40);
    const labelHeight = clamp(number(options.labelHeight, 8), 5, 20);
    const errors = [];
    if (maxPower <= minPower) errors.push("Maksimum güç minimum güçten büyük olmalı.");
    if (maxFeed <= minFeed) errors.push("Maksimum hız minimum hızdan büyük olmalı.");
    const powers = series(minPower, maxPower, columns, true);
    const feeds = series(minFeed, maxFeed, rows, true);
    const gridWidth = columns * tile + (columns - 1) * gap;
    const gridHeight = rows * tile + (rows - 1) * gap;
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        cells.push({
          row,
          column,
          power: powers[column],
          feed: feeds[row],
          x: labelWidth + column * (tile + gap),
          y: row * (tile + gap),
          width: tile,
          height: tile,
        });
      }
    }
    return {
      errors,
      columns,
      rows,
      tile,
      gap,
      powers,
      feeds,
      cells,
      gridWidth,
      gridHeight,
      width: labelWidth + gridWidth,
      height: labelHeight + gridHeight,
      labelWidth,
      labelHeight,
    };
  }

  return { build, series };
});
