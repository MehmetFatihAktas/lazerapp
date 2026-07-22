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
    const tileWidth = clamp(number(options.tileWidth, tile), 5, 240);
    const tileHeight = clamp(number(options.tileHeight, tile), 5, 80);
    const gap = clamp(number(options.gap, 3), 1, 20);
    const minPower = clamp(number(options.minPower, 20), 0, 100);
    const maxPower = clamp(number(options.maxPower, 100), 0, 100);
    const minFeed = Math.max(1, Math.round(number(options.minFeed, 300)));
    const maxFeed = Math.max(1, Math.round(number(options.maxFeed, 1500)));
    const labelWidth = clamp(number(options.labelWidth, 18), 10, 40);
    const labelHeight = clamp(number(options.labelHeight, 8), 5, 20);
    const errors = [];
    if (maxPower <= minPower) errors.push("Maksimum güç minimum güçten büyük olmalı.");
    if (maxFeed <= minFeed) errors.push("Maksimum hız minimum hızdan büyük olmalı.");
    const powers = series(minPower, maxPower, columns, true);
    const feeds = series(minFeed, maxFeed, rows, true);
    const gridWidth = columns * tileWidth + (columns - 1) * gap;
    const gridHeight = rows * tileHeight + (rows - 1) * gap;
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        cells.push({
          row,
          column,
          power: powers[column],
          feed: feeds[row],
          x: labelWidth + column * (tileWidth + gap),
          y: row * (tileHeight + gap),
          width: tileWidth,
          height: tileHeight,
        });
      }
    }
    return {
      errors,
      columns,
      rows,
      tile,
      tileWidth,
      tileHeight,
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

  function estimateTextFillSeconds(options = {}, builtResult = null) {
    const result = builtResult || build(options);
    if (result.errors?.length) return 0;
    const lineStep = clamp(number(options.lineStep, 0.12), 0.05, 1);
    const contentWidth = clamp(number(options.contentWidth, result.tileWidth - 6), 0.5, result.tileWidth);
    const contentHeight = clamp(number(options.contentHeight, result.tileHeight - 5), 0.5, result.tileHeight);
    const returnFeed = Math.max(1, number(options.returnFeed, 1200));
    const indexFeed = Math.max(1, number(options.indexFeed, 300));
    const settleSeconds = clamp(number(options.settleMs, 20), 0, 250) / 1000;
    const acceleration = Math.max(1, number(options.acceleration, 320));
    const rowCount = Math.max(1, Math.ceil(contentHeight / lineStep));
    let seconds = 0;
    for (const cell of result.cells) {
      const scanFeed = Math.max(1, number(cell.feed, result.feeds[0] || 1200));
      const velocity = scanFeed / 60;
      const overscan = 1.25 * velocity * velocity / (2 * acceleration) + 0.5;
      const envelopeWidth = contentWidth + 2 * overscan;
      seconds += rowCount * envelopeWidth * 60 / scanFeed;
      seconds += Math.max(0, rowCount - 1) * envelopeWidth * 60 / returnFeed;
      seconds += Math.max(0, rowCount - 1) * lineStep * 60 / indexFeed;
      seconds += rowCount * settleSeconds;
    }
    // Power/feed labels and travel between cells are short, but including a
    // small allowance keeps the preview estimate conservative.
    seconds += (result.columns + result.rows) * 1.5 + result.cells.length * 0.5;
    return Math.round(seconds * 1.08);
  }

  return { build, series, estimateTextFillSeconds };
});
